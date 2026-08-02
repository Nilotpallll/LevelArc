import assert from 'node:assert/strict';
import supabaseClientModule from '../public/js/supabaseClient.js';

const { resolveSupabaseConfig, isSupabaseConfigured } = supabaseClientModule;

assert.deepEqual(resolveSupabaseConfig({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'valid-key'
}), {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'valid-key',
  isConfigured: true,
});

assert.equal(isSupabaseConfigured({
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
}), false);

console.log('Supabase config guard test passed');
