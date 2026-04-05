import test from 'node:test'
import assert from 'node:assert/strict'

import logger from '../../utils/logger.js'
import {
  createMockReq,
  createMockRes,
  createNextSpy,
} from '../helpers/http.js'
import {
  errorLoggingMiddleware,
  httpLoggingMiddleware,
} from '../../middlewares/logging.js'

test('httpLoggingMiddleware registra detalhes da resposta JSON', () => {
  const req = createMockReq({
    method: 'GET',
    path: '/api/contas',
    params: { id: '123' },
    query: { status: 'ABERTA' },
    user: { id: 'user-1' },
  })
  const res = createMockRes()
  const next = createNextSpy()

  const originalHttpLog = logger.http
  const httpCalls = []
  logger.http = (...args) => httpCalls.push(args)

  try {
    httpLoggingMiddleware(req, res, next)
    res.status(201).json({ ok: true })

    assert.equal(next.called(), true)
    assert.equal(httpCalls.length, 1)
    assert.equal(httpCalls[0][0], 'GET')
    assert.equal(httpCalls[0][1], '/api/contas')
    assert.equal(httpCalls[0][2], 201)
    assert.equal(httpCalls[0][4], 'user-1')
    assert.deepEqual(httpCalls[0][5], {
      params: { id: '123' },
      query: { status: 'ABERTA' },
    })
  } finally {
    logger.http = originalHttpLog
  }
})

test('errorLoggingMiddleware delega o erro ao logger e chama next(err)', () => {
  const error = new Error('falha inesperada')
  const req = createMockReq({
    method: 'POST',
    path: '/api/conta',
    ip: '10.0.0.1',
    user: { id: 'user-99' },
  })
  const res = createMockRes()
  const next = createNextSpy()

  const originalErrorLog = logger.error
  const errorCalls = []
  logger.error = (...args) => errorCalls.push(args)

  try {
    errorLoggingMiddleware(error, req, res, next)

    assert.equal(errorCalls.length, 1)
    assert.match(errorCalls[0][0], /\[POST \/api\/conta\] falha inesperada/)
    assert.equal(errorCalls[0][1], error)
    assert.deepEqual(errorCalls[0][2], {
      userId: 'user-99',
      path: '/api/conta',
      method: 'POST',
      ip: '10.0.0.1',
    })
    assert.equal(next.called(), true)
    assert.equal(next.calls[0][0], error)
  } finally {
    logger.error = originalErrorLog
  }
})
