// jobs/pollHubspot.js
import cron from 'node-cron';
import { fetchFormSubmissions } from '../services/hubspotForms.js';
import HubspotSubmission from '../models/HubspotSubmission.js';
import Contact from '../models/Contact.js';

// GUID de tu formulario
const FORM_ID = '5f745bfa-8589-40c2-9940-f9081123e0b4';

// Timestamp inicial (10 minutos antes)
let lastTimestamp = Date.now() - 1000 * 60 * 10;

export function startHubspotPolling() {
  // Ejecuta cada 5 minutos
  cron.schedule('*/5 * * * *', async () => {
    try {
      const subs = await fetchFormSubmissions(lastTimestamp);
      if (!subs.length) return;

      console.log(`🔄 HubSpot: ${subs.length} envíos nuevos`);

      for (const s of subs) {
        // Construye objeto fields
        const fields = Object.fromEntries(s.values.map(v => [v.name, v.value]));

        // 1) Guarda sumisión cruda
        await HubspotSubmission.create({
          portalId:    s.portalId,
          formId:      s.formGuid,
          submittedAt: new Date(s.submittedAt),
          fields
        });

        // 2) Upsert en Contact
        const email = fields.email; // clave primaria
        await Contact.findOneAndUpdate(
          { 'properties.email': email },
          {
            $set: {
              properties:       fields,
              syncedAt:         new Date(),
              lastSubmissionAt: new Date(s.submittedAt)
            },
            $setOnInsert: {
              firstSubmissionAt: new Date(s.submittedAt)
            },
            $inc: { submissionCount: 1 }
          },
          { upsert: true, new: true }
        );
      }

      // 3) Actualiza timestamp
      lastTimestamp = Math.max(...subs.map(s => s.submittedAt));
    } catch (err) {
      console.error('❌ Error polling HubSpot:', err);
    }
  });

  console.log('✅ Polling de HubSpot iniciado (cada 5 minutos)');
}
