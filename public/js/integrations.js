// =====================================================================
// INTEGRATIONS — pulls live stats from LeetCode + GitHub through our
// serverless proxies (api/leetcode-stats.js, api/github-stats.js),
// which also cache the result into Supabase.
// =====================================================================

async function syncLeetCode() {
  if (!currentProfile?.leetcode_username) {
    showToast('Add your LeetCode username in Settings first');
    return null;
  }
  try {
    const res = await fetch(
      `/api/leetcode-stats?username=${encodeURIComponent(currentProfile.leetcode_username)}&userId=${currentUser.id}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`💻 LeetCode synced — ${data.total_solved} problems solved`);
    return data;
  } catch (err) {
    showToast(`⚠ ${err.message}`);
    return null;
  }
}

async function syncGitHub() {
  if (!currentProfile?.github_username) {
    showToast('Add your GitHub username in Settings first');
    return null;
  }
  try {
    const res = await fetch(
      `/api/github-stats?username=${encodeURIComponent(currentProfile.github_username)}&userId=${currentUser.id}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`🐙 GitHub synced — ${data.total_commits_year} commits this year`);
    return data;
  } catch (err) {
    showToast(`⚠ ${err.message}`);
    return null;
  }
}

async function syncAll() {
  showToast('🔄 Syncing your accounts…');
  const [lc, gh] = await Promise.all([syncLeetCode(), syncGitHub()]);
  await renderStatsFromDB();
  return { lc, gh };
}
