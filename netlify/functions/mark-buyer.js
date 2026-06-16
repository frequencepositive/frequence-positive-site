// Fonction Netlify : à l'arrivée sur la page de confirmation après un paiement Stripe,
// vérifie que la session est bien PAYÉE, puis ajoute l'acheteur à la liste Brevo
// "Acheteurs seance (auto)" (id 18). Cette liste sert à faire SORTIR la personne
// de la séquence email "guide gratuit" pour ne pas lui envoyer la promo après achat.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ACHETEURS = 18;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { session_id } = JSON.parse(event.body || '{}');
    if (!session_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'session_id manquant' }) };
    }

    // 1. Vérifier auprès de Stripe que la session est réellement payée
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status !== 'paid') {
      return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'paiement non confirmé' }) };
    }

    const email =
      (session.customer_details && session.customer_details.email) ||
      session.customer_email;
    if (!email) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'email introuvable' }) };
    }

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY manquante dans les variables d\'environnement Netlify');
      return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY manquante' }) };
    }

    // 2. Ajouter / mettre à jour le contact dans Brevo et l'ajouter à la liste Acheteurs
    const resp = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        email: email,
        listIds: [BREVO_LIST_ACHETEURS],
        updateEnabled: true,
      }),
    });

    // 201 = contact créé, 204 = contact mis à jour. Sinon, on force l'ajout à la liste.
    if (!resp.ok && resp.status !== 204) {
      const txt = await resp.text();
      console.error('Brevo /contacts a renvoyé', resp.status, txt);
      await fetch(
        `https://api.brevo.com/v3/contacts/lists/${BREVO_LIST_ACHETEURS}/contacts/add`,
        {
          method: 'POST',
          headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ emails: [email] }),
        }
      );
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('mark-buyer error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
