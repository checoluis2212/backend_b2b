// src/services/api.js

// En .env.local (desarrollo):
// VITE_API_URL=http://localhost:3001
//
// En Vercel (producción):
// VITE_API_URL=https://backend-b2b.onrender.com

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function sendResponse(payload) {
  const url = `${API_BASE}/api/responses`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getResponses() {
  const url = `${API_BASE}/api/responses/all`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Error ${res.status}`);
  }
  return res.json();
}
