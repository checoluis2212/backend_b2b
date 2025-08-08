import express from 'express';
import Response from '../models/Response.js';
import { upsertHubspotContact } from '../services/hubspot.js';
import { sendGA4Event } from '../utils/ga.js';

const router = express.Router();

/**
 * POST /api/responses/contact
 * Recibe datos de un formulario y los guarda/enlaza en Mongo, HubSpot y GA4
 */
router.post('/contact', async (req, res) => {
  try {
    // 1) Desestructurar los campos esperados del body
    const {
      visitorId,
      nombre,
      apellido,
      email,
      telefono,
      company,
      jobtitle,
      vacantes_anuales,
      rfc
    } = req.body;

    // 2) Validar los campos mínimos
    if (!visitorId || !email) {
      return res.status(400).json({ error: 'visitorId y email son requeridos' });
    }

    // 3) Buscar o crear el documento Response en Mongo
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // 4) Actualizar contador y timestamps
    const now = new Date();
    response.submissionCount = (response.submissionCount || 0) + 1;
    if (!response.firstSubmission) {
      response.firstSubmission = now;
    }
    response.lastSubmission = now;

    // 5) Guardar registro de contacto dentro del documento
    response.contacts.push({
      name:          nombre,
      email,
      phone:         telefono,
      company,
      jobtitle,
      vacantes:      parseInt(vacantes_anuales, 10) || 0,
      rfc,
      payload:       { ...req.body }
    });

    // 6) Persistir cambios en MongoDB
    await response.save();

    // 7) Sincronizar/Upsert en HubSpot (ignorar errores)
    try {
      await upsertHubspotContact(email, visitorId, { firstname: nombre, lastname: apellido });
    } catch (err) {
      console.error('⚠️ HubSpot upsert failed:', err?.response?.data || err.message);
    }

    // 8) Enviar evento a GA4 vía Measurement Protocol
    try {
      await sendGA4Event(visitorId, 'form_submit', response.metadata.utmParams);
    } catch (err) {
      console.error('❌ Error enviando evento GA4:', err.message);
    }

    // 9) Responder al cliente
    return res.json({ ok: true, data: response });
  } catch (err) {
    console.error('❌ Error registrando formulario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
