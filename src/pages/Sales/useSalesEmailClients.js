import { useCallback, useEffect, useRef, useState } from "react";
import salesService from "../../services/sales.service";

// Publish only a complete authorized directory. A partial page must not imply
// that a customer is absent or that a name has only one matching record.
export default function useSalesEmailClients(enabled = true) {
  const requestId = useRef(0);
  const active = useRef(false);
  const access = useRef({ denied: false, generation: 0 });
  const [state, setState] = useState({ records: [], loading: true, error: "", denied: false });
  const load = useCallback(async () => {
    const request = ++requestId.current;
    const current = () => active.current && request === requestId.current;
    setState((currentState) => ({ records: [], loading: true, error: "", denied: currentState.denied }));
    try {
      const records = [];
      const ids = new Set();
      let page = 1;
      while (page !== null) {
        const payload = await salesService.getClients({ page, page_size: 100, ordering: "company_name" });
        if (!current()) return;
        const values = Array.isArray(payload) ? payload : payload?.results;
        if (!Array.isArray(values)) throw new Error("Invalid clients.");
        for (const record of values) {
          if (typeof record?.id !== "string" || !record.id.trim() || typeof record.company_name !== "string" || !record.company_name.trim() || ids.has(record.id)) throw new Error("Invalid client.");
          ids.add(record.id);
          records.push({ id: record.id, company_name: record.company_name });
        }
        const next = Array.isArray(payload) ? null : payload.next;
        if (next == null) page = null;
        else {
          if (typeof next !== "string" || !next.trim()) throw new Error("Invalid client page.");
          const pages = new URL(next, window.location.origin).searchParams.getAll("page");
          const nextPage = Number(pages[0]);
          if (pages.length !== 1 || !/^[1-9]\d*$/.test(pages[0]) || !Number.isSafeInteger(nextPage) || nextPage !== page + 1 || page >= 100) throw new Error("Invalid client page.");
          page = nextPage;
        }
      }
      if (current()) {
        access.current.denied = false;
        setState({ records, loading: false, error: "", denied: false });
      }
    } catch (error) {
      if (!current()) return;
      const denied = [401, 403].includes(error?.response?.status);
      if (denied) access.current = { denied: true, generation: access.current.generation + 1 };
      setState((currentState) => ({ records: [], loading: false, denied: denied || currentState.denied, error: denied ? "You do not have access to client options." : "Client options could not be loaded. Try again." }));
    }
  }, []);
  useEffect(() => {
    active.current = enabled;
    if (enabled) load();
    return () => { active.current = false; requestId.current += 1; };
  }, [enabled, load]);
  // A reopened form waits for its new directory request, even when the previous
  // form left a complete list in state before the enabling effect runs.
  return { ...state, loading: enabled && !active.current ? true : state.loading, load, access };
}
