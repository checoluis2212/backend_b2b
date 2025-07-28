import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) CORS global (incluye preflight)
app.use(cors({ origin: '*' }));
app.use(express.json());

// 2) Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => { console.error('❌ Error MongoDB:', err); process.exit(1); });

// 3) Rutas
app.use('/api/responses', responsesRouter);

// 4) Health‑check
app.get('/', (_req, res) => res.send('API viva ✔️'));

// 5) Levantar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en el puerto ${PORT}`));
