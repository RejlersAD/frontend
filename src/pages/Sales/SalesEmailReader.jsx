import { useId, useState } from "react";
import PropTypes from "prop-types";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";
import SalesEmailAnalysis from "./SalesEmailAnalysis";
import { Paperclip, Reply } from "lucide-react";
import salesService from "../../services/sales.service";

export default function SalesEmailReader({ information, subject, bodyText, bodyContent, saved, hasAttachments, attachments = [], intakeId, onReply, children }) {
  const [tab, setTab] = useState("email");
  const [attachmentError, setAttachmentError] = useState("");
  const id = useId();
  const tabs = [["email", "Email"], ["thread", "Thread"], ["attachments", "Attachments"], ["details", "Extracted details"]];
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
        <div className="sales-email-body-panel">
          <SalesEmailBody bodyText={bodyText} bodyContent={bodyContent} />
        </div>
        {saved && <p className="sales-email-preview-note">Preview from the imported email.</p>}
        {children}
      </> : tab === "thread" ? <SalesEmailAnalysis analysis={information?.analysis} savedContent={saved} />
        : tab === "attachments" ? <div className="sales-email-attachment-state"><Paperclip aria-hidden="true" /><h4>Attachments</h4>
          {attachments.length ? <><p>{attachments.length} file(s) received with this email.</p><ul className="mt-4 space-y-3">{attachments.map(file => <li key={file.id} className="rounded-md border border-slate-200 p-3">
            <p className="font-semibold text-slate-800">{file.name}</p><p className="mt-1 text-xs text-slate-600">{file.extraction_status === 'read' ? 'Text extracted' : file.extraction_status === 'partial' ? 'Partially read' : 'Not readable'}{file.extraction_diagnostic ? ` · ${file.extraction_diagnostic.replaceAll('_', ' ')}` : ''}</p>
            <button type="button" className="mt-2 text-sm font-semibold text-blue-700 underline" onClick={async () => {
              setAttachmentError('');
              try { const blob = await salesService.downloadEmailIntakeAttachment(intakeId, file.id); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); URL.revokeObjectURL(url); }
              catch { setAttachmentError('The attachment could not be downloaded. Refresh the email and try again.'); }
            }}>Download file</button>
          </li>)}</ul>{attachmentError && <p role="alert" className="mt-3 text-sm text-rose-700">{attachmentError}</p>}</>
            : <><p>{hasAttachments ? "Attachments are reported, but the source files were not provided with this imported email." : "No attachments are reported for this email."}</p>{hasAttachments && <p>Ask the mailbox or import owner to resend the original email with its files included.</p>}</>}
        </div>
        : <SalesEmailDetectedInformation information={information} subject={subject} />}
    </div>
    {onReply && <footer className="sales-email-reader-footer"><span>Review the email before replying.</span><button type="button" className="sales-email-button sales-email-reply" onClick={onReply} title="Prepare a reply with Ask RADAI"><Reply aria-hidden="true" />Reply</button></footer>}
  </>;
}

SalesEmailReader.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
  bodyText: PropTypes.string,
  bodyContent: PropTypes.array,
  saved: PropTypes.bool,
  hasAttachments: PropTypes.bool,
  attachments: PropTypes.array,
  intakeId: PropTypes.string,
  onReply: PropTypes.func,
  children: PropTypes.node,
};

