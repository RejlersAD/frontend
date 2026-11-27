import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Gauge, X } from "lucide-react";
import { getAIUsage } from "../services/radaiIntelligence.service";

// Token and cost meter beside the composer: this chat at a glance, with a breakdown of this chat,
// your month and (for its owner) the project. Costs are estimates from list prices, in AED and USD.
const compact = (value) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
const full = (value) => new Intl.NumberFormat().format(value || 0);
const money = (value, currency) => {
  const amount = Number(value || 0);
  const digits = amount > 0 && amount < 0.01 ? 4 : 2;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

function UsageBlock({ title, note, totals }) {
  return (
    <section className="radai-ai-usage-block">
      <header><strong>{title}</strong>{note && <span>{note}</span>}</header>
      <dl>
        <div><dt>Tokens</dt><dd>{full(totals.total_tokens)}</dd></div>
        <div><dt>In / out</dt><dd>{compact(totals.input_tokens)} / {compact(totals.output_tokens)}</dd></div>
        <div><dt>Cost (AED)</dt><dd>{money(totals.cost.aed, "AED")}</dd></div>
        <div><dt>Cost (USD)</dt><dd>{money(totals.cost.usd, "$")}</dd></div>
      </dl>
      <p>{totals.answers} answer{totals.answers === 1 ? "" : "s"}</p>
    </section>
  );
}

UsageBlock.propTypes = {
  title: PropTypes.string.isRequired,
  note: PropTypes.string,
  totals: PropTypes.shape({
    total_tokens: PropTypes.number, input_tokens: PropTypes.number, output_tokens: PropTypes.number, answers: PropTypes.number,
    cost: PropTypes.shape({ aed: PropTypes.string, usd: PropTypes.string }),
  }).isRequired,
};

export default function RadaiUsageMeter({ projectId, conversationId, refreshKey }) {
  const [usage, setUsage] = useState(null);
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    let active = true;
    getAIUsage({ project: projectId || undefined, conversation: conversationId || undefined })
      .then((data) => { if (active) setUsage(data); })
      .catch(() => { if (active) setUsage(null); });
    return () => { active = false; };
  }, [projectId, conversationId, refreshKey, open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!usage) return null;
  const chat = usage.conversation;
  const shown = chat || usage.month;
  const month = new Date(`${usage.month_start}T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div ref={root} className="radai-ai-usage">
      <button type="button" className="radai-ai-usage-chip" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        aria-label={`Token usage ${chat ? "in this chat" : "this month"}: ${full(shown.total_tokens)} tokens, ${money(shown.cost.aed, "AED")}, ${money(shown.cost.usd, "US dollars")}. Show details.`}
        title={chat ? "Tokens and cost of this chat" : "Your tokens and cost this month"}>
        <Gauge size={14} aria-hidden="true" />
        <span>{compact(shown.total_tokens)}</span>
        <span className="radai-ai-usage-cost">{money(shown.cost.aed, "AED")}</span>
      </button>
      {open && (
        <div className="radai-ai-usage-panel" role="dialog" aria-label="Token usage and cost">
          <div className="radai-ai-usage-title">
            <strong>Token usage</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close usage"><X size={14} /></button>
          </div>
          {chat ? <UsageBlock title="This chat" totals={chat} /> : <p className="radai-ai-usage-empty">Send a message to start counting this chat.</p>}
          <UsageBlock title="My total" note={month} totals={usage.month} />
          {usage.project && <UsageBlock title="Project total" note={`${usage.project.name} · ${month} · all members`} totals={usage.project} />}
          <p className="radai-ai-usage-foot">
            Estimated from provider list prices. 1 USD = {usage.aed_per_usd} AED (fixed peg).
          </p>
        </div>
      )}
    </div>
  );
}

RadaiUsageMeter.propTypes = {
  projectId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  conversationId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  refreshKey: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};
