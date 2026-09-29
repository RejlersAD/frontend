import PropTypes from "prop-types";

const labels = { new_message: "New message", reply: "Reply", forward: "Forward", draft: "Draft", unknown: "Thread role unknown" };
export const threadRole = (value) => typeof value === "string" && Object.hasOwn(labels, value) ? value : "unknown";

// The server identifies the selected source; neither a subject prefix nor the
// source-array position establishes which message is selected or original.
export function selectedThreadSource(analysis) {
  if (analysis?.version !== 1 || typeof analysis.selected_source_id !== "string" || !analysis.selected_source_id || !Array.isArray(analysis.sources)) return null;
  const sources = analysis.sources.filter((source) => source?.id === analysis.selected_source_id);
  return sources.length === 1 && sources[0].origin === "message" && sources[0].is_selected === true ? sources[0] : null;
}

export default function SalesEmailThreadRole({ role, reason, selected, hideDraft }) {
  const value = threadRole(role);
  if (hideDraft && value === "draft") return null;
  const explanation = typeof reason === "string" && reason.trim() ? reason : value === "new_message"
    ? "A new message does not by itself establish the first email or the original request."
    : value === "unknown" ? "The available evidence does not establish this email's thread role." : undefined;
  return <span className="sales-email-status" title={explanation}>{selected ? "Selected email: " : ""}{labels[value]}</span>;
}

SalesEmailThreadRole.propTypes = { role: PropTypes.any, reason: PropTypes.any, selected: PropTypes.bool, hideDraft: PropTypes.bool };
SalesEmailThreadRole.defaultProps = { role: "unknown", reason: "", selected: false, hideDraft: false };
