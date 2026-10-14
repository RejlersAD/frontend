import test from 'node:test'
import assert from 'node:assert/strict'
import {
  artifactDownloadFilename, conversionReviewLabel, hasConversionAction,
  isNewUnreviewedArtifact, pfdOperationError,
} from '../src/utils/pfdArtifactState.js'

const original = {
  id: 'f0500000-0000-4000-8000-000000000001',
  pfd_document: 'f0500000-0000-4000-8000-000000000002',
  pid_drawing_number: 'Synthetic/PID', pid_revision: 'A',
}
const result = () => ({
  id: 'f0500000-0000-4000-8000-000000000003', pfd_document: original.pfd_document,
  status: 'completed', reviewed_by: null, reviewed_at: null, review_notes: '',
  artifact: {
    identity: 'f0500000-0000-4000-8000-000000000003', available: true,
    sha256: 'a'.repeat(64), review_state: 'unreviewed', source_conversion_id: original.id,
  },
})

test('only a distinct unreviewed stored output linked to the same source confirms regeneration', () => {
  assert.equal(isNewUnreviewedArtifact(original, result()), true)
  for (const invalid of [
    { ...result(), id: original.id },
    { ...result(), pfd_document: 'different-document' },
    { ...result(), status: 'failed' },
    { ...result(), reviewed_by: 1 },
    { ...result(), reviewed_at: '2026-09-24T12:00:00Z' },
    { ...result(), review_notes: 'Copied approval' },
    { ...result(), artifact: { ...result().artifact, source_conversion_id: 'different-output' } },
    { ...result(), artifact: { ...result().artifact, available: false } },
    { ...result(), artifact: { ...result().artifact, review_state: 'approved' } },
    { ...result(), artifact: { ...result().artifact, sha256: null } },
  ]) assert.equal(isNewUnreviewedArtifact(original, invalid), false)
})

test('recorded legacy approval is not described as verified exact-output approval', () => {
  assert.match(conversionReviewLabel({ artifact: { review_state: 'legacy_approved' } }), /binding unavailable/)
  assert.equal(conversionReviewLabel({}), 'Review state unavailable')
  assert.equal(conversionReviewLabel({ artifact: { review_state: 'unreviewed' } }), 'Unreviewed')
})

test('download permission cannot enable regeneration', () => {
  assert.equal(hasConversionAction({ allowed_actions: ['download'] }, 'regenerate'), false)
  assert.equal(hasConversionAction({}, 'regenerate'), false)
  assert.equal(hasConversionAction({ allowed_actions: ['regenerate'] }, 'regenerate'), true)
})

test('stored PDF and PNG downloads retain their actual format and exact output identity', () => {
  assert.equal(artifactDownloadFilename(original, { 'content-type': 'image/png' }), `Synthetic_PID_A_${original.id}.png`)
  assert.equal(artifactDownloadFilename(original, { 'content-type': 'application/pdf; charset=utf-8' }), `Synthetic_PID_A_${original.id}.pdf`)
  assert.equal(artifactDownloadFilename(original, { 'content-disposition': 'attachment; filename="stored.jpeg"' }), `Synthetic_PID_A_${original.id}.jpeg`)
  assert.match(artifactDownloadFilename(original), /\.bin$/)
})

test('blob download errors remain visible without suggesting implicit generation', async () => {
  const error = { response: { status: 503, data: new Blob([JSON.stringify({ error: 'Synthetic storage unavailable.' })]) } }
  assert.equal(await pfdOperationError(error, 'fallback'), 'Synthetic storage unavailable.')
  assert.match(await pfdOperationError({ response: { status: 403 } }, 'fallback'), /Access denied/)
  assert.match(await pfdOperationError({ response: { status: 409 } }, 'fallback'), /Reload outputs/)
  assert.match(await pfdOperationError({ code: 'ECONNABORTED' }, 'fallback'), /not confirmed/)
})
