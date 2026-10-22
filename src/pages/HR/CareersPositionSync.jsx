import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { talentAcquisitionService as service } from "../../services/talentAcquisition.service";

export default function CareersPositionSync({ onSynced }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    service
      .syncStatus()
      .then((data) => {
        if (active) setState(data);
      })
      .catch(() => {
        if (active) setError("Position synchronization status is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  const sync = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await service.syncPositions();
      setState(await service.syncStatus());
      if (result.status === "failed") throw new Error(result.detail);
      await onSynced?.();
    } catch (failure) {
      setError(failure?.response?.data?.detail || failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ta-careers-sync">
      <div>
        <strong>Rejlers Careers</strong>
        <span>
          {state?.automatic_enabled
            ? `Automatic sync every ${Math.round(state.interval_seconds / 60)} minutes`
            : state
              ? "Automatic sync disabled"
              : "Loading synchronization status…"}
          {state?.last_success_at
            ? ` · Last synced ${new Date(state.last_success_at).toLocaleString()}`
            : ""}
        </span>
        {state?.error && !error && <small role="alert">{state.error}</small>}
        {error && <small role="alert">{error}</small>}
      </div>
      <a
        href="https://www.rejlers.com/ae/careers/"
        target="_blank"
        rel="noreferrer"
      >
        View careers website
      </a>
      <button className="ta-button" disabled={busy} onClick={sync}>
        <ArrowPathIcon />
        {busy ? "Synchronizing…" : "Sync positions now"}
      </button>
    </div>
  );
}
CareersPositionSync.propTypes = { onSynced: PropTypes.func };
