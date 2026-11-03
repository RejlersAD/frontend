import { useState } from "react";
import PropTypes from "prop-types";
import salesService from "../../services/sales.service";

export default function SalesEmailArchiveMatch({ intake, classification, disabled, onLinked }) {
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const check = async () => {
    setBusy(true);
    setMatch(null);
    setMessage("");
    try {
      const result = await salesService.getEmailOpportunityMatches(intake.id);
      if (result.state === "unique_match" && result.matches?.length === 1) {
        setMatch(result.matches[0]);
      } else {
        setMessage("No unique exact client/reference match. Continue manual review.");
      }
    } catch (error) {
      setMessage(error?.response?.data?.detail || "Opportunity matching is unavailable. Refresh and retry.");
    } finally {
      setBusy(false);
    }
  };

  const link = async () => {
    setBusy(true);
    setMessage("");
    try {
      await salesService.linkEmailOpportunity(intake.id, {
        opportunity: match.id,
        source_token: intake.source_token,
        classification_code: classification,
        classification_confirmed: true,
      });
      onLinked();
    } catch (error) {
      setMatch(null);
      setMessage(error?.response?.data?.detail || "The link could not be saved. Reload the email and review again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Existing opportunity match" className="mb-3 rounded border border-slate-200 p-3 text-sm">
      <p className="font-semibold">Existing opportunity</p>
      <p className="my-2 text-slate-600">Check the exact client and reference before creating another opportunity.</p>
      <button type="button" className="rounded border px-3 py-2" disabled={disabled || busy} onClick={check}>
        {busy ? "Working..." : "Check existing opportunity"}
      </button>
      {match && (
        <div className="mt-2">
          <p>{match.code} - {match.title}</p>
          <p className="my-2">Review this match and confirm the email classification before linking.</p>
          <button type="button" className="rounded border px-3 py-2" disabled={disabled || busy || !classification} onClick={link}>
            Confirm link to this opportunity
          </button>
        </div>
      )}
      {message && <p role="status" className="mt-2">{message}</p>}
    </section>
  );
}

SalesEmailArchiveMatch.propTypes = {
  intake: PropTypes.shape({ id: PropTypes.string.isRequired, source_token: PropTypes.string }).isRequired,
  classification: PropTypes.string,
  disabled: PropTypes.bool,
  onLinked: PropTypes.func.isRequired,
};
