import express from 'express';
import Response from '../models/Response.js';
import { sendGA4Event } from '../utils/ga4.js';
import { upsertHubspotContact } from '../utils/hubspot.js';

const router = express.Router();

/**
 * 1) Clicks de botones
 */
router.post('/', async (req, res) => {
  try {
    const { visitorId, button, utm_source, utm_medium, utm_campaign } = req.body;
    if (!visitorId || !button) {
      return res.status(400).json({ error: 'visitorId y button son requeridos' });
    }

    let response = await Response.findOne({ visitorId });
    if (!response) response = new Response({ visitorId });

    // IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.ip
             || req.socket.remoteAddress;
    response.metadata.ip = ip;

    // UTM
    response.metadata.utmParams = {
      source:   utm_source   || response.metadata?.utmParams?.source   || '(not set)',
      medium:   utm_medium   || response.metadata?.utmParams?.medium   || '(not set)',
      campaign: utm_campaign || response.metadata?.utmParams?.campaign || '(not set)'
    };

    // Contadores
    if (button === 'cotizar')  response.buttonCounts.cotizar++;
    if (button === 'publicar') response.buttonCounts.publicar++;
    if (button === 'empleo')   response.buttonCounts.empleo++;

    await response.save();

    // GA4
    await sendGA4Event(visitorId, `click_${button}`, response.metadata.utmParams);

    // Respuesta detallada
    return res.json({
      ok:      true,
      message: `Botón ${button} registrado correctamente`,
      data:    response
    });
  } catch (err) {
    console.error('❌ Error registrando botón:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

/**
 * 2) Envíos de formulario
 */
router.post('/contact', async (req, res) => {
  try {
    const { visitorId, name, email, ...rest } = req.body;
    if (!visitorId || !email) {
      return res.status(400).json({ error: 'visitorId y email son requeridos' });
    }

    let response = await Response.findOne({ visitorId });
    if (!response) response = new Response({ visitorId });

    // Guardar contacto
    response.contacts.push({ name, email, payload: rest });
    response.submissionCount++;

    await response.save();

    // HubSpot
    try {
      await upsertHubspotContact(email, visitorId, { firstname: name });
    } catch (hsErr) {
      console.error('⚠️ HubSpot upsert failed:', hsErr.response?.data || hsErr.message);
    }

    // GA4
    await sendGA4Event(visitorId, 'form_submit', {
      ...response.metadata.utmParams,
      form: 'Lead_Form'
    });

    // Respuesta detallada
    return res.json({
      ok:      true,
      message: 'Formulario registrado correctamente',
      data:    response
    });
  } catch (err) {
    console.error('❌ Error registrando formulario:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
