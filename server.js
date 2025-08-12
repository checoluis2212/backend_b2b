import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Rutas OCC B2B
import responsesRouter from './routes/responses.js';
import { sendGA4Event } from './utils/ga4.js';

const app = express();

// 🔹 Configuración CORS global
app.use(cors({ origin: '*' }));
app.use(express.json());

// 🔹 Middleware de autenticación por API Key
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

// 🔹 Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err); process.exit(1); });

// 🔹 Rutas OCC protegidas con API Key
app.use('/api/responses', checkApiKey, responsesRouter);

// 🔹 Endpoint de prueba para GA4 protegido con API Key
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

// ================== 🔻 NUEVO ENDPOINT HUBSPOT LEAD 🔻 ==================
const { HS_PORTAL_ID, HS_FORM_ID } = process.env;

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

async function submitToHubSpot({ fields = {}, context = {}, ip = '' }) {
  const hsPayload = {
    fields: Object.entries(fields).map(([name, value]) => ({ name, value: value ?? '' })),
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
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hsPayload)
  });
  if (!resp.ok) {
    const t = await resp.text();
    console.error('[HS] submit error:', t);
  }
}

// (Opcional) Si quieres protegerlo con API Key, agrega checkApiKey como middleware
app.post('/api/lead', async (req, res) => {
  try {
    const { fields = {}, context = {} } = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    // Guarda en colección "Hubspot"
    await mongoose.connection.collection('Hubspot').insertOne({
      json: { fields, context },
      _meta: { ip, ua, createdAt: new Date() }
    });

    // Reenviar a HubSpot (no bloquea respuesta si falla)
    submitToHubSpot({ fields, context, ip }).catch(err => console.error('[HS] catch:', err));

    res.json({ ok: true });
  } catch (e) {
    console.error('[API] /api/lead error:', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});
// ================== 🔺 FIN NUEVO ENDPOINT HUBSPOT LEAD 🔺 ==================

// 🔹 Health-check
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// 🔹 Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor OCC B2B escuchando en puerto ${PORT}`));
