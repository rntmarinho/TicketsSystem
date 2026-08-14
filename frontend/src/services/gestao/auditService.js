import { apiFetch } from '../api';

export async function getAuditLog() {
  const r = await apiFetch('/gestao/audit-log/');
  return r.json();
}
