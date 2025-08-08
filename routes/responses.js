import express from 'express';
import Response from '../models/Response.js';
import { sendGA4Event } from '../utils/ga4.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { visitorId, button, utm_source, utm_medium, utm_campaign } = req.body;

    if (!visitorId || !button) {
      return res.status(400).json({ error: 'visitorId y button son requeridos' });
    }

    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    const ipCliente =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;

    response.metadata.ip = ipCliente;

    response.metadata.utmParams = {
      source: utm_source || response.metadata?.utmParams?.source || '(not set)',
      medium: utm_medium || response.metadata?.utmParams?.medium || '(not set)',
      campaign: utm_campaign || response.metadata?.utmParams?.campaign || '(not set)'
    };

    if (button === 'cotizar') response.buttonCounts.cotizar++;
    if (button === 'publicar') response.buttonCounts.publicar++;
    if (button === 'empleo') response.buttonCounts.empleo++;

    await response.save();

    await sendGA4Event(visitorId, `click_${button}`, response.metadata.utmParams);

    // 🔹 Log seguro solo en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📩 Evento ${button} registrado para visitorId ****${visitorId.slice(-4)}`);
    }

    res.json({ ok: true, message: `Botón ${button} registrado en Mongo y enviado a GA4` });
  } catch (error) {
    console.error('❌ Error registrando botón:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(error.stack);
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
