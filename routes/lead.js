// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const { HS_PORTAL_ID, HS_FORM_ID, SKIP_HS } = process.env;

/* --------------------- Utils --------------------- */
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
  const res = await fetchWithTimeout(
    url,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hsPayload) },
    12000
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[HS] submit error:', res.status, t?.slice(0, 400));
    throw new Error(`HS ${res.status}`);
  }
  console.log('[HS] submit ok');
}

/* --------------------- Health --------------------- */
router.get('/lead/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState,
    hs_ready: !!(HS_PORTAL_ID && HS_FORM_ID),
    skip_hs: SKIP_HS === 'true'
  });
});

/* --------------------- POST /api/lead --------------------- */
router.post('/lead', async (req, res) => {
  try {
    const start = Date.now();
    const { fields = {}, context = {}, visitorId } = req.body || {};

    // Validaciones mínimas (solo log; no bloquea)
    const required = ['email', 'firstname', 'lastname', 'phone', 'company'];
    const missing = required.filter(k => !String(fields[k] || '').trim());
    if (missing.length) {
      console.warn('[API] lead faltan campos:', missing);
      // si prefieres, responde 400 aquí
      // return res.status(400).json({ ok:false, error:'missing_fields', fields: missing });
    }

    // Metadatos request
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const now = new Date();

    /* --------- Guarda submission crudo en colección "Hubspot" --------- */
    const hubspotDoc = { json: { fields, context }, _meta: { ip, ua, createdAt: now } };
    const ins = await mongoose.connection.collection('Hubspot').insertOne(hubspotDoc);
    console.log('[API] lead stored (Hubspot) _id:', ins.insertedId?.toString());

    /* --------- Upsert en colección "responses" --------- */
    const responsesCol = mongoose.connection.collection('responses');

    // Clave: preferimos visitorId; si no viene, usamos email del form
    const key =
      visitorId
        ? { visitorId: String(visitorId) }
        : { 'metadata.hubspotForm.email': (fields.email || null) };

    await responsesCol.updateOne(
      key,
      {
        $setOnInsert: {
          visitorId: visitorId || null,
          formCount: 0,
          firstFormDate: now,
          createdAt: now
        },
        $inc: { formCount: 1 },
        $set: {
          lastFormDate: now,
          updatedAt: now,
          'metadata.ip': ip,
          'metadata.utmParams': {
            source: context.utm_source || '(not set)',
            medium: context.utm_medium || '(not set)',
            campaign: context.utm_campaign || '(not set)'
          },
          // ← aquí va TODO el formulario tal cual llega
          'metadata.hubspotForm': { ...fields }
        }
      },
      { upsert: true }
    );

    /* --------- Envío a HubSpot API (no bloquea) --------- */
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
