const fallback = 'The request could not be completed. Please try again.';
const serverFailure = 'The server could not complete the request. Please try again.';
const maxLength = 300;
const diagnostics = /^(?:traceback|stack|exception|exc_info|request|settings|environment|locals|debug|sql)$/i;
const unsafeText = /<(?:!doctype\b|!--|\?xml|\/?[a-z][^>]*>)|&lt;(?:!doctype\b|\/?[a-z])|traceback\s*\(most recent call last\)|exception\s+(?:type|value|location)\s*:|\b(?:Type|Value|Attribute|Key|Runtime|Syntax|Import|ModuleNotFound|Operational|Programming|Integrity|Assertion|Reference)Error\b|\bFile\s+"[^"]+",\s+line\s+\d+|\bat\s+[\w$.]+\s*\([^)]*:\d+:\d+\)/i;

function conciseText(value) {
  if (typeof value !== 'string' || value.length > maxLength || unsafeText.test(value)) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function validationText(data) {
  const messages = [];
  let visited = 0;
  const collect = (value, depth = 0) => {
    if (++visited > 32 || depth > 4 || messages.length === 3) return;
    const text = conciseText(value);
    if (text) {
      if ([...messages, text].join(' ').length <= maxLength) messages.push(text);
    } else if (Array.isArray(value)) {
      value.slice(0, 8).forEach(item => collect(item, depth + 1));
    } else if (value && typeof value === 'object') {
      const priority = ['detail', 'error', 'message', 'non_field_errors', 'errors'];
      const fields = priority.some(field => value[field]) ? priority : [];
      if (!fields.length) for (const field in value) {
        if (Object.hasOwn(value, field)) fields.push(field);
        if (fields.length === 8) break;
      }
      for (const field of fields) if (!diagnostics.test(field)) collect(value[field], depth + 1);
    }
  };
  collect(data);
  return messages.join(' ');
}

export function handoffError(error) {
  const response = error?.response;
  if (response?.status === 403) return 'You do not have access to these purchase orders.';
  if (response?.status === 409) return 'This record changed. Refresh its details before trying again.';
  if (response?.status >= 500) return serverFailure;
  const contentType = response?.headers?.['content-type'] || response?.headers?.get?.('content-type') || '';
  if (/html/i.test(contentType)) return fallback;
  if (response) return validationText(response.data) || fallback;
  return conciseText(error?.message) || fallback;
}
