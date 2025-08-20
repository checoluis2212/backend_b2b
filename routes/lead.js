// routes/lead.js
import express from 'express';
import Lead from '../models/Lead.js';

const router = express.Router();

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// Guarda el espejo del submit del form en Mongo
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};

    const doc = await Lead.create({
      visitorId: b.visitorId || b.visitorid || '',
      vidCookie: b.vid_cookie || '',

      utm: {
        source:   b.utm_source   || '(not set)',
        medium:   b.utm_medium   || '(not set)',
        campaign: b.utm_campaign || '(not set)',
        content:  b.utm_content,
        term:     b.utm_term,
      },

      page:     b.page || b.page_location || '',
      referrer: b.referrer || b.page_referrer || '',
      form_id:  b.form_id || 'hubspot_embed',

      // ‘fields’ = pares name/value que alcanzaste a leer del iframe
      fields: b,

      raw: b,
      _meta: {
        ip: getClientIp(req),
        ua: req.headers['user-agent'] || '',
      },
    });

    res.json({ ok: true, id: doc._id });
  } catch (err) {
    console.error('[API] /api/lead error:', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

export default router;
