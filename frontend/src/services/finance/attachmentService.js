import { apiFetch } from '../api';

export async function getDemandAttachments(demandId) {
  const r = await apiFetch(`/finance/demands/${demandId}/attachments`);
  return r.json();
}

export async function uploadDemandAttachment(demandId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/finance/demands/${demandId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return r.json();
}

export function getDemandAttachmentDownloadUrl(attachmentId) {
  const token = localStorage.getItem('token');
  return `/api/finance/demands/attachments/${attachmentId}/download?token=${token}`;
}

export async function deleteDemandAttachment(attachmentId) {
  const r = await apiFetch(`/finance/demands/attachments/${attachmentId}`, { method: 'DELETE' });
  return r.json();
}
