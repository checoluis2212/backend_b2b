// routes/hubspotWebhook.js
import express from 'express';
import HubspotSubmission from '../models/HubspotSubmission.js';
import Contact from '../models/Contact.js';
import { getContactById } from '../services/hubspot.js';

const router = express.Router();
const FORM_GUID = '5f745bfa-8589-40c2-9940-f9081123e0b4';

router.post('/', async (req, res) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const evt of events) {
    if (evt.subscriptionType !== 'object.creation') {
      continue;
    }

    const hubspotId = evt.objectId;
    let properties;

    // 1) Intenta traer el contacto; si falla (p.ej. en test), lo saltamos
    try {
      const hsContact = await getContactById(hubspotId);
      properties = hsContact.properties || {};
    } catch (err) {
      console.warn('⚠️ No pude obtener contacto', hubspotId, err.message);
      continue;  // salta este evento, pero no aborta todo el handler
    }

    // 2) Filtra sólo tu formulario
    if (properties.hs_analytics_source_data_2 !== FORM_GUID) {
      continue;
    }

    // 3) Upsert en Contact con contador y fechas
    await Contact.findOneAndUpdate(
      { hubspotId },
      {
        $set: {
          properties,
          syncedAt: new Date(),
          lastSubmissionAt: new Date()
        },
        $setOnInsert: { firstSubmissionAt: new Date() },
        $inc: { submissionCount: 1 }
      },
      { upsert: true, new: true }
    );

    // 4) Guarda sumisión cruda
    await new HubspotSubmission({
      portalId: evt.portalId,
      formId:   FORM_GUID,
      submittedAt: evt.eventDate ? new Date(evt.eventDate) : new Date(),
      fields: properties
    }).save();
  }

  // Siempre devolvemos 200 OK para que HubSpot no reintente el webhook
  return res.status(200).send('OK');
});

export default router;
