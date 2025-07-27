// backend/index.js
import 'dotenv/config';
import express        from 'express';
import mongoose       from 'mongoose';
import cors           from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// Middlewares
app.use(cors({ origin: '*' }));  // en prod puedes restringir a tu front
app.use(express.json());

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser:    true,
    useUnifiedTopology: true
  })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Rutas
app.use('/api/responses', responsesRouter);

// Ruta de verificación
app.get('/', (req, res) => {
  res.send('API viva ✔️');
});

// **NO** llamamos a app.listen en serverless—
// exportamos la app para Vercel
export default app;
