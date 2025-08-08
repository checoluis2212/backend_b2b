// services/hubspotForms.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
const FORM_ID  = '5f745bfa-8589-40c2-9940-f9081123e0b4';

if (!HS_TOKEN) throw new Error('❌ Falta HUBSPOT_TOKEN');

export async function fetchFormSubmissions(after = 0) {
  const url = `https://api.hubapi.com/marketing/v3/forms/${FORM_ID}/submissions`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
    params: { limit: 100, after }
  });
  return res.data.results;
}
