// routes/lead.js
import express from 'express';
import fetch from 'node-fetch';
import Lead from '../models/Lead.js';

const router = express.Router();

// Configuración HubSpot
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_FORM_GUID = process.env.HUBSPOT_FORM_GUID;

// Regex para UUID v4 (formato válido de hutk)
const hutkRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    console.log('[API] lead stored (Mongo) _id:', leadDoc._id);

    // 2️⃣ Construir solo lo que va a HubSpot
    const hubspotFields = {
      firstname: fields.firstname || '',
      lastname: fields.lastname || '',
      email: fields.email || '',
      phone: fields.phone || '',
      company: fields.company || '',
      puesto: fields.puesto || '',
      vacantesAnuales: fields.vacantesAnuales || fields.vacantes_anuales || '',
      rfc: fields.rfc || '',
      hs_visitor_id: visitorId || '',
      utm_source: context?.utm_source || '',
      utm_medium: context?.utm_medium || '',
      utm_campaign: context?.utm_campaign || ''
    };

    // 3️⃣ Construir el contexto válido para HubSpot
    const hubspotContext = {
      pageUri: context?.pageUri || '',
      pageName: context?.pageName || ''
    };

    // Solo enviar hutk si es válido
    if (context?.hutk && hutkRegex.test(context.hutk)) {
      hubspotContext.hutk = context.hutk;
    }

    // 4️⃣ Enviar a HubSpot
    const hsPayload = {
      fields: Object.entries(hubspotFields)
        .filter(([_, value]) => value !== '') // No mandar campos vacíos
        .map(([name, value]) => ({ name, value })),
      context: hubspotContext
    };

    const hsRes = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hsPayload)
      }
    );

    if (!hsRes.ok) {
      const errorText = await hsRes.text();
      console.error('[HS] submit error:', errorText);
      return res.status(400).json({ ok: false, message: 'Error enviando a HubSpot', hs: errorText });
    }

    console.log('[HS] Lead enviado correctamente');
    res.json({ ok: true });

  } catch (error) {
    console.error('[API] lead error:', error);
    res.status(500).json({ ok: false, message: 'Error interno en lead' });
  }
});

export default router;
