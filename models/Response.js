// backend/models/Response.js
import mongoose from 'mongoose';

const responseSchema = new mongoose.Schema({
  visitorId:    { type: String, required: true, unique: true },
  buttonCounts: {
    cotizar:       { type: Number, default: 0 },
    publicar:      { type: Number, default: 0 },
    oportunidades: { type: Number, default: 0 }
  }
}, {
  timestamps: true   // crea createdAt y updatedAt automático
});

export default mongoose.model('Response', responseSchema);
