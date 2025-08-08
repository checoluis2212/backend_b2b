// File: services/hubspot.js
import axios from 'axios';

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HUBSPOT_TOKEN) {
  throw new Error('❌ Falta la variable HUBSPOT_TOKEN');
}
const BASE_URL = 'https://api.hubapi.com';

/**
 * Upsert de contacto en HubSpot por email
 */
export async function upsertHubspotContact(email, visitorId, extra = {}) {
  const url = `${BASE_URL}/crm/v3/objects/contacts`;
  const payload = {
    properties: {
      email,
      visitor_id: visitorId,
      ...extra
    }
  };
  // Usamos createOrUpdate para que no falle si existe
  return axios.post(
    `${url}?idProperty=email`,
    payload,
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${HUBSPOT_TOKEN}`
      }
    }
  );
}

