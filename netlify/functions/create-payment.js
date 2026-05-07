const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbxs-2ucxLHS3JZlDrEg3V9GoctPvw1ff0qqsjdTgB57MpsiPVwAgqPbZZW4lTqqhXSmFw/exec';
const NEWSLETTER_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzEP480vDzHSnWViji1hiEHnvVfK7X0kcfQ8xJPzFn9jaXMmVR_lICRnz3JKIbEl0_kvQ/exec';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, email, prenom, nom, description, commande } = JSON.parse(event.body);

    // 1. Créer la Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Fréquence Positive — Séance Personnalisée',
              description: description || `Commande de ${prenom} ${nom}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.URL}/confirmation.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/`,
    });

    // 2. Envoyer au Google Sheet
    if (commande) {
      const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      await fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: now,
          prenom: prenom,
          nom: nom,
          email: email,
          telephone: commande.telephone || '—',
          pour_qui: commande.pour_qui || '—',
          prenom_auditeur: commande.prenom_auditeur || '—',
          genre: commande.genre || '—',
          tutoiement: commande.tutoiement || '—',
          guide: commande.guide || '—',
          duree: commande.duree || '—',
          affirmations: commande.affirmations || '—',
          redaction: commande.redaction || '—',
          texte_affirmations: commande.texte_affirmations || '—',
          sub_besoin: commande.sub_besoin || '—',
          message_libre: commande.message_libre || '—',
          ambiance: commande.ambiance || '—',
          delai: commande.delai || '—',
          prix_total: commande.prix_total || '—',
          optin_comms: commande.optin_comms || 'Non',
          optin_newsletter: commande.optin_newsletter || 'Non',
        }),
      });
    }

    // 3. Envoyer au Google Sheet Newsletter si optin coché
    if (commande && commande.optin_comms === 'Oui') {
      const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      await fetch(NEWSLETTER_SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: now,
          prenom: prenom,
          nom: nom,
          email: email,
          telephone: commande.telephone || '—',
          optin_comms: commande.optin_comms,
        }),
      });
    }

    // 4. Envoyer email via Resend
    if (commande && process.env.RESEND_API_KEY) {
      const now = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      const lignes = [
        `👤 CLIENT`,
        `Prénom : ${prenom}`,
        `Nom : ${nom}`,
        `Email : ${email}`,
        `Téléphone : ${commande.telephone || '—'}`,
        ``,
        `🎵 DÉTAILS DE LA SÉANCE`,
        `Pour qui : ${commande.pour_qui}`,
        `Prénom auditeur : ${commande.prenom_auditeur}`,
        `Genre : ${commande.genre}`,
        `Tutoiement : ${commande.tutoiement}`,
        `Guide : ${commande.guide}`,
        `Durée : ${commande.duree}`,
        `Affirmations : ${commande.affirmations}`,
        `Rédaction : ${commande.redaction}`,
        `Affirmations rédigées : ${commande.texte_affirmations || '—'}`,
        `Respiration : ${commande.respiration}`,
        `Effet vocal : ${commande.vocal}`,
        `Sous-titres : ${commande.soustitres}`,
        `Domaine : ${commande.domaine || '—'}`,
        `Sous-thème : ${commande.sub_besoin || '—'}`,
        ``,
        `💬 MESSAGE DU CLIENT`,
        `${commande.message_libre || '(aucun message)'}`,
        ``,
        `🎧 AMBIANCE SONORE`,
        `Ambiance : ${commande.ambiance}`,
        `Délai : ${commande.delai}`,
        ``,
        `💰 TOTAL : ${commande.prix_total}`,
        `Newsletter : ${commande.optin_comms || 'Non'}`,
        `Commande reçue le : ${now}`,
      ].join('\n');

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Frequence Positive <onboarding@resend.dev>',
          to: ['denismagine06@gmail.com'],
          subject: `Nouvelle commande — ${prenom} ${nom} — ${commande.prix_total}`,
          text: lignes,
        }),
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (error) {
    console.error('Erreur:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
