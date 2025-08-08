// routes/hubspotWebhook.js
import express from 'express';
import crypto from 'crypto';
import HubspotSubmission from '../models/HubspotSubmission.js';
import Contact from '../models/Contact.js';
import { upsertContactByEmail } from '../services/hubspot.js';

const router = express.Router();

// Middlware para validar la firma de HubSpot (opcional pero recomendable)
function verifyHubspotSignature(req, res, next) {
  const secret = process.env.HUBSPOT_WEBHOOK_SECRET; 
  const signature = req.headers['x-hubspot-signature'] || '';
  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (hash !== signature) {
    return res.status(401).send('Invalid signature');
  }
  next();
}

// Usar express.json antes de montar la ruta
// En server.js: app.use(express.json());

router.post('/', /* verifyHubspotSignature, */ async (req, res) => {
  try {
    // HubSpot envía un array de eventos
    const events = req.body; 
    for (const evt of events) {
      if (evt.subscriptionType !== 'form_submission') continue;

      const { portalId, formGuid: formId, submissions } = evt;
      // submissions es un array de sumisiones; procesa cada una
      for (const sub of submissions) {
        const fieldsObj = {};
        sub.values.forEach(f => { fieldsObj[f.name] = f.value; });

        // 1) Sincroniza contacto en HubSpot
        const { id: hubspotId, properties } = await upsertContactByEmail(fieldsObj);

        // 2) Actualiza Contact en Mongo (contador y fechas)
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
          { upsert: true }
        );

        // 3) Guarda la sumisión pura
        await new HubspotSubmission({
          portalId,
          formId,
          submittedAt: sub.submittedAt,
          fields: fieldsObj
        }).save();
      }
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('❌ Error webhook HubSpot:', err);
    res.status(500).send('Server error');
  }
});

export default router;
