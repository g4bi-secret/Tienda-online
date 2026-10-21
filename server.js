const express = require('express');
const path = require('path');
const Stripe = require('stripe');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);

const stripe = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'your_stripe_secret_key_here'
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/success', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.get('/cancel', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cancel.html'));
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe no está configurado. Agrega una clave válida en .env (STRIPE_SECRET_KEY).'
      });
    }

    const { items = [] } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío.' });
    }

    const origin = `${req.protocol}://${req.get('host')}`;

    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'ars',
        product_data: {
          name: String(item.name || 'Producto'),
        },
        unit_amount: Math.round(Number(item.unit_amount || 0)),
      },
      quantity: Math.max(1, Number(item.quantity || 1)),
    }));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['AR'],
      },
      payment_method_types: ['card'],
      metadata: {
        customerName: String(req.body?.customerName || 'Sin nombre'),
        deliveryMethod: String(req.body?.deliveryMethod || 'local'),
        paymentMethod: String(req.body?.paymentMethod || 'tarjeta'),
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      error: 'No se pudo crear la sesión de pago. Revisa la configuración de Stripe.'
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
