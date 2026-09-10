const memory = new Map();

function key() {
  try {
    const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const user = payload.user_id ?? payload.sub;
    return user == null ? null : `radai:vendor-draft:${user}`;
  } catch { return null; }
}

export function readVendorDraft() {
  const id = key();
  if (!id) return null;
  try { return memory.get(id) || JSON.parse(sessionStorage.getItem(id) || 'null'); }
  catch { return memory.get(id) || null; }
}

export function writeVendorDraft(draft) {
  const id = key();
  if (!id) return;
  memory.set(id, draft);
  try { sessionStorage.setItem(id, JSON.stringify(draft)); } catch { /* Retain the in-memory draft if storage is unavailable. */ }
}

export function clearVendorDraft() {
  const id = key();
  if (!id) return;
  memory.delete(id);
  try { sessionStorage.removeItem(id); } catch { /* Storage may be unavailable. */ }
}
