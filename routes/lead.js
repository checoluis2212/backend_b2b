import express from 'express';
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import HubspotModel from '../models/Hubspot.js';
import ResponseModel from '../models/Response.js';

const router = express.Router();

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

    // 🔹 Filtrar hutk inválido antes de guardar
    const hubspotContext = {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      pageUri,
      pageName
    };
    if (hutk && hutk.trim().length > 15) {
      hubspotContext.hutk = hutk.trim();
    }

    // 1️⃣ Guardar en colección Hubspot (Mongo)
    const hubspotDoc = new HubspotModel({
      json: {
        fields: formFields,
        context: hubspotContext
      },
      _meta: { ip, ua, createdAt: new Date() }
    });

    await hubspotDoc.save();

    // 2️⃣ Actualizar en responses sin conflicto en `formCount`
    if (visitorId && button) {
      await ResponseModel.updateOne(
        { visitorId },
        {
          $setOnInsert: { visitorId, createdAt: new Date() },
          $set: {
            updatedAt: new Date(),
            'metadata.ip': ip,
            'metadata.utmParams': {
              source: utm_source || '(not set)',
              medium: utm_medium || '(not set)',
              campaign: utm_campaign || '(not set)',
              content: utm_content || '(not set)',
              term: utm_term || '(not set)'
            }
          },
          $push: {
            buttons: {
              name: button,
              pageUri,
              pageName,
              date: new Date()
            }
          },
          $inc: { formCount: 1 }
        },
        { upsert: true }
      );
    }

    // 3️⃣ Preparar contexto para HubSpot
    const hsContext = {
      pageUri,
      pageName,
      ipAddress: ip
    };
    if (hutk && hutk.trim().length > 15) {
      hsContext.hutk = hutk.trim();
    }

    // 4️⃣ Enviar a HubSpot API (async)
    (async () => {
      try {
        const hsRes = await fetch(
          `https://api.hsforms.com/submissions/v3/integration/submit/${process.env.HUBSPOT_PORTAL_ID}/${process.env.HUBSPOT_FORM_ID}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: Object.entries(formFields).map(([name, value]) => ({
                name,
                value
              })),
              context: hsContext
            })
          }
        );

        const hsData = await hsRes.text();
        if (!hsRes.ok) {
          console.error('[HS] submit error:', hsRes.status, hsData);
        } else {
          console.log('[HS] enviado correctamente:', hsData);
        }
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
