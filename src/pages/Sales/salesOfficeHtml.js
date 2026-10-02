import createDOMPurify from 'dompurify';

const tags = ['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr', 'img'];
const imageUrl = /^data:image\/(?:png|jpeg|gif|webp|bmp|avif);base64,[A-Za-z0-9+/=]+$/;
const styles = 'body{margin:24px auto;padding:0 24px;max-width:960px;font:15px/1.65 Arial,sans-serif;color:#142448;overflow-wrap:anywhere}h1,h2,h3,h4,h5,h6{line-height:1.3}h1{font-size:26px}h2{font-size:22px}h3{font-size:19px}table{border-collapse:collapse;max-width:100%;display:block;overflow:auto}td,th{border:1px solid #ccd6e5;padding:8px 12px;vertical-align:top}th{background:#f3f6fc}img{max-width:100%;height:auto}pre{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{border-left:3px solid #cbd5e1;margin-left:0;padding-left:16px}ul,ol{padding-left:24px}@media(max-width:500px){body{margin:16px auto;padding:0 14px;font-size:14px}}';

export function officePreviewHtml(html) {
  if (typeof html !== 'string' || html.length > 8 * 1024 * 1024) throw new Error('This document is too complex to display. Download the original.');
  const purifier = createDOMPurify(window);
  let nodes = 0;
  purifier.addHook('uponSanitizeElement', () => {
    if (++nodes > 30000) throw new Error('This document is too complex to display. Download the original.');
  });
  purifier.addHook('uponSanitizeAttribute', (node, attribute) => {
    if (attribute.attrName === 'src' && (node.nodeName !== 'IMG' || !imageUrl.test(attribute.attrValue))) attribute.keepAttr = false;
    if (['colspan', 'rowspan'].includes(attribute.attrName) && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(attribute.attrValue)) attribute.keepAttr = false;
  });
  purifier.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'IMG' && !node.hasAttribute('alt')) node.setAttribute('alt', 'Document image');
  });
  const clean = purifier.sanitize(html, {
    ALLOWED_TAGS: tags, ALLOWED_ATTR: ['src', 'alt', 'colspan', 'rowspan'],
    ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, SANITIZE_NAMED_PROPS: true,
    FORBID_TAGS: ['svg', 'math', 'style', 'script', 'form', 'iframe', 'object', 'embed', 'template'],
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none';"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document content</title><style>${styles}</style></head><body dir="auto">${clean.trim() || '<p>No readable document content is available.</p>'}</body></html>`;
}
