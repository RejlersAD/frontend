import { useId, useState } from "react";
import PropTypes from "prop-types";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import { Paperclip } from "lucide-react";

export default function SalesEmailReader({ information, subject, bodyText, bodyContent, saved, hasAttachments, assistant, children }) {
  const [tab, setTab] = useState("email");
  const id = useId();
  const tabs = [["email", "Email preview"], ["thread", "Thread"], ["attachments", "Attachments"], ["details", "Extracted details"]];
  return <>
    <div role="tablist" aria-label="Email reading view" className="sales-email-reader-tabs">
      {tabs.map(([value, label], index) => <button
        key={value} id={`${id}-${value}`} type="button" role="tab"
        aria-selected={tab === value} aria-controls={`${id}-panel`}
        tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[next][0]);
          document.getElementById(`${id}-${tabs[next][0]}`)?.focus();
        }}
      >{label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0} className="sales-email-reader-content">
      {tab === "email" ? <>
        <p className="sales-email-eyebrow">{saved ? "Saved email preview" : "Email preview"}</p>
        <div className="sales-email-body-panel">
          <SalesEmailBody bodyText={bodyText} bodyContent={bodyContent} />
        </div>
        {saved && <p className="sales-email-preview-note">Preview from the imported email.</p>}
        {children}
      </> : tab === "thread" ? <SalesEmailAnalysis analysis={information?.analysis} savedContent={saved} />
        : tab === "attachments" ? <div className="sales-email-attachment-state"><Paperclip aria-hidden="true" /><h4>Attachments</h4><p>{hasAttachments ? "This email has attachments. Open the original email in your mailbox to view them." : "No attachments are reported for this email."}</p>{hasAttachments && <p>Attachment contents have not been included in this review.</p>}</div>
        : <SalesEmailDetectedInformation information={information} subject={subject} />}
    </div>
    {assistant}
  </>;
}

SalesEmailReader.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
  bodyText: PropTypes.string,
  bodyContent: PropTypes.array,
  saved: PropTypes.bool,
  hasAttachments: PropTypes.bool,
  assistant: PropTypes.node,
  children: PropTypes.node,
};
