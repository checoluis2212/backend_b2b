// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';

// Si tu runtime NO es Node 18+, descomenta esto:
// import fetch from 'node-fetch';

const router = express.Router();

/* ======================= helpers ======================= */
const now = () => new Date();

function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// Acepta payload anidado o plano
function normalizeBody(body = {}) {
  const isNested = body.fields && typeof body.fields === 'object';

  const fields = isNested
    ? body.fields
    : Object.fromEntries(
        Object.entries(body).filter(([k]) =>
          ![
            'visitorId','visitorID','visitorid',
            'button',
            'utm_source','utm_medium','utm_campaign','utm_content','utm_term',
            'pageUri','pageName','hutk'
          ].includes(k)
        )
      );

  const context = isNested
    ? (body.context || {})
    : {
        utm_source: body.utm_source || '',
        utm_medium: body.utm_medium || '',
        utm_campaign: body.utm_campaign || '',
        utm_content: body.utm_content || '',
        utm_term: body.utm_term || '',
        pageUri: body.pageUri || '',
        pageName: body.pageName || '',
        hutk: body.hutk || ''
      };

  const visitorId = body.visitorId || body.visitorID || body.visitorid || '';
  const button = body.button || '';

  return { fields, context, visitorId, button };
}

/* =============== healthcheck específico =============== */
router.get('/health', (_req, res) => {
  const PORTAL_ID = process.env.HS_PORTAL_ID || process.env.HUBSPOT_PORTAL_ID;
  const FORM_ID   = process.env.HS_FORM_ID || process.env.HUBSPOT_FORM_ID;

  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState,
    hs_ready: !!(PORTAL_ID && FORM_ID),
    skip_hs: String(process.env.SKIP_HS) === 'true'
  });
});

/* ========================= POST /api/lead ========================= */
router.post('/', async (req, res) => {
  const t0 = Date.now();
  try {
    const { fields, context, visitorId, button } = normalizeBody(req.body || {});
    const ip = getIp(req);
    const ua = req.headers['user-agent'] || '';

    // --- guarda submission crudo en "Hubspot"
    const ins = await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: now() }
    });
    const storedId = ins.insertedId;

    // --- upsert en "responses" (sin conflicto de formCount)
    if (visitorId) {
      await mongoose.connection.collection('responses').updateOne(
        { visitorId },
        {
          $setOnInsert: {
            visitorId,
            createdAt: now()
          },
          $set: {
            updatedAt: now(),
            'metadata.ip': ip,
            'metadata.utmParams': {
              source: context.utm_source || '(not set)',
              medium: context.utm_medium || '(not set)',
              campaign: context.utm_campaign || '(not set)',
              content: context.utm_content || '(not set)',
              term: context.utm_term || '(not set)'
            },
            'metadata.hubspotForm': { ...fields } // último formulario completo
          },
          $inc: { formCount: 1 },
          ...(button
            ? { $push: { buttons: {
                  name: String(button),
                  pageUri: context.pageUri || '',
                  pageName: context.pageName || '',
                  date: now()
                } } }
            : {})
        },
        { upsert: true }
      );
    }

    // --- envío a HubSpot (background, con logs)
    const PORTAL_ID = process.env.HS_PORTAL_ID || process.env.HUBSPOT_PORTAL_ID;
    const FORM_ID   = process.env.HS_FORM_ID || process.env.HUBSPOT_FORM_ID;

    if (String(process.env.SKIP_HS) === 'true') {
      console.log('[HS] SKIP_HS=true → no se envía a HubSpot');
    } else if (!PORTAL_ID || !FORM_ID) {
      console.error('[HS] Falta HS_PORTAL_ID/HS_FORM_ID (o HUBSPOT_*) → se omite envío');
    } else {
      // Mapea tus campos a los internal names requeridos por tu form
      const MAP = {
        puesto: 'job_title',
        vacantes_anuales: 'annual_processes'
        // agrega aquí otros alias → internal name si los tienes
      };

      const hsFields = Object.entries(fields).map(([name, value]) => ({
        name: MAP[name] || name,
        value: value ?? ''
      }));

      const hsPayload = {
        fields: hsFields,
        context: {
          hutk: context.hutk || '',
          pageUri: context.pageUri || '',
          pageName: context.pageName || '',
          ipAddress: ip
        },
        legalConsentOptions: {
          consent: { consentToProcess: true, text: 'Acepto términos', communications: [] }
        }
      };

      // log de depuración (puedes comentar cuando todo quede ok)
      console.log('[HS] payload →', JSON.stringify(hsPayload));

      (async () => {
        try {
          const url = `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hsPayload)
          });
          const txt = await resp.text().catch(() => '');
          if (!resp.ok) {
            console.error('[HS] submit error:', resp.status, resp.statusText, txt?.slice(0, 800));
          } else {
            console.log('[HS] submit ok:', resp.status, txt?.slice(0, 200));
          }
        } catch (e) {
          console.error('[HS] fetch error:', e?.message || e);
        }
      })();
    }

    res.json({ ok: true, storedId, ms: Date.now() - t0 });
  } catch (err) {
    console.error('❌ /api/lead error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
