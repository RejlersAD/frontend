import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlignCenter, AlignLeft, AlignRight, Bold, Eraser, Image as ImageIcon, Italic, Link2, List, ListOrdered, Redo2, Table, Trash2, Underline, Undo2 } from 'lucide-react';
import { radaiPrompt } from '../../services/radaiDialog';

const editorValue = (editor) => {
  if (!editor) return '';
  const content = editor.querySelector('svg, [data-po-page-break="true"]') ? editor.cloneNode(true) : editor;
  if (content !== editor) content.querySelectorAll('svg, [data-po-page-break="true"]').forEach(node => node.remove());
  const text = (content.textContent || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '');
  return text || content.querySelector('img, td, th, hr') ? editor.innerHTML : '';
};

const pasteHtml = (html) => {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  parsed.querySelectorAll('script, style, iframe, object, embed, link, meta, form, input, button, svg, math').forEach(node => node.remove());
  parsed.querySelectorAll('*').forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const url = [...attribute.value].filter(character => character.charCodeAt(0) > 32).join('');
      const unsafeUrl = ['src', 'href', 'xlink:href'].includes(name) && (/^(?:javascript|vbscript):/i.test(url) || (/^data:/i.test(url) && !(name === 'src' && /^data:image\/(?:png|jpe?g|gif|webp|bmp);/i.test(url))));
      if (name.startsWith('on') || unsafeUrl) node.removeAttribute(attribute.name);
    });
  });
  return parsed.body.innerHTML;
};

export default function PurchaseOrderNarrativeEditor({ value = '', onChange, disabled = false }) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const lastPublishedRef = useRef('');
  const tableDialogRef = useRef(null);
  const [showTable, setShowTable] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [tableHeader, setTableHeader] = useState(true);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editorValue(editor) !== (value || '')) {
      editor.innerHTML = value || '';
      savedRangeRef.current = null;
    }
    lastPublishedRef.current = editorValue(editor);
  }, [value]);

  useEffect(() => {
    if (showTable) tableDialogRef.current?.showModal();
  }, [showTable]);

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const selection = window.getSelection();
    const saved = savedRangeRef.current;
    const range = saved && editor.contains(saved.commonAncestorContainer) ? saved : document.createRange();
    if (range !== saved) { range.selectNodeContents(editor); range.collapse(false); }
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const publish = (force = false) => {
    if (disabled) return;
    rememberSelection();
    const next = editorValue(editorRef.current);
    if (!force && next === lastPublishedRef.current) return;
    lastPublishedRef.current = next;
    onChange(next);
  };

  const command = (name, argument = null, forcePublish = false) => {
    if (disabled || !editorRef.current?.isContentEditable) return;
    restoreSelection();
    document.execCommand(name, false, argument);
    publish(forcePublish);
  };

  const clearText = () => {
    if (disabled) return;
    editorRef.current.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    command('delete', null, true);
  };

  const insertLink = async () => {
    const url = (await radaiPrompt('Enter the link URL'))?.trim();
    if (url && /^(?:https?:\/\/|mailto:|tel:|#|\/[^/])/i.test(url)) command('createLink', url);
  };

  const insertImage = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => command('insertImage', reader.result);
    reader.readAsDataURL(file);
  };

  const onPaste = (event) => {
    if (disabled) return;
    rememberSelection();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const image = [...event.clipboardData.files].find(file => file.type.startsWith('image/'));
    if (html || text || image) {
      event.preventDefault();
      if (html) command('insertHTML', pasteHtml(html));
      else if (text) command('insertText', text);
      else insertImage(image);
    }
  };

  const closeTable = () => { tableDialogRef.current?.close(); setShowTable(false); restoreSelection(); };
  const insertTable = () => {
    const rows = Math.min(30, Math.max(1, Number(tableRows) || 1));
    const columns = Math.min(12, Math.max(1, Number(tableColumns) || 1));
    const html = Array.from({ length: rows }, (_, row) => `<tr>${Array.from({ length: columns }, (_, column) => {
      const header = tableHeader && row === 0;
      const tag = header ? 'th' : 'td';
      return `<${tag} style="border:1px solid #64748b;padding:6px">${header ? `Heading ${column + 1}` : 'Cell'}</${tag}>`;
    }).join('')}</tr>`).join('');
    closeTable();
    command('insertHTML', `<table style="border-collapse:collapse;width:100%"><tbody>${html}</tbody></table><p><br></p>`);
  };

  const control = (label, Icon, action) => <button type="button" aria-label={label} title={label} onMouseDown={event => event.preventDefault()} onClick={action} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40"><Icon size={16} aria-hidden="true" /></button>;

  return <div className="mt-1 min-w-0 overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <div role="toolbar" aria-label="Narrative formatting" className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-1">
        {control('Undo', Undo2, () => command('undo'))}{control('Redo', Redo2, () => command('redo'))}
        <select aria-label="Text style" defaultValue="p" onChange={event => command('formatBlock', event.target.value)} className="h-8 w-24 rounded border-slate-300 bg-white px-1 py-0 text-xs"><option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select>
        <select aria-label="Font size" defaultValue="3" onChange={event => command('fontSize', event.target.value)} className="h-8 w-14 rounded border-slate-300 bg-white px-1 py-0 text-xs">{Object.entries({ 1: 7.5, 2: 9.75, 3: 12, 4: 13.5, 5: 18, 6: 24, 7: 36 }).map(([key, size]) => <option key={key} value={key}>{size}</option>)}</select>
        {control('Bold', Bold, () => command('bold'))}{control('Italic', Italic, () => command('italic'))}{control('Underline', Underline, () => command('underline'))}
        <input type="color" aria-label="Font colour" title="Font colour" onChange={event => command('foreColor', event.target.value)} className="mx-1 h-6 w-6 cursor-pointer border-0 bg-transparent p-0" />
        {control('Bulleted list', List, () => command('insertUnorderedList'))}{control('Numbered list', ListOrdered, () => command('insertOrderedList'))}
        {control('Align left', AlignLeft, () => command('justifyLeft'))}{control('Align centre', AlignCenter, () => command('justifyCenter'))}{control('Align right', AlignRight, () => command('justifyRight'))}
        {control('Insert link', Link2, insertLink)}{control('Insert table', Table, () => setShowTable(true))}
        <label className="relative inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-200 focus-within:outline focus-within:outline-2 focus-within:outline-blue-500" title="Insert image"><ImageIcon size={16} aria-hidden="true" /><input type="file" accept="image/*" aria-label="Insert image" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={event => { insertImage(event.target.files?.[0]); event.target.value = ''; }} /></label>
        {control('Clear formatting', Eraser, () => command('removeFormat'))}{control('Clear text', Trash2, clearText)}
      </div>
    </fieldset>
    <div ref={editorRef} contentEditable={!disabled} aria-readonly={disabled} data-table-typography="preserve" role="textbox" aria-label="PO Narrative" aria-multiline="true" suppressContentEditableWarning onMouseUp={rememberSelection} onKeyUp={rememberSelection} onInput={() => publish()} onBlur={() => publish()} onPaste={onPaste} className="po-narrative-document bg-white outline-none" />
    {showTable && <dialog ref={tableDialogRef} onCancel={closeTable} className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-4 shadow-xl backdrop:bg-slate-900/30" aria-label="Insert table">
      <h4 className="mb-4 text-sm font-semibold text-slate-900">Insert table</h4>
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm text-slate-700">Rows<input type="number" min="1" max="30" aria-label="Table rows" value={tableRows} onChange={event => setTableRows(event.target.value)} className="mt-1 block w-full rounded border-slate-300" /></label>
        <label className="text-sm text-slate-700">Columns<input type="number" min="1" max="12" aria-label="Table columns" value={tableColumns} onChange={event => setTableColumns(event.target.value)} className="mt-1 block w-full rounded border-slate-300" /></label>
      </div>
      <label className="my-4 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={tableHeader} onChange={event => setTableHeader(event.target.checked)} className="rounded border-slate-300 text-blue-600" />First row is a header</label>
      <div className="flex justify-end gap-2"><button type="button" onClick={closeTable} className="rounded border border-slate-300 px-3 py-2 text-sm">Cancel</button><button type="button" onClick={insertTable} className="rounded bg-blue-600 px-3 py-2 text-sm text-white">Insert table</button></div>
    </dialog>}
  </div>;
}

PurchaseOrderNarrativeEditor.propTypes = { value: PropTypes.string, onChange: PropTypes.func.isRequired, disabled: PropTypes.bool };
