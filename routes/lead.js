// routes/lead.js
import express from 'express';
import mongoose from 'mongoose';
import HubspotModel from '../models/Hubspot.js';
import ResponseModel from '../models/Response.js';

const router = express.Router();

/* ======================= Helpers ======================= */
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}
const now = () => new Date();

/** Normaliza body:
 * A) { visitorId, fields: {...}, context:{...}, button }
 * B) { visitorId, button, utm_*, pageUri, pageName, hutk, ...camposFormEnTopLevel }
 */
function normalizeBody(body = {}) {
  const isNested = body.fields && typeof body.fields === 'object';

  const fields = isNested
    ? body.fields
    : Object.fromEntries(
        Object.entries(body).filter(([k]) =>
          ![
            'visitorId', 'visitorID', 'visitorid',
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

/* =============== Healthcheck específico =============== */
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

    /* 1) Guarda submission crudo en colección "Hubspot" */
    const hubDoc = await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: now() }
    });
    const storedId = hubDoc.insertedId;

    /* 2) Upsert en "responses" */
    if (visitorId) {
      const responsesCol = mongoose.connection.collection('responses');

      await responsesCol.updateOne(
        { visitorId },
        {
          $setOnInsert: {
            visitorId,
            createdAt: now()
            // ⚠️ NO pongas formCount aquí (evita conflicto con $inc)
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
            // guarda TODO el último formulario
            'metadata.hubspotForm': { ...fields }
          },
          $inc: { formCount: 1 }, // ✅ si no existe, Mongo lo crea con 1
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

    /* 3) Envío a HubSpot (background + logs claros) */
    const PORTAL_ID = process.env.HS_PORTAL_ID || process.env.HUBSPOT_PORTAL_ID;
    const FORM_ID   = process.env.HS_FORM_ID || process.env.HUBSPOT_FORM_ID;

    if (String(process.env.SKIP_HS) === 'true') {
      console.log('[HS] SKIP_HS=true → no se envía a HubSpot');
    } else if (!PORTAL_ID || !FORM_ID) {
      console.error('[HS] Falta HS_PORTAL_ID/HS_FORM_ID (o HUBSPOT_*) → se omite envío');
    } else {
      // Mapea tus nombres a los internal names del form de HubSpot
      const MAP = {
        puesto: 'job_title',
        vacantes_anuales: 'annual_processes'
        // agrega más si aplica
      };

      const hsFields = Object.entries(fields).map(([name, value]) => {
        const mapped = MAP[name] || name;
        return { name: mapped, value: value ?? '' };
      });

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

    return res.json({ ok: true, storedId, ms: Date.now() - t0 });
  } catch (err) {
    console.error('❌ Error en /api/lead:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
