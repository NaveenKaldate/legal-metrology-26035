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

console.log('SUPABASE URL:', supabaseUrl);
console.log('SUPABASE KEY PRESENT:', Boolean(supabaseKey));

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log('\n1. Checking public.rule_sets table:');
  const { data: ruleSets, error: rsError } = await supabase
    .from('rule_sets')
    .select('*');

  if (rsError) {
    console.error('Error fetching rule_sets:', rsError.message);
  } else {
    console.log(`Found ${ruleSets?.length || 0} rule sets:`);
    console.log(JSON.stringify(ruleSets, null, 2));
  }

  console.log('\n2. Checking public.test_definitions table:');
  const { data: testDefs, error: tdError } = await supabase
    .from('test_definitions')
    .select('id, rule_set_id, test_code, name, clause');

  if (tdError) {
    console.error('Error fetching test_definitions:', tdError.message);
  } else {
    console.log(`Found ${testDefs?.length || 0} test definitions:`);
    console.log(JSON.stringify(testDefs, null, 2));
  }

  console.log('\n3. Checking public.mpe_rules table:');
  const { data: mpeRules, error: mpeError } = await supabase
    .from('mpe_rules')
    .select('id, rule_set_id, accuracy_class, lower_load_e, upper_load_e, mpe_multiplier');

  if (mpeError) {
    console.error('Error fetching mpe_rules:', mpeError.message);
  } else {
    console.log(`Found ${mpeRules?.length || 0} MPE rules.`);
  }
}

checkDatabase().catch(console.error);

