// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const { HS_PORTAL_ID, HS_FORM_ID } = process.env;

// ---- Utilidades ----
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// Enviar a HubSpot Forms Submission API (v3)
async function submitToHubSpot({ fields = {}, context = {}, ip = '' }) {
  const hsPayload = {
    fields: Object.entries(fields).map(([name, value]) => ({
      name,
      value: value ?? ''
    })),
    context: {
      pageUri: context.pageUri || '',
      pageName: context.pageName || '',
      hutk: context.hutk || '',
      ipAddress: ip
    },
    // Ajusta si tienes GDPR con textos/consents propios
    legalConsentOptions: {
      consent: { consentToProcess: true, text: 'Acepto términos', communications: [] }
    }
  };

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HS_PORTAL_ID}/${HS_FORM_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hsPayload),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error('[HS] submit error:', t);
  }
}

router.post('/lead', async (req, res) => {
  try {
    // Espera: { fields: {...}, context: {...} }
    const { fields = {}, context = {} } = req.body || {};

    // Guarda el JSON crudo + metadatos en la colección "Hubspot"
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    const toStore = {
      json: { fields, context },   // 👈 tu payload completo en un solo campo
      _meta: { ip, ua, createdAt: new Date() }
    };

    await mongoose.connection.collection('Hubspot').insertOne(toStore);

    // Reenviar a HubSpot (no bloquea el éxito del usuario si falla)
    submitToHubSpot({ fields, context, ip }).catch(err => console.error('[HS] catch:', err));

    return res.json({ ok: true });
  } catch (e) {
    console.error('[API] /api/lead error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
