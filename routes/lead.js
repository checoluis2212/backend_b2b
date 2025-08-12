import express from 'express';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import HubspotModel from '../models/Hubspot.js';
import ResponseModel from '../models/Response.js';

const router = express.Router();

// 🔹 POST /api/lead
router.post('/', async (req, res) => {
  try {
    const {
      visitorId,
      button,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      pageUri,
      pageName,
      hutk,
      ...formFields
    } = req.body;

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      '';

    const ua = req.headers['user-agent'] || '';

    // 1️⃣ Guardar en colección Hubspot
    const hubspotDoc = new HubspotModel({
      json: {
        fields: formFields,
        context: {
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          pageUri,
          pageName,
          hutk
        }
      },
      _meta: { ip, ua, createdAt: new Date() }
    });

    await hubspotDoc.save();

    // 2️⃣ Actualizar en responses (lógica botones)
    if (visitorId && button) {
      let response = await ResponseModel.findOne({ visitorId });
      if (!response) {
        response = new ResponseModel({ visitorId });
      }

      response.metadata = {
        ...response.metadata,
        ip,
        utmParams: {
          source: utm_source || response.metadata?.utmParams?.source || '(not set)',
          medium: utm_medium || response.metadata?.utmParams?.medium || '(not set)',
          campaign: utm_campaign || response.metadata?.utmParams?.campaign || '(not set)',
          content: utm_content || response.metadata?.utmParams?.content || '(not set)',
          term: utm_term || response.metadata?.utmParams?.term || '(not set)'
        }
      };

      if (!response.buttons) response.buttons = [];
      response.buttons.push({
        name: button,
        pageUri,
        pageName,
        date: new Date()
      });

      await response.save();
    }

    // 3️⃣ Enviar a HubSpot API (async, sin bloquear respuesta)
    (async () => {
      try {
        await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${process.env.HUBSPOT_PORTAL_ID}/${process.env.HUBSPOT_FORM_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: Object.entries(formFields).map(([name, value]) => ({ name, value })),
            context: {
              hutk,
              pageUri,
              pageName,
              ipAddress: ip
            }
          })
        });
      } catch (err) {
        console.error('❌ Error enviando a HubSpot:', err.message);
      }
    })();

    res.json({ ok: true });

  } catch (err) {
    console.error('❌ Error en /api/lead:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
