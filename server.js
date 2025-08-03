import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Rutas
import responsesRouter from './routes/responses.js';
import estudiosRouter from './routes/estudios.js';

dotenv.config();
const app = express();

// ─── 1) CORS ESTRICTO ───────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://empresas.occ.com.mx',              // Producción OCC Empresas
    'https://frontend-occ-clientes.onrender.com', // Frontend en Render
    'http://localhost:5173'                     // Desarrollo local
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key']
}));

// Preflight para OPTIONS
app.options('*', cors());

// ─── 2) Middleware JSON ─────────────────────────────────────────────
app.use(express.json());

// ─── 3) API KEY PROTECCIÓN ──────────────────────────────────────────
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    console.warn(`🚫 Acceso denegado desde IP: ${req.ip}`);
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
});

// ─── 4) Conexión a MongoDB ──────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err);
    process.exit(1);
  });

// ─── 5) Rutas ───────────────────────────────────────────────────────
app.use('/api/responses', responsesRouter);
app.use('/api/estudios', estudiosRouter);

// Health Check
app.get('/', (_req, res) => res.send('API viva ✔️'));

// ─── 6) Levantar servidor ───────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));
