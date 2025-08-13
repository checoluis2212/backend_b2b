// routes/lead.js
import express from 'express';
import Response from '../models/Response.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { visitorId, fields, context } = req.body;

    // ✅ Acepta tanto objeto como array para fields
    let emailField;
    if (Array.isArray(fields)) {
      emailField = fields.find(f => f.name === 'email')?.value;
    } else {
      emailField = fields?.email;
    }

    if (!emailField) {
      return res.status(400).json({ ok: false, error: 'Email es requerido' });
    }

    // Guardar en Mongo
    let response = new Response({
      visitorId: visitorId || null,
      json: { fields, context },
      _meta: {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        ua: req.headers['user-agent']
      }
    });

    await response.save();
    console.log('[API] Lead guardado en Mongo _id:', response._id);

    res.json({ ok: true, id: response._id });

  } catch (err) {
    console.error('[API] lead error:', err);
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
});

export default router;
