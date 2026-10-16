import { useId, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { ChevronDown, MoreHorizontal } from "lucide-react";

export default function SalesEmailMessageHeader({ subject, senderName, senderEmail, to, receivedAt, dateLabel, children }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const subjectRef = useRef(null);
  const id = useId();
  const name = senderName || senderEmail || "Sender unavailable";
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  const initials = /^[A-Z]{2,3}$/.test(parts[0] || "") ? parts[0] : parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  useLayoutEffect(() => {
    const node = subjectRef.current;
    if (!node || expanded) return undefined;
    const measure = () => setOverflows(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [subject, expanded]);

  return <>
    <div className="sales-email-sender">
      <span className="sales-email-avatar" aria-hidden="true">{initials || "?"}</span>
      <div className="sales-email-sender-identity">
        <strong title={name}>{name}</strong>
        {to ? <details className="sales-email-recipients"><summary>To: {to}<ChevronDown aria-hidden="true" /></summary><div><p>From: {senderEmail || name}</p><p>To: {to}</p></div></details>
          : senderEmail && senderEmail !== name ? <span>{senderEmail}</span> : null}
      </div>
      <time dateTime={receivedAt || undefined}>{dateLabel}</time>
      {children && <details className="sales-email-message-options">
        <summary className="sales-email-button sales-email-icon-button" aria-label="Message details" title="Message details"><MoreHorizontal aria-hidden="true" /></summary>
        <div>{children}</div>
      </details>}
    </div>
    <div className="sales-email-subject-block">
      <h2 ref={subjectRef} id={`${id}-subject`} className={`sales-email-subject${expanded ? " sales-email-subject-expanded" : ""}`}>{subject || "No subject"}</h2>
      {(expanded || overflows) && <button type="button" className="sales-email-full-subject" aria-expanded={expanded} aria-controls={`${id}-subject`} onClick={() => setExpanded((value) => !value)}>{expanded ? "Less subject" : "Full subject"}</button>}
    </div>
  </>;
}

SalesEmailMessageHeader.propTypes = {
  subject: PropTypes.string, senderName: PropTypes.string, senderEmail: PropTypes.string,
  to: PropTypes.string, receivedAt: PropTypes.string, dateLabel: PropTypes.string, children: PropTypes.node,
};
