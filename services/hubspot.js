// services/hubspot.js
import axios from 'axios';

const HS_TOKEN = process.env.HUBSPOT_TOKEN;
if (!HS_TOKEN) throw new Error('❌ Falta HUBSPOT_TOKEN');

/**
 * Obtiene un contacto completo de HubSpot por su ID, incluyendo el GUID del form
 */
export async function getContactById(hubspotId) {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${hubspotId}`;
  const res = await axios.get(url, {
    headers: { 
      'Content-Type': 'application/json',
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
