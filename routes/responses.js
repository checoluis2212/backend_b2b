// File: routes/responses.js
import express from 'express';
import Response from '../models/Response.js';
import { upsertHubspotContact } from '../services/hubspot.js';

const router = express.Router();

/**
 * POST /api/responses/contact
 * Recibe datos de un formulario y los guarda/enlaza en Mongo y HubSpot
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

    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
    }

    // Update submission count and timestamps
    const now = new Date();
    response.submissionCount = (response.submissionCount || 0) + 1;
    if (!response.firstSubmission) {
      response.firstSubmission = now;
    }
    response.lastSubmission = now;

    // Save contact payload
    response.contacts.push({
      name:      nombre,
      email,
      phone:     telefono,
      company,
      jobtitle,
      vacantes:  parseInt(vacantes_anuales, 10) || 0,
      rfc,
      payload:   { ...req.body }
    });

    await response.save();

    // Upsert in HubSpot
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

// --------------------------------------------------
// File: services/hubspot.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HS_TOKEN) {
  throw new Error('❌ Falta la variable HUBSPOT_TOKEN');
}
