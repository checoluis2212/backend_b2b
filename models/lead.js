// models/Lead.js
import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    visitorId: { type: String, index: true },
    vidCookie: String,

    utm: {
      source: { type: String, default: '(not set)' },
      medium: { type: String, default: '(not set)' },
      campaign: { type: String, default: '(not set)' },
      content: { type: String, default: undefined },
      term:    { type: String, default: undefined },
    },

    page: String,
    referrer: String,
    form_id: { type: String, default: 'hubspot_embed' },

    // Lo que lograste leer del iframe (best-effort)
    fields: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Guarda además el payload crudo por si luego necesitas algo más
    raw: { type: mongoose.Schema.Types.Mixed, default: {} },

    _meta: {
      ip: String,
      ua: String,
    }
  },
  { timestamps: true, collection: 'leads' }
);

export default mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
