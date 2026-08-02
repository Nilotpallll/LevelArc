// POST /api/stripe-webhook
// Configure this URL in Stripe Dashboard → Developers → Webhooks
// Events to send: checkout.session.completed, customer.subscription.updated,
//                 customer.subscription.deleted, invoice.payment_failed
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const { supabaseAdmin } = require('./_supabaseAdmin');

// Stripe needs the RAW request body to verify the signature, so we must
// turn off Vercel's automatic JSON body parsing for this route only.
module.exports.config = {
  api: { bodyParser: false },
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (c) => chunks.push(c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  let event;
  try {
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;
        if (userId && plan) {
          await supabaseAdmin.from('subscriptions').upsert(
            {
              user_id: userId,
              plan,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              status: 'active',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'stripe_subscription_id' }
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: sub.status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription);
        }
        break;
      }

      default:
        // Unhandled event types are fine to ignore.
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe-webhook handling error:', err);
    // Return 200 anyway once signature is verified — Stripe retries on non-2xx,
    // and retry storms on a downstream bug just make things worse. Log & fix.
    return res.status(200).json({ received: true, note: 'logged error, see server logs' });
  }
};
