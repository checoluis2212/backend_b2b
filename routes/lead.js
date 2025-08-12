// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();
const { HS_PORTAL_ID, HS_FORM_ID, SKIP_HS } = process.env;

/* ====================== Utils ====================== */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// pequeño helper de timeout para fetch (Node 18+)
async function fetchWithTimeout(url, opts = {}, ms = 12000) {
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
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hsPayload)
  }, 12000);

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error('[HS] submit error:', resp.status, t?.slice(0, 400));
    throw new Error(`HS ${resp.status}`);
  }
  console.log('[HS] submit ok');
}

/* ====================== Health ====================== */
router.get('/lead/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState,
    hs_ready: !!(HS_PORTAL_ID && HS_FORM_ID),
    skip_hs: SKIP_HS === 'true'
  });
});

/* ====================== POST /lead ====================== */
router.post('/lead', async (req, res) => {
  const started = Date.now();
  try {
    const { fields = {}, context = {}, visitorId } = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const now = new Date();

    // (Opcional) visibilidad de requeridos (no bloquea)
    const required = ['email', 'firstname', 'lastname', 'phone', 'company'];
    const missing = required.filter(k => !String(fields[k] || '').trim());
    if (missing.length) console.warn('[API] lead faltan campos:', missing);

    /* 1) Guarda submission crudo en colección "Hubspot" */
    const hubspotIns = await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: now }
    });
    const storedId = hubspotIns.insertedId?.toString();
    console.log('[API] lead stored (Hubspot) _id:', storedId);

    /* 2) Upsert en "responses" (sin tocar /api/responses) */
    try {
      // clave de unión: preferimos visitorId; si no, email del form
      const key =
        visitorId
          ? { visitorId: String(visitorId) }
          : (fields?.email ? { 'metadata.hubspotForm.email': fields.email } : null);

      if (!key) {
        console.warn('[API] responses upsert omitido: falta visitorId y email');
      } else {
        await mongoose.connection.collection('responses').updateOne(
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
                source: context?.utm_source || '(not set)',
                medium: context?.utm_medium || '(not set)',
                campaign: context?.utm_campaign || '(not set)'
              },
              // 👉 guardamos TODO el formulario del último envío
              'metadata.hubspotForm': { ...(fields || {}) }
            }
          },
          { upsert: true }
        );
      }
    } catch (e) {
      console.error('[API] responses upsert warn:', e?.message || e);
      // no rompemos la respuesta si solo falló el upsert secundario
    }

    /* 3) Responder al cliente inmediatamente */
    res.json({ ok: true, storedId, ms: Date.now() - started });

    /* 4) Enviar a HubSpot en background (no bloquea al cliente) */
    if (SKIP_HS === 'true') {
      console.log('[API] SKIP_HS=true → no se envía a HubSpot');
      return;
    }
    if (!HS_PORTAL_ID || !HS_FORM_ID) {
      console.error('[API] Falta HS_PORTAL_ID o HS_FORM_ID → se omite envío a HubSpot');
      return;
    }
    submitToHubSpot({ fields, context, ip })
      .catch(err => console.error('[HS] catch:', err?.message || err));

  } catch (e) {
    console.error('[API] /api/lead error:', e?.stack || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
