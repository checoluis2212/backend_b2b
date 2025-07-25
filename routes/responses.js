// backend/routes/responses.js
import express  from 'express';
import Response from '../models/Response.js';

const router = express.Router();
const validButtons = ['cotizar','publicar','oportunidades'];

router.post('/', async (req, res) => {
  try {
    const { visitorId, button } = req.body;
    if (!visitorId || !validButtons.includes(button)) {
      return res
        .status(400)
        .json({ success:false, error:'visitorId y button válidos son obligatorios' });
    }

    // 1) Buscamos si ya hay un doc para este visitorId
    let doc = await Response.findOne({ visitorId });

    if (doc) {
      // 2) Si existe, incrementamos el contador en memoria y guardamos
      doc.buttonCounts[button]++;
      await doc.save();
    } else {
      // 3) Si no existe, creamos uno nuevo con los tres contadores
      const initialCounts = { cotizar:0, publicar:0, oportunidades:0 };
      initialCounts[button] = 1;
      doc = new Response({
        visitorId,
        buttonCounts: initialCounts
      });
      await doc.save();
    }

    // 4) Devolvemos el estado actual
    return res.json({
      success:      true,
      visitorId:    doc.visitorId,
      buttonCounts: doc.buttonCounts
    });
  } catch (err) {
    console.error('❌ Error en POST /api/responses:', err);
    return res.status(500).json({ success:false, error:err.message });
  }
});

export default router;
