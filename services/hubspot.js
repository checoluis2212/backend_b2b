// services/hubspot.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HS_TOKEN) throw new Error('❌ Falta HUBSPOT_TOKEN');

/**
 * Busca en HubSpot un contacto por email y devuelve sus properties
 */
export async function findContactByEmail(email) {
  const url = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
  const body = {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['firstname','lastname','email','phone','company','jobtitle','createdate'],
    limit: 1
  };
  const res = await axios.post(url, body, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${HS_TOKEN}`
    }
  });
  return res.data.results?.[0] || null;
}

/**
 * Crea un contacto en HubSpot con las propiedades dadas
 */
export async function createContact(properties) {
  const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
  const res = await axios.post(url, { properties }, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${HS_TOKEN}`
    }
  });
  return res.data;
}

/**
 * Busca o crea un contacto en HubSpot, devuelve { id, properties }
 */
export async function upsertContactByEmail(fieldsObj) {
  const existing = await findContactByEmail(fieldsObj.email);
  if (existing) {
    return { id: existing.id, properties: existing.properties };
  } else {
    const created = await createContact(fieldsObj);
    return { id: created.id, properties: created.properties };
  }
}

/**
 * Obtiene un contacto completo de HubSpot por su ID, incluyendo el GUID del form
 */
export async function getContactById(hubspotId) {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}`;
  const res = await axios.get(url, {
    headers: { 
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${HS_TOKEN}` 
    },
    params: {
      properties: [
        'firstname','lastname','email','phone','company','jobtitle',
        'createdate','hs_analytics_source_data_2'
      ].join(',')
    }
  });
  return res.data;
}
