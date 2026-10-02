// Anchors use the displayed page's coordinates, independent of fit/zoom and
// raster density. They are meaningful only for their immutable PDF revision.
export const MAX_SELECTION_RECTS = 50;
export const MAX_SELECTION_TEXT = 2000;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function clampPdfPage(value, pageCount) {
  const total = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1;
  const page = Number(value);
  return Number.isFinite(page) ? clamp(Math.trunc(page), 1, total) : 1;
}

export function clampPdfZoom(value) {
  const zoom = Number(value);
  return Number.isFinite(zoom) ? clamp(zoom, 0.5, 3) : 1;
}

export function pdfRasterDensity(width, height, devicePixelRatio = 1) {
  if (![width, height].every(value => finite(value) && value > 0)) return 1;
  const density = finite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.min(density, 2, 8192 / width, 8192 / height, Math.sqrt(16000000 / (width * height)));
}

export function normalizePdfSelection(clientRects, pageRect) {
  if (!pageRect || ![pageRect.left, pageRect.top, pageRect.width, pageRect.height].every(finite)
    || pageRect.width <= 0 || pageRect.height <= 0) return [];
  const rectangles = [];
  for (const rectangle of Array.from(clientRects || [])) {
    if (![rectangle.left, rectangle.top, rectangle.width, rectangle.height].every(finite)
      || rectangle.width <= 0 || rectangle.height <= 0) continue;
    const left = clamp(rectangle.left - pageRect.left, 0, pageRect.width);
    const top = clamp(rectangle.top - pageRect.top, 0, pageRect.height);
    const right = clamp(rectangle.left + rectangle.width - pageRect.left, 0, pageRect.width);
    const bottom = clamp(rectangle.top + rectangle.height - pageRect.top, 0, pageRect.height);
    if (right <= left || bottom <= top) continue;
    const normalized = {
      x: left / pageRect.width, y: top / pageRect.height,
      width: (right - left) / pageRect.width, height: (bottom - top) / pageRect.height,
    };
    // Nested text spans can report the same physical selection rectangle twice.
    if (!rectangles.some(previous => Object.keys(normalized).every(key => Math.abs(previous[key] - normalized[key]) < 0.00001))) {
      rectangles.push(normalized);
    }
    if (rectangles.length >= MAX_SELECTION_RECTS) break;
  }
  return rectangles;
}

export function validPdfAnchorRects(anchor) {
  if (!Array.isArray(anchor?.rects)) return [];
  return anchor.rects.slice(0, MAX_SELECTION_RECTS).filter(rectangle => rectangle
    && [rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(finite)
    && rectangle.x >= 0 && rectangle.y >= 0 && rectangle.width > 0 && rectangle.height > 0
    && rectangle.x + rectangle.width <= 1.000001 && rectangle.y + rectangle.height <= 1.000001);
}

// Outline titles remain text. Destination references stay private to the viewer
// and are resolved only when selected; PDF URL/JavaScript actions are not used.
export function flattenPdfOutline(nodes, limit = 1000) {
  const result = [];
  const visit = (entries, depth) => {
    if (!Array.isArray(entries) || depth > 20) return;
    for (const node of entries) {
      if (result.length >= limit) return;
      if (!node || typeof node !== 'object') continue;
      result.push({
        id: `outline-${result.length}`, title: typeof node.title === 'string' ? node.title : 'Untitled section',
        depth, destination: typeof node.dest === 'string' || Array.isArray(node.dest) ? node.dest : null,
      });
      visit(node.items, depth + 1);
    }
  };
  visit(nodes, 0);
  return result;
}

export async function resolvePdfOutlinePage(pdf, destination) {
  const resolved = typeof destination === 'string' ? await pdf.getDestination(destination) : destination;
  if (!Array.isArray(resolved) || !resolved.length) return null;
  const reference = resolved[0];
  const index = Number.isInteger(reference) ? reference
    : reference && typeof reference === 'object' ? await pdf.getPageIndex(reference) : null;
  return Number.isInteger(index) && index >= 0 && index < pdf.numPages ? index + 1 : null;
}
