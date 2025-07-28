import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
  source:   String,
  medium:   String,
  campaign: String,
  term:     String,
  content:  String,
}, { _id: false });

const responseSchema = new mongoose.Schema({
  visitorId:    { type: String, required: true, index: true },
  buttonCounts: {
    cotizar:       { type: Number, default: 0 },
    publicar:      { type: Number, default: 0 },
    oportunidades: { type: Number, default: 0 },
  },
  metadata: {
    ip:        String,
    referer:   String,
    utmParams: utmSchema,
  }
}, { timestamps: true });

export default mongoose.model('Response', responseSchema);
