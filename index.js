// backend/index.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) Habilitar CORS global y responder preflight OPTIONS en todas las rutas
app.use(cors({ origin: '*' }));
app.options('*', cors({ origin: '*' }));

// 2) Parseo de JSON
app.use(express.json());

// 3) Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ Falta la variable MONGO_URI');
  process.exit(1);
}
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => {
    console.error('❌ Error MongoDB:', err);
    process.exit(1);
  });

// 4) Rutas de la API
app.use('/api/responses', responsesRouter);

// 5) Health‑check
app.get('/', (_req, res) => {
  res.send('API viva ✔️');
});

// 6) Arranque del servidor (Render usa process.env.PORT)
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
});
