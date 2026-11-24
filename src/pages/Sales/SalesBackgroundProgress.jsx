import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle2, Loader2, X } from "lucide-react";
import salesService from "../../services/sales.service";
import { ACTIVE, importProgress, scanProgress } from "./backgroundProgressPresentation";
import "./SalesBackgroundProgress.css";

const ACTIVE_MS = 3000;
const IDLE_MS = 20000;
const RECENT_MS = 10 * 60 * 1000;
function Meter({ label, value, indeterminate, failed }) {
  return (
    <div
      className={`sbp-meter ${indeterminate ? "sbp-indeterminate" : ""} ${failed ? "sbp-failed" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
    >
      <span style={indeterminate ? undefined : { width: `${value}%` }} />
    </div>
  );
}
Meter.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  indeterminate: PropTypes.bool,
  failed: PropTypes.bool,
};

export default function SalesBackgroundProgress({ dealId, nudge, onRefresh }) {
  const [imports, setImports] = useState([]);
  const [scan, setScan] = useState(null);
  const [dismissed, setDismissed] = useState(() => new Set());
  const seen = useRef(new Map()); // import id -> "status:processed" last reported
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    let cancelled = false;
    let timer;
    const controller = new AbortController();
    const poll = async () => {
      let busy = false;
      try {
        const data = await salesService.getWorkspaceZipImports(
          dealId,
          controller.signal,
        );
        if (cancelled) return;
        const rows = (data?.imports || []).filter(
          (row) =>
            ACTIVE.includes(row.status) ||
            Date.now() - new Date(row.updated_at).getTime() < RECENT_MS,
        );
        let changed = false;
        for (const row of rows) {
          const key = `${row.status}:${row.processed}`;
          if (seen.current.has(row.id) && seen.current.get(row.id) !== key)
            changed = true;
          seen.current.set(row.id, key);
        }
        if (changed) refresh.current?.(); // new files arrived: reload the folder
        setImports(rows);
        busy = rows.some((row) => ACTIVE.includes(row.status));
      } catch {
        if (cancelled) return;
      }
      try {
        const analysis = await salesService.getOpportunityAnalysis(
          dealId,
          controller.signal,
        );
        if (cancelled) return;
        const next = scanProgress(analysis);
        setScan(next);
        busy = busy || Boolean(next);
      } catch {
        if (cancelled) return;
      }
      timer = setTimeout(poll, busy ? ACTIVE_MS : IDLE_MS);
    };
    poll();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [dealId, nudge]);

  const shown = imports.filter((row) => !dismissed.has(row.id));
  if (!shown.length && !scan) return null;
  return (
    <section
      className="sbp-panel"
      aria-label="Background processing"
      aria-live="polite"
    >
      {shown.map((row) => {
        const progress = importProgress(row);
        return (
          <div className="sbp-row" key={row.id}>
            <div className="sbp-head">
              {progress.finished ? (
                <CheckCircle2
                  className={progress.failed ? "sbp-icon-failed" : "sbp-icon-done"}
                  aria-hidden="true"
                />
              ) : (
                <Loader2 className="sbp-spin" aria-hidden="true" />
              )}
              <strong>{row.source_name}</strong>
              <span>{progress.label}</span>
              {progress.finished && (
                <button
                  type="button"
                  className="sbp-dismiss"
                  aria-label={`Dismiss ${row.source_name} progress`}
                  onClick={() =>
                    setDismissed((previous) => new Set(previous).add(row.id))
                  }
                >
                  <X aria-hidden="true" />
                </button>
              )}
            </div>
            <Meter {...progress} />
          </div>
        );
      })}
      {scan && (
        <div className="sbp-row">
          <div className="sbp-head">
            <Loader2 className="sbp-spin" aria-hidden="true" />
            <strong>Document scan</strong>
            <span>{scan.label}</span>
          </div>
          <Meter {...scan} />
        </div>
      )}
    </section>
  );
}

SalesBackgroundProgress.propTypes = {
  dealId: PropTypes.string.isRequired,
  nudge: PropTypes.any,
  onRefresh: PropTypes.func,
};
