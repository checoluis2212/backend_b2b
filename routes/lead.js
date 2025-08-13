import express from 'express';
import mongoose from 'mongoose';
import HubspotModel from '../models/Hubspot.js';
import ResponseModel from '../models/Response.js';

const router = express.Router();

// Helpers
function getIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

function now() { return new Date(); }

// Normaliza el cuerpo para aceptar tanto:
// A) { visitorId, fields: {...}, context: {...} }
// B) { visitorId, button, utm_source,..., pageUri, pageName, hutk, <campos del form en top-level> }
function normalizeBody(body = {}) {
  const isNested = body.fields && typeof body.fields === 'object';

  const fields = isNested
    ? body.fields
    : Object.fromEntries(
        Object.entries(body).filter(
          ([k]) => ![
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

// POST /api/lead
router.post('/', async (req, res) => {
  const t0 = Date.now();
  try {
    const { fields, context, visitorId, button } = normalizeBody(req.body || {});
    const ip = getIp(req);
    const ua = req.headers['user-agent'] || '';

    // 1) Guarda en colección Hubspot (Mongo)
    const hubDoc = await mongoose.connection
      .collection('Hubspot')
      .insertOne({
        json: { fields, context },
        _meta: { ip, ua, createdAt: now() }
      });

    // 2) Actualiza "responses" (tu lógica de botones / utm)
    if (visitorId) {
      const responsesCol = mongoose.connection.collection('responses');

      await responsesCol.updateOne(
        { visitorId },
        {
          $setOnInsert: { visitorId, createdAt: now() },
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
            // Guarda TODO el último formulario para referencia
            'metadata.hubspotForm': { ...fields }
          },
          ...(button
            ? { $push: { buttons: { name: button, pageUri: context.pageUri || '', pageName: context.pageName || '', date: now() } } }
            : {})
        },
        { upsert: true }
      );
    }

    // 3) Disparo a HubSpot (en background, con logs claros)
    const PORTAL_ID = process.env.HS_PORTAL_ID || process.env.HUBSPOT_PORTAL_ID;
    const FORM_ID   = process.env.HS_FORM_ID || process.env.HUBSPOT_FORM_ID;

    if (!PORTAL_ID || !FORM_ID) {
      console.error('[HS] Falta HS_PORTAL_ID/HS_FORM_ID (o HUBSPOT_*). Se omite envío.');
    } else {
      // Si quieres filtrar a campos “seguros”:
      // const SAFE = ['email','firstname','lastname','phone','company'];
      // const hsFields = Object.entries(fields)
      //   .filter(([k]) => SAFE.includes(k))
      //   .map(([name, value]) => ({ name, value: value ?? '' }));

      const hsFields = Object.entries(fields).map(([name, value]) => ({
        name,
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

    return res.json({ ok: true, storedId: hubDoc.insertedId, ms: Date.now() - t0 });
  } catch (err) {
    console.error('❌ Error en /api/lead:', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
