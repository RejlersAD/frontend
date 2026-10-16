import { useCallback, useEffect, useRef, useState } from "react";
import salesService from "../../services/sales.service";

export default function useSalesRegistrationOptions() {
  const request = useRef(0);
  const [state, setState] = useState({ loading: true, error: "", owners: [], opportunityTypes: [], defaultOwner: "" });
  const load = useCallback(async () => {
    const version = ++request.current;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const result = await salesService.getRegistrationOptions();
      if (!Array.isArray(result?.owners) || !Array.isArray(result?.opportunity_types) ||
        result.owners.some((owner) => !["string", "number"].includes(typeof owner?.id) || !owner.name) ||
        result.opportunity_types.some((type) => !type?.value || !type.label)) throw new Error("Invalid registration options");
      if (version === request.current) setState({ loading: false, error: "", owners: result.owners, opportunityTypes: result.opportunity_types, defaultOwner: String(result.default_owner ?? "") });
    } catch (error) {
      if (version === request.current) setState((previous) => ({ ...previous, loading: false, error: [401, 403].includes(error?.response?.status) ? "You do not have access to opportunity registration options." : "Registration options could not be loaded. Retry before saving." }));
    }
  }, []);
  useEffect(() => { load(); return () => { request.current += 1; }; }, [load]);
  return { ...state, load };
}
