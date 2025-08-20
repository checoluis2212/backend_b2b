// utils/ga4.js
import axios from 'axios';

const MID = process.env.GA4_MEASUREMENT_ID;
const SEC = process.env.GA4_API_SECRET;
const GA4_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${MID}&api_secret=${SEC}`;

export async function sendGA4Event(clientId, eventName, utm = {}, extra = {}) {
  if (!MID || !SEC) throw new Error('Faltan GA4 env vars (GA4_MEASUREMENT_ID / GA4_API_SECRET)');
  if (!clientId) throw new Error('client_id requerido');
  if (!eventName) throw new Error('eventName requerido');

  const utm_source   = utm.source   ?? utm.utm_source   ?? '(not set)';
  const utm_medium   = utm.medium   ?? utm.utm_medium   ?? '(not set)';
  const utm_campaign = utm.campaign ?? utm.utm_campaign ?? '(not set)';
  const utm_content  = utm.content  ?? utm.utm_content  ?? undefined;
  const utm_term     = utm.term     ?? utm.utm_term     ?? undefined;

  const body = {
    client_id: String(clientId),
    timestamp_micros: Date.now() * 1000,
    events: [{
      name: eventName,
      params: {
        engagement_time_msec: 1,
        // ayuda a verlo en DebugView mientras pruebas
        ...(process.env.NODE_ENV !== 'production' ? { debug_mode: true } : {}),
        visitor_id: String(clientId),
        utm_source,
        utm_medium,
        utm_campaign,
        ...(utm_content ? { utm_content } : {}),
        ...(utm_term ? { utm_term } : {}),
        page_location: extra.page_location || '',
        page_referrer: extra.page_referrer || '',
        ...(extra.params || {})
      }
    }],
    user_properties: {
      utm_source:   { value: utm_source },
      utm_medium:   { value: utm_medium },
      utm_campaign: { value: utm_campaign },
      ...(utm_content ? { utm_content: { value: utm_content } } : {}),
      ...(utm_term ? { utm_term: { value: utm_term } } : {})
    }
  };

  try {
    const r = await axios.post(GA4_URL, body, { headers: { 'Content-Type': 'application/json' } });
    // GA4 suele responder 204 cuando todo bien
    if (process.env.NODE_ENV !== 'production') {
      console.log('[GA4] collect status:', r.status);
    }
  } catch (e) {
    console.error('[GA4] collect error:', e?.response?.status, e?.response?.data || e.message);
    throw e;
  }
}

/**
 * Útil para diagnóstico: pega contra /debug/mp/collect y regresa mensajes de validación.
 */
export async function sendGA4DebugEvent(body) {
  const url = `https://www.google-analytics.com/debug/mp/collect?measurement_id=${MID}&api_secret=${SEC}`;
  const r = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
  return r.data; // { validationMessages: [...] }
}
