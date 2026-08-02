// POST /api/create-checkout-session
// Body: { plan: "starter" | "pro" | "placement_ready", userId: "<supabase-uuid>", email: "<user-email>" }
// Returns: { url: "<stripe-checkout-url>" }
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  placement_ready: process.env.STRIPE_PRICE_PLACEMENT_READY,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan, userId, email } = req.body;

    if (!plan || !PRICE_IDS[plan]) {
      return res.status(400).json({ error: 'Unknown or missing plan' });
    }
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email — sign in first' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.SITE_URL}/?payment=success&plan=${plan}`,
      cancel_url: `${process.env.SITE_URL}/?payment=cancelled`,
      // These land on the session + the subsequent subscription/invoice
      // objects, which is how the webhook knows which Supabase user paid.
      client_reference_id: userId,
      subscription_data: {
        metadata: { supabase_user_id: userId, plan },
      },
      metadata: { supabase_user_id: userId, plan },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
