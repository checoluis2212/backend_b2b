// backend/index.js
import 'dotenv/config';              // carga las vars de .env
import express       from 'express';
import mongoose      from 'mongoose';
import cors          from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) Middlewares
app.use(cors({ origin: '*' }));    // en prod pon tu dominio
app.use(express.json());           // parsea JSON del body

// 2) Conexión a MongoDB
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

// 3) Rutas
app.use('/api/responses', responsesRouter);

// 4) Ruta de comprobación
app.get('/', (_req, res) => {
  res.send('API viva ✔️');
});

// 5) Arranque del servidor: Render te da el puerto en process.env.PORT
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
});
