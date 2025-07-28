// routes/responses.js
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
        .json({ success: false, error: 'visitorId y button válidos son obligatorios' });
    }

    let doc = await Response.findOne({ visitorId });
    if (doc) {
      doc.buttonCounts[button]++;
      await doc.save();
    } else {
      const initialCounts = { cotizar: 0, publicar: 0, oportunidades: 0 };
      initialCounts[button] = 1;
      doc = new Response({ visitorId, buttonCounts: initialCounts });
      await doc.save();
    }

    return res.json({
      success:      true,
      visitorId:    doc.visitorId,
      buttonCounts: doc.buttonCounts
    });
  } catch (err) {
    console.error('❌ Error en POST /api/responses:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
