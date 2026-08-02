// Server-side only. Uses the SERVICE ROLE key, which bypasses Row Level
// Security — that's required here (webhooks/sync jobs write to any user's
// row) but it must never be shipped to the browser.
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = { supabaseAdmin };
