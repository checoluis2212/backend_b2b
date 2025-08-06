import axios from 'axios';

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const API_SECRET = process.env.GA4_API_SECRET;
const GA4_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

export async function sendGA4Event(visitorId, eventName, utmParams = {}) {
  try {
    const payload = {
      client_id: visitorId,
      user_id: visitorId,
      events: [
        {
          name: eventName,
          params: {
            event_timestamp: Date.now(),
            utm_source: utmParams.source || '(not set)',
            utm_medium: utmParams.medium || '(not set)',
            utm_campaign: utmParams.campaign || '(not set)',
            variant_id: visitorId
          }
        }
      ]
    };

    await axios.post(GA4_URL, payload);

    // 🔹 Log seguro (solo en desarrollo, visitorId parcial)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Evento ${eventName} enviado a GA4 con visitorId ****${visitorId.slice(-4)}`);
    }
  } catch (error) {
    console.error(`❌ Error enviando evento ${eventName}:`, error.message);
  }
}
