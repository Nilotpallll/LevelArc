// The Supabase ANON key is safe to ship in frontend code by design —
// it can only do what your Row Level Security policies (schema.sql) allow.
// Fill these two values in after you create your Supabase project.
// Project → Settings → API → Project URL / anon public key.

function resolveSupabaseConfig(env = {}) {
  const SUPABASE_URL = (env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (env.SUPABASE_ANON_KEY || '').trim();

  const isConfigured = Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR-PROJECT') &&
    !SUPABASE_ANON_KEY.includes('YOUR-ANON')
  );

  return { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured };
}

function isSupabaseConfigured(env = {}) {
  return resolveSupabaseConfig(env).isConfigured;
}

const defaultEnv = {
  SUPABASE_URL: 'https://gtvklcbkneboymyymkao.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dmtsY2JrbmVib3lteXlta2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODg5NTYsImV4cCI6MjEwMTI2NDk1Nn0.lD3TEDpSpR-ra-Ec_mDeYq8lmpEoznKWz0Wap91u0U8',
};

if (typeof window !== 'undefined') {
  window.__ENV__ = { ...defaultEnv, ...(window.__ENV__ || {}) };
}

const resolvedEnv = resolveSupabaseConfig(typeof window !== 'undefined' ? window.__ENV__ : defaultEnv);

if (typeof window !== 'undefined') {
  window.__ENV__ = { ...window.__ENV__, ...resolvedEnv };
}

// NOTE: deliberately NOT named `supabase` — the CDN script above already
// defines a global `window.supabase` object (the library itself, with
// .createClient on it). Naming our client instance the same thing causes
// "Cannot read properties of undefined (reading 'signUp')" style bugs
// depending on load order/caching. Every file in this project calls the
// client `supabaseClient`, matching Supabase's own docs convention.
const supabaseClient = resolvedEnv.isConfigured && typeof window !== 'undefined' && window.supabase
  ? window.supabase.createClient(resolvedEnv.SUPABASE_URL, resolvedEnv.SUPABASE_ANON_KEY)
  : null;

if (typeof window !== 'undefined') {
  window.supabaseClient = supabaseClient;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveSupabaseConfig, isSupabaseConfigured };
}

if (typeof globalThis !== 'undefined') {
  globalThis.resolveSupabaseConfig = resolveSupabaseConfig;
  globalThis.isSupabaseConfigured = isSupabaseConfigured;
}

if (typeof window !== 'undefined') {
  window.resolveSupabaseConfig = resolveSupabaseConfig;
  window.isSupabaseConfigured = isSupabaseConfigured;
}
