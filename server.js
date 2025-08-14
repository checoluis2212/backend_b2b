// server.js (o index.js)
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Rutas OCC B2B (sin cambios)
import responsesRouter from './routes/responses.js';
import { sendGA4Event } from './utils/ga4.js';

const app = express();

/* ======================== CORE ======================== */

// CORS global (abre mientras pruebas; restringe en prod)
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','x-api-key'],
}));
app.use(express.json());

// Middleware API key (reutilizable)
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

// Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err); process.exit(1); });

/* ======================== RUTAS EXISTENTES ======================== */

app.use('/api/responses', checkApiKey, responsesRouter);

app.get('/api/test-ga4', checkApiKey, async (req, res) => {
  try {
    await sendGA4Event('test-visitor-123', 'click_test', {
      source: 'facebook',
      medium: 'cpc',
      campaign: 'b2b-cta'
    });
    res.json({ ok: true, message: 'Evento de prueba enviado a GA4' });
  } catch (error) {
    console.error('❌ Error test GA4:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

/* ================== NUEVO: ENDPOINT HUBSPOT LEAD ================== */

// helper: IP real
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

const { LEAD_REQUIRE_API_KEY } = process.env;

// middleware condicional para /api/lead
const maybeRequireKey = (req, res, next) => {
  if (LEAD_REQUIRE_API_KEY === 'true') return checkApiKey(req, res, next);
  next();
};

// POST /api/lead robusto: des-empaca (body) y guarda tal cual en "Hubspot"
// en server.js (o donde tengas el endpoint actual de /api/lead)
// POST /api/lead (recibe webhook y guarda en Mongo)
app.post('/api/lead', maybeRequireKey, async (req, res) => {
  const t0 = Date.now();
  try {
    const b = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const now = new Date();

    // 🔎 Logea lo que llegó
    console.log('[API] /api/lead received:', JSON.stringify(b, null, 2));

   // Guarda tal cual en colección hubspot (minúsculas)
const ins = await mongoose.connection.collection('hubspot').insertOne({
  json: b,
  _meta: { ip, ua, createdAt: now }
});


    const storedId = ins.insertedId?.toString();
    console.log('[API] lead stored (Hubspot) _id:', storedId);

    // ⬅️ Devuelve también lo recibido (para verlo en n8n)
    res.json({ ok: true, storedId, ms: Date.now() - t0, received: b });

  } catch (e) {
    console.error('[API] /api/lead error:', e?.stack || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});


/* ================== FIN ENDPOINT HUBSPOT LEAD ================== */

// Health específico de lead
app.get('/api/lead/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState
  });
});

// Health-check general
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor OCC B2B escuchando en puerto ${PORT}`));
