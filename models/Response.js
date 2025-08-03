import mongoose from 'mongoose';

// 🔍 Definición de esquema para UTM
const utmSchema = new mongoose.Schema({
  source:   String,
  medium:   String,
  campaign: String,
  term:     String,
  content:  String,
}, { _id: false });

// 🔍 Definición de esquema para Respuesta
const responseSchema = new mongoose.Schema({
  visitorId:    { type: String, required: true, index: true },
  buttonCounts: {
    cotizar:  { type: Number, default: 0 },
    publicar: { type: Number, default: 0 },
    empleo:   { type: Number, default: 0 },
  },
  metadata: {
    ip:        String,
    referer:   String,
    utmParams: utmSchema,
  }
}, { timestamps: true });

// 🔍 Forzar nombre de colección para evitar que Mongoose lo pluralice distinto
export default mongoose.model('Response', responseSchema, 'responses');
