// utils/ga4.js
import axios from 'axios';

const MID = process.env.GA4_MEASUREMENT_ID;
const SEC = process.env.GA4_API_SECRET;
const GA4_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${MID}&api_secret=${SEC}`;

export async function sendGA4Event(clientId, eventName, utm = {}, extra = {}) {
  if (!MID || !SEC) throw new Error('Faltan GA4 env vars');
  if (!clientId) throw new Error('client_id requerido');
  if (!eventName) throw new Error('eventName requerido');

  const utm_source   = utm.source   || utm.utm_source   || '(not set)';
  const utm_medium   = utm.medium   || utm.utm_medium   || '(not set)';
  const utm_campaign = utm.campaign || utm.utm_campaign || '(not set)';

  const body = {
    client_id: String(clientId),
    timestamp_micros: Date.now() * 1000,
    events: [{
      name: eventName,
      params: {
        engagement_time_msec: 1,
        // params del evento (visibles en Realtime/Exploration)
        visitor_id: String(clientId),
        utm_source,
        utm_medium,
        utm_campaign,
        // contexto opcional
        page_location: extra.page_location || '',
        page_referrer: extra.page_referrer || '',
        ...extra.params
      }
    }],
    // user properties opcionales (persisten por usuario)
    user_properties: {
      utm_source:   { value: utm_source },
      utm_medium:   { value: utm_medium },
      utm_campaign: { value: utm_campaign }
    }
  };

  await axios.post(GA4_URL, body, { headers: { 'Content-Type': 'application/json' } });
}
