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

// envío a HubSpot (Forms API v3)
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

// POST /api/lead (robusto: acepta body plano o {fields, context})
app.post('/api/lead', maybeRequireKey, async (req, res) => {
  const t0 = Date.now();
  try {
    // --- Adaptador: soportar body plano o con {fields, context} ---
    const b = req.body || {};
    const FLAT_FIELD_KEYS = [
      'email','firstname','lastname','phone','company',
      'puesto','vacantesAnuales','rfc','aceptaComunicaciones'
    ];

    // Si no viene b.fields, construimos desde el body plano
    const fields = b.fields ?? Object.fromEntries(
      FLAT_FIELD_KEYS.filter(k => b[k] !== undefined).map(k => [k, b[k]])
    );

    // Si no viene b.context, construimos desde el body plano
    const context = b.context ?? {
      utm_source:  b.utm_source,
      utm_medium:  b.utm_medium,
      utm_campaign:b.utm_campaign,
      utm_content: b.utm_content,
      utm_term:    b.utm_term,
      pageUri:     b.pageUri,
      pageName:    b.pageName,
      hutk:        b.hutk
    };

    const visitorId = b.visitorId;
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const now = new Date();

    // (Opcional) validaciones mínimas para visibilidad (no bloqueantes)
    const required = ['email', 'firstname', 'lastname', 'phone', 'company'];
    const missing = required.filter(k => !String(fields?.[k] || '').trim());
    if (missing.length) console.warn('[API] lead faltan campos:', missing);

    // 1) Guarda submission crudo en colección "Hubspot"
    const ins = await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: now }
    });
    const storedId = ins.insertedId?.toString();
    console.log('[API] lead stored (Hubspot) _id:', storedId);

    // 2) Upsert en colección "responses" (seguro: sólo si hay visitorId o email)
    try {
      let key = null;
      if (visitorId) key = { visitorId: String(visitorId) };
      else if (fields?.email) key = { 'metadata.hubspotForm.email': fields.email };

      if (!key) {
        console.warn('[API] responses upsert omitido: falta visitorId y email');
      } else {
        await mongoose.connection.collection('responses').updateOne(
          key,
          {
            $setOnInsert: {
              visitorId: visitorId || null,
              formCount: 0,
              firstFormDate: now,
              createdAt: now
            },
            $inc: { formCount: 1 },
            $set: {
              lastFormDate: now,
              updatedAt: now,
              'metadata.ip': ip,
              'metadata.utmParams': {
                source: context?.utm_source || '(not set)',
                medium: context?.utm_medium || '(not set)',
                campaign: context?.utm_campaign || '(not set)'
              },
              // 👉 guardamos TODO el formulario del último envío
              'metadata.hubspotForm': { ...(fields || {}) }
            }
          },
          { upsert: true }
        );
      }
    } catch (e) {
      console.error('[API] responses.updateOne error:', e?.message || e);
      // no rompemos la respuesta si solo falló el upsert secundario
    }

    // 3) Responder YA al cliente (éxito en Mongo garantizado)
    res.json({ ok: true, storedId, ms: Date.now() - t0 });

    // 4) Enviar a HubSpot en background (no bloquea la respuesta)
    if (SKIP_HS === 'true') {
      console.log('[API] SKIP_HS=true → no se envía a HubSpot');
      return;
    }
    if (!HS_PORTAL_ID || !HS_FORM_ID) {
      console.error('[API] Falta HS_PORTAL_ID o HS_FORM_ID → se omite envío a HubSpot');
      return;
    }
    submitToHubSpot({ fields, context, ip })
      .catch(err => console.error('[HS] catch:', err?.message || err));

  } catch (e) {
    console.error('[API] /api/lead error:', e?.stack || e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ================== FIN ENDPOINT HUBSPOT LEAD ================== */

// Health-check general
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor OCC B2B escuchando en puerto ${PORT}`));
