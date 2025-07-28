// backend/routes/responses.js
import express from 'express';
import Response from '../models/Response.js';
import { URL } from 'url';

const router = express.Router();

// SANITY CHECK
router.get('/', (_req, res) => {
  return res.send('✅ El router /api/responses funciona perfectamente');
});

// LISTAR TODAS LAS RESPUESTAS
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
  const { visitorId, button, utmParams } = req.body;

  // 1) Validación
  if (!visitorId || !validButtons.includes(button)) {
    return res
      .status(400)
      .json({ success: false, error: 'visitorId y button válidos son obligatorios' });
  }

  // 2) Extraer IP y referer
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection.remoteAddress ||
    '';
  const referer = req.get('Referer') || '';

  // 3) Intentamos encontrar un documento existente
  let doc = await Response.findOne({ visitorId });

  if (doc) {
    // —> YA EXISTE: solo incrementamos el contador
    doc.buttonCounts[button] = (doc.buttonCounts[button] || 0) + 1;
    await doc.save();
  } else {
    // —> PRIMERA INTERACCIÓN: guardamos metadata + contador inicial
    const initialCounts = { cotizar: 0, publicar: 0, oportunidades: 0 };
    initialCounts[button] = 1;

    doc = new Response({
      visitorId,
      buttonCounts: initialCounts,
      metadata: {
        ip,
        referer,
        // utmParams viene del front (parsing en cliente), o {} si no hay
        utmParams: typeof utmParams === 'object' ? utmParams : {},
      }
    });
    await doc.save();
  }

  // 4) Devolvemos el estado actual
  return res.json({
    success: true,
    visitorId: doc.visitorId,
    buttonCounts: doc.buttonCounts,
    metadata: doc.metadata,  // la verás solo con los datos de la 1ª interacción
  });
});

export default router;
