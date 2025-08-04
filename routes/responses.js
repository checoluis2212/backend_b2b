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

    // Buscar o crear documento
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // 🔹 Guardar UTM si llegan en el request
    response.metadata.utmParams = {
      source: utm_source || response.metadata?.utmParams?.source || '(not set)',
      medium: utm_medium || response.metadata?.utmParams?.medium || '(not set)',
      campaign: utm_campaign || response.metadata?.utmParams?.campaign || '(not set)'
    };

    // Incrementar contador de botón
    if (button === 'cotizar') response.buttonCounts.cotizar++;
    if (button === 'publicar') response.buttonCounts.publicar++;
    if (button === 'empleo') response.buttonCounts.empleo++;

    await response.save();

    // 🔹 Enviar evento a GA4 con UTM actualizadas
    await sendGA4Event(visitorId, `click_${button}`, response.metadata.utmParams);

    res.json({ ok: true, message: `Botón ${button} registrado y enviado a GA4` });
  } catch (error) {
    console.error('❌ Error registrando botón:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
