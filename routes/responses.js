import express from 'express';
import Response from '../models/Response.js';
import { sendGA4Event } from '../utils/ga4.js';

const router = express.Router();

/**
 * 1) Endpoint para clicks de botones
 */
router.post('/', async (req, res) => {
  try {
    const { visitorId, button, utm_source, utm_medium, utm_campaign } = req.body;
    if (!visitorId || !button) {
      return res.status(400).json({ error: 'visitorId y button son requeridos' });
    }

    // Busca o crea el documento de Response
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // Actualiza IP y UTM params
    const ipCliente =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    response.metadata.ip = ipCliente;
    response.metadata.utmParams = {
      source:   utm_source   || response.metadata?.utmParams?.source   || '(not set)',
      medium:   utm_medium   || response.metadata?.utmParams?.medium   || '(not set)',
      campaign: utm_campaign || response.metadata?.utmParams?.campaign || '(not set)',
    };

    // Incrementa el contador del botón correspondiente
    if (button === 'cotizar')  response.buttonCounts.cotizar++;
    if (button === 'publicar') response.buttonCounts.publicar++;
    if (button === 'empleo')   response.buttonCounts.empleo++;

    await response.save();

    // Envía evento a GA4
    await sendGA4Event(visitorId, `click_${button}`, response.metadata.utmParams);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📩 Evento ${button} registrado para visitorId ****${visitorId.slice(-4)}`);
    }
    return res.json({ ok: true, message: `Botón ${button} registrado en Mongo y enviado a GA4` });
  } catch (error) {
    console.error('❌ Error registrando botón:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * 2) Endpoint para envíos de formulario (contact)
 */
router.post('/contact', async (req, res) => {
  try {
    const { visitorId, name, email, ...rest } = req.body;
    if (!visitorId || !email) {
      return res.status(400).json({ error: 'visitorId y email son requeridos' });
    }

    // Busca o crea el documento de Response
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // Añade el envío al array contacts y sube el contador
    response.contacts.push({
      name:    name || '(no name)',
      email,
      payload: rest
    });
    response.submissionCount = (response.submissionCount || 0) + 1;

    await response.save();

    // (Opcional) envía un evento a GA4
    await sendGA4Event(visitorId, 'form_submit', {
      // reutiliza utmParams guardados
      ...response.metadata.utmParams,
      form: 'Lead_Form'
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📩 Formulario guardado para visitorId ****${visitorId.slice(-4)}`);
    }
    return res.json({ ok: true, message: 'Formulario registrado en Mongo y enviado a GA4' });
  } catch (error) {
    console.error('❌ Error registrando formulario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
