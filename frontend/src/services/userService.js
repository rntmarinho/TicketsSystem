import { apiFetch } from './api';

export async function getUsers() {
  const response = await apiFetch('/users/');
  return await response.json();
}

export async function getUser(id) {
  const response = await apiFetch(`/users/${id}`);
  return await response.json();
}

export async function createUser(data) {
  const response = await apiFetch('/users/', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function updateUser(id, data) {
  const response = await apiFetch(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  return await response.json();
}

export async function activateUser(id) {
  const response = await apiFetch(`/users/${id}/situation`, {
    method: 'PATCH',
    body: JSON.stringify({ situation: 'A' })
  });
  return await response.json();
}

export async function deleteUser(id) {
  const response = await apiFetch(`/users/${id}`, {
    method: 'DELETE'
  });
  return await response.json();
}

// ── Perfil próprio, foto e assinatura (02/09/2026) ──────────────────────────
export async function getMe() {
  const response = await apiFetch('/users/me');
  return await response.json();
}

// Versão pra cache-busting das imagens de perfil (muda a cada upload/remoção).
const MEDIA_VERSION_KEY = 'profile_media_version';
export function getMediaVersion() {
  return Number(localStorage.getItem(MEDIA_VERSION_KEY) || 0);
}
export function bumpMediaVersion() {
  localStorage.setItem(MEDIA_VERSION_KEY, String(Date.now()));
  window.dispatchEvent(new Event('profile-media-updated'));
}

// <img src> não manda header Authorization — token vai por querystring, mesmo
// padrão do download de anexo (backend aceita locations=["headers","query_string"]).
export function getPictureUrl(userId, version = getMediaVersion()) {
  const token = localStorage.getItem('token');
  return `/api/users/${userId}/picture?token=${token}&v=${version}`;
}
export function getSignatureUrl(userId, version = getMediaVersion()) {
  const token = localStorage.getItem('token');
  return `/api/users/${userId}/signature?token=${token}&v=${version}`;
}

async function uploadImage(path, field, file) {
  const formData = new FormData();
  formData.append(field, file);
  const response = await apiFetch(path, { method: 'PATCH', body: formData });
  return await response.json();
}
export function uploadPicture(userId, file) {
  return uploadImage(`/users/${userId}/picture`, 'picture', file);
}
export function uploadSignature(userId, file) {
  return uploadImage(`/users/${userId}/signature`, 'signature', file);
}
export async function deletePicture(userId) {
  const response = await apiFetch(`/users/${userId}/picture`, { method: 'DELETE' });
  return await response.json();
}
export async function deleteSignature(userId) {
  const response = await apiFetch(`/users/${userId}/signature`, { method: 'DELETE' });
  return await response.json();
}
