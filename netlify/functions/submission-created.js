// Fonction Netlify déclenchée automatiquement à chaque soumission
// d'un formulaire Netlify Forms.
// Filtre uniquement le formulaire "newsletter-fp" et synchronise
// les inscriptions vers Brevo (liste ID 11 - Newsletter FP).

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const payload = body.payload || {};

    // On ne traite QUE le formulaire newsletter, on ignore les autres
    if (payload.form_name !== 'newsletter-fp') {
      return {
        statusCode: 200,
        body: JSON.stringify({ ignored: 'not the newsletter form', form: payload.form_name }),
      };
    }

    const data = payload.data || {};
    const email = (data.email || '').trim();
    const prenom = (data.prenom || '').trim();

    if (!email) {
      console.error('Email manquant dans la soumission');
      return { statusCode: 400, body: JSON.stringify({ error: 'email manquant' }) };
    }

    const apiKey = process.env.brevo_api_key_newsletter;
    if (!apiKey) {
      console.error('Variable brevo_api_key_newsletter non configurée');
      return { statusCode: 500, body: JSON.stringify({ error: 'API key non configurée' }) };
    }

    // Appel API Brevo - création/mise à jour du contact + ajout à la liste 11
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          PRENOM: prenom,
          FIRSTNAME: prenom,
        },
        listIds: [11],
        updateEnabled: true, // Si le contact existe déjà, on le met à jour
      }),
    });

    const responseText = await brevoResponse.text();

    if (!brevoResponse.ok) {
      console.error('Erreur Brevo API:', brevoResponse.status, responseText);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Erreur Brevo',
          status: brevoResponse.status,
          details: responseText,
        }),
      };
    }

    console.log('Contact ajouté à Brevo:', email);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, email: email }),
    };
  } catch (err) {
    console.error('Erreur fonction submission-created:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur serveur', message: err.message }),
    };
  }
};
