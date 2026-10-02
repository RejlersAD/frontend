import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampPdfPage, clampPdfZoom, flattenPdfOutline, normalizePdfSelection,
  pdfRasterDensity, resolvePdfOutlinePage, validPdfAnchorRects,
} from '../src/pages/Sales/salesProposalPdfHelpers.js';

test('selection anchors remain identical when page and selection are zoomed or moved', () => {
  const normal = normalizePdfSelection([{ left: 150, top: 240, width: 200, height: 20 }], { left: 100, top: 200, width: 500, height: 700 });
  const zoomed = normalizePdfSelection([{ left: 180, top: 260, width: 400, height: 40 }], { left: 80, top: 180, width: 1000, height: 1400 });
  assert.deepEqual(zoomed, normal);
  assert.deepEqual(normal, [{ x: 0.1, y: 40 / 700, width: 0.4, height: 20 / 700 }]);
});

test('selection clips to page, drops zero/outside/invalid rectangles and deduplicates nested spans', () => {
  const rect = { left: -5, top: 90, width: 50, height: 30 };
  assert.deepEqual(normalizePdfSelection([rect, rect,
    { left: 500, top: 10, width: 20, height: 20 }, { left: 2, top: 3, width: 0, height: 20 },
    { left: NaN, top: 3, width: 10, height: 20 }], { left: 0, top: 0, width: 100, height: 100 }),
  [{ x: 0, y: 0.9, width: 0.45, height: 0.1 }]);
  assert.deepEqual(normalizePdfSelection([rect], { left: 0, top: 0, width: 0, height: 100 }), []);
});

test('untrusted anchor metadata cannot position pins outside the page or inject CSS values', () => {
  const valid = { x: 0.1, y: 0.2, width: 0.3, height: 0.04 };
  assert.deepEqual(validPdfAnchorRects({ rects: [valid,
    { ...valid, x: 'calc(100% + 9999px)' }, { ...valid, width: Infinity },
    { ...valid, x: -0.1 }, { ...valid, y: 1 }, { ...valid, height: 0 }] }), [valid]);
  assert.deepEqual(validPdfAnchorRects({ rects: 'bad' }), []);
});

test('PDF raster allocation stays within pixel and dimension budgets for large drawings', () => {
  for (const [width, height] of [[595, 842], [14400, 10170], [50000, 2], [2, 50000]]) {
    const density = pdfRasterDensity(width, height, 4);
    assert.ok(density <= 2);
    assert.ok(width * density <= 8192 + 0.0001);
    assert.ok(height * density <= 8192 + 0.0001);
    assert.ok(width * height * density ** 2 <= 16000000.001);
  }
});

test('page and zoom controls clamp malformed input to safe supported values', () => {
  assert.equal(clampPdfPage(999, 3), 3);
  assert.equal(clampPdfPage(-8, 3), 1);
  assert.equal(clampPdfPage(NaN, 3), 1);
  assert.equal(clampPdfPage(2.8, 3), 2);
  assert.equal(clampPdfZoom(Infinity), 1);
  assert.equal(clampPdfZoom(9), 3);
  assert.equal(clampPdfZoom(0.1), 0.5);
});

test('outline keeps literal titles and internal destinations without exposing URL actions', () => {
  const tree = [{ title: '<img src=x onerror=alert(1)>', dest: 'section', url: 'javascript:alert(1)', items: [
    { title: 'External', url: 'https://outside.example', items: [] },
    { title: 'Second page', dest: [1, { name: 'Fit' }], items: [] },
  ] }];
  const flattened = flattenPdfOutline(tree);
  assert.equal(flattened.length, 3);
  assert.equal(flattened[0].title, tree[0].title);
  assert.equal(flattened[1].destination, null);
  assert.equal(flattened[2].depth, 1);
  assert.equal('url' in flattened[0], false);
  assert.equal(flattenPdfOutline(tree, 2).length, 2);
});

test('outline resolves named/reference destinations and rejects nonexistent pages', async () => {
  const pdf = { numPages: 3, getDestination: async name => name === 'section' ? [{ num: 12, gen: 0 }, { name: 'Fit' }] : null,
    getPageIndex: async reference => reference.num === 12 ? 2 : 99 };
  assert.equal(await resolvePdfOutlinePage(pdf, 'section'), 3);
  assert.equal(await resolvePdfOutlinePage(pdf, [1]), 2);
  assert.equal(await resolvePdfOutlinePage(pdf, 'missing'), null);
  assert.equal(await resolvePdfOutlinePage(pdf, [-1]), null);
  assert.equal(await resolvePdfOutlinePage(pdf, [3]), null);
  assert.equal(await resolvePdfOutlinePage(pdf, [null]), null);
});
