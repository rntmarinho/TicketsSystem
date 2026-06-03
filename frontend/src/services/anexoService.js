import { apiFetch } from './api';

const API_BASE_URL = 'http://127.0.0.1:5000';

/** Lista os anexos de um chamado. */
export async function getAnexos(ticketId) {
  const response = await apiFetch(`/tickets/${ticketId}/anexos`);
  if (!response.ok) throw new Error('Erro ao listar anexos.');
  return response.json();
}

/**
 * Faz upload de um arquivo.
 * Usa fetch diretamente (sem Content-Type JSON) para multipart/form-data.
 */
export async function uploadAnexo(ticketId, file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('arquivo', file);

  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/anexos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao enviar anexo.');
  }

  return response.json();
}

/** Remove um anexo pelo ID. */
export async function deleteAnexo(ticketId, anexoId) {
  const response = await apiFetch(
    `/tickets/${ticketId}/anexos/${anexoId}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error('Erro ao remover anexo.');
  return response.json();
}

/** URL autenticada para download via rota do Flask. */
export function getDownloadUrl(nomeArquivo) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/tickets/anexos/download/${nomeArquivo}?token=${token}`;
}

/** URL estática direta (só funciona se backend/public/ for servido como estático). */
export function getStaticUrl(caminhoArquivo) {
  return `${API_BASE_URL}${caminhoArquivo}`;
}

/** Formata bytes para leitura humana. */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Retorna ícone e cor baseados no tipo MIME / extensão. */
export function getFileIcon(tipoMime, nomeOriginal) {
  const ext = nomeOriginal?.split('.').pop()?.toLowerCase() || '';
  const mime = tipoMime || '';

  if (mime.startsWith('image/'))             return { icon: '🖼️', color: '#8b5cf6' };
  if (mime === 'application/pdf' || ext === 'pdf') return { icon: '📄', color: '#ef4444' };
  if (['doc', 'docx'].includes(ext))         return { icon: '📝', color: '#2563eb' };
  if (['xls', 'xlsx', 'csv'].includes(ext))  return { icon: '📊', color: '#16a34a' };
  if (['zip', 'rar', '7z'].includes(ext))    return { icon: '🗜️', color: '#f59e0b' };
  if (['mp4', 'mov', 'avi'].includes(ext))   return { icon: '🎬', color: '#ec4899' };
  if (['mp3', 'wav'].includes(ext))          return { icon: '🎵', color: '#06b6d4' };
  if (ext === 'txt')                         return { icon: '📃', color: '#6b7280' };
  return { icon: '📎', color: '#374151' };
}
