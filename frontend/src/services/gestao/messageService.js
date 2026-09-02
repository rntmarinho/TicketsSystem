import { apiFetch } from '../api';

export async function getTeamMessages(teamId) {
  const r = await apiFetch(`/gestao/messages/team/${teamId}`);
  return r.json();
}

export async function sendTeamMessage(teamId, body) {
  const r = await apiFetch(`/gestao/messages/team/${teamId}`, { method: 'POST', body: JSON.stringify({ body }) });
  return r.json();
}

export async function startTeamCall(teamId) {
  const r = await apiFetch(`/gestao/messages/team/${teamId}/call`, { method: 'POST' });
  return r.json();
}

export async function uploadTeamAttachment(teamId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/gestao/messages/team/${teamId}/attachment`, { method: 'POST', body: formData });
  return r.json();
}

export async function getDirectMessages(userId) {
  const r = await apiFetch(`/gestao/messages/direct/${userId}`);
  return r.json();
}

export async function sendDirectMessage(userId, body) {
  const r = await apiFetch(`/gestao/messages/direct/${userId}`, { method: 'POST', body: JSON.stringify({ body }) });
  return r.json();
}

export async function startDirectCall(userId) {
  const r = await apiFetch(`/gestao/messages/direct/${userId}/call`, { method: 'POST' });
  return r.json();
}

export async function uploadDirectAttachment(userId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/gestao/messages/direct/${userId}/attachment`, { method: 'POST', body: formData });
  return r.json();
}

export async function getUnreadSummary() {
  const r = await apiFetch('/gestao/messages/unread');
  return r.json();
}

export async function getCallHistory() {
  const r = await apiFetch('/gestao/messages/calls');
  return r.json();
}

export async function getIncomingCalls() {
  const r = await apiFetch('/gestao/messages/incoming-calls');
  return r.json();
}
