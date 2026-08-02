// GET /api/leetcode-stats?username=<leetcode_handle>&userId=<supabase_uuid>
//
// LeetCode has no official public API. This calls their public GraphQL
// endpoint (the same one leetcode.com's own site uses for profile pages).
// It's unofficial and can change or rate-limit without notice — this
// function is written to fail gracefully rather than break the dashboard.
const { supabaseAdmin } = require('./_supabaseAdmin');

const QUERY = `
  query userProfile($username: String!) {
    matchedUser(username: $username) {
      username
      submitStatsGlobal {
        acSubmissionNum { difficulty count }
      }
      profile { ranking }
    }
  }
`;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, userId } = req.query;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  try {
    const lcRes = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // LeetCode's endpoint expects a browser-like referer or it 403s.
        Referer: `https://leetcode.com/${username}/`,
      },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
    });

    if (!lcRes.ok) {
      throw new Error(`LeetCode responded ${lcRes.status}`);
    }

    const json = await lcRes.json();
    const user = json?.data?.matchedUser;

    if (!user) {
      return res.status(404).json({ error: `No LeetCode user found for "${username}"` });
    }

    const counts = Object.fromEntries(
      user.submitStatsGlobal.acSubmissionNum.map((d) => [d.difficulty.toLowerCase(), d.count])
    );

    const stats = {
      total_solved: counts.all || 0,
      easy_solved: counts.easy || 0,
      medium_solved: counts.medium || 0,
      hard_solved: counts.hard || 0,
      ranking: user.profile?.ranking ?? null,
      last_synced: new Date().toISOString(),
    };

    // Cache into Supabase so the dashboard has data even when LeetCode
    // is slow/unreachable, and so we're not hammering their endpoint.
    if (userId) {
      await supabaseAdmin.from('leetcode_stats').upsert({ user_id: userId, ...stats });
    }

    return res.status(200).json(stats);
  } catch (err) {
    console.error('leetcode-stats error:', err);
    return res.status(502).json({
      error: 'Could not reach LeetCode right now. Showing your last synced numbers instead.',
    });
  }
};
