import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'

import auth from '../../middlewares/auth.js'
import logger from '../../utils/logger.js'
import { createMockReq, createMockRes, createNextSpy } from '../helpers/http.js'

test('auth retorna 401 quando o header Authorization nao existe', () => {
  const req = createMockReq({ path: '/api/contas', method: 'GET' })
  const res = createMockRes()
  const next = createNextSpy()

  const originalAuthLog = logger.auth
  const authCalls = []
  logger.auth = (...args) => authCalls.push(args)

  try {
    auth(req, res, next)

    assert.equal(res.statusCode, 401)
    assert.deepEqual(res.body, { message: 'Token não fornecido' })
    assert.equal(next.called(), false)
    assert.equal(authCalls.length, 1)
    assert.equal(authCalls[0][2], 'failure')
  } finally {
    logger.auth = originalAuthLog
  }
})

test('auth anexa o usuario em req.user e chama next quando o token e valido', () => {
  const req = createMockReq({
    headers: { authorization: 'Bearer token-valido' },
    path: '/api/contas',
    method: 'GET',
  })
  const res = createMockRes()
  const next = createNextSpy()

  const originalVerify = jwt.verify
  const originalAuthLog = logger.auth
  const authCalls = []

  jwt.verify = () => ({ id: 'user-1', email: 'user@test.com' })
  logger.auth = (...args) => authCalls.push(args)

  try {
    auth(req, res, next)

    assert.deepEqual(req.user, { id: 'user-1', email: 'user@test.com' })
    assert.equal(next.called(), true)
    assert.equal(authCalls.length, 1)
    assert.equal(authCalls[0][1], 'user@test.com')
    assert.equal(authCalls[0][2], 'success')
  } finally {
    jwt.verify = originalVerify
    logger.auth = originalAuthLog
  }
})

test('auth retorna 401 quando jwt.verify lanca erro', () => {
  const req = createMockReq({
    headers: { authorization: 'Bearer token-invalido' },
    path: '/api/contas',
    method: 'GET',
  })
  const res = createMockRes()
  const next = createNextSpy()

  const originalVerify = jwt.verify
  const originalAuthLog = logger.auth
  const authCalls = []

  jwt.verify = () => {
    throw new Error('jwt malformed')
  }
  logger.auth = (...args) => authCalls.push(args)

  try {
    auth(req, res, next)

    assert.equal(res.statusCode, 401)
    assert.deepEqual(res.body, { message: 'Token inválido ou expirado' })
    assert.equal(next.called(), false)
    assert.equal(authCalls.length, 1)
    assert.equal(authCalls[0][2], 'failure')
  } finally {
    jwt.verify = originalVerify
    logger.auth = originalAuthLog
  }
})
