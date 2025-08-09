import mongoose from 'mongoose';

const utmSchema = new mongoose.Schema({
  source: String, medium: String, campaign: String, term: String, content: String,
}, { _id: false });

const formSubmissionSchema = new mongoose.Schema({
  visitorId: String,
  nombre:   { type: String, required: true },
  email:    { type: String, required: true },
  telefono: { type: String, required: true },
  empresa:  { type: String, required: true },
  mensaje:  { type: String, required: true },
  metadata: {
    ip: String,
    referer: String,
    userAgent: String,
    utm: utmSchema,
    page: { uri: String, name: String }
  }
}, { timestamps: true });

export default mongoose.model('FormSubmission', formSubmissionSchema);
