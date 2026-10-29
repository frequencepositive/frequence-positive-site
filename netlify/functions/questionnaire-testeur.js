// Questionnaire de fin de test de l'appli (page questionnaire-testeur.html, Denis 29/10/2026).
// 1. Envoie les réponses dans le Gmail de Denis (Resend, comme les commandes).
// 2. Note dans Brevo que le testeur a répondu (champ QUESTIONNAIRE = date) : c'est ce qui donne droit aux 3 mois offerts.

const nettoyer = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
const echapper = (s) => s.replace(/[&<>"]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Méthode refusée' };
  let d;
  try { d = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, body: '{"erreur":"demande"}' }; }
  if (nettoyer(d.piege, 10)) return { statusCode: 200, body: '{"ok":true}' }; // robots

  const email = nettoyer(d.email, 120).toLowerCase();
  const prenom = nettoyer(d.prenom, 60) || 'Un testeur';
  const aime = Array.isArray(d.aime) ? d.aime.map((x) => nettoyer(x, 60)).filter(Boolean).slice(0, 10) : [];
  const aimeTexte = nettoyer(d.aimeTexte, 3000);
  const gene = nettoyer(d.gene, 3000);
  const continuer = nettoyer(d.continuer, 40);
  const pourquoi = nettoyer(d.pourquoi, 3000);
  if (!aime.length && !aimeTexte && !gene && !continuer && !pourquoi) {
    return { statusCode: 400, body: '{"erreur":"vide"}' };
  }

  const bloc = (titre, texte) => `<h3 style="margin:22px 0 6px;color:#7b4a3a">${titre}</h3>
<p style="margin:0;white-space:pre-wrap">${echapper(texte || '—')}</p>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#2c2c2c;max-width:600px">
<p><b>${echapper(prenom)}</b>${email ? ` (${echapper(email)})` : ''} a répondu au questionnaire de fin de test.</p>
${bloc('1. Ce qui a le plus plu', [aime.join(', '), aimeTexte].filter(Boolean).join('\n\n'))}
${bloc('2. Ce qui a gêné ou manqué', gene)}
${bloc('3. Continuerait à l\'utiliser ?', [continuer, pourquoi].filter(Boolean).join('\n\n'))}
<p style="margin-top:24px;font-size:13px;color:#777">→ ${email ? 'Noté dans Brevo (champ QUESTIONNAIRE) : 3 mois offerts à prévoir.' : 'Adresse inconnue : retrouver ce testeur pour ses 3 mois offerts.'}</p></div>`;

  let ok = true;
  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Frequence Positive <onboarding@resend.dev>',
        to: ['denismagine06@gmail.com'],
        ...(email ? { reply_to: email } : {}),
        subject: `[Questionnaire testeur] ${prenom} — ${continuer || 'réponses'}`,
        html,
      }),
    });
    if (!r.ok) { ok = false; console.error('Resend', r.status, await r.text()); }
  } else ok = false;

  if (email && process.env.BREVO_API_KEY) {
    const r = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'PUT',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ attributes: { QUESTIONNAIRE: new Date().toISOString().slice(0, 10) } }),
    });
    if (!r.ok) console.error('Brevo', r.status, await r.text());
  }

  return ok ? { statusCode: 200, body: '{"ok":true}' } : { statusCode: 502, body: '{"erreur":"envoi"}' };
};
