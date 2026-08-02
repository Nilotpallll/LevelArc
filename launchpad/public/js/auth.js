// =====================================================================
// AUTH — email/password via Supabase Auth. Session persists in the
// browser automatically (Supabase stores it in localStorage under the
// hood); we just react to sign-in/sign-out state.
// =====================================================================

let currentUser = null;
let currentProfile = null;

function ensureSupabaseReady() {
  if (!supabaseClient) {
    const message = 'Supabase is not configured yet. Add your project URL and anon key in public/js/supabaseClient.js before signing up.';
    const error = new Error(message);
    error.name = 'SupabaseConfigError';
    throw error;
  }
  return supabaseClient;
}

async function signUp({ email, password, fullName, college, year, leetcode, github }) {
  ensureSupabaseReady();
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;

  // The DB trigger (handle_new_user) already created a bare profile row.
  // Fill in the onboarding details the person just gave us.
  if (data.user) {
    await supabaseClient
      .from('profiles')
      .update({
        full_name: fullName,
        college,
        year_of_study: year,
        leetcode_username: leetcode || null,
        github_username: github || null,
      })
      .eq('id', data.user.id);
  }
  return data.user;
}

async function signIn({ email, password }) {
  ensureSupabaseReady();
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

async function loadCurrentSession() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  currentUser = session.user;
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  currentProfile = profile;
  return { user: currentUser, profile: currentProfile };
}

function readableAuthError(err) {
  const msg = err?.message || 'Something went wrong. Please try again.';
  if (msg.includes('Supabase is not configured yet')) return 'Supabase is not configured yet. Add your project URL and anon key before signup.';
  if (msg.includes('failed to fetch')) return 'Network request failed. Check your connection or Supabase configuration.';
  if (msg.includes('Invalid login')) return 'Incorrect email or password.';
  if (msg.includes('already registered')) return 'An account with this email already exists — try signing in.';
  if (msg.includes('Password')) return 'Password must be at least 6 characters.';
  return msg;
}
