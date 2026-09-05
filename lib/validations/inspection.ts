import { z } from 'zod';

export const TestResultSchema = z.enum(['PASS', 'FAIL', 'NOT_APPLICABLE', 'PENDING']);

export const InspectionTypeSchema = z.enum(['TYPE_EVALUATION', 'INITIAL', 'IN_SERVICE']);

export const InspectionDataSourceSchema = z.enum(['SIMULATED', 'FIELD']);

export const InspectionOverallResultSchema = z.enum(['PASS', 'FAIL', 'PENDING']);

export const InspectionTestInputSchema = z.object({
  test_definition_id: z.string().uuid().optional().nullable(),
  test_type: z.string().min(1, { message: 'Test code/type is required' }),
  test_sequence: z.number().optional().default(1),
  test_status: z.string().optional().default('PENDING'),
  test_load: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nullable().optional()
  ),
  reference_value: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nullable().optional()
  ),
  observed_value: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? null : Number(val)),
    z.number().nullable().optional()
  ),
  calculated_error: z.number().nullable().optional(),
  absolute_error: z.number().nullable().optional(),
  error: z.number().nullable().optional(),
  mpe: z.number().nullable().optional(),
  mpe_rule_id: z.string().uuid().optional().nullable(),
  calculation_method: z.string().optional().nullable(),
  calculation_details: z.record(z.string(), z.any()).optional().nullable(),
  result: TestResultSchema.default('PASS'),
  remarks: z.string().optional().default(''),
});

export type InspectionTestInput = z.infer<typeof InspectionTestInputSchema>;

export const InspectionFormSchema = z.object({
  instrument_id: z.string().uuid({ message: 'Valid instrument ID is required' }),
  rule_set_id: z.string().uuid({ message: 'Rule set selection is required' }),
  inspection_type: InspectionTypeSchema.default('INITIAL'),
  inspection_date: z.string().min(1, { message: 'Inspection date is required' }),
  data_source: InspectionDataSourceSchema.default('SIMULATED'),
  overall_result: InspectionOverallResultSchema.default('PENDING'),
  tests: z
    .array(InspectionTestInputSchema)
    .min(1, { message: 'At least one inspection test card is required' }),
});

export type InspectionFormInput = z.infer<typeof InspectionFormSchema>;
