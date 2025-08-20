// utils/ga4.js
import axios from 'axios';

const MID = process.env.GA4_MEASUREMENT_ID;
const SEC = process.env.GA4_API_SECRET;

const BASE = process.env.NODE_ENV === 'production'
  ? 'https://www.google-analytics.com/mp/collect'
  : 'https://www.google-analytics.com/debug/mp/collect'; // <- debug en dev

const GA4_URL = `${BASE}?measurement_id=${MID}&api_secret=${SEC}`;

/**
 * Envía un evento a GA4 Measurement Protocol
 */
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
    console.log('[GA4] sending', {
      url: GA4_URL.includes('/debug/') ? 'DEBUG' : 'COLLECT',
      eventName,
      clientId: String(clientId).slice(-8),
      utm_source, utm_medium, utm_campaign
    });

    const resp = await axios.post(GA4_URL, body, { headers: { 'Content-Type': 'application/json' } });

    // Si estamos en /debug, GA4 responde validationMessages
    if (GA4_URL.includes('/debug/')) {
      console.log('[GA4] debug response', JSON.stringify(resp.data, null, 2));
    } else {
      console.log('[GA4] sent OK', eventName);
    }
  } catch (error) {
    const status = error?.response?.status;
    const data   = error?.response?.data;
    console.error('[GA4] error', status, data || error.message);
    throw error;
  }
}
