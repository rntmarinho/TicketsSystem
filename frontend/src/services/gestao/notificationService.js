import { apiFetch } from '../api';

export async function getNotifications() {
  const r = await apiFetch('/gestao/notifications/');
  return r.json();
}

export async function markNotificationRead(id) {
  const r = await apiFetch(`/gestao/notifications/${id}/read`, { method: 'POST' });
  return r.json();
}

export async function markAllNotificationsRead() {
  const r = await apiFetch('/gestao/notifications/read-all', { method: 'POST' });
  return r.json();
}
