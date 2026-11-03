/**
 * Unit tests for buildAlignment (SLD Checker 2D alignment helper).
 * Runs with the repo's existing runner style: node --test.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import buildAlignment, { normalizeTag } from '../src/pages/Engineering/Electrical/SldChecker/views/buildAlignment.js'

test('tag normalisation: dashes, case, spaces', () => {
  assert.equal(normalizeTag('285-rm-204b'), '285-RM-204B')
  assert.equal(normalizeTag('285–RM—204‐B'), '285-RM-204-B')
  assert.equal(normalizeTag(' 285 RM 204B '), '285RM204B')
  assert.equal(normalizeTag(null), '')
})

test('equipment matched → sld ok sheet, el ok list sheet, ll from eqload', () => {
  const { rows } = buildAlignment({
    equipment: [{ tag: '285-U-503A', status: 'matched', onSld: 'Sheet 001', listSheet: 'New Equipment', description: 'MCC', category: 'board' }],
    eqload: [{ tag: '285-U-503A', status: 'board-covered' }],
  })
  assert.equal(rows.length, 1)
  const r = rows[0]
  assert.equal(r.group, 'board')
  assert.equal(r.sld.text, 'Sheet 001'); assert.equal(r.sld.tone, 'ok')
  assert.equal(r.el.text, 'New Equipment'); assert.equal(r.el.tone, 'ok'); assert.equal(r.el.sub, 'MCC')
  assert.equal(r.ll.text, 'Board covered'); assert.equal(r.ll.tone, 'ok')
  assert.equal(r.status, 'matched'); assert.equal(r.statusLabel, 'Matched')
  assert.deepEqual(r.source, [{ tab: 'equipment', index: 0 }])
})

test('equipment not-on-sld → sld none, el ok or demolition', () => {
  const { rows } = buildAlignment({
    equipment: [
      { tag: '285-U-509', status: 'not-on-sld', listSheet: 'New Equipment', description: 'Spare' },
      { tag: '285-U-OLD', status: 'not-on-sld', listSheet: 'Demolition' },
    ],
  })
  const [a, b] = rows
  assert.equal(a.sld.tone, 'none'); assert.equal(a.sld.text, '— not found')
  assert.equal(a.el.tone, 'ok'); assert.equal(a.el.text, 'New Equipment')
  assert.equal(b.el.tone, 'demolition'); assert.equal(b.el.text, 'Demolition')
})

test('equipment sld-only → sld only, el none, ll none', () => {
  const { rows } = buildAlignment({
    equipment: [{ tag: '285-PM-601', status: 'sld-only', onSld: 'Sheet 002', category: 'load' }],
  })
  const r = rows[0]
  assert.equal(r.sld.tone, 'only'); assert.equal(r.sld.text, 'Sheet 002')
  assert.equal(r.el.tone, 'none'); assert.equal(r.el.text, '— not in list')
  assert.equal(r.ll.tone, 'none')
  assert.equal(r.statusLabel, 'On SLD only')
})

test('equipment sld-demolition → sld ok, el demolition', () => {
  const { rows } = buildAlignment({
    equipment: [{ tag: '285-U-555', status: 'sld-demolition', onSld: 'Sheet 001' }],
  })
  const r = rows[0]
  assert.equal(r.sld.tone, 'ok'); assert.equal(r.el.tone, 'demolition')
  assert.equal(r.statusLabel, 'On SLD · demolition')
})

test('equipment no-tag-in-list → all none with labels', () => {
  const { rows } = buildAlignment({
    equipment: [{ tag: '285-CBL-9', status: 'no-tag-in-list' }],
  })
  const r = rows[0]
  assert.equal(r.sld.tone, 'none')
  assert.equal(r.el.text, 'No tag in list'); assert.equal(r.el.tone, 'none')
  assert.equal(r.ll.tone, 'none')
})

test('load board-mismatch → sld diff boardSld, ll diff boardList + kW, el from eqload', () => {
  const { rows } = buildAlignment({
    load: [{ tag: '285-PM-402C', status: 'board-mismatch', boardList: '285-U-505A', boardSld: '285-U-506A', kwList: 75, description: 'Pump' }],
    eqload: [{ tag: '285-PM-402C', status: 'not-in-equipment-list' }],
  })
  const r = rows[0]
  assert.equal(r.group, 'load')
  assert.equal(r.sld.text, 'fed from 285-U-506A'); assert.equal(r.sld.tone, 'diff')
  assert.equal(r.ll.text, 'fed from 285-U-505A'); assert.equal(r.ll.sub, '75 kW'); assert.equal(r.ll.tone, 'diff')
  assert.equal(r.el.text, 'Not in Equipment List')
  assert.equal(r.kw, 75)
  assert.deepEqual(r.source, [{ tab: 'load', index: 0 }])
})

test('load not-on-sld → sld none, ll ok', () => {
  const { rows } = buildAlignment({
    load: [{ tag: '285-L-1', status: 'not-on-sld', boardList: '285-U-505A', kwList: 15 }],
  })
  const r = rows[0]
  assert.equal(r.sld.tone, 'none'); assert.equal(r.sld.text, '— not found')
  assert.equal(r.ll.tone, 'ok'); assert.equal(r.ll.text, 'fed from 285-U-505A')
})

test('load agrees → sld ok, ll ok', () => {
  const { rows } = buildAlignment({
    load: [{ tag: '285-M-7', status: 'agrees', boardList: '285-U-505A', boardSld: '285-U-505A', kwList: 30 }],
  })
  const r = rows[0]
  assert.equal(r.sld.tone, 'ok'); assert.equal(r.ll.tone, 'ok')
  assert.equal(r.statusLabel, 'Agrees')
})

test('interfaces → sld only, group other, status Interface', () => {
  const { rows } = buildAlignment({
    interfaces: [{ tag: '285-U-610', where: 'Sheet 002 (interface)', meaning: 'Other area' }],
  })
  const r = rows[0]
  assert.equal(r.group, 'other')
  assert.equal(r.sld.text, 'Sheet 002 (interface)'); assert.equal(r.sld.tone, 'only')
  assert.equal(r.el.tone, 'none'); assert.equal(r.ll.tone, 'none')
  assert.equal(r.status, 'interface'); assert.equal(r.statusLabel, 'Interface')
  assert.deepEqual(r.source, [{ tab: 'interfaces', index: 0 }])
})

test('cables → sld size · sheet only, group other, status Cable', () => {
  const { rows } = buildAlignment({
    cables: [{ tag: '285-C-100', size: '4C 95mm²', sheet: 'Sheet 001' }],
  })
  const r = rows[0]
  assert.equal(r.group, 'other')
  assert.equal(r.sld.text, '4C 95mm² · Sheet 001'); assert.equal(r.sld.tone, 'only')
  assert.equal(r.status, 'cable'); assert.equal(r.statusLabel, 'Cable')
})

test('counts and ordering: boards first, differences counted, load board carried', () => {
  const { rows, counts, loadBoard, loadSection } = buildAlignment({
    equipment: [
      { tag: 'B-2', status: 'matched', onSld: 'Sheet 001', listSheet: 'New Equipment', category: 'board' },
      { tag: 'L-1', status: 'sld-only', onSld: 'Sheet 001', category: 'load' },
    ],
    load: [{ tag: 'L-2', status: 'agrees', boardList: 'B-2', boardSld: 'B-2', kwList: 5 }],
    interfaces: [{ tag: 'X-1', where: 'Sheet 001' }],
    loadMeta: { board: 'B-2', section: 'MCC-D' },
  })
  assert.deepEqual(rows.map(r => r.tag), ['B-2', 'L-1', 'L-2', 'X-1'])
  assert.equal(counts.all, 4)
  assert.equal(counts.differences, 2) // sld-only + interface
  assert.equal(counts.boards, 1)
  assert.equal(counts.loads, 2)
  assert.equal(loadBoard, 'B-2'); assert.equal(loadSection, 'MCC-D')
})

test('same tag in equipment and load merges sources, keeps first cells', () => {
  const { rows } = buildAlignment({
    equipment: [{ tag: '285-U-505A', status: 'matched', onSld: 'Sheet 001', listSheet: 'New Equipment', category: 'board' }],
    load: [{ tag: '285–u–505a', status: 'agrees', boardList: 'X', boardSld: 'X', kwList: 1 }],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].source.length, 2)
  assert.equal(rows[0].status, 'matched')
})
