// services/hubspot.js
import fetch from 'node-fetch';
const HS_PORTAL_ID = process.env.HS_PORTAL_ID;
const HS_FORM_ID   = process.env.HS_FORM_ID;
const HS_TOKEN     = process.env.HUBSPOT_TOKEN;

// Si quieres obtener el contacto por email (asumimos que mandas email en la sumisión):
export async function findContactByEmail(email) {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
  const body = {
    filterGroups: [
      {
        filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
      }
    ],
    properties: ['firstname','lastname','email','phone','company','jobtitle','createdate'],
    limit: 1
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HS_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return json.results && json.results[0];
}
