// File: server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) CORS: permite sólo tus dominios
app.use(cors({
  origin: [
    'https://b2b.occ.com.mx',
    'https://reclutamiento.occ.com.mx'
  ]
}));

// 2) Parse JSON bodies
app.use(express.json());

// 3) Middleware de API Key
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

// 4) Conexión a MongoDB
if (!process.env.MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => {
  console.error('❌ Error MongoDB:', err);
  process.exit(1);
});

// 5) Montar rutas protegidas por API Key
app.use('/api/responses', checkApiKey, responsesRouter);

// 6) Health-check
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// 7) Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));
