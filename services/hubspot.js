// File: services/hubspot.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HS_TOKEN) {
  throw new Error('❌ Falta la variable HUBSPOT_TOKEN');
}

/**
 * Busca en HubSpot un contacto por email y devuelve sus properties
 */
export async function findContactByEmail(email) {
  const url = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
  const body = {
    filterGroups: [
      { filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }
    ],
    properties: ['firstname','lastname','email','phone','company','jobtitle','createdate'],
    limit: 1
  };
  const res = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${HS_TOKEN}`
    }
  });
  const results = res.data.results;
  return results && results.length ? results[0] : null;
}
