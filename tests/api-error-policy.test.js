import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isExpectedAccessDenied,
  isPasswordExpiredResponse,
  markExpectedAccessDenied,
} from '../src/services/apiErrorPolicy.js'

const responseError = (status, data = {}) => ({ response: { status, data } })

test('ordinary 403 responses are expected access restrictions', () => {
  const error = responseError(403, { detail: 'This action is not assigned.' })
  assert.equal(isExpectedAccessDenied(error), true)
  assert.equal(markExpectedAccessDenied(error), error)
  assert.equal(error.isAccessDenied, true)
  assert.equal(error.isExpected, true)
})

test('password-expired 403 remains an actionable authentication response', () => {
  const error = responseError(403, { error: 'password_expired' })
  assert.equal(isPasswordExpiredResponse(error), true)
  assert.equal(isExpectedAccessDenied(error), false)
  markExpectedAccessDenied(error)
  assert.equal(error.isAccessDenied, undefined)
})

test('server, authentication and network errors are not access restrictions', () => {
  for (const error of [responseError(401), responseError(500), new Error('Network unavailable')]) {
    assert.equal(isExpectedAccessDenied(error), false)
  }
})
