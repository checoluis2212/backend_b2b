import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Rutas OCC B2B
import responsesRouter from './routes/responses.js';
import { sendGA4Event } from './utils/ga4.js';

const app = express();

/* ======================== CORE ======================== */

// CORS global (abre mientras pruebas)
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

const { HS_PORTAL_ID, HS_FORM_ID, SKIP_HS, LEAD_REQUIRE_API_KEY } = process.env;

// helper: IP real
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

// helper: fetch con timeout (Node 18+)
async function fetchWithTimeout(url, opts = {}, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// envío a HubSpot
async function submitToHubSpot({ fields = {}, context = {}, ip = '' }) {
  const hsPayload = {
    fields: Object.entries(fields).map(([name, value]) => ({
      name,
      value: value ?? ''
    })),
    context: {
      pageUri: context.pageUri || '',
      pageName: context.pageName || '',
      hutk: context.hutk || '',
      ipAddress: ip
    },
    legalConsentOptions: {
      consent: { consentToProcess: true, text: 'Acepto términos', communications: [] }
    }
  };

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HS_PORTAL_ID}/${HS_FORM_ID}`;
  const resp = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hsPayload)
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error('[HS] submit error:', resp.status, t?.slice(0, 400));
    throw new Error(`HS ${resp.status}`);
  }
  console.log('[HS] submit ok');
}

// Health específico de lead
app.get('/api/lead/health', (_req, res) => {
  res.json({
    ok: true,
    mongo: !!mongoose.connection?.readyState,
    hs_ready: !!(HS_PORTAL_ID && HS_FORM_ID),
    skip_hs: SKIP_HS === 'true'
  });
});

// middleware condicional para /api/lead
const maybeRequireKey = (req, res, next) => {
  if (LEAD_REQUIRE_API_KEY === 'true') return checkApiKey(req, res, next);
  next();
};

// POST /api/lead
app.post('/api/lead', maybeRequireKey, async (req, res) => {
  const t0 = Date.now();
  try {
    const { fields = {}, context = {} } = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // Guarda en colección "Hubspot"
    const ins = await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: new Date() }
    });
    const storedId = ins.insertedId?.toString();
    console.log('[API] lead stored _id:', storedId);

    // Envío a HubSpot en background (no bloquea la respuesta)
    if (SKIP_HS === 'true') {
      console.log('[API] SKIP_HS=true → no se envía a HubSpot');
    } else if (!HS_PORTAL_ID || !HS_FORM_ID) {
      console.error('[API] Falta HS_PORTAL_ID o HS_FORM_ID → se omite envío a HubSpot');
    } else {
      submitToHubSpot({ fields, context, ip }).catch(err =>
        console.error('[HS] catch:', err?.message || err)
      );
    }

    const ms = Date.now() - t0;
    return res.json({ ok: true, storedId, ms });
  } catch (e) {
    console.error('[API] /api/lead error:', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ================== FIN ENDPOINT HUBSPOT LEAD ================== */

// Health-check general
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor OCC B2B escuchando en puerto ${PORT}`));
