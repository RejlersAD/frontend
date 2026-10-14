import assert from 'node:assert/strict'
import test from 'node:test'
import { buildValveMTOReview } from '../src/config/valveMTOReview.js'

test('separates duplicate audit messages, reference information and exclusions from review issues', () => {
  const warning = 'Image resolution is poor and several valves require review.'
  const result = buildValveMTOReview([], [
    warning, warning, 'Using 37 active valve/regulator legend pictures as classification references.',
    'Excluded: Off-page connectors', 'AREA could not be determined.',
  ])
  assert.equal(result.messages.length, 4)
  assert.equal(result.information.length, 1)
  assert.equal(result.excluded.length, 1)
  assert.deepEqual(result.groups.map(group => group.key), ['quality', 'area'])
})

test('coverage measures actual records, not optimistic provider warning text', () => {
  const rows = [{ area: '', pms_class: '', rating: '', line_number: 'LINE-1', valve_tag: 'HV-1', size_1: '2"', confidence: 'LOW' },
    { area: 'AA PRODUCTION PLATFORM MPFM', pms_class: 'CARBON STEEL', rating: '150 RF', line_number: '', valve_tag: '', size_1: 'unknown', confidence: 'HIGH' }]
  const result = buildValveMTOReview(rows, ['All fields extracted.'])
  assert.equal(result.total, 2)
  assert.equal(result.rowsWithGaps, 2)
  assert.equal(result.lowConfidence, 1)
  assert.equal(result.coverage.find(field => field.key === 'area').populated, 1)
  assert.equal(result.coverage.find(field => field.key === 'size_1').percent, 50)
  assert.equal(result.coverage.find(field => field.key === 'rating').label, 'RATING / FACING')
})

test('empty extraction has zero coverage and never reports complete records', () => {
  const result = buildValveMTOReview()
  assert.ok(result.coverage.every(field => field.percent === 0 && field.populated === 0))
  assert.equal(result.total, 0)
})

test('legacy installation scope is not counted as a populated drawing title', () => {
  const result = buildValveMTOReview([{ area: 'Field' }, { area: 'ISLAND' }])
  assert.equal(result.coverage.find(field => field.key === 'area').populated, 0)
})
