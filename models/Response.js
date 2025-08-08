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
  createdAt: { type: Date, default: Date.now },
  fromForm:  { type: Boolean, default: false }
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
