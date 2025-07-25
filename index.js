// Backend/index.js
import 'dotenv/config';              // carga .env
import express       from 'express';
import mongoose      from 'mongoose';
import cors          from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({ origin: 'http://localhost:5173' }));  // Ajusta origen de tu frontend
app.use(express.json());                             // Parseo de JSON

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Error MongoDB:', err));

// Rutas
app.use('/api/responses', responsesRouter);

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('API viva ✔️');
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`🌐 Servidor escuchando en http://localhost:${PORT}`);
});
