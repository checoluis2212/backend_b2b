// backend/routes/responses.js
import express from 'express';
import Response from '../models/Response.js';
import { URL } from 'url';

const router = express.Router();

// ————————— SANITY CHECK —————————
router.get('/', (_req, res) => {
  return res.send('✅ El router /api/responses funciona perfectamente');
});

// ————————— LISTAR TODAS LAS RESPUESTAS —————————
router.get('/all', async (_req, res) => {
  try {
    const list = await Response.find().sort({ createdAt: -1 });
    return res.json(list);
  } catch (err) {
    console.error('❌ Error al listar respuestas:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

const validButtons = ['cotizar', 'publicar', 'oportunidades'];

router.post('/', async (req, res) => {
  console.log('📬 LLEGÓ UN POST:', req.body);
  const { visitorId, button, currentUrl } = req.body;

  // 1) Validación
  if (!visitorId || !validButtons.includes(button)) {
    return res
      .status(400)
      .json({ success: false, error: 'visitorId y button válidos son obligatorios' });
  }

  // 2) Extraer metadata
  // IP real tras proxy (Render, Vercel, etc.)
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection.remoteAddress ||
    '';

  // Referer desde cabecera HTTP
  const referer = req.get('Referer') || '';

  // Parsear utm params si se envió currentUrl
  const utmParams = {};
  if (currentUrl) {
    try {
      const url = new URL(currentUrl);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((key) => {
        if (url.searchParams.has(key)) {
          utmParams[key.replace('utm_', '')] = url.searchParams.get(key);
        }
      });
    } catch (e) {
      console.warn('⚠️ URL inválida para parsing UTM:', currentUrl);
    }
  }

  // 3) Crear o actualizar documento
  let doc = await Response.findOne({ visitorId });
  if (doc) {
    doc.buttonCounts[button] = (doc.buttonCounts[button] || 0) + 1;
    doc.metadata = { ip, referer, utmParams };
    await doc.save();
  } else {
    const initial = { cotizar: 0, publicar: 0, oportunidades: 0 };
    initial[button] = 1;
    doc = new Response({
      visitorId,
      buttonCounts: initial,
      metadata: { ip, referer, utmParams },
    });
    await doc.save();
  }

  // 4) Respuesta
  res.json({
    success: true,
    visitorId: doc.visitorId,
    buttonCounts: doc.buttonCounts,
    metadata: doc.metadata,
  });
});

export default router;
