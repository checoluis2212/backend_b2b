import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
  source: String, medium: String, campaign: String, term: String, content: String,
}, { _id: false });

const contactSchema = new mongoose.Schema({
  // Datos “normalizados”
  visitorId: String,
  nombre: String,
  email:  String,
  telefono: String,
  empresa: String,
  mensaje: String,

  // Metadatos
  metadata: {
    ip: String,
    referer: String,
    userAgent: String,
    utm: utmSchema,
    page: { uri: String, name: String }
  },

  // Crudo desde el form (por si cambian campos en HS)
  raw: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// 👇 tercer argumento fuerza la colección: contacts
export default mongoose.model('Contact', contactSchema, 'contacts');
