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

// POST /api/lead (recibe webhook o mirror del form, guarda en Mongo y manda GA4)
app.post('/api/lead', maybeRequireKey, async (req, res) => {
  const t0 = Date.now();
  try {
    const b = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    const now = new Date();

    // 🔎 Log request
    console.log('[API] /api/lead received:', JSON.stringify(b, null, 2));

    // Guarda tal cual en colección hubspot (minúsculas)
    const ins = await mongoose.connection.collection('hubspot').insertOne({
      json: b,
      _meta: { ip, ua, createdAt: now }
    });

    const storedId = ins.insertedId?.toString();
    console.log('[API] lead stored (Hubspot) _id:', storedId);

    // -------- GA4: evento lead_form_submitted con UTMs --------
    try {
      // client_id preferido (de tu front o del form HS)
      const visitorId =
        b.visitorid || b.visitorId || b._meta?.visitorid || storedId;

      // UTMs (acepta plano o dentro de properties)
      const utm_source   = b.utm_source   || b.properties?.utm_source;
      const utm_medium   = b.utm_medium   || b.properties?.utm_medium;
      const utm_campaign = b.utm_campaign || b.properties?.utm_campaign;
      const utm_content  = b.utm_content  || b.properties?.utm_content;
      const utm_term     = b.utm_term     || b.properties?.utm_term;

      await sendGA4Event(
        visitorId,
        'lead_form_submitted',
        { source: utm_source, medium: utm_medium, campaign: utm_campaign, content: utm_content, term: utm_term },
        {
          page_location: b.page || b.page_location || '',
          page_referrer: b.referrer || b.page_referrer || '',
          params: {
            form_id: b.formId || b.form_id || 'hubspot_embed'
          }
        }
      );

      console.log('[GA4] lead_form_submitted sent for cid:', visitorId);
    } catch (err) {
      console.warn('[GA4] skipped:', err?.message || err);
    }
    // -----------------------------------------------------------

    // ⬅️ Respuesta
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

// ================== NUEVO: ENDPOINT GA4 CTA BUTTON ==================

// POST /api/ga4/button (envía evento de click de botón a GA4 vía MP)
app.post('/api/ga4/button', maybeRequireKey, async (req, res) => {
  try {
    const b = req.body || {};
    const ua = req.headers['user-agent'] || '';

    // client_id (visitorId) requerido por MP: toma el que tengas; cae a "anon-<ts>"
    const visitorId =
      b.visitorid || b.visitorId || b.cid || `anon-${Date.now()}`;

    // Nombre del evento (por defecto cta_button_clicked)
    const eventName = b.eventName || 'cta_button_clicked';

    // UTMs (acepta plano u objeto utms)
    const utms = b.utms || {};
    const utm_source   = b.utm_source   ?? utms.source   ?? undefined;
    const utm_medium   = b.utm_medium   ?? utms.medium   ?? undefined;
    const utm_campaign = b.utm_campaign ?? utms.campaign ?? undefined;
    const utm_content  = b.utm_content  ?? utms.content  ?? undefined;
    const utm_term     = b.utm_term     ?? utms.term     ?? undefined;

    // Atributos del botón (opcionales)
    const button_id    = b.buttonId || b.button_id;
    const button_text  = b.buttonText || b.button_text;
    const section      = b.section;
    const value        = (typeof b.value === 'number') ? b.value : undefined;

    await sendGA4Event(
      visitorId,
      eventName,
      {
        // Dimensiones de adquisición
        source: utm_source,
        medium: utm_medium,
        campaign: utm_campaign,
        content: utm_content,
        term: utm_term,

        // Etiquetas útiles
        label: button_text || button_id || section,
        value
      },
      {
        page_location: b.page || b.page_location || '',
        page_referrer: b.referrer || b.page_referrer || '',
        user_agent: ua,
        params: {
          button_id,
          button_text,
          section
        }
      }
    );

    return res.json({ ok: true, event: eventName, cid: visitorId });
  } catch (e) {
    console.error('[GA4] /api/ga4/button error:', e?.stack || e);
    return res.status(500).json({ ok: false, error: 'ga4_button_error' });
  }
});
// ================== FIN ENDPOINT GA4 CTA BUTTON ==================

