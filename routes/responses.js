// routes/responses.js
import express from 'express';
import Response from '../models/Response.js';
import { findContactByEmail } from '../services/hubspot.js';

const router = express.Router();

router.post('/contact', async (req, res) => {
  try {
    const {
      visitorId,
      nombre, apellido, email, telefono,
      company, jobtitle, vacantes_anuales, rfc
    } = req.body;

    // 1) Upsert de la sumisión en Response
    const now = new Date();
    const resp = await Response.findOneAndUpdate(
      { visitorId },
      {
        $inc:  { submissionCount: 1 },
        $setOnInsert: { firstSubmission: now, metadata: {
          ip: req.ip,
          referer: req.get('Referer') || '',
          utmParams: {
            source: req.body.utm_source,
            medium: req.body.utm_medium,
            campaign: req.body.utm_campaign
          }
        }},
        $set: { lastSubmission: now }
      },
      { new: true, upsert: true }
    );

    // 2) Mete el formulario en el sub‐array contacts
    const contactPayload = {
      name: `${nombre} ${apellido}`,
      email,
      phone: telefono,
      company,
      jobtitle,
      vacantes: vacantes_anuales,
      rfc,
      payload: req.body
    };
    resp.contacts.push(contactPayload);

    // 3) Llama a HubSpot para traer datos enriquecidos
    const hsContact = await findContactByEmail(email);
    if (hsContact) {
      // Mapea las propiedades de HubSpot
      const p = hsContact.properties;
      resp.contacts.push({
        name:    `${p.firstname} ${p.lastname}`,
        email:    p.email,
        phone:    p.phone,
        company:  p.company,
        jobtitle: p.jobtitle,
        payload:  hsContact,
        fromForm: true
      });
    }

    // 4) Guarda el documento actualizado
    await resp.save();

    return res.json({ ok: true, data: resp });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
