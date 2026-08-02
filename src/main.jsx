import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { supabaseClient } from './supabase'
import './index.css'

const heroStats = [
  { value: '48,200', label: 'Active Students', accent: 'cyan' },
  { value: '312', label: 'Colleges Covered', accent: 'purple' },
  { value: '89%', label: 'Placement Rate', accent: 'pink' },
  { value: '₹149', label: 'Starting /month', accent: 'lime' },
]

const navItems = ['Overview', 'DSA', 'LeetCode', 'Resume']

const initialSidebar = [
  { icon: '🏠', label: 'Home', active: true },
  { icon: '🧠', label: 'AI Coach', badge: 'NEW' },
  { icon: '⚡', label: 'DSA Track' },
  { icon: '💻', label: 'LeetCode' },
  { icon: '🐙', label: 'GitHub' },
  { icon: '📄', label: 'Resume Score' },
  { icon: '🎯', label: 'Mock Interviews' },
  { icon: '🏆', label: 'Leaderboard' },
  { icon: '⚙️', label: 'Settings' },
]

const defaultTasks = [
  { id: 'task-1', text: 'Solve 3 medium-array questions', tag: 'DSA', tagClass: 'bg-cyan/10 text-cyan', done: false },
  { id: 'task-2', text: 'Review heap and graph patterns', tag: 'DSA', tagClass: 'bg-amber/10 text-amber', done: true },
  { id: 'task-3', text: 'Push 2 GitHub commits this week', tag: 'GitHub', tagClass: 'bg-lime/10 text-lime', done: false },
]

const plans = [
  {
    name: 'Starter',
    price: '₹149',
    features: ['DSA + LeetCode tracker', 'Weekly AI coach plan', 'Mock interviews', 'Resume review'],
    active: false,
  },
  {
    name: 'Pro',
    price: '₹299',
    features: ['Everything in Starter', 'Unlimited mock interviews', 'GitHub + LeetCode auto-sync', '1:1 resume review'],
    active: true,
  },
  {
    name: 'Placement Ready',
    price: '₹499',
    features: ['Everything in Pro', 'Human resume review', 'Priority placement alerts', '1:1 monthly mentor call'],
    active: false,
    premium: true,
  },
]

const defaultLeaderboard = [
  { name: 'Aanya', xp: 2200 },
  { name: 'Rohit', xp: 2050 },
  { name: 'Sneha', xp: 1880 },
  { name: 'Kabir', xp: 1710 },
]

function useAnimatedCounter(target, suffix = '') {
  const [value, setValue] = useState(0)

  useEffect(() => {
    let frame = 0
    const duration = 900
    const start = performance.now()

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return `${value.toLocaleString('en-IN')}${suffix}`
}

function App() {
  const [landingVisible, setLandingVisible] = useState(true)
  const [dashboardVisible, setDashboardVisible] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [activeNav, setActiveNav] = useState('Overview')
  const [sidebarItems, setSidebarItems] = useState(initialSidebar)
  const [tasks, setTasks] = useState(defaultTasks)
  const [xp, setXp] = useState(0)
  const [streak, setStreak] = useState(0)
  const [plan, setPlan] = useState('🆓 Free Plan')
  const [toast, setToast] = useState('')
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState(defaultLeaderboard)
  const [tiltMap, setTiltMap] = useState({})

  const lcSolvedText = useAnimatedCounter(profile?.leetcode_stats?.total_solved ?? 126)
  const dsaCountText = useAnimatedCounter((profile?.dsa_progress?.length ?? 14))
  const ghCommitsText = useAnimatedCounter(profile?.github_stats?.total_commits_year ?? 342)
  const resumeScoreText = useAnimatedCounter(profile?.resume_score?.overall_score ?? 92)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!supabaseClient) return

    const syncSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadDashboardData(session.user)
        setDashboardVisible(true)
        setLandingVisible(false)
      }
    }

    syncSession()

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadDashboardData(session.user)
        setDashboardVisible(true)
        setLandingVisible(false)
      } else {
        setUser(null)
        setProfile(null)
        setDashboardVisible(false)
        setLandingVisible(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadDashboardData = async (currentUser) => {
    if (!supabaseClient || !currentUser) return

    try {
      const results = await Promise.allSettled([
        supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
        supabaseClient.from('ai_tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true }),
        supabaseClient.from('leaderboard').select('*').limit(6),
        supabaseClient.from('leetcode_stats').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabaseClient.from('github_stats').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabaseClient.from('resume_scores').select('*').eq('user_id', currentUser.id).maybeSingle(),
        supabaseClient.from('dsa_progress').select('*').eq('user_id', currentUser.id),
        supabaseClient.from('subscriptions').select('*').eq('user_id', currentUser.id).eq('status', 'active').maybeSingle(),
      ])

      const [profileRes, taskRes, leaderboardRes, lcRes, ghRes, resumeRes, dsaRes, subRes] = results
      const profileData = profileRes.status === 'fulfilled' ? profileRes.value.data : null
      const taskRows = taskRes.status === 'fulfilled' ? taskRes.value.data : null
      const leaderboardRows = leaderboardRes.status === 'fulfilled' ? leaderboardRes.value.data : null
      const lcData = lcRes.status === 'fulfilled' ? lcRes.value.data : null
      const ghData = ghRes.status === 'fulfilled' ? ghRes.value.data : null
      const resumeData = resumeRes.status === 'fulfilled' ? resumeRes.value.data : null
      const dsaRows = dsaRes.status === 'fulfilled' ? dsaRes.value.data : null
      const subRows = subRes.status === 'fulfilled' ? subRes.value.data : null

      const nextProfile = profileData || { full_name: 'Student', xp: 0, streak_days: 0, level: 1 }
      setProfile({
        ...nextProfile,
        leetcode_stats: lcData || { total_solved: 126 },
        github_stats: ghData || { total_commits_year: 342 },
        resume_score: resumeData || { overall_score: 92 },
        dsa_progress: dsaRows || [
          { topic: 'Arrays', percent: 68 },
          { topic: 'Graphs', percent: 52 },
          { topic: 'Dynamic Programming', percent: 80 },
        ],
      })

      setTasks((taskRows && taskRows.length ? taskRows.map((task) => ({
        id: task.id,
        text: task.text,
        tag: task.tag,
        tagClass: task.tag === 'GitHub' ? 'bg-lime/10 text-lime' : task.tag === 'LeetCode' ? 'bg-amber/10 text-amber' : 'bg-cyan/10 text-cyan',
        done: Boolean(task.done),
      })) : defaultTasks))

      setXp(Number(nextProfile.xp || 0))
      setStreak(Number(nextProfile.streak_days || 0))
      setPlan(subRows ? '💎 Pro Plan' : '🆓 Free Plan')
      setLeaderboard((leaderboardRows && leaderboardRows.length) ? leaderboardRows.map((item) => ({ name: item.full_name || 'Student', xp: Number(item.xp || 0) })) : defaultLeaderboard)
    } catch (error) {
      console.error('Failed to load dashboard data', error)
    }
  }

  const openDashboard = () => {
    setLandingVisible(false)
    setDashboardVisible(true)
  }

  const openLanding = () => {
    setDashboardVisible(false)
    setLandingVisible(true)
  }

  const openAuthModal = (mode = 'signup') => {
    setAuthMode(mode)
    setAuthModalOpen(true)
  }

  const closeAuthModal = () => setAuthModalOpen(false)

  const handleSidebarClick = (label) => {
    setSidebarItems((prev) =>
      prev.map((item) => ({
        ...item,
        active: item.label === label,
      })),
    )
  }

  const handlePointerMove = (id, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTiltMap((prev) => ({ ...prev, [id]: { x: y * 12, y: x * 14 } }))
  }

  const handlePointerLeave = (id) => {
    setTiltMap((prev) => ({ ...prev, [id]: { x: 0, y: 0 } }))
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()

    const form = event.currentTarget
    const email = form.email.value.trim()
    const password = form.password.value
    const fullName = form.fullName?.value?.trim() || 'Student'

    if (!supabaseClient) {
      setToast('Supabase is not configured yet.')
      return
    }

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })

        if (error) throw error

        if (data.user) {
          const { error: profileError } = await supabaseClient.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName,
            college: form.college?.value || null,
            year_of_study: form.year?.value || null,
          }, { onConflict: 'id' })

          if (profileError) {
            console.error('Profile upsert failed during signup:', profileError)
          }
        }

        setToast('🎉 Account created! Sign in to continue.')
        setAuthMode('login')
        return
      }

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
      if (error) throw error
      setToast('Welcome back 👋')
      closeAuthModal()
      setLandingVisible(false)
      setDashboardVisible(true)
    } catch (error) {
      setToast(error?.message || 'Sign in failed.')
    }
  }

  const handleTaskToggle = async (id) => {
    const nextTask = tasks.find((task) => task.id === id)
    if (!nextTask) return

    const nextDone = !nextTask.done
    setTasks((prev) => prev.map((task) => task.id === id ? { ...task, done: nextDone } : task))

    if (supabaseClient && user) {
      await supabaseClient.from('ai_tasks').update({ done: nextDone }).eq('id', id)
    }

    if (nextDone) {
      const nextXp = xp + 50
      setXp(nextXp)
      if (supabaseClient && user) {
        await supabaseClient.from('profiles').update({ xp: nextXp }).eq('id', user.id)
      }
      setToast('✅ Task completed! +50 XP earned!')
    } else {
      setToast('↩ Task marked incomplete')
    }
  }

  const handleLogout = async () => {
    if (supabaseClient) await supabaseClient.auth.signOut()
    setUser(null)
    setProfile(null)
    openLanding()
    setPlan('🆓 Free Plan')
    setToast('Signed out')
  }

  const currentLevel = profile?.level || 1
  const xpGoal = currentLevel * 500
  const progress = Math.min((xp / xpGoal) * 100, 100)

  return (
    <div className="min-h-screen bg-navy text-white">
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <canvas className="pointer-events-none fixed inset-0 z-0 opacity-80" />

      {landingVisible && (
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-14 pb-10 text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple/40 bg-purple/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-purple-300 shadow-glow">
            <span className="inline-block h-2 w-2 rounded-full bg-lime animate-pulse" />
            Built for India's 9M+ Engineering Students
          </div>

          <h1 className="max-w-5xl font-display text-5xl font-bold tracking-[-0.04em] sm:text-6xl lg:text-8xl">
            Your Career.
            <br />
            <span className="bg-gradient-to-r from-cyan via-purple to-pink bg-clip-text text-transparent">
              Tracked. Leveled. Launched.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base text-slate-300 sm:text-lg">
            Stop guessing what to learn next. LevelArc tracks your DSA, LeetCode, GitHub, CGPA and tells you exactly what to do this week.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openAuthModal('signup')}
              className="button-glow rounded-xl bg-gradient-to-r from-purple to-pink px-7 py-3.5 font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(124,58,237,0.6)]"
            >
              Get Started Free →
            </button>
            <button
              onClick={() => openAuthModal('login')}
              className="rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:border-cyan hover:text-cyan"
            >
              Sign In
            </button>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {heroStats.map(({ value, label, accent }) => (
              <div key={label} className="text-center">
                <div className={`font-display text-3xl font-bold ${accent === 'cyan' ? 'text-cyan' : accent === 'purple' ? 'text-purple-300' : accent === 'pink' ? 'text-pink-400' : 'text-lime'}`}>
                  {value}
                </div>
                <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboardVisible && (
        <div className="relative z-10">
          <nav className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-navy/80 px-6 backdrop-blur-xl">
            <div className="font-display text-xl font-bold">
              Level<span className="text-cyan">Arc</span>
            </div>

            <div className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <button
                  key={item}
                  onClick={() => setActiveNav(item)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${activeNav === item ? 'bg-white/5 text-cyan' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
                {plan}
              </div>
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-purple to-pink text-sm font-bold text-white"
                title="Sign out"
              >
                ⎋
              </button>
            </div>
          </nav>

          <div className="flex min-h-[calc(100vh-64px)]">
            <aside className="w-20 border-r border-white/10 bg-slate-950/30 p-3 md:w-56">
              <div className="flex flex-col gap-1.5">
                {sidebarItems.map(({ icon, label, badge, active }) => (
                  <button
                    key={label}
                    onClick={() => handleSidebarClick(label)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'border border-cyan/20 bg-purple/10 text-cyan' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                  >
                    <span className="text-base">{icon}</span>
                    <span className="hidden md:inline">{label}</span>
                    {badge ? <span className="ml-auto rounded-full bg-purple px-1.5 py-0.5 text-[10px] font-bold text-white">{badge}</span> : null}
                  </button>
                ))}
              </div>
            </aside>

            <main className="flex-1 p-4 md:p-6">
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-panel p-5 shadow-[0_0_24px_rgba(124,58,237,0.12)] md:flex-row md:items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-purple to-pink font-bold">
                  {profile?.full_name?.charAt(0)?.toUpperCase() || 'S'}
                </div>

                <div className="flex-1">
                  <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold">{profile?.full_name || 'Student'}</div>
                    <div className="text-xs font-semibold text-amber">⚡ {xp} / {xpGoal} XP to Level {currentLevel + 1}</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple to-cyan" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Level {currentLevel}</span>
                    <span>{Math.round(progress)}% complete</span>
                  </div>
                </div>

                <div className="rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-semibold text-amber">
                  🔥 {streak}-day streak
                </div>
              </div>

              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">Your Progress Snapshot</h2>
                <button className="text-sm font-medium text-purple-300">Sync Now ↗</button>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {[
                  { icon: '💻', value: lcSolvedText, label: 'LeetCode Solved', color: 'cyan' },
                  { icon: '🧠', value: dsaCountText, label: 'DSA Topics Tracked', color: 'purple' },
                  { icon: '🐙', value: ghCommitsText, label: 'GitHub Commits (yr)', color: 'lime' },
                  { icon: '📊', value: '8.7', label: 'CGPA (Current)', color: 'pink' },
                  { icon: '📄', value: resumeScoreText, label: 'Resume Score', color: 'cyan' },
                ].map(({ icon, value, label, color }) => (
                  <div
                    key={label}
                    onMouseMove={(e) => handlePointerMove(`stat-${label}`, e)}
                    onMouseLeave={() => handlePointerLeave(`stat-${label}`)}
                    style={{
                      transform: `perspective(1000px) rotateX(${tiltMap[`stat-${label}`]?.x ?? 0}deg) rotateY(${tiltMap[`stat-${label}`]?.y ?? 0}deg) translateY(-2px)`,
                    }}
                    className={`card-tilt rounded-2xl border bg-panel p-4 transition ${color === 'cyan' ? 'border-cyan/30' : color === 'purple' ? 'border-purple/40' : color === 'pink' ? 'border-pink/30' : 'border-lime/30'}`}
                  >
                    <div className="mb-3 text-2xl">{icon}</div>
                    <div className="font-display text-3xl font-bold text-white">{value}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</div>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
                <div
                  className="card-tilt rounded-2xl border border-white/10 bg-panel p-5"
                  onMouseMove={(e) => handlePointerMove('coach-card', e)}
                  onMouseLeave={() => handlePointerLeave('coach-card')}
                  style={{ transform: `perspective(1000px) rotateX(${tiltMap['coach-card']?.x ?? 0}deg) rotateY(${tiltMap['coach-card']?.y ?? 0}deg)` }}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-purple to-pink text-sm">🤖</div>
                    <div>
                      <div className="font-semibold">AI Career Coach</div>
                      <div className="text-[11px] text-slate-400">Based on your real DSA progress</div>
                    </div>
                    <button className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white">
                      Refresh ↺
                    </button>
                  </div>

                  <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 text-sm leading-6 text-slate-200">
                    Add a couple of DSA topics and hit refresh — your coach will build this week's plan around your weakest areas.
                  </div>

                  <div className="mt-4 space-y-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => handleTaskToggle(task.id)}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${task.done ? 'border-lime/20 bg-lime/5' : 'border-white/5 bg-white/3'}`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] ${task.done ? 'border-lime bg-lime text-navy' : 'border-slate-500 text-slate-500'}`}>
                          {task.done ? '✓' : ''}
                        </div>
                        <div className={`flex-1 text-sm ${task.done ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                          {task.text}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.tagClass}`}>{task.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="card-tilt rounded-2xl border border-white/10 bg-panel p-5"
                  onMouseMove={(e) => handlePointerMove('dsa-card', e)}
                  onMouseLeave={() => handlePointerLeave('dsa-card')}
                  style={{ transform: `perspective(1000px) rotateX(${tiltMap['dsa-card']?.x ?? 0}deg) rotateY(${tiltMap['dsa-card']?.y ?? 0}deg)` }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold">DSA Progress</h3>
                    <button className="text-xs text-purple-300">+ Add Topic</button>
                  </div>

                  <div className="space-y-4">
                    {[
                      { name: 'Arrays', value: 65, color: 'bg-cyan' },
                      { name: 'Graphs', value: 48, color: 'bg-purple' },
                      { name: 'Dynamic Programming', value: 82, color: 'bg-lime' },
                    ].map((topic) => (
                      <div key={topic.name}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{topic.name}</span>
                          <span className="text-slate-400">{topic.value}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${topic.color}`} style={{ width: `${topic.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-white/10 bg-panel p-5 card-tilt" onMouseMove={(e)=>handlePointerMove('heatmap-card', e)} onMouseLeave={()=>handlePointerLeave('heatmap-card')} style={{ transform: `perspective(1000px) rotateX(${tiltMap['heatmap-card']?.x ?? 0}deg) rotateY(${tiltMap['heatmap-card']?.y ?? 0}deg)` }}>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Activity Heatmap · Last 24 Weeks</h3>
                  <button className="text-xs text-purple-300">+ Log Today</button>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-2">
                  {Array.from({ length: 24 }, (_, weekIndex) =>
                    Array.from({ length: 7 }, (_, dayIndex) => {
                      const level = (weekIndex * dayIndex + weekIndex + dayIndex) % 5
                      return level
                    }),
                  ).map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                      {week.map((cell, dayIndex) => (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`h-3 w-3 rounded-[2px] ${cell === 0 ? 'bg-white/5' : cell === 1 ? 'bg-purple/30' : cell === 2 ? 'bg-purple/55' : cell === 3 ? 'bg-cyan/50' : 'bg-cyan'}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-white/10 bg-panel p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">💎 Upgrade Your Plan</h3>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {plans.map(({ name, price, features, premium, active }) => (
                    <div
                      key={name}
                      className={`relative rounded-2xl border p-4 ${premium ? 'border-gold/40 bg-gradient-to-b from-panel to-gold/5' : 'border-white/10 bg-slate-900/20'}`}
                    >
                      {name === 'Pro' ? <div className="absolute right-[-18px] top-4 rotate-45 bg-pink px-6 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white">Most Popular</div> : null}
                      <div className="font-display text-lg font-bold">{name}</div>
                      <div className="mt-2 font-display text-3xl font-bold text-cyan">
                        {price}
                        <span className="text-base text-slate-400">/mo</span>
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-300">
                        {features.map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <span className={feature.includes('Everything') || feature.includes('Unlimited') || feature.includes('GitHub') || feature.includes('Human') || feature.includes('Priority') || feature.includes('1:1') ? 'text-lime' : 'text-slate-500'}>
                              {feature.includes('Everything') || feature.includes('Unlimited') || feature.includes('GitHub') || feature.includes('Human') || feature.includes('Priority') || feature.includes('1:1') ? '✓' : '✗'}
                            </span>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                      <button className={`mt-5 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${premium ? 'border-gold/50 bg-gold/10 text-gold hover:border-gold' : 'border-white/10 bg-white/5 text-white hover:border-cyan hover:text-cyan'}`}>
                        {active ? 'Current Plan' : `Choose ${name}`}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-panel p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">🏆 Leaderboard</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {leaderboard.map((entry, idx) => (
                    <div key={`${entry.name}-${idx}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/3 px-3 py-2 transition hover:border-cyan/30 hover:bg-white/5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple to-cyan text-xs font-bold">{idx + 1}</span>
                        <span>{entry.name}</span>
                      </div>
                      <span className="text-slate-400">{entry.xp} XP</span>
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="mt-1 text-sm text-slate-400">Track your career progress in one place — free to start.</p>
              </div>
              <button onClick={closeAuthModal} className="text-xl text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-300 sm:col-span-2">
                    <span>Full Name</span>
                    <input name="fullName" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-white outline-none ring-0 focus:border-cyan" defaultValue="Student" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300 sm:col-span-1">
                    <span>College</span>
                    <input name="college" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan" defaultValue="IIT" />
                  </label>
                  <label className="space-y-1 text-sm text-slate-300 sm:col-span-1">
                    <span>Year</span>
                    <select name="year" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan" defaultValue="3rd Year">
                      <option>1st Year</option>
                      <option>2nd Year</option>
                      <option>3rd Year</option>
                      <option>4th Year</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="block space-y-1 text-sm text-slate-300">
                <span>Email</span>
                <input name="email" type="email" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan" defaultValue="student@levelarc.dev" required />
              </label>

              <label className="block space-y-1 text-sm text-slate-300">
                <span>Password</span>
                <input name="password" type="password" className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2.5 text-white outline-none focus:border-cyan" defaultValue="demo123" required />
              </label>

              <button type="submit" className="button-glow w-full rounded-xl bg-gradient-to-r from-purple to-pink px-4 py-3 font-semibold text-white shadow-glow">
                {authMode === 'signup' ? 'Create account →' : 'Sign in →'}
              </button>

              <p className="text-center text-sm text-slate-400">
                {authMode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                  className="font-medium text-cyan underline underline-offset-2"
                >
                  {authMode === 'signup' ? 'Sign in' : 'Create an account'}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] rounded-xl border border-cyan/20 bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
          {toast}
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
