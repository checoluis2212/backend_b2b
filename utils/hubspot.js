import axios from 'axios';

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;  // tu Private App token
const BASE_URL      = 'https://api.hubapi.com';

if (!HUBSPOT_TOKEN) {
  throw new Error('❌ Falta la variable de entorno HUBSPOT_TOKEN');
}

/**
 * Crea o actualiza un contacto en HubSpot, inyectando visitorId.
 * @param {string} email 
 * @param {string} visitorId 
 * @param {object} extraProps  // otras propiedades opcionales
 */
export async function upsertHubspotContact(email, visitorId, extraProps = {}) {
  const url = `${BASE_URL}/crm/v3/objects/contacts`;
  const payload = {
    properties: {
      email,
      visitor_id: visitorId,
      ...extraProps
    }
  };

  // Si quieres forzar actualización de un contacto existente,
  // podrías buscar por email primero y hacer PATCH a /contacts/{id}.
  // Aquí usamos POST + `?idProperty=email` para upsert por email:
  const upsertUrl = `${url}?idProperty=email`;

  const res = await axios({
    method: 'POST',
    url: upsertUrl,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type':  'application/json'
    },
    data: payload
  });

  return res.data;
}

