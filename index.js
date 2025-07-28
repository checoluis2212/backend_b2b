// index.js
import 'dotenv/config';
import express         from 'express';
import mongoose        from 'mongoose';
import cors            from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// --- Middlewares ---
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- Conexión a MongoDB ---
mongoose
  .connect(process.env.MONGO_URI, {
    // Las opciones useNewUrlParser y useUnifiedTopology
    // ya no tienen efecto en mongoose v8+
  })
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// --- Routes ---
app.use('/api/responses', responsesRouter);
app.get('/', (req, res) => res.send('API viva ✔️'));

// --- Puerto para Render / Heroku / Node puro ---
// Detectamos si estamos en Vercel Functions
const isServerless = !!process.env.VERCEL;

if (!isServerless) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🌐 Servidor escuchando en el puerto ${PORT}`);
  });
}

// Exportamos app para Vercel (serverless)
export default app;
