import express from 'express';
import Contact from '../models/Contact.js';

const router = express.Router();

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip || req.socket?.remoteAddress || null
  );
}

// Recibe datos del embed de HubSpot (o de tu propio form)
router.post('/', async (req, res) => {
  try {
    const {
      visitorId,
      nombre, email, telefono, empresa, mensaje,
      utm, page,
      raw // opcional: el objeto completo serializado del form
    } = req.body;

    const doc = await Contact.create({
      visitorId: visitorId || null,
      nombre: nombre || null,
      email: email || null,
      telefono: telefono || null,
      empresa: empresa || null,
      mensaje: mensaje || null,
      metadata: {
        ip: getClientIp(req),
        referer: req.headers.referer || null,
        userAgent: req.headers['user-agent'] || null,
        utm: utm || {},
        page: page || {}
      },
      raw: raw || null
    });

    res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('❌ POST /api/contacts:', err.message);
    res.status(500).json({ ok: false, error: 'No se pudo guardar el contacto' });
  }
});

export default router;
