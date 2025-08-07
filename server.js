import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// Rutas OCC B2B
import responsesRouter from './routes/responses.js';

const app = express();

// 🔹 Configuración CORS
app.use(cors({
  origin: [
    'https://b2b.occ.com.mx',
    'https://reclutamiento.occ.com.mx'
  ]
}));

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
if (!process.env.MONGO_URI) {
  console.error('❌ Falta MONGO_URI');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ Error MongoDB:', err);
    process.exit(1);
  });

// 🔹 Montaje de rutas protegidas
app.use('/api/responses', checkApiKey, responsesRouter);

// 🔹 Health-check
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// 🔹 Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));
