import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { officePreviewHtml } from './salesOfficeHtml';
import { fileSize } from './salesOpportunityWorkspace';

function DocumentFrame({ html, title, onClose }) {
  const cleanup = useRef(() => {});
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => () => cleanup.current(), []);
  const result = useMemo(() => {
    try { return { document: officePreviewHtml(html) }; }
    catch (failure) { return { error: failure.message }; }
  }, [html]);
  return result.error ? <p className="sop-state" role="alert">{result.error}</p>
    : <iframe className="sop-office-frame" title={title} sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={result.document} onLoad={event => {
      cleanup.current();
      const frameDocument = event.currentTarget.contentDocument;
      if (!frameDocument) return;
      const escape = keyEvent => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); close.current(); } };
      frameDocument.addEventListener('keydown', escape);
      cleanup.current = () => frameDocument.removeEventListener('keydown', escape);
    }} />;
}
DocumentFrame.propTypes = { html: PropTypes.string.isRequired, title: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired };

function WorkbookPreview({ content }) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const [rowPage, setRowPage] = useState(0);
  const sheet = content.sheets[sheetIndex];
  const rows = sheet?.rows.slice(rowPage * 100, (rowPage + 1) * 100) || [];
  return <section className="sop-workbook" aria-label="Excel workbook preview">
    <div className="sop-workbook-tools"><label>Sheet<select aria-label="Workbook sheet" value={sheetIndex} onChange={event => { setSheetIndex(Number(event.target.value)); setRowPage(0); }}>{content.sheets.map((item, index) => <option key={index} value={index}>{item.name}{item.hidden ? ' (hidden in workbook)' : ''}</option>)}</select></label><span>Saved workbook values; formulas are not recalculated.</span></div>
    {content.notice && <p className="sop-office-notice" role="status">{content.notice}</p>}
    {sheet?.truncated && <p className="sop-office-notice" role="status">This sheet is larger than the preview. Download the original for all cells.</p>}
    {rows.length ? <div className="sop-workbook-scroll" tabIndex={0} role="region" aria-label="Worksheet cells"><table data-table-typography="preserve"><caption>{sheet.name}</caption><thead><tr><th scope="col">Row</th>{sheet.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.number}><th scope="row">{row.number}</th>{row.cells.map((cell, index) => <td key={index} className={cell.missingResult ? 'sop-missing-result' : undefined} title={cell.formula ? `Formula: =${cell.formula}` : undefined}>{cell.text}</td>)}</tr>)}</tbody></table></div> : <p className="sop-state">This worksheet has no saved cell values.</p>}
    {sheet && <footer className="sop-workbook-footer"><span>{rows.length ? `Rows ${rows[0].number}–${rows.at(-1).number}` : 'No rows'} · {sheet.totalRows} rows × {sheet.totalColumns} columns in the sheet</span><div><button type="button" className="sow-upload" disabled={rowPage === 0} onClick={() => setRowPage(value => value - 1)}>Previous rows</button><button type="button" className="sow-upload" disabled={(rowPage + 1) * 100 >= sheet.rows.length} onClick={() => setRowPage(value => value + 1)}>Next rows</button></div></footer>}
  </section>;
}
WorkbookPreview.propTypes = { content: PropTypes.object.isRequired };

export default function SalesOfficeFilePreview({ content, onClose }) {
  if (content.kind === 'xlsx') return <WorkbookPreview content={content} />;
  if (content.kind === 'docx') return <section className="sop-word" aria-label="Word document preview"><p className="sop-office-notice" role="status">{content.notice || 'Reading view. Page layout may differ from Word.'}</p><DocumentFrame html={content.html} title="Word document content" onClose={onClose} /></section>;
  return <section className="sop-message" aria-label="Outlook message preview"><header><h3>{content.subject || '(No subject)'}</h3><dl>{[['From', content.sender], ['To', content.to], ['Cc', content.cc], ['Sent', content.date]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl></header>{content.notice && <p className="sop-office-notice" role="status">{content.notice}</p>}{content.attachments?.length > 0 && <section className="sop-message-attachments" aria-label="Message attachments"><h4>Attachments</h4><ul>{content.attachments.map((attachment, index) => <li key={index}><span>{attachment.name}</span>{attachment.size != null && <small>{fileSize(attachment.size)}</small>}</li>)}</ul><p>Download the original message to open its attachments.</p></section>}{content.bodyText ? <pre className="sop-message-text" aria-label="Message body">{content.bodyText}</pre> : content.bodyHtml ? <DocumentFrame html={content.bodyHtml} title="Message content" onClose={onClose} /> : <p className="sop-state">No readable message body is available.</p>}</section>;
}
SalesOfficeFilePreview.propTypes = { content: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired };
