// backend/index.js
import 'dotenv/config';
import express         from 'express';
import mongoose        from 'mongoose';
import cors            from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) Middlewares
app.use(cors({ origin: '*' }));    // en producción limita a tu front
app.use(express.json());           // parsea JSON en el body

// 2) Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    // desde v4 ya no necesita opciones, pero no dañan
    useNewUrlParser:    true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// 3) Rutas
app.use('/api/responses', responsesRouter);

// Ruta de verificación rápida
app.get('/', (_req, res) => {
  res.send('API viva ✔️');
});

// 4) Levantar el servidor
// Render (y muchos hosts) exponen el puerto en process.env.PORT
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
});

// Si quisieras llevar esto a Vercel en modo serverless, en lugar de app.listen usarías:
// export default app;
