import express from 'express';
import Response from '../models/Response.js';
import { sendGA4Event } from '../utils/ga4.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { visitorId, button } = req.body;

    if (!visitorId || !button) {
      return res.status(400).json({ error: 'visitorId y button son requeridos' });
    }

    // Buscar o crear documento
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // Incrementar contador de botón
    if (button === 'cotizar') response.buttonCounts.cotizar++;
    if (button === 'publicar') response.buttonCounts.publicar++;
    if (button === 'empleo') response.buttonCounts.empleo++;

    await response.save();

    // 🔹 UTM params
    const utmParams = response.metadata?.utmParams || {};

    // 🔹 Enviar evento a GA4 con UTM
    await sendGA4Event(visitorId, `click_${button}`, utmParams);

    res.json({ ok: true, message: `Botón ${button} registrado y enviado a GA4` });
  } catch (error) {
    console.error('❌ Error registrando botón:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
