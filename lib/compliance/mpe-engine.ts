import { MpeRule, InspectionType } from '@/types/database';
import { MpeEvaluationResult } from './types';
import { D, isNumeric, loadInE, toNumber, formatDecimal, Decimal } from './decimal';

/**
 * Database-Driven MPE Engine
 *
 * Performs an exact load-range lookup (in multiples of e) for a given
 * accuracy class, control stage and test load.
 *
 * BAND SEMANTICS (OIML R-76 / Legal Metrology MPE tables)
 * ------------------------------------------------------
 * The published tables are half-open: the first band includes zero and each
 * later band EXCLUDES its lower limit, e.g. for Class III:
 *
 *      0   <= m <= 500e    -> 0.5e
 *    500e  <  m <= 2000e   -> 1.0e
 *   2000e  <  m <= 10000e  -> 1.5e
 *
 * Rows are stored as (lower_load_e, upper_load_e). A naive
 * `n >= lower && n <= upper` test matches TWO rows at exactly 500e, and the
 * winner then depends on whatever order the database happened to return -
 * i.e. the PASS/FAIL verdict becomes non-deterministic. That is why the
 * lower bound below is EXCLUSIVE except for the band that starts at zero.
 *
 * Determinism is enforced three ways:
 *   1. exclusive lower bound (no legitimate overlap),
 *   2. candidates sorted by lower_load_e before selection,
 *   3. if data still yields >1 match, we refuse to guess and report it.
 */

function pendingResult(
  stage: InspectionType | null | undefined,
  reason: string,
  code: MpeEvaluationResult['reasonCode']
): MpeEvaluationResult {
  return {
    mpeRule: null,
    mpeValue: null,
    mpeInE: null,
    mpeRuleId: null,
    clause: null,
    stage: stage || 'INITIAL',
    status: 'PENDING',
    reason,
    reasonCode: code,
  };
}

export function getApplicableMPE(
  ruleSetId: string | null | undefined,
  accuracyClass: string | null | undefined,
  controlStage: InspectionType | null | undefined,
  testLoad: number | null | undefined,
  verificationIntervalE: number | null | undefined,
  mpeRules: MpeRule[]
): MpeEvaluationResult {
  if (!ruleSetId) {
    return pendingResult(
      controlStage,
      'No rule set selected. Choose an active rule set in Step 1 before results can be calculated.',
      'MISSING_RULE_SET'
    );
  }

  if (!accuracyClass || accuracyClass.trim() === '') {
    return pendingResult(
      controlStage,
      'Accuracy class is missing on this instrument. Edit the instrument and set its accuracy class (Class I, II, III or IIII).',
      'MISSING_ACCURACY_CLASS'
    );
  }

  if (!isNumeric(verificationIntervalE) || D(verificationIntervalE).lte(0)) {
    return pendingResult(
      controlStage,
      'Verification interval e is missing or invalid. Edit the instrument and set e to a value greater than zero.',
      'INVALID_E'
    );
  }

  if (!isNumeric(testLoad)) {
    return pendingResult(
      controlStage,
      'Test load is missing. Enter the applied test load before a result can be calculated.',
      'MISSING_TEST_LOAD'
    );
  }

  const stage = controlStage || 'INITIAL';
  const e = D(verificationIntervalE);
  // Exact: 5.01 / 0.01 is 501, not 500.99999999999994
  const numberOfIntervals = loadInE(testLoad, e);

  const candidates = mpeRules
    .filter(
      (rule) =>
        rule.rule_set_id === ruleSetId &&
        rule.accuracy_class === accuracyClass &&
        rule.control_stage === stage
    )
    // Deterministic order regardless of how the database returned the rows.
    .sort((a, b) => D(a.lower_load_e).comparedTo(D(b.lower_load_e)));

  if (candidates.length === 0) {
    return pendingResult(
      stage,
      `No MPE rules are configured for ${accuracyClass} at the ${stage.replace('_', ' ')} control stage in the selected rule set. An administrator must add them before this stage can be used.`,
      'NO_RULES_FOR_STAGE'
    );
  }

  const matches = candidates.filter((rule) => {
    const lower = D(rule.lower_load_e);
    // The band starting at zero includes zero; every later band excludes
    // its lower limit so adjacent bands cannot both match.
    const lowerOk = lower.isZero()
      ? numberOfIntervals.gte(lower)
      : numberOfIntervals.gt(lower);

    const upperOk =
      rule.upper_load_e === null || rule.upper_load_e === undefined
        ? true // open-ended top band
        : numberOfIntervals.lte(D(rule.upper_load_e));

    return lowerOk && upperOk;
  });

  if (matches.length === 0) {
    const highest = candidates[candidates.length - 1];
    const ceiling =
      highest.upper_load_e === null || highest.upper_load_e === undefined
        ? null
        : D(highest.upper_load_e);

    const reason =
      ceiling && numberOfIntervals.gt(ceiling)
        ? `Test load ${formatDecimal(numberOfIntervals, 2)}e exceeds the highest configured MPE band (${formatDecimal(ceiling, 0)}e) for ${accuracyClass}. Check the test load, or ask an administrator to extend the MPE table.`
        : `No MPE band covers a load of ${formatDecimal(numberOfIntervals, 2)}e for ${accuracyClass} at the ${stage.replace('_', ' ')} stage. The configured bands may have a gap.`;

    return pendingResult(stage, reason, 'NO_APPLICABLE_RULE');
  }

  if (matches.length > 1) {
    // Overlapping or duplicated rule rows. Refuse to guess - guessing here is
    // exactly how a verdict becomes non-reproducible.
    const detail = matches
      .map(
        (m) =>
          `${formatDecimal(m.lower_load_e, 0)}-${
            m.upper_load_e === null || m.upper_load_e === undefined
              ? 'open'
              : formatDecimal(m.upper_load_e, 0)
          }e @ ${formatDecimal(m.mpe_multiplier, 2)}e`
      )
      .join(', ');

    return pendingResult(
      stage,
      `Ambiguous MPE configuration: ${matches.length} rules match a load of ${formatDecimal(numberOfIntervals, 2)}e for ${accuracyClass} (${detail}). Overlapping or duplicated rules must be corrected by an administrator before a result can be issued.`,
      'AMBIGUOUS_RULES'
    );
  }

  const matchingRule = matches[0];

  // Exact, unrounded MPE: multiplier x e
  const mpeValue: Decimal = D(matchingRule.mpe_multiplier).times(e);

  return {
    mpeRule: matchingRule,
    mpeValue: toNumber(mpeValue),
    mpeValueDecimal: mpeValue,
    mpeInE: matchingRule.mpe_multiplier,
    mpeRuleId: matchingRule.id,
    clause: matchingRule.clause || null,
    stage,
    status: 'SUCCESS',
    loadInE: toNumber(numberOfIntervals),
  };
}

/**
 * Backward-compatible helper wrapping getApplicableMPE.
 * Kept so existing callers/tests continue to work.
 */
export function evaluateMpe(
  mpeRules: MpeRule[],
  accuracyClass: string,
  controlStage: InspectionType,
  load: number | null,
  verificationIntervalE: number | null
): MpeEvaluationResult {
  const ruleSetId = mpeRules[0]?.rule_set_id || null;
  return getApplicableMPE(
    ruleSetId,
    accuracyClass,
    controlStage,
    load,
    verificationIntervalE,
    mpeRules
  );
}
