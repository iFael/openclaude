import { expect, test } from 'bun:test'
import { summarizeGrpcErrorForLog } from './server.js'

test('summarizeGrpcErrorForLog omits sensitive error messages but keeps error code', () => {
  const error = Object.assign(
    new Error('oauthAccount={"email":"secret@example.com"}'),
    { code: 'EADDRINUSE' },
  )

  expect(summarizeGrpcErrorForLog(error)).toBe('Error (EADDRINUSE)')
})
