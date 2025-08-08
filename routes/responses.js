// File: routes/responses.js
import express from 'express';
import Response from '../models/Response.js';
import { upsertHubspotContact } from '../services/hubspot.js';

const router = express.Router();

/**
 * POST /api/responses/contact
 * Guarda los datos del form en Mongo y sincroniza a HubSpot
 */
router.post('/contact', async (req, res) => {
  try {
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

    if (!visitorId || !email) {
      return res.status(400).json({ error: 'visitorId y email son requeridos' });
    }

    // Buscar o crear documento
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // Actualizar contador y timestamps
    const now = new Date();
    response.submissionCount = (response.submissionCount || 0) + 1;
    if (!response.firstSubmission) {
      response.firstSubmission = now;
    }
    response.lastSubmission = now;

    // Agregar registro de contacto
    response.contacts.push({
      name:     nombre,
      email,
      phone:    telefono,
      company,
      jobtitle,
      vacantes: parseInt(vacantes_anuales, 10) || 0,
      rfc,
      payload:  { ...req.body }
    });

    // Guardar en Mongo
    await response.save();

    // Upsert en HubSpot (ignora fallos)
    try {
      await upsertHubspotContact(email, visitorId, {
        firstname: nombre,
        lastname:  apellido
      });
    } catch (err) {
      console.error('⚠️ HubSpot upsert failed:', err?.response?.data || err.message);
    }

    return res.json({ ok: true, data: response });
  } catch (err) {
    console.error('❌ Error registrando formulario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
