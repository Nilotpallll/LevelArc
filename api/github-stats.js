// GET /api/github-stats?username=<github_handle>&userId=<supabase_uuid>
//
// Public repo/follower counts come from the REST API (no token needed, but
// rate-limited to 60 req/hr per IP without one). Contribution-year commit
// count needs GraphQL + a token (GITHUB_TOKEN env var) since GitHub doesn't
// expose that on the public REST API. If no token is set, we skip that
// number gracefully instead of failing the whole sync.
const { supabaseAdmin } = require('./_supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, userId } = req.query;
  if (!username) return res.status(400).json({ error: 'Missing username' });

  try {
    const restRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {},
    });

    if (restRes.status === 404) {
      return res.status(404).json({ error: `No GitHub user found for "${username}"` });
    }
    if (!restRes.ok) throw new Error(`GitHub REST responded ${restRes.status}`);

    const user = await restRes.json();

    let totalCommitsYear = 0;
    if (process.env.GITHUB_TOKEN) {
      const since = new Date();
      since.setFullYear(since.getFullYear() - 1);
      const gqlRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `query($login:String!, $from:DateTime!){
            user(login:$login){
              contributionsCollection(from:$from){
                contributionCalendar { totalContributions }
              }
            }
          }`,
          variables: { login: username, from: since.toISOString() },
        }),
      });
      if (gqlRes.ok) {
        const gqlJson = await gqlRes.json();
        totalCommitsYear =
          gqlJson?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions || 0;
      }
    }

    const stats = {
      public_repos: user.public_repos || 0,
      followers: user.followers || 0,
      total_commits_year: totalCommitsYear,
      last_synced: new Date().toISOString(),
    };

    if (userId) {
      await supabaseAdmin.from('github_stats').upsert({ user_id: userId, ...stats });
    }

    return res.status(200).json(stats);
  } catch (err) {
    console.error('github-stats error:', err);
    return res.status(502).json({
      error: 'Could not reach GitHub right now. Showing your last synced numbers instead.',
    });
  }
};
