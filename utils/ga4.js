import axios from 'axios';

const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const API_SECRET = process.env.GA4_API_SECRET;
const GA4_URL = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;

export async function sendGA4Event(clientId, eventName, eventParams = {}) {
  try {
    const payload = {
      client_id: clientId, // Usa visitorId o un UUID
      events: [
        {
          name: eventName,
          params: eventParams
        }
      ]
    };

    await axios.post(GA4_URL, payload);
    console.log(`✅ Evento ${eventName} enviado a GA4`);
  } catch (error) {
    console.error(`❌ Error enviando evento ${eventName}:`, error.message);
  }
}
