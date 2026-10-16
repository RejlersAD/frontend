import { useCallback, useEffect, useRef, useState } from "react";
import salesService from "../../services/sales.service";
import { isKnownClassification } from "./salesEmailReviewState";

const emptyState = (scope) => ({ scope, running: false, completed: 0, total: 0, results: {}, error: "" });
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const validId = (value) => typeof value === "string" && value.trim().length > 0;

function reviewResult(payload, expectedId) {
  if (!object(payload) || payload.id !== expectedId || typeof payload.is_read !== "boolean" ||
      typeof payload.is_draft !== "boolean" || !["incoming", "outgoing", "draft", "unknown"].includes(payload.direction)) {
    throw new Error("Invalid email review response.");
  }
  // Another mailbox user may have changed the message since this page loaded.
  // Never change its read state or retain its content in the batch summary.
  if (payload.is_read || payload.is_draft || payload.direction !== "incoming") {
    return { status: "skipped", classificationCode: "" };
  }
  const information = object(payload.extracted_information);
  if (!information) throw new Error("Invalid email review response.");
  const review = object(information.ai_review);
  let status = "rules";
  if (information.ai_review != null) {
    if (review?.version !== 1) status = "failed";
    else if (review.status === "validated") status = "validated";
    else if (["unavailable", "disabled"].includes(review.status)) status = "unavailable";
    else if (review.status === "in_progress") status = "in_progress";
    else status = "failed";
  }
  const classification = object(information.classification);
  const classificationCode = classification?.version === 1 && classification.status === "classified" &&
    isKnownClassification(classification.code) ? classification.code : "";
  return { status, classificationCode };
}

function unavailableMessage(status) {
  if (status === 401) return "Sign in again to analyze mailbox emails.";
  if (status === 403) return "You do not have access to this mailbox.";
  return "This mailbox or email is no longer available. Refresh emails.";
}

// A manual, page-scoped queue. The server owns source permissions and AI caching;
// these GET requests neither mark messages read nor create business records.
export default function useSalesEmailBatchReview({ connectionId, records, pageKey, onUnavailable, onReviewed }) {
  const scope = JSON.stringify([connectionId, pageKey]);
  const inputs = useRef(null);
  inputs.current = { connectionId, records, scope, onUnavailable, onReviewed };
  const mounted = useRef(false);
  const generation = useRef(0);
  const runningRequest = useRef(null);
  const [state, setState] = useState(() => emptyState(scope));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      runningRequest.current = null;
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    runningRequest.current = null;
    setState(emptyState(scope));
    return () => {
      generation.current += 1;
      runningRequest.current = null;
    };
  }, [scope]);

  const cancel = useCallback(() => {
    generation.current += 1;
    runningRequest.current = null;
    if (mounted.current) setState((previous) => previous.scope === inputs.current.scope
      ? { ...previous, running: false } : emptyState(inputs.current.scope));
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    runningRequest.current = null;
    if (mounted.current) setState(emptyState(inputs.current.scope));
  }, []);

  const analyzeUnread = useCallback(async () => {
    const input = inputs.current;
    if (!mounted.current || runningRequest.current !== null || !validId(input.connectionId)) return;
    const seen = new Set();
    const ids = (Array.isArray(input.records) ? input.records.slice(0, 50) : [])
      .filter((record) => {
        if (!validId(record?.id) || seen.has(record.id) || record.is_read !== false ||
            record.is_draft !== false || record.direction !== "incoming") return false;
        seen.add(record.id);
        return true;
      }).map((record) => record.id);
    const request = ++generation.current;
    runningRequest.current = request;
    const current = () => mounted.current && generation.current === request && inputs.current.scope === input.scope;
    setState({ ...emptyState(input.scope), running: ids.length > 0, total: ids.length });

    for (const id of ids) {
      if (!current()) return;
      let result;
      try {
        const payload = await salesService.getMailboxMessage(input.connectionId, id);
        if (!current()) return;
        result = reviewResult(payload, id);
      } catch (error) {
        if (!current()) return;
        const status = error?.response?.status;
        if ([401, 403, 404].includes(status)) {
          generation.current += 1;
          runningRequest.current = null;
          setState({ ...emptyState(input.scope), error: unavailableMessage(status) });
          if (typeof inputs.current.onUnavailable === "function") inputs.current.onUnavailable(status);
          return;
        }
        result = { status: "failed", classificationCode: "" };
      }
      if (!current()) return;
      setState((previous) => previous.scope === input.scope ? {
        ...previous,
        completed: previous.completed + 1,
        results: { ...previous.results, [id]: result },
        error: result.status === "failed" ? "Some emails could not be analyzed. You can try again." : previous.error,
      } : previous);
      if (typeof inputs.current.onReviewed === "function") inputs.current.onReviewed(id, result);
    }
    if (current()) {
      runningRequest.current = null;
      setState((previous) => previous.scope === input.scope ? { ...previous, running: false } : previous);
    }
  }, []);

  // Hide the previous page's summaries immediately, before effect cleanup runs.
  const visible = state.scope === scope ? state : emptyState(scope);
  return {
    running: visible.running, completed: visible.completed, total: visible.total,
    results: visible.results, error: visible.error, analyzeUnread, cancel, reset,
  };
}
