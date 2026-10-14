import { useCallback, useEffect, useState } from "react";
import { customerMatch } from "./SalesEmailCustomerMatch";

const emptyChoice = (key) => ({ key, value: "", newName: "", fixed: false });

// A complete, source-backed suggestion can initialize the existing Client field.
// Once reviewed or initialized, later reads never replace that chosen identity.
export default function useSalesEmailClientChoice({ information, clients, canCreateClient = false, enabled = true, reviewKey }) {
  const [stored, setStored] = useState(() => emptyChoice(reviewKey));
  const current = stored.key === reviewKey ? stored : emptyChoice(reviewKey);
  const match = customerMatch(information);
  const ready = enabled && !clients.loading && !clients.error && !clients.denied;
  const matchedId = ready && match?.status === "matched" && clients.records.some((client) => client.id === match.candidates[0].id)
    ? match.candidates[0].id : "";
  const proposedName = ready && canCreateClient === true && match?.status === "no_match" ? match.detected_name.trim() : "";
  const proposal = matchedId || (proposedName ? "__new__" : "");

  useEffect(() => {
    setStored((previous) => {
      const value = previous.key === reviewKey ? previous : emptyChoice(reviewKey);
      if (!enabled) return value.value || value.fixed ? emptyChoice(reviewKey) : value;
      if (value.fixed || !ready || !proposal) return value;
      return { key: reviewKey, value: proposal, newName: proposal === "__new__" ? proposedName : "", fixed: true };
    });
  }, [enabled, reviewKey, ready, proposal, proposedName]);

  // A refreshed source or revoked capability cannot silently authorize the previous
  // name. Keep the form open and offer the current sourced name for explicit choice.
  const newClientName = proposedName;
  const clientChoice = current.value === "__new__" && (!proposedName || current.newName !== proposedName) ? "" : current.value;
  const chooseClient = useCallback((value) => {
    setStored({ key: reviewKey, value, newName: value === "__new__" ? newClientName : "", fixed: true });
  }, [reviewKey, newClientName]);

  return { clientChoice, newClientName, chooseClient };
}
