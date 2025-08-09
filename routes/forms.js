import express from 'express';
import axios from 'axios';
import FormSubmission from '../models/FormSubmission.js'; // modelo nuevo
import { sendGA4Event } from '../utils/ga4.js'; // opcional si quieres rastrear también

const router = express.Router();

// Utilidad para IP real
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

router.post('/submit', async (req, res) => {
  try {
    const { visitorId, nombre, email, telefono, empresa, mensaje, utm, page } = req.body;
    if (!nombre || !email || !telefono || !empresa || !mensaje) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // 1) Guardar en Mongo
    const doc = await FormSubmission.create({
      visitorId: visitorId || null,
      nombre, email, telefono, empresa, mensaje,
      metadata: {
        ip: getClientIp(req),
        referer: req.headers.referer || null,
        userAgent: req.headers['user-agent'] || null,
        utm: utm || {},
        page: page || {},
      }
    });

    // 2) Enviar a HubSpot Forms API (no exponer token en frontend)
    // Usa el endpoint de submissions clásico:
    // https://api.hsforms.com/submissions/v3/integration/submit/{PORTAL_ID}/{FORM_ID}
    const hsPortalId = process.env.HS_PORTAL_ID;
    const hsFormId   = process.env.HS_FORM_ID;

    // Construir payload HS
    const hsPayload = {
      fields: [
        { name: 'firstname', value: nombre },
        { name: 'email',     value: email },
        { name: 'phone',     value: telefono },
        { name: 'company',   value: empresa },
        { name: 'message',   value: mensaje },
      ],
      context: {
        pageUri: page?.uri || '',
        pageName: page?.name || '',
        ipAddress: getClientIp(req),
      },
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: 'El usuario acepta ser contactado.',
          communications: [{ value: true, subscriptionTypeId: 999, text: 'Comunicaciones comerciales' }]
        }
      }
    };

    await axios.post(
      `https://api.hsforms.com/submissions/v3/integration/submit/${hsPortalId}/${hsFormId}`,
      hsPayload,
      { timeout: 10000 }
    );

    // (Opcional) 3) Enviar evento GA4 por Measurement Protocol para alinear reportes
    if (visitorId) {
      await sendGA4Event({
        client_id: visitorId,
        events: [{ name: 'form_submit', params: { form_id: hsFormId, company: empresa } }],
      }).catch(() => null);
    }

    return res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('Error /api/forms/submit:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'No se pudo enviar el formulario' });
  }
});

export default router;
