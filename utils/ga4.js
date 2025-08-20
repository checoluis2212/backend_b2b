// utils/ga4.js (Node.js / backend)
import axios from 'axios';

// ===== ENV (Node) =====
const MID = process.env.GA4_MEASUREMENT_ID;
const SEC = process.env.GA4_API_SECRET;

const BASE =
  process.env.NODE_ENV === 'production'
    ? 'https://www.google-analytics.com/mp/collect'
    : 'https://www.google-analytics.com/debug/mp/collect'; // <- debug en dev

const GA4_URL = `${BASE}?measurement_id=${MID}&api_secret=${SEC}`;

// Flags para no romper en Node si se usan helpers de browser
const HAS_WINDOW   = typeof window !== 'undefined';
const HAS_DOCUMENT = typeof document !== 'undefined';
const HAS_LS       = typeof localStorage !== 'undefined';

/**
 * Envía un evento a GA4 Measurement Protocol (backend)
 */
export async function sendGA4Event(clientId, eventName, utm = {}, extra = {}) {
  if (!MID || !SEC) throw new Error('Faltan GA4 env vars (GA4_MEASUREMENT_ID / GA4_API_SECRET)');
  if (!clientId) throw new Error('client_id requerido');
  if (!eventName) throw new Error('eventName requerido');

  const utm_source   = utm.source   ?? utm.utm_source   ?? '(not set)';
  const utm_medium   = utm.medium   ?? utm.utm_medium   ?? '(not set)';
  const utm_campaign = utm.campaign ?? utm.utm_campaign ?? '(not set)';
  const utm_content  = utm.content  ?? utm.utm_content  ?? undefined;
  const utm_term     = utm.term     ?? utm.utm_term     ?? undefined;

  const body = {
    client_id: String(clientId),
    timestamp_micros: Date.now() * 1000,
    events: [{
      name: eventName,
      params: {
        engagement_time_msec: 1,
        visitor_id: String(clientId),
        utm_source,
        utm_medium,
        utm_campaign,
        ...(utm_content ? { utm_content } : {}),
        ...(utm_term ? { utm_term } : {}),
        page_location: extra.page_location || '',
        page_referrer: extra.page_referrer || '',
        ...(extra.params || {})
      }
    }],
    user_properties: {
      utm_source:   { value: utm_source },
      utm_medium:   { value: utm_medium },
      utm_campaign: { value: utm_campaign },
      ...(utm_content ? { utm_content: { value: utm_content } } : {}),
      ...(utm_term ? { utm_term: { value: utm_term } } : {})
    }
  };

  const resp = await axios.post(GA4_URL, body, { headers: { 'Content-Type': 'application/json' } });

  if (GA4_URL.includes('/debug/')) {
    console.log('[GA4] debug response', JSON.stringify(resp.data, null, 2));
  } else {
    console.log('[GA4] sent OK', eventName);
  }
  return resp.data;
}

/* =======================
   ADICIONES (append-only)
   ======================= */

// Estas utilidades usan cookies/DOM; en backend devolvemos valores seguros

export function getCookie(name) {
  try {
    if (!HAS_DOCUMENT) return '';
    return decodeURIComponent(
      (document.cookie.split('; ').find(x => x.startsWith(name + '=')) || '')
        .split('=')[1] || ''
    );
  } catch {
    return '';
  }
}

export function getGAClientId() {
  const raw = getCookie('_ga');
  if (!raw) return '';
  const p = raw.split('.');
  return p.length >= 4 ? `${p[2]}.${p[3]}` : '';
}

export function getUTMsFromCookies() {
  const utm_source   = getCookie('utm_source')   || '(not set)';
  const utm_medium   = getCookie('utm_medium')   || '(not set)';
  const utm_campaign = getCookie('utm_campaign') || '(not set)';
  const utm_content  = getCookie('utm_content')  || undefined;
  const utm_term     = getCookie('utm_term')     || undefined;
  return { utm_source, utm_medium, utm_campaign, utm_content, utm_term };
}

/**
 * En backend NO navega (no hay window). Se mantiene para compatibilidad.
 */
export async function trackGA4Click(eventName, options = {}) {
  const {
    placement,
    params = {},
    utm = {},
    clientId: forcedClientId,
    navigateTo,       // ignorado en Node
    newTab = true,    // ignorado en Node
    timeoutMs = 300,
  } = options;

  const cid =
    forcedClientId ||
    (HAS_LS ? localStorage.getItem('visitorId') : '') ||
    getGAClientId() ||
    `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;

  const utms = Object.keys(utm).length ? utm : getUTMsFromCookies();

  const extra = {
    page_location: HAS_WINDOW ? window.location.href : '',
    page_referrer: HAS_DOCUMENT ? (document.referrer || '') : '',
    params: { placement, ...params },
  };

  try {
    await Promise.race([
      sendGA4Event(cid, eventName, utms, extra),
      new Promise((r) => setTimeout(r, timeoutMs)),
    ]);
  } catch (e) {
    console.warn('[GA4] trackGA4Click (Node) error', e);
  }

  // En Node no hay navegación
  return { ok: true };
}

export function trackAndGo_PruebaGratis(url, opts = {}) {
  // En backend no puede "abrir" la URL; solo registramos el evento
  return trackGA4Click('cta_prueba_gratis_click', {
    placement: opts.placement || 'promo_header',
    params: { button_text: opts.button_text || 'Prueba/Empieza gratis' },
    timeoutMs: opts.timeoutMs ?? 300,
    clientId: opts.clientId,
    utm: opts.utm,
  });
}
