// =====================================================================
// DASHBOARD — pulls the signed-in student's real rows from Supabase and
// renders them into the UI built in index.html. Replaces the old demo's
// hardcoded numbers and Math.random() heatmap with actual data.
// =====================================================================

async function renderStatsFromDB() {
  if (!currentUser) return;

  const [{ data: lc }, { data: gh }, { data: resume }, { data: dsa }, { data: subs }] = await Promise.all([
    supabaseClient.from('leetcode_stats').select('*').eq('user_id', currentUser.id).maybeSingle(),
    supabaseClient.from('github_stats').select('*').eq('user_id', currentUser.id).maybeSingle(),
    supabaseClient.from('resume_scores').select('*').eq('user_id', currentUser.id).maybeSingle(),
    supabaseClient.from('dsa_progress').select('*').eq('user_id', currentUser.id),
    supabaseClient.from('subscriptions').select('*').eq('user_id', currentUser.id).eq('status', 'active').maybeSingle(),
  ]);

  // --- Stat cards ---
  setStatCard('lcSolved', lc?.total_solved ?? 0);
  setStatCard('dsaCount', (dsa || []).length);
  setStatCard('ghCommits', gh?.total_commits_year ?? 0);
  document.getElementById('cgpaVal').textContent = currentProfile?.cgpa ?? '—';
  setStatCard('resumeScore', resume?.overall_score ?? 0);

  // --- DSA bars ---
  const dsaWrap = document.getElementById('dsaTopics');
  if (dsa && dsa.length) {
    dsaWrap.innerHTML = dsa
      .map(
        (t) => `
      <div class="dsa-topic">
        <div class="dsa-top-row"><span>${escapeHTML(t.topic)}</span><span>${t.percent}%</span></div>
        <div class="dsa-bar"><div class="dsa-fill" style="width:${t.percent}%;background:linear-gradient(90deg,var(--purple),var(--cyan))"></div></div>
      </div>`
      )
      .join('');
  } else {
    dsaWrap.innerHTML = `<div class="empty-state">No DSA topics tracked yet. Add your first topic in the DSA tab.</div>`;
  }

  // --- XP bar ---
  const xp = currentProfile?.xp ?? 0;
  const level = currentProfile?.level ?? 1;
  const xpForNextLevel = level * 500;
  const pct = Math.min(100, Math.round((xp / xpForNextLevel) * 100));
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpLevelText').textContent = `⚡ ${xp.toLocaleString('en-IN')} / ${xpForNextLevel.toLocaleString('en-IN')} XP to Level ${level + 1}`;
  document.getElementById('xpSubPct').textContent = `${pct}% complete`;
  document.getElementById('xpName').textContent = `${currentProfile?.full_name ?? 'Student'} · ${currentProfile?.year_of_study ?? ''}`;
  document.getElementById('xpStreak').textContent = `🔥 ${currentProfile?.streak_days ?? 0}-day streak`;

  // --- Subscription badge ---
  const planLabel = { starter: 'Starter', pro: 'Pro', placement_ready: 'Placement Ready' };
  document.getElementById('planBadge').textContent = subs ? `💎 ${planLabel[subs.plan]}` : '🆓 Free Plan';

  await loadHeatmap();
  await loadAITasks();
  await loadLeaderboard();
}

function setStatCard(id, value) {
  const el = document.getElementById(id);
  if (el) animateCounter(el, Number(value) || 0);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// HEATMAP — built from real activity_log rows, not random data.
// ---------------------------------------------------------------------
async function loadHeatmap() {
  const { data: rows } = await supabaseClient
    .from('activity_log')
    .select('activity_date, problems_solved')
    .eq('user_id', currentUser.id);

  const byDate = {};
  (rows || []).forEach((r) => { byDate[r.activity_date] = r.problems_solved; });

  const grid = document.getElementById('heatmap');
  grid.innerHTML = '';
  const today = new Date();
  for (let w = 23; w >= 0; w--) {
    const col = document.createElement('div');
    col.className = 'heatmap-col';
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const key = date.toISOString().slice(0, 10);
      const count = byDate[key] || 0;
      const cls = count === 0 ? 'h0' : count <= 2 ? 'h1' : count <= 4 ? 'h2' : count <= 7 ? 'h3' : 'h4';
      const cell = document.createElement('div');
      cell.className = `heatmap-cell ${cls}`;
      cell.title = `${date.toDateString()}: ${count} problem${count === 1 ? '' : 's'}`;
      cell.addEventListener('mouseenter', function () { showToast(`📅 ${this.title}`); });
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }
}

// ---------------------------------------------------------------------
// AI TASKS — real checklist stored per-user, toggled state persists.
// ---------------------------------------------------------------------
async function loadAITasks() {
  const { data: tasks } = await supabaseClient
    .from('ai_tasks')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });

  const wrap = document.getElementById('aiTasks');
  if (!tasks || !tasks.length) {
    wrap.innerHTML = `<div class="empty-state">No tasks yet — hit "Refresh" to generate this week's plan.</div>`;
    return;
  }
  const tagClass = { DSA: 'tag-dsa', LeetCode: 'tag-lc', GitHub: 'tag-git', Resume: 'tag-lc', Interview: 'tag-dsa' };
  wrap.innerHTML = tasks
    .map(
      (t) => `
    <div class="ai-task ${t.done ? 'done' : ''}" data-task-id="${t.id}" onclick="toggleTask(this)">
      <div class="ai-task-check">${t.done ? '✓' : ''}</div>
      <div class="ai-task-text">${escapeHTML(t.text)}</div>
      <span class="ai-task-tag ${tagClass[t.tag] || 'tag-dsa'}">${t.tag}</span>
    </div>`
    )
    .join('');
}

async function toggleTask(el) {
  const id = el.dataset.taskId;
  const willBeDone = !el.classList.contains('done');
  el.classList.toggle('done');
  el.querySelector('.ai-task-check').textContent = willBeDone ? '✓' : '';

  await supabaseClient.from('ai_tasks').update({ done: willBeDone }).eq('id', id);

  if (willBeDone) {
    showToast('✅ Task completed! +50 XP earned!');
    const newXp = (currentProfile.xp || 0) + 50;
    currentProfile.xp = newXp;
    await supabaseClient.from('profiles').update({ xp: newXp }).eq('id', currentUser.id);
    renderStatsFromDB();
  } else {
    showToast('↩ Task marked incomplete');
  }
}

// Rule-based weekly plan generator, seeded by the student's actual weakest
// DSA topics. Swap the body of this function for a call to an LLM API
// (e.g. the Anthropic API) if you want genuinely generative coaching text —
// see README "Wiring a real AI coach" for the two-line change.
async function regenerateAI() {
  const { data: dsa } = await supabaseClient.from('dsa_progress').select('*').eq('user_id', currentUser.id);
  const weakest = (dsa || []).sort((a, b) => a.percent - b.percent).slice(0, 2);
  const topicNames = weakest.map((t) => t.topic).join(' and ') || 'core DSA fundamentals';

  const message = `This week, focus on <strong>${escapeHTML(topicNames)}</strong> — that's where your progress is lowest right now. Aim for 5 LeetCode problems on these topics and push at least one commit to a portfolio project. Small, consistent effort compounds fast. 💪`;
  document.getElementById('aiMsg').innerHTML = message;

  const newTasks = weakest.length
    ? weakest.map((t) => ({ user_id: currentUser.id, text: `Solve 3 problems on ${t.topic}`, tag: 'DSA' }))
    : [{ user_id: currentUser.id, text: 'Pick your first DSA topic to start tracking', tag: 'DSA' }];
  newTasks.push({ user_id: currentUser.id, text: 'Push a commit to your portfolio project', tag: 'GitHub' });

  await supabaseClient.from('ai_tasks').delete().eq('user_id', currentUser.id).eq('done', false);
  await supabaseClient.from('ai_tasks').insert(newTasks);
  await loadAITasks();
  showToast('🤖 AI Coach updated your plan!');
}

// ---------------------------------------------------------------------
// LEADERBOARD — public view, safe for anyone to read (name + XP only).
// ---------------------------------------------------------------------
async function loadLeaderboard() {
  const { data: rows } = await supabaseClient.from('leaderboard').select('*').limit(10);
  const wrap = document.getElementById('leaderboardRows');
  if (!rows || !rows.length) {
    wrap.innerHTML = `<div class="empty-state">Leaderboard fills up as students earn XP.</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  wrap.innerHTML = rows
    .map((r, i) => {
      const isMe = r.user_id === currentUser?.id;
      const initials = (r.full_name || '??').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
      return `
      <div class="lb-row ${isMe ? 'me' : ''}">
        <div class="lb-rank ${i < 3 ? 'top' : ''}">${i < 3 ? medals[i] : i + 1}</div>
        <div class="lb-av" style="background:linear-gradient(135deg,var(--purple),var(--pink))">${initials}</div>
        <div class="lb-name" ${isMe ? 'style="color:var(--cyan)"' : ''}>${isMe ? 'You · ' : ''}${escapeHTML(r.full_name)}</div>
        <div class="lb-score">${(r.xp || 0).toLocaleString('en-IN')}</div>
      </div>`;
    })
    .join('');
}
