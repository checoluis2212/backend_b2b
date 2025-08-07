import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
  source:   String,
  medium:   String,
  campaign: String,
  term:     String,
  content:  String,
}, { _id: false });

// Sub-schema para cada envío de formulario
const contactSchema = new mongoose.Schema({
  name:      String,
  email:     String,
  payload:   mongoose.Schema.Types.Mixed, // cualquier otro campo
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const responseSchema = new mongoose.Schema({
  visitorId: { type: String, required: true, index: true },

  // Contadores de botones existentes
  buttonCounts: {
    cotizar:  { type: Number, default: 0 },
    publicar: { type: Number, default: 0 },
    empleo:   { type: Number, default: 0 },
  },

  // Metadatos originales
  metadata: {
    ip:        String,
    referer:   String,
    utmParams: utmSchema,
  },

  // Nuevo: envíos de formularios
  contacts: {
    type: [contactSchema],
    default: []
  },
  submissionCount: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

export default mongoose.model('Response', responseSchema);
