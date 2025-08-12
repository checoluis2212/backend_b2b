// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const { HS_PORTAL_ID, HS_FORM_ID, SKIP_HS } = process.env;

// ---- Utils ----
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// pequeño helper de timeout para fetch (Node 18+)
async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
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
    legalConsentOptions: {
      consent: { consentToProcess: true, text: 'Acepto términos', communications: [] }
    }
  };

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HS_PORTAL_ID}/${HS_FORM_ID}`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hsPayload),
  }, 12000);

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[HS] submit error:', res.status, t?.slice(0, 400));
    throw new Error(`HS ${res.status}`);
  }
  console.log('[HS] submit ok');
}

// ---- Health para probar rápido ----
router.get('/lead/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState,
    hs_ready: !!(HS_PORTAL_ID && HS_FORM_ID),
    skip_hs: SKIP_HS === 'true'
  });
});

// ---- POST /api/lead ----
router.post('/lead', async (req, res) => {
  try {
    const start = Date.now();
    const { fields = {}, context = {} } = req.body || {};

    // Validaciones mínimas (no bloqueantes si quieres, pero ayudan)
    const required = ['email', 'firstname', 'lastname', 'phone', 'company'];
    const missing = required.filter(k => !String(fields[k] || '').trim());
    if (missing.length) {
      console.warn('[API] lead faltan campos:', missing);
      // si prefieres, responde 400; aquí no bloqueamos el guardado
    }

    // Metadatos
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // Guarda en Mongo (colección "Hubspot")
    const doc = {
      json: { fields, context },
      _meta: { ip, ua, createdAt: new Date() }
    };
    const ins = await mongoose.connection.collection('Hubspot').insertOne(doc);
    console.log('[API] lead stored _id:', ins.insertedId?.toString());

    // Reenviar a HubSpot (en background, no bloquea éxito al usuario)
    if (SKIP_HS === 'true') {
      console.log('[API] SKIP_HS=true → no se envía a HubSpot');
    } else if (!HS_PORTAL_ID || !HS_FORM_ID) {
      console.error('[API] Falta HS_PORTAL_ID o HS_FORM_ID → no se envía a HubSpot');
    } else {
      submitToHubSpot({ fields, context, ip })
        .catch(err => console.error('[HS] catch:', err?.message || err));
    }

    const ms = Date.now() - start;
    return res.json({ ok: true, storedId: ins.insertedId, ms });

  } catch (e) {
    console.error('[API] /api/lead error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
