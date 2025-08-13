// routes/lead.js
import express from 'express';
import fetch from 'node-fetch';
import Lead from '../models/Lead.js';

const router = express.Router();

const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_FORM_GUID = process.env.HUBSPOT_FORM_GUID;

router.post('/', async (req, res) => {
  try {
    const { visitorId, fields, context } = req.body;

    // 1️⃣ Guardar en MongoDB todo tal cual
    const leadDoc = await Lead.create({
      visitorId,
      fields,
      context,
      createdAt: new Date()
    });
    console.log('[API] Lead guardado en MongoDB _id:', leadDoc._id);

    // 2️⃣ Campos mínimos para HubSpot
    const hubspotFields = [
      { name: 'firstname', value: fields.firstname || '' },
      { name: 'lastname', value: fields.lastname || '' },
      { name: 'email', value: fields.email || '' },
      { name: 'phone', value: fields.phone || '' },
      { name: 'company', value: fields.company || '' },
      { name: 'puesto', value: fields.puesto || '' },
      { name: 'vacantesAnuales', value: fields.vacantesAnuales || fields.vacantes_anuales || '' },
      { name: 'rfc', value: fields.rfc || '' },
      { name: 'hs_visitor_id', value: visitorId || '' },
      { name: 'utm_source', value: context?.utm_source || '' },
      { name: 'utm_medium', value: context?.utm_medium || '' },
      { name: 'utm_campaign', value: context?.utm_campaign || '' }
    ];

    // 3️⃣ Contexto (sin validaciones raras)
    const hubspotContext = {
      pageUri: context?.pageUri || '',
      pageName: context?.pageName || ''
    };
    if (context?.hutk) {
      hubspotContext.hutk = context.hutk;
    }

    // 4️⃣ Enviar a HubSpot
    const hsRes = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: hubspotFields, context: hubspotContext })
      }
    );

    const hsText = await hsRes.text();
    if (!hsRes.ok) {
      console.error('[HS] Error:', hsText);
      return res.status(400).json({ ok: false, error: hsText });
    }

    console.log('[HS] Lead enviado OK:', hsText);
    res.json({ ok: true });

  } catch (error) {
    console.error('[API] Error en lead:', error);
    res.status(500).json({ ok: false, message: 'Error interno' });
  }
});

export default router;
