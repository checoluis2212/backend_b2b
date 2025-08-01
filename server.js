// backend/server.js
import express  from 'express';
import mongoose from 'mongoose';
import cors     from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// 1) Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/occ_db';
mongoose.connect(MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// 2) CORS – **antes** de cualquier otra cosa
app.use(cors({
  origin: [
    'http://localhost:5173',    // para tu desarrollo local
    'https://b2b.occ.com.mx'    // para tu frontend en producción
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-api-key']
}));
// Responde a las peticiones preflight OPTIONS
app.options('*', cors());

// 3) Middlewares normales
app.use(express.json());

// 4) Rutas
app.use('/api/responses', responsesRouter);

// 5) Arranque del servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
