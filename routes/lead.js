// routes/lead.js
import express from 'express';
import Response from '../models/Response.js';

const router = express.Router();

// Campos “planos” que aceptamos también si vienen al nivel raíz
const FLAT_FIELD_KEYS = [
  'email','firstname','lastname','phone','company',
  'puesto','vacantesAnuales','rfc','aceptaComunicaciones'
];

function toBooleanLike(v) {
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'on' || s === 'sí' || s === 'si' || s === 'accepted';
}

function buildFieldsObj(body) {
  const out = Object.create(null);

  // 1) Si viene como array [{name,value}, ...] (lo que mandas desde la LP)
  if (Array.isArray(body.fields)) {
    for (const f of body.fields) {
      if (!f || typeof f.name !== 'string') continue;
      const name = f.name.trim();
      let val = f.value;
      if (typeof val === 'string') val = val.trim();
      if (name === 'aceptaComunicaciones') val = toBooleanLike(val);
      out[name] = val ?? '';
    }
  }
  // 2) Si viene como objeto { email, firstname, ... }
  else if (body.fields && typeof body.fields === 'object') {
    for (const [k, v] of Object.entries(body.fields)) {
      out[k] = typeof v === 'string' ? v.trim() : v;
    }
  }

  // 3) Fallback: si no vino en fields, toma llaves planas del body
  for (const k of FLAT_FIELD_KEYS) {
    if (out[k] == null && body[k] != null) {
      out[k] = typeof body[k] === 'string' ? body[k].trim() : body[k];
    }
  }

  // 4) Normaliza email
  if (typeof out.email === 'string') out.email = out.email.toLowerCase().trim();

  return out;
}

function buildContext(body) {
  const c = body.context || {};
  return {
    utm_source:   c.utm_source   ?? body.utm_source   ?? '',
    utm_medium:   c.utm_medium   ?? body.utm_medium   ?? '',
    utm_campaign: c.utm_campaign ?? body.utm_campaign ?? '',
    utm_content:  c.utm_content  ?? body.utm_content  ?? '',
    utm_term:     c.utm_term     ?? body.utm_term     ?? '',
    pageUri:      c.pageUri      ?? body.pageUri      ?? '',
    pageName:     c.pageName     ?? body.pageName     ?? '',
    hutk:         c.hutk         ?? body.hutk         ?? ''
  };
}

router.post('/', async (req, res) => {
  try {
    const b = req.body || {};

    // 🔧 normaliza fields/context
    const fieldsObj = buildFieldsObj(b);
    const context   = buildContext(b);

    if (!fieldsObj?.email) {
      return res.status(400).json({ ok: false, error: 'Email es requerido' });
    }

    // Guardar en Mongo
    const response = new Response({
      visitorId: b.visitorId || null,
      fields: fieldsObj,
      context,
      _meta: {
        ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
        ua: req.headers['user-agent'] || ''
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
