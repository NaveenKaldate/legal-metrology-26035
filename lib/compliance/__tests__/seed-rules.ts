import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let supabaseUrl = '';
let supabaseKey = '';

for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log('Seeding rule_sets into Supabase...');

  // 1. Seed Rule Sets
  const { data: rsData, error: rsError } = await supabase.from('rule_sets').upsert([
    {
      id: '11111111-1111-1111-1111-111111111111',
      standard: 'Legal Metrology General Rules',
      version: '2011',
      jurisdiction: 'INDIA',
      status: 'ACTIVE',
      description: 'Indian Legal Metrology (General) Rules 2011 for Non-Automatic Weighing Instruments',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      standard: 'OIML R-76',
      version: '2006',
      jurisdiction: 'INTERNATIONAL',
      status: 'ACTIVE',
      description: 'OIML R-76:2006 Non-Automatic Weighing Instruments International Standard',
    },
  ], { onConflict: 'standard,version,jurisdiction' }).select();

  if (rsError) {
    console.error('Error upserting rule_sets:', rsError.message);
  } else {
    console.log('Rule sets upserted successfully:', rsData?.length);
  }

  // 2. Seed Test Definitions
  const testDefsToInsert = [
    // Indian Rules (2011)
    { id: 'a1111111-0000-0000-0000-000000000001', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T01', name: 'Visual & Administrative Examination', description: 'Examine metrological markings, model approval details, serial numbers, Class, Min, Max, e, d, software/modules, and sealing marks.', clause: '8.3.2', category: 'ADMINISTRATIVE', sequence: 1, is_active: true },
    { id: 'a1111111-0000-0000-0000-000000000002', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T02', name: 'Zero-setting Accuracy Check', description: 'Evaluate zero-setting accuracy according to non-automatic, semi-automatic, or zero-tracking configuration.', clause: '4.5.2; A.4.2.3', category: 'METROLOGICAL', sequence: 2, is_active: true },
    { id: 'a1111111-0000-0000-0000-000000000003', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T03', name: 'Errors of Indication Test', description: 'Determine indication error across load range using direct observation or changeover-point method.', clause: '3.5.1; A.4.4-A.4.6', category: 'METROLOGICAL', sequence: 3, is_active: true },
    { id: 'a1111111-0000-0000-0000-000000000004', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T04', name: 'Repeatability Test', description: 'Determine repeatability from repeated weighings at identical load (Max - Min <= MPE).', clause: '3.6.1; A.4.10', category: 'METROLOGICAL', sequence: 4, is_active: true },
    { id: 'a1111111-0000-0000-0000-000000000005', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T05', name: 'Eccentric Loading Test', description: 'Evaluate instrument performance for loads applied at off-center receptor positions.', clause: '3.6.2; A.4.7', category: 'METROLOGICAL', sequence: 5, is_active: true },
    { id: 'a1111111-0000-0000-0000-000000000006', rule_set_id: '11111111-1111-1111-1111-111111111111', test_code: 'T06', name: 'Tare Accuracy Test', description: 'Evaluate tare operation and net indication accuracy where a tare device is present.', clause: '4.6.3; A.4.6.2', category: 'METROLOGICAL', sequence: 6, is_active: true },

    // OIML R-76 (2006)
    { id: 'b2222222-0000-0000-0000-000000000001', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T01', name: 'Visual & Administrative Examination', description: 'Examine metrological markings, inscriptions, Class, Min, Max, e, d, and control marks.', clause: '8.3.2', category: 'ADMINISTRATIVE', sequence: 1, is_active: true },
    { id: 'b2222222-0000-0000-0000-000000000002', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T02', name: 'Zero-setting Accuracy Check', description: 'Evaluate zero-setting error (E_0 = I_0 + 0.5e - delta_L - L_0).', clause: '4.5.2; A.4.2.3', category: 'METROLOGICAL', sequence: 2, is_active: true },
    { id: 'b2222222-0000-0000-0000-000000000003', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T03', name: 'Errors of Indication Test', description: 'Determine indication error using changeover-point method (P = I + 0.5e - delta_L, E = P - L).', clause: '3.5.1; A.4.4-A.4.6', category: 'METROLOGICAL', sequence: 3, is_active: true },
    { id: 'b2222222-0000-0000-0000-000000000004', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T04', name: 'Repeatability Test', description: 'Determine repeatability error from repeated weighings (Max - Min <= |MPE|).', clause: '3.6.1; A.4.10', category: 'METROLOGICAL', sequence: 4, is_active: true },
    { id: 'b2222222-0000-0000-0000-000000000005', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T05', name: 'Eccentric Loading Test', description: 'Evaluate off-center load performance at 1/3 Max (or 1/4 Max for >4 supports).', clause: '3.6.2; A.4.7', category: 'METROLOGICAL', sequence: 5, is_active: true },
    { id: 'b2222222-0000-0000-0000-000000000006', rule_set_id: '22222222-2222-2222-2222-222222222222', test_code: 'T06', name: 'Tare Accuracy Test', description: 'Evaluate tare balancing accuracy and net indication.', clause: '4.6.3; A.4.6.2', category: 'METROLOGICAL', sequence: 6, is_active: true },
  ];

  const { data: tdData, error: tdError } = await supabase.from('test_definitions').upsert(testDefsToInsert, { onConflict: 'rule_set_id,test_code' }).select();
  if (tdError) {
    console.error('Error upserting test_definitions:', tdError.message);
  } else {
    console.log('Test definitions upserted successfully:', tdData?.length);
  }

  // 3. Seed MPE Rules for OIML R-76 & Indian Rules
  const mpeRulesToInsert = [
    // OIML R-76 (2006)
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 0, upper_load_e: 500, mpe_multiplier: 0.5, mpe_unit: 'e', clause: 'OIML R-76:2006 Table 6' },
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 500, upper_load_e: 2000, mpe_multiplier: 1.0, mpe_unit: 'e', clause: 'OIML R-76:2006 Table 6' },
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 2000, upper_load_e: 10000, mpe_multiplier: 1.5, mpe_unit: 'e', clause: 'OIML R-76:2006 Table 6' },
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 0, upper_load_e: 500, mpe_multiplier: 1.0, mpe_unit: 'e', clause: 'OIML R-76:2006 Clause 3.5.2' },
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 500, upper_load_e: 2000, mpe_multiplier: 2.0, mpe_unit: 'e', clause: 'OIML R-76:2006 Clause 3.5.2' },
    { rule_set_id: '22222222-2222-2222-2222-222222222222', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 2000, upper_load_e: 10000, mpe_multiplier: 3.0, mpe_unit: 'e', clause: 'OIML R-76:2006 Clause 3.5.2' },

    // Indian Legal Metrology (2011)
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 0, upper_load_e: 500, mpe_multiplier: 0.5, mpe_unit: 'e', clause: 'Table 1, Rule 3.5.1' },
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 500, upper_load_e: 2000, mpe_multiplier: 1.0, mpe_unit: 'e', clause: 'Table 1, Rule 3.5.1' },
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'INITIAL', lower_load_e: 2000, upper_load_e: 10000, mpe_multiplier: 1.5, mpe_unit: 'e', clause: 'Table 1, Rule 3.5.1' },
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 0, upper_load_e: 500, mpe_multiplier: 1.0, mpe_unit: 'e', clause: 'Table 1 (In-Service), Rule 3.5.1' },
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 500, upper_load_e: 2000, mpe_multiplier: 2.0, mpe_unit: 'e', clause: 'Table 1 (In-Service), Rule 3.5.1' },
    { rule_set_id: '11111111-1111-1111-1111-111111111111', accuracy_class: 'Class III', control_stage: 'IN_SERVICE', lower_load_e: 2000, upper_load_e: 10000, mpe_multiplier: 3.0, mpe_unit: 'e', clause: 'Table 1 (In-Service), Rule 3.5.1' },
  ];

  const { data: mpeData, error: mpeErr } = await supabase.from('mpe_rules').insert(mpeRulesToInsert).select();
  if (mpeErr) {
    console.error('Error inserting mpe_rules:', mpeErr.message);
  } else {
    console.log('MPE rules inserted successfully:', mpeData?.length);
  }

  console.log('Seeding complete!');
}

seedDatabase().catch(console.error);

