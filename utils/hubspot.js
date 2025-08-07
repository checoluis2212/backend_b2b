import axios from 'axios';

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HUBSPOT_TOKEN) {
  throw new Error('❌ Falta la variable HUBSPOT_TOKEN');
}
const BASE_URL = 'https://api.hubapi.com';

/**
 * Upsert de contacto en HubSpot por email, añadiendo visitor_id
 */
export async function upsertHubspotContact(email, visitorId, extra = {}) {
  const url = `${BASE_URL}/crm/v3/objects/contacts?idProperty=email`;
  const payload = {
    properties: {
      email,
      visitor_id: visitorId,
      ...extra
    }
  };
  return axios.post(url, payload, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`
    }
  });
}
