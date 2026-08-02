// =====================================================================
// APP — landing page effects, navigation, modals, and the glue between
// auth.js / dashboard.js / payments.js / integrations.js.
// =====================================================================

// --------------------------- BACKGROUND CANVAS ---------------------------
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let W, H, dots = [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initCanvas() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  dots = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.random() * 1.5 + 0.5,
    vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
  }));
}
function drawGrid() {
  ctx.strokeStyle = 'rgba(124,58,237,0.04)';
  ctx.lineWidth = 1;
  const sz = 60;
  for (let x = 0; x < W; x += sz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += sz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function animCanvas() {
  ctx.clearRect(0, 0, W, H);
  drawGrid();
  dots.forEach((d) => {
    d.x += d.vx; d.y += d.vy;
    if (d.x < 0 || d.x > W) d.vx *= -1;
    if (d.y < 0 || d.y > H) d.vy *= -1;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,245,255,${d.alpha})`;
    ctx.fill();
  });
  if (!reduceMotion) requestAnimationFrame(animCanvas);
}
initCanvas();
animCanvas();
window.addEventListener('resize', initCanvas);

// --------------------------- COUNTER ANIMATION ---------------------------
function animateCounter(el, target, duration = 1200) {
  if (!el) return;
  if (reduceMotion) { el.textContent = target.toLocaleString('en-IN'); return; }
  let start = 0;
  const step = target / (duration / 16);
  const t = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = Math.floor(start).toLocaleString('en-IN');
    if (start >= target) clearInterval(t);
  }, 16);
}
document.querySelectorAll('[data-count]').forEach((el) => animateCounter(el, +el.dataset.count));

// --------------------------- TOAST ---------------------------
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// --------------------------- MODALS ---------------------------
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('open'));
});

function openAuthModal(mode) {
  document.getElementById('authTitle').textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
  document.getElementById('authSubmitBtn').textContent = mode === 'signup' ? 'Create account →' : 'Sign in →';
  document.getElementById('onboardFields').style.display = mode === 'signup' ? 'flex' : 'none';
  document.getElementById('authModal').dataset.mode = mode;
  document.getElementById('authSwitchText').innerHTML =
    mode === 'signup'
      ? `Already have an account? <a href="#" onclick="openAuthModal('login');return false;">Sign in</a>`
      : `New here? <a href="#" onclick="openAuthModal('signup');return false;">Create an account</a>`;
  openModal('authModal');
}

// --------------------------- NAV / TABS ---------------------------
function setTab(btn, tab) {
  document.querySelectorAll('.nav-link').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}
function setSide(btn) {
  document.querySelectorAll('.sidebar-item').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}

// --------------------------- ENTER DASHBOARD ---------------------------
async function enterDash() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  await renderStatsFromDB();
}

function goToLanding() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('landing').style.display = 'flex';
}

// --------------------------- FORM HANDLERS ---------------------------
document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = document.getElementById('authModal').dataset.mode;
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';

  try {
    if (mode === 'signup') {
      await signUp({
        email,
        password,
        fullName: document.getElementById('obName').value.trim(),
        college: document.getElementById('obCollege').value.trim(),
        year: document.getElementById('obYear').value,
        leetcode: document.getElementById('obLeetcode').value.trim(),
        github: document.getElementById('obGithub').value.trim(),
      });
      showToast('🎉 Account created! Check your email to confirm, then sign in.');
      openAuthModal('login');
    } else {
      await signIn({ email, password });
      await loadCurrentSession();
      closeModal('authModal');
      await enterDash();
      showToast(`Welcome back, ${currentProfile?.full_name?.split(' ')[0] || 'there'} 👋`);
    }
  } catch (err) {
    showToast(`❌ ${readableAuthError(err)}`);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await signOut();
  goToLanding();
  showToast('Signed out');
});

// --------------------------- BOOT ---------------------------
(async function boot() {
  handlePaymentRedirect();
  const session = await loadCurrentSession();
  if (session) {
    await enterDash();
  }
})();
