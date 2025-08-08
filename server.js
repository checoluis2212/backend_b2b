// File: server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import responsesRouter from './routes/responses.js';

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'https://b2b.occ.com.mx',
    'https://reclutamiento.occ.com.mx'
  ]
}));

app.use(express.json());

// API Key middleware
function checkApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ ok: false, message: 'Acceso no autorizado' });
  }
  next();
}

// MongoDB connection
if (!process.env.MONGO_URI) {
  console.error('❌ Falta MONGO_URI');
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

// Mount routes with API Key protection
app.use('/api/responses', checkApiKey, responsesRouter);

// Health-check endpoint
app.get('/', (_req, res) => res.send('API OCC B2B viva ✔️'));

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌐 Servidor escuchando en puerto ${PORT}`));

// --------------------------------------------------
// File: models/Response.js
import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
  source:   String,
  medium:   String,
  campaign: String,
  term:     String,
  content:  String,
}, { _id: false });

const contactSchema = new mongoose.Schema({
  name:      String,
  email:     String,
  phone:     String,
  company:   String,
  jobtitle:  String,
  vacantes:  Number,
  rfc:       String,
  payload:   mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const responseSchema = new mongoose.Schema({
  visitorId:        { type: String, required: true, index: true },
  buttonCounts:     {
    cotizar:  { type: Number, default: 0 },
    publicar: { type: Number, default: 0 },
    empleo:   { type: Number, default: 0 },
  },
  metadata:         {
    ip:        String,
    referer:   String,
    utmParams: utmSchema,
  },
  contacts:         { type: [contactSchema], default: [] },
  submissionCount:  { type: Number, default: 0 },
  firstSubmission:  Date,
  lastSubmission:   Date
}, { timestamps: true });

export default mongoose.model('Response', responseSchema);
