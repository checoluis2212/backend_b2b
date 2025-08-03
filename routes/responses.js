import express from 'express';
import Response from '../models/Response.js';

const router = express.Router();

// Sanity check
router.get('/', (_req, res) => res.send('✅ El router /api/responses funciona perfectamente'));

// Listar todas las respuestas
router.get('/all', async (_req, res) => {
  try {
    const list = await Response.find().sort({ createdAt: -1 });
    console.log(`📦 Respuestas encontradas: ${list.length}`);
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
    console.warn('⚠️ Datos inválidos recibidos');
    return res.status(400).json({ success: false, error: 'visitorId y button válidos son obligatorios' });
  }

  // Extraer IP y referer
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection.remoteAddress || '';
  const referer = req.get('Referer') || '';

  try {
    // Buscar doc existente
    let doc = await Response.findOne({ visitorId });

    if (doc) {
      console.log(`♻️ Actualizando contador para ${visitorId}`);
      doc.buttonCounts[button] = (doc.buttonCounts[button] || 0) + 1;
      await doc.save();
    } else {
      console.log(`🆕 Creando nuevo registro para ${visitorId}`);
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
    }

    console.log('✅ Guardado en MongoDB:', doc);

    return res.json({
      success: true,
      visitorId: doc.visitorId,
      buttonCounts: doc.buttonCounts,
      metadata: doc.metadata,
    });
  } catch (err) {
    console.error('❌ Error guardando en MongoDB:', err);
    return res.status(500).json({ success: false, error: 'Error guardando en la base de datos' });
  }
});

export default router;
