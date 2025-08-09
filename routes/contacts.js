import express from 'express';
import Contact from '../models/Contact.js';
import { sendGA4Event } from '../utils/ga4.js';

const router = express.Router();

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Crea un contacto en Mongo (colección `contacts`)
 * Espera (sugerido):
 * {
 *   visitorId, nombre, email, telefono, empresa, mensaje,
 *   utm: { source, medium, campaign, term, content },
 *   page: { uri, name },
 *   raw: {...}  // opcional: objeto crudo del form HubSpot
 * }
 */
router.post('/', async (req, res) => {
  try {
    const {
      visitorId,
      nombre, email, telefono, empresa, mensaje,
      utm, page, raw
    } = req.body || {};

    const doc = await Contact.create({
      visitorId: visitorId || null,
      nombre:   nombre   || null,
      email:    email    || null,
      telefono: telefono || null,
      empresa:  empresa  || null,
      mensaje:  mensaje  || null,
      metadata: {
        ip: getClientIp(req),
        referer: req.headers.referer || null,
        userAgent: req.headers['user-agent'] || null,
        utm: utm || {},
        page: page || {}
      },
      raw: raw || null
    });

    // Opcional: reportar a GA4 por Measurement Protocol
    if (visitorId) {
      sendGA4Event(visitorId, 'form_submit', {
        page_location: page?.uri || null,
        company: empresa || null
      }).catch(() => null);
    }

    return res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('❌ POST /api/contacts:', err?.response?.data || err.message);
    return res.status(500).json({ ok: false, error: 'No se pudo guardar el contacto' });
  }
});

export default router;
