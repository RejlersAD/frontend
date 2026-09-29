import PropTypes from "prop-types";
import { Sparkles } from "lucide-react";

export default function SalesEmailPageHeader({ information, children, imported = false }) {
  const reviewed = information?.ai_review?.version === 1 && information.ai_review.status === "validated";
  return <header className="sales-email-page-header">
    <div className="sales-email-page-heading">
      <nav className="sales-email-breadcrumb" aria-label="Breadcrumb"><span>Sales</span><span aria-hidden="true">/</span><span>Email Intake</span></nav>
      <div className="sales-email-title-line"><h1>Email Intake</h1><span className="sales-email-ai-badge" title={reviewed ? "The selected email has a source-validated AI review." : "AI review is available when configured. Review status appears with each email."}><Sparkles aria-hidden="true" />{reviewed ? "Powered by AI" : "AI email review"}</span></div>
      <p>{imported ? "Review imported enquiries. Turn the next action into an opportunity." : "Understand every email. Review the next action."}</p>
    </div>
    {children && <div className="sales-email-page-actions">{children}</div>}
  </header>;
}

SalesEmailPageHeader.propTypes = { information: PropTypes.object, children: PropTypes.node, imported: PropTypes.bool };
