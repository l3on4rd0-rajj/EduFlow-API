import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'

import logger from '../../utils/logger.js'

test('logger.info redige campos sensiveis antes de escrever no arquivo', () => {
  const originalAppendFileSync = fs.appendFileSync
  const originalConsoleLog = console.log
  const writes = []

  fs.appendFileSync = (file, message) => writes.push({ file, message })
  console.log = () => {}

  try {
    logger.info('Teste de sanitizacao', {
      password: '123456',
      token: 'abc',
      email: 'user@test.com',
      cpf: '12345678900',
    })

    assert.equal(writes.length, 1)
    assert.match(writes[0].message, /\*\*\*REDACTED\*\*\*/)
    assert.match(writes[0].message, /user@test\.com/)
    assert.doesNotMatch(writes[0].message, /12345678900/)
  } finally {
    fs.appendFileSync = originalAppendFileSync
    console.log = originalConsoleLog
  }
})

test('logger.debug nao escreve nada quando DEBUG nao e true', () => {
  const originalAppendFileSync = fs.appendFileSync
  const originalDebug = process.env.DEBUG
  const writes = []

  fs.appendFileSync = (file, message) => writes.push({ file, message })
  process.env.DEBUG = 'false'

  try {
    logger.debug('nao deve logar', { ok: true })
    assert.equal(writes.length, 0)
  } finally {
    fs.appendFileSync = originalAppendFileSync
    process.env.DEBUG = originalDebug
  }
})
