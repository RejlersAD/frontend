import { useId, useState } from "react";
import PropTypes from "prop-types";
import SalesEmailBody from "./SalesEmailBody";
import SalesEmailDetectedInformation from "./SalesEmailDetectedInformation";

export default function SalesEmailReader({ information, subject, bodyText, bodyContent, saved, children }) {
  const [tab, setTab] = useState("email");
  const id = useId();
  const tabs = [["email", "Email"], ["details", "Extracted details"]];
  return <>
    <div role="tablist" aria-label="Email reading view" className="sales-email-reader-tabs">
      {tabs.map(([value, label], index) => <button
        key={value} id={`${id}-${value}`} type="button" role="tab"
        aria-selected={tab === value} aria-controls={`${id}-panel`}
        tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
          setTab(tabs[next][0]);
          document.getElementById(`${id}-${tabs[next][0]}`)?.focus();
        }}
      >{label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} tabIndex={0} className="sales-email-reader-content">
      {tab === "email" ? <>
        <p className="sales-email-eyebrow">{saved ? "Message preview" : "Message"}</p>
        <div className="sales-email-body-panel">
          <SalesEmailBody bodyText={bodyText} bodyContent={bodyContent} />
        </div>
        {saved && <p className="sales-email-preview-note">Preview from the imported email.</p>}
        {children}
      </> : <SalesEmailDetectedInformation information={information} subject={subject} />}
    </div>
  </>;
}

SalesEmailReader.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
  bodyText: PropTypes.string,
  bodyContent: PropTypes.array,
  saved: PropTypes.bool,
  children: PropTypes.node,
};
