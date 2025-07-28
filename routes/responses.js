// backend/routes/responses.js
import express  from 'express';
import Response from '../models/Response.js';

const router = express.Router();

// 0) SANITY CHECK: esto debería responder 200 OK
router.get('/', (_req, res) => {
  return res.send('✅ El router /api/responses funciona perfectamente');
});

const validButtons = ['cotizar','publicar','oportunidades'];

router.post('/', async (req, res) => {
  console.log('📬 LLEGÓ UN POST:', req.body);   // para que veas en logs
  const { visitorId, button } = req.body;
  if (!visitorId || !validButtons.includes(button)) {
    return res
      .status(400)
      .json({ success:false, error:'visitorId y button válidos son obligatorios' });
  }

  let doc = await Response.findOne({ visitorId });
  if (doc) {
    doc.buttonCounts[button] = (doc.buttonCounts[button]||0) + 1;
    await doc.save();
  } else {
    const initial = { cotizar:0, publicar:0, oportunidades:0 };
    initial[button] = 1;
    doc = await new Response({ visitorId, buttonCounts: initial }).save();
  }

  res.json({ success:true, visitorId:doc.visitorId, buttonCounts:doc.buttonCounts });
});

export default router;
