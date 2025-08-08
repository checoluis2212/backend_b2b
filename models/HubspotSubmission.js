// models/HubspotSubmission.js
import mongoose from 'mongoose';

const hubspotSubmissionSchema = new mongoose.Schema({
  portalId:    { type: String, required: true },
  formId:      { type: String, required: true },
  submittedAt: { type: Date,   default: Date.now },
  fields:      { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

export default mongoose.model('HubspotSubmission', hubspotSubmissionSchema);
