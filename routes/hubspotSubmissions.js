// routes/hubspotSubmissions.js
import express from 'express';
import HubspotSubmission from '../models/HubspotSubmission.js';
import Contact from '../models/Contact.js';
import { upsertContactByEmail } from '../services/hubspot.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { portalId, formId, fields } = req.body;
    if (!portalId || !formId || !fields) {
      return res.status(400).json({ error: 'portalId, formId y fields son requeridos' });
    }

    // 1) Sincroniza en HubSpot (busca o crea) y obtén id + properties
    const { id: hubspotId, properties } = await upsertContactByEmail(fields);

    // 2) Actualiza tu Contact: contador + fechas + properties + syncedAt
    await Contact.findOneAndUpdate(
      { hubspotId },
      {
        $set: {
          properties,
          syncedAt: new Date(),
          lastSubmissionAt: new Date()
        },
        $setOnInsert: {
          firstSubmissionAt: new Date()
        },
        $inc: { submissionCount: 1 }
      },
      { upsert: true, new: true }
    );

    // 3) Guarda la sumisión cruda en HubspotSubmission
    const submission = new HubspotSubmission({ portalId, formId, fields });
    await submission.save();

    return res.json({ ok: true, message: 'Contacto sincronizado y sumisión guardada' });
  } catch (error) {
    console.error('❌ Error hubspot-submissions:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
