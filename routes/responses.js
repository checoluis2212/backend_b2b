import express from 'express';
import Response from '../models/Response.js';
import { findContactByEmail } from '../services/hubspot.js';

const router = express.Router();

router.post('/contact', async (req, res) => {
  try {
    const {
      visitorId,
      nombre, apellido, email, telefono,
      company, jobtitle, vacantes_anuales, rfc,
      utm_source, utm_medium, utm_campaign
    } = req.body;

    const now = new Date();
    let response = await Response.findOne({ visitorId });
    if (!response) {
      response = new Response({ visitorId });
      response.firstSubmission = now;
      response.metadata = {
        ip:      req.ip,
        referer: req.get('Referer') || '',
        utmParams: { source: utm_source, medium: utm_medium, campaign: utm_campaign }
      };
    }
    response.submissionCount = (response.submissionCount || 0) + 1;
    response.lastSubmission   = now;

    // Payload raw
    response.contacts.push({
      name:     `${nombre} ${apellido}`,
      email,
      phone:    telefono,
      company,
      jobtitle,
      vacantes: parseInt(vacantes_anuales, 10) || 0,
      rfc,
      payload:  req.body,
      fromForm: false
    });

    // Enriquecer con HubSpot
    const hs = await findContactByEmail(email);
    if (hs) {
      const p = hs.properties;
      response.contacts.push({
        name:      `${p.firstname} ${p.lastname}`,
        email:      p.email,
        phone:      p.phone,
        company:    p.company,
        jobtitle:   p.jobtitle,
        payload:    p,
        createdAt:  new Date(p.createdate),
        fromForm:   true
      });
    }

    await response.save();
    res.json({ ok: true, data: response });
  } catch (err) {
    console.error('Error in /contact:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
