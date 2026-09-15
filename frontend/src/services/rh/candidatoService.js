import { apiFetch } from '../api';

export async function getCandidatos(vagaId) {
  const r = await apiFetch(`/rh/vagas/${vagaId}/candidatos`);
  return r.json();
}

export async function createCandidato(vagaId, data) {
  const r = await apiFetch(`/rh/vagas/${vagaId}/candidatos`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateCandidato(id, data) {
  const r = await apiFetch(`/rh/candidatos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteCandidato(id) {
  const r = await apiFetch(`/rh/candidatos/${id}`, { method: 'DELETE' });
  return r.json();
}

export async function getComentarios(candidatoId) {
  const r = await apiFetch(`/rh/candidatos/${candidatoId}/comentarios`);
  return r.json();
}

export async function createComentario(candidatoId, body) {
  const r = await apiFetch(`/rh/candidatos/${candidatoId}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return r.json();
}

// ── Anexos (currículo) ──
export async function getCandidatoAttachments(candidatoId) {
  const r = await apiFetch(`/rh/candidatos/${candidatoId}/attachments`);
  return r.json();
}

export async function uploadCandidatoAttachment(candidatoId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/rh/candidatos/${candidatoId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return r.json();
}

export function getCandidatoAttachmentDownloadUrl(attachmentId) {
  const token = localStorage.getItem('token');
  return `/api/rh/vagas/attachments/${attachmentId}/download?token=${token}`;
}

export async function deleteCandidatoAttachment(attachmentId) {
  const r = await apiFetch(`/rh/vagas/attachments/${attachmentId}`, { method: 'DELETE' });
  return r.json();
}
