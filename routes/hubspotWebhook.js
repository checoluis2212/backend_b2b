// routes/hubspotWebhook.js
import express from 'express';
import HubspotSubmission from '../models/HubspotSubmission.js';
import Contact from '../models/Contact.js';
import { getContactById } from '../services/hubspot.js';

const FORM_GUID = '5f745bfa-8589-40c2-9940-f9081123e0b4';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const evt of events) {
      if (evt.subscriptionType !== 'object.creation') continue;

      const hubspotId = evt.objectId;
      // 1) Trae el contacto completo
      const { properties } = await getContactById(hubspotId);
      
      // 2) Filtra sólo si vino de nuestro form
      const formGuid = properties.hs_analytics_source_data_2;
      if (formGuid !== FORM_GUID) continue;

      // 3) Upsert en Contact (contador, fechas, properties)
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

      // 4) Guarda la sumisión cruda
      await new HubspotSubmission({
        portalId: evt.portalId,
        formId:   FORM_GUID,
        submittedAt: evt.eventDate ? new Date(evt.eventDate) : new Date(),
        fields: properties
      }).save();
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Error en webhook CRM object.creation:', err);
    return res.status(500).send('Server error');
  }
});

export default router;
