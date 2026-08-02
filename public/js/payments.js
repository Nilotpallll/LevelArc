// =====================================================================
// PAYMENTS — hands off to Stripe Checkout. No card data ever touches
// this frontend or your server; Stripe hosts the payment page.
// =====================================================================

async function startCheckout(plan) {
  if (!currentUser) {
    showToast('⚠ Please sign in first to upgrade your plan');
    openAuthModal('login');
    return;
  }

  const btn = document.querySelector(`[data-plan-btn="${plan}"]`);
  const originalText = btn?.textContent;
  if (btn) { btn.textContent = 'Redirecting…'; btn.disabled = true; }

  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, userId: currentUser.id, email: currentUser.email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    window.location.href = data.url;
  } catch (err) {
    showToast(`❌ ${err.message}`);
    if (btn) { btn.textContent = originalText; btn.disabled = false; }
  }
}

// On page load, react to Stripe's redirect back (?payment=success|cancelled)
function handlePaymentRedirect() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (payment === 'success') {
    showToast('🎉 Payment successful! Your plan is now active.');
  } else if (payment === 'cancelled') {
    showToast('Checkout cancelled — no charge was made.');
  }
  if (payment) {
    params.delete('payment');
    params.delete('plan');
    const clean = window.location.pathname + (params.toString() ? `?${params}` : '');
    window.history.replaceState({}, '', clean);
  }
}
