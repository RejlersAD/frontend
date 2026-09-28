import PropTypes from "prop-types";

const valueText = (value) => typeof value === "string" ? value.trim() : "";

export default function SalesEmailDetectedInformation({ information, subject }) {
  const detected = information && typeof information === "object" ? information : {};
  const requestCode = valueText(detected.request_type_code);
  const fields = [
    ["title", "Title (Subject)", valueText(detected.title) || subject],
    ["customer_name", "Customer Name", valueText(detected.customer_name)],
    ["submission_date", "Submission Date", valueText(detected.submission_date)],
    ["due_date", "Due Date", valueText(detected.due_date)],
    ["request_type_code", "Type of Request", ["EOI", "EIO", "RFT"].includes(requestCode) ? requestCode : ""],
  ];
  const evidence = fields.map(([key, label]) => [label, valueText(detected.evidence?.[key])])
    .filter(([, value]) => value);
  const warnings = Array.isArray(detected.warnings) ? detected.warnings.filter((value) => typeof value === "string" && value.trim()) : [];
  return <section aria-label="Detected information" className="min-w-0">
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
      {fields.map(([key, label, value]) => <div key={key} className={`min-w-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 ${key === "title" ? "sm:col-span-2" : ""}`}>
        <dt className="text-xs font-semibold text-slate-600">{label}</dt>
        <dd className="mt-1 break-words text-sm font-medium text-slate-800 [overflow-wrap:anywhere]">{value || "Not detected"}</dd>
      </div>)}
    </dl>
    {(evidence.length > 0 || warnings.length > 0) && <details className="mt-3 min-w-0 text-xs text-slate-600">
      <summary className="w-fit cursor-pointer rounded py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">Source evidence</summary>
      {evidence.length > 0 && <dl className="mt-2 space-y-2">
        {evidence.map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap leading-5 [overflow-wrap:anywhere]">{value}</dd></div>)}
      </dl>}
      {warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4 leading-5">{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
    </details>}
  </section>;
}

SalesEmailDetectedInformation.propTypes = {
  information: PropTypes.object,
  subject: PropTypes.string,
};
SalesEmailDetectedInformation.defaultProps = { information: null, subject: "" };
