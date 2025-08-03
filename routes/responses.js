import express from 'express';
import Response from '../models/Response.js';

const router = express.Router();

// Sanity check
router.get('/', (_req, res) => res.send('✅ El router /api/responses funciona perfectamente'));

// Listar todas las respuestas
router.get('/all', async (_req, res) => {
  try {
    const list = await Response.find().sort({ createdAt: -1 });
    return res.json(list);
  } catch (err) {
    console.error('❌ Error al listar respuestas:', err);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

const validButtons = ['cotizar', 'publicar', 'empleo'];

router.post('/', async (req, res) => {
  console.log('📬 LLEGÓ UN POST:', req.body);
  const { visitorId, button, utmParams } = req.body;

  // Validación
  if (!visitorId || !validButtons.includes(button)) {
    console.warn('⚠️ Datos inválidos:', { visitorId, button });
    return res.status(400).json({ success: false, error: 'visitorId y button válidos son obligatorios' });
  }

  try {
    // Extraer IP y referer
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection.remoteAddress || '';
    const referer = req.get('Referer') || '';

    // Buscar doc existente
    let doc = await Response.findOne({ visitorId });

    if (doc) {
      // Ya existe: solo incrementamos contador
      doc.buttonCounts[button] = (doc.buttonCounts[button] || 0) + 1;
      await doc.save();
      console.log(`✅ Actualizado documento existente para ${visitorId}`);
    } else {
      // Primera interacción: guardamos metadata + contador inicial
      const initial = { cotizar: 0, publicar: 0, empleo: 0 };
      initial[button] = 1;

      doc = new Response({
        visitorId,
        buttonCounts: initial,
        metadata: {
          ip,
          referer,
          utmParams: typeof utmParams === 'object' ? utmParams : {},
        }
      });
      await doc.save();
      console.log(`✅ Nuevo documento guardado para ${visitorId}`);
    }

    return res.json({
      success: true,
      visitorId: doc.visitorId,
      buttonCounts: doc.buttonCounts,
      metadata: doc.metadata,
    });
  } catch (err) {
    console.error('❌ Error guardando en MongoDB:', err);
    return res.status(500).json({ success: false, error: 'Error interno en el servidor' });
  }
});

export default router;
