import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Rutas
import responsesRouter from './routes/responses.js';   // (ya la tienes)
import contactsRouter from './routes/contacts.js';     // (nueva)

// Utils
import { sendGA4Event } from './utils/ga4.js';

const app = express();

/* -------------------- Middlewares base -------------------- */
app.use(cors({ origin: '*' }));       // si quieres, restringe origin
app.use(express.json({ limit: '1mb' }));

/* --------------- Middleware API Key (para rutas privadas) --------------- */
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

/* -------------------- Conexión a MongoDB -------------------- */
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err); process.exit(1); });

/* -------------------- Rutas -------------------- */
// Rutas OCC protegidas con API Key (como ya lo tenías)
app.use('/api/responses', checkApiKey, responsesRouter);

// NUEVA: contactos SIN API key (se llama directo desde el navegador vía onFormSubmit)
app.use('/api/contacts', contactsRouter);

// Endpoint test GA4 (protegido)
app.get('/api/test-ga4', checkApiKey, async (_req, res) => {
  try {
    await sendGA4Event('test-visitor-123', 'click_test', {
      source: 'facebook', medium: 'cpc', campaign: 'b2b-cta'
    });
    res.json({ ok: true, message: 'Evento de prueba enviado a GA4' });
  } catch (error) {
    console.error('❌ Error test GA4:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Health-check
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

/* -------------------- Levantar servidor -------------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));
