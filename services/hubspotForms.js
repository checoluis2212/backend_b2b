// services/hubspotForms.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HS_TOKEN) {
  console.warn('⚠️ HUBSPOT_TOKEN no está definido. El polling no se iniciará.');
}

/**
 * Trae las sumisiones del formulario dado, paginadas por timestamp "after" (ms)
 * Requiere HUBSPOT_TOKEN. FORM_ID puede venir por env o se usa el default.
 */
export async function fetchFormSubmissions(after = 0) {
  if (!HS_TOKEN) return [];

  const FORM_ID = process.env.HUBSPOT_FORM_ID || '5f745bfa-8589-40c2-9940-f9081123e0b4';
  const url = `https://api.hubapi.com/marketing/v3/forms/${FORM_ID}/submissions`;

  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
    params: { limit: 100, after }
  });

  return data?.results || [];
}
