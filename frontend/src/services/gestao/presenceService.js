import { apiFetch } from '../api';

export async function sendHeartbeat() {
  const r = await apiFetch('/gestao/presence/heartbeat', { method: 'POST' });
  return r.json();
}

export async function getPresence() {
  const r = await apiFetch('/gestao/presence/');
  return r.json();
}
