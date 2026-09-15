import { apiFetch } from '../api';

export async function getVagas({ status } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  const r = await apiFetch(`/rh/vagas/${qs ? `?${qs}` : ''}`);
  return r.json();
}

export async function getVaga(id) {
  const r = await apiFetch(`/rh/vagas/${id}`);
  return r.json();
}

export async function createVaga(data) {
  const r = await apiFetch('/rh/vagas/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateVaga(id, data) {
  const r = await apiFetch(`/rh/vagas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function cancelVaga(id) {
  const r = await apiFetch(`/rh/vagas/${id}/cancelar`, { method: 'PATCH' });
  return r.json();
}

export async function decidirVaga(id, decisao, comentario) {
  const r = await apiFetch(`/rh/vagas/${id}/decisao`, {
    method: 'PATCH',
    body: JSON.stringify({ decisao, comentario }),
  });
  return r.json();
}

export async function marcarVagaCriada(id, referenciaVagaSenior) {
  const r = await apiFetch(`/rh/vagas/${id}/marcar-criada`, {
    method: 'PATCH',
    body: JSON.stringify({ referencia_vaga_senior: referenciaVagaSenior }),
  });
  return r.json();
}

// ── Anexos ──
export async function getVagaAttachments(vagaId) {
  const r = await apiFetch(`/rh/vagas/${vagaId}/attachments`);
  return r.json();
}

export async function uploadVagaAttachment(vagaId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/rh/vagas/${vagaId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return r.json();
}

export function getVagaAttachmentDownloadUrl(attachmentId) {
  const token = localStorage.getItem('token');
  return `/api/rh/vagas/attachments/${attachmentId}/download?token=${token}`;
}

export async function deleteVagaAttachment(attachmentId) {
  const r = await apiFetch(`/rh/vagas/attachments/${attachmentId}`, { method: 'DELETE' });
  return r.json();
}
