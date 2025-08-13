import express from 'express';
import mongoose from 'mongoose';
import fetch from 'node-fetch';

const router = express.Router();

// --- Endpoint principal
router.post('/', async (req, res) => {
  try {
    const { visitorId, fields, context, button } = req.body;

    if (!visitorId || !fields) {
      return res.status(400).json({ ok: false, message: 'Faltan visitorId o fields' });
    }

    const ipCliente =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    // --- Guardar en MongoDB sin conflicto de formCount
    await mongoose.connection.collection('responses').updateOne(
      { visitorId },
      {
        $setOnInsert: {
          visitorId,
          createdAt: new Date()
        },
        $set: {
          updatedAt: new Date(),
          'metadata.ip': ipCliente,
          'metadata.utmParams': {
            source: context?.utm_source || '(not set)',
            medium: context?.utm_medium || '(not set)',
            campaign: context?.utm_campaign || '(not set)',
            content: context?.utm_content || '(not set)',
            term: context?.utm_term || '(not set)'
          },
          'metadata.hubspotForm': { ...fields }
        },
        $inc: { formCount: 1 },
        ...(button
          ? { $push: { buttons: {
              name: String(button),
              pageUri: context?.pageUri || '',
              pageName: context?.pageName || '',
              date: new Date()
            } } }
          : {})
      },
      { upsert: true }
    );

    // --- Enviar a HubSpot si SKIP_HS=false
    if (String(process.env.SKIP_HS) !== 'true') {
      const PORTAL_ID = process.env.HS_PORTAL_ID;
      const FORM_ID = process.env.HS_FORM_ID;

      if (PORTAL_ID && FORM_ID) {
        const MAP = {
          puesto: 'job_title',
          vacantes_anuales: 'annual_processes'
        };

        const hsFields = Object.entries(fields).map(([name, value]) => ({
          name: MAP[name] || name,
          value: value ?? ''
        }));

        const ctx = {
          pageUri: context?.pageUri || '',
          pageName: context?.pageName || '',
          ipAddress: ipCliente
        };

        const hutk = (context?.hutk || '').trim();
        if (hutk && hutk.length >= 20) {
          ctx.hutk = hutk;
        }

        const hsPayload = {
          fields: hsFields,
          context: ctx,
          legalConsentOptions: {
            consent: { consentToProcess: true, text: 'Acepto términos', communications: [] }
          }
        };

        const url = `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hsPayload)
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('[HS] submit error:', resp.status, errorText);
        } else {
          console.log('[HS] submit ok');
        }
      }
    }

    res.json({ ok: true });

  } catch (err) {
    console.error('[API] lead error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
