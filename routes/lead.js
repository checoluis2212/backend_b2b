import express from 'express';
import Response from '../models/Response.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { visitorId, fields, context } = req.body;

    // Si "fields" es array => convertirlo a objeto plano
    let fieldsObj;
    if (Array.isArray(fields)) {
      fieldsObj = fields.reduce((acc, f) => {
        acc[f.name] = f.value;
        return acc;
      }, {});
    } else {
      fieldsObj = fields; // ya es objeto
    }

    if (!fieldsObj?.email) {
      return res.status(400).json({ ok: false, error: 'Email es requerido' });
    }

    // Guardar en Mongo
    const response = new Response({
      visitorId: visitorId || null,
      fields: fieldsObj,
      context,
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
