// models/Contact.js
import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  hubspotId:         { type: String, required: true, unique: true },
  properties:        { type: mongoose.Schema.Types.Mixed },
  firstSubmissionAt: { type: Date },
  lastSubmissionAt:  { type: Date },
  submissionCount:   { type: Number, default: 0 },
  syncedAt:          { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Contact', contactSchema);
