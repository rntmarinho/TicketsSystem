import { apiFetch } from '../api';

export async function getTaskAttachments(taskId) {
  const r = await apiFetch(`/gestao/tasks/${taskId}/attachments`);
  return r.json();
}

export async function uploadTaskAttachment(taskId, file) {
  const formData = new FormData();
  formData.append('arquivo', file);
  const r = await apiFetch(`/gestao/tasks/${taskId}/attachments`, {
    method: 'POST',
    body: formData,
  });
  return r.json();
}

export function getDownloadUrl(attachmentId) {
  const token = localStorage.getItem('token');
  return `/api/gestao/attachments/${attachmentId}/download?token=${token}`;
}

export async function deleteAttachment(attachmentId) {
  const r = await apiFetch(`/gestao/attachments/${attachmentId}`, { method: 'DELETE' });
  return r.json();
}
