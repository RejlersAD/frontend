import { useEffect, useRef } from 'react';
import salesService from '../../services/sales.service';
import { verifiedClassification } from './salesDocumentControl';

// Only visible, pending records are checked. Editors keep their own draft/revision.
export default function useDocumentClassificationPolling({ recordId, folderKey, storage, files, onUpdated }) {
  const context = useRef(null);
  context.current = { files, onUpdated };
  const pending = files.some(file => ['queued', 'running'].includes(file.classification?.status));
  useEffect(() => {
    if (!pending) return undefined;
    let disposed = false, busy = false;
    const started = Date.now(), attempts = new Map();
    const controller = new AbortController();
    const poll = async () => {
      if (busy || disposed || document.hidden || Date.now() - started > 120000) return;
      const candidates = context.current.files.filter(file => ['queued', 'running'].includes(file.classification?.status) && (attempts.get(file.id) || 0) < 20)
        .sort((left, right) => (attempts.get(left.id) || 0) - (attempts.get(right.id) || 0)).slice(0, 4);
      busy = true;
      await Promise.allSettled(candidates.map(async file => {
        attempts.set(file.id, (attempts.get(file.id) || 0) + 1);
        try {
          const result = await salesService.getOpportunityDocumentClassification(recordId, folderKey, file.id, { signal: controller.signal });
          if (!disposed && verifiedClassification(result?.classification)) context.current.onUpdated({ id: file.id, classification: result.classification });
        } catch { /* Background checks never replace a user's draft or hide a saved file. Refresh remains available. */ }
      }));
      busy = false;
    };
    const timer = setInterval(poll, 4000);
    return () => { disposed = true; clearInterval(timer); controller.abort(); };
  }, [recordId, folderKey, storage, pending]);
}
