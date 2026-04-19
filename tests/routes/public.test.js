import test from 'node:test'
import assert from 'node:assert/strict'

import publicRouter from '../../routes/public.js'
import {
  createMockReq,
  createMockRes,
  getRouteHandler,
} from '../helpers/http.js'
import {
  mockBcrypt,
  mockJwt,
  mockLogger,
  mockMailer,
  mockPrisma,
} from '../mocks/dependencies.js'

const cadastroHandler = getRouteHandler(publicRouter, 'post', '/cadastro')
const loginLimiterHandler = getRouteHandler(publicRouter, 'post', '/login', 0)
const loginHandler = getRouteHandler(publicRouter, 'post', '/login', 1)
const verifyMfaHandler = getRouteHandler(publicRouter, 'post', '/login/mfa/verify')
const forgotPasswordHandler = getRouteHandler(publicRouter, 'post', '/esqueci-senha')
const resetPasswordHandler = getRouteHandler(publicRouter, 'post', '/reset-password')

test('POST /cadastro retorna 400 quando campos obrigatorios nao sao enviados', async () => {
  const req = createMockReq({ method: 'POST', path: '/cadastro', body: { email: 'user@test.com' } })
  const res = createMockRes()

  await cadastroHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { message: 'Nome, e-mail e senha são obrigatórios' })
})

test('POST /cadastro retorna 400 para senha fraca', async () => {
  const req = createMockReq({
    method: 'POST',
    path: '/cadastro',
    body: { name: 'User', email: 'user@test.com', password: '123456' },
  })
  const res = createMockRes()

  await cadastroHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /A senha deve conter pelo menos 8 caracteres/)
})

test('checkLoginAttempts permite seguir quando o IP nao esta bloqueado', () => {
  const req = createMockReq({ ip: '127.0.0.2' })
  const res = createMockRes()
  let nextCalled = false

  loginLimiterHandler(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, true)
  assert.equal(res.body, undefined)
})

test('POST /login retorna 400 quando email ou senha nao sao enviados', async () => {
  const req = createMockReq({
    method: 'POST',
    path: '/login',
    body: { email: '' },
    ip: '127.0.0.3',
  })
  const res = createMockRes()

  await loginHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { message: 'E-mail e senha são obrigatórios' })
})

test('POST /esqueci-senha retorna 400 sem email', async () => {
  const req = createMockReq({ method: 'POST', path: '/esqueci-senha', body: {} })
  const res = createMockRes()

  await forgotPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { message: 'E-mail é obrigatório' })
})

test('POST /reset-password retorna 400 sem token e senha', async () => {
  const req = createMockReq({ method: 'POST', path: '/reset-password', body: {} })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { message: 'Token e nova senha são obrigatórios' })
})

test('POST /reset-password retorna 400 para senha fraca', async () => {
  const req = createMockReq({
    method: 'POST',
    path: '/reset-password',
    body: { token: 'qualquer', password: '123456' },
  })
  const res = createMockRes()

  await resetPasswordHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /A senha deve conter pelo menos 8 caracteres/)
})

test('POST /cadastro cria usuario com bcrypt e prisma mockados', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      create: async ({ data }) => ({
        id: 'user-1',
        name: data.name,
        email: data.email,
        password: data.password,
      }),
    },
  })
  const bcryptMock = mockBcrypt({
    genSalt: async () => 'salt-10',
    hash: async (password, salt) => `hashed:${password}:${salt}`,
  })
  const loggerMock = mockLogger()

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/cadastro',
      body: { name: 'Maria', email: 'maria@test.com', password: 'Senha@123' },
    })
    const res = createMockRes()

    await cadastroHandler(req, res)

    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body, {
      id: 'user-1',
      name: 'Maria',
      email: 'maria@test.com',
      message: 'Usuário criado com sucesso',
    })
    assert.equal(loggerMock.calls.success.length, 1)
  } finally {
    loggerMock.restore()
    bcryptMock.restore()
    prismaMock.restore()
  }
})

test('POST /login autentica usuario com prisma, bcrypt e jwt mockados', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findUnique: async ({ where }) => ({
        id: 'user-9',
        name: 'Thomas',
        email: where.email,
        password: 'hashed-password',
      }),
    },
  })
  const bcryptMock = mockBcrypt({
    compare: async () => true,
  })
  const jwtMock = mockJwt({
    sign: () => 'jwt-token-mockado',
  })
  const loggerMock = mockLogger()
  const previousMfaEnabled = process.env.MFA_ENABLED
  process.env.MFA_ENABLED = 'false'

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/login',
      ip: '127.0.0.4',
      body: { email: 'thomas@test.com', password: 'Senha@123' },
    })
    const res = createMockRes()

    await loginHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.token, 'jwt-token-mockado')
    assert.deepEqual(res.body.user, {
      id: 'user-9',
      name: 'Thomas',
      email: 'thomas@test.com',
    })
    assert.equal(loggerMock.calls.success.length, 1)
  } finally {
    loggerMock.restore()
    jwtMock.restore()
    bcryptMock.restore()
    prismaMock.restore()
  }
})

test('POST /login retorna desafio MFA quando usuario tem MFA ativo', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findUnique: async ({ where }) => ({
        id: 'user-12',
        name: 'Carla',
        email: where.email,
        password: 'hashed-password',
      }),
    },
  })
  const bcryptMock = mockBcrypt({
    compare: async () => true,
    genSalt: async () => 'salt-10',
    hash: async () => 'hashed-code',
  })
  const jwtMock = mockJwt({
    sign: (payload) => (payload?.type === 'mfa' ? 'mfa-challenge' : 'jwt-token'),
  })
  const mailerMock = mockMailer()
  const loggerMock = mockLogger()
  const previousMfaEnabled = process.env.MFA_ENABLED
  process.env.MFA_ENABLED = 'true'

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/login',
      ip: '127.0.0.5',
      body: { email: 'carla@test.com', password: 'Senha@123' },
    })
    const res = createMockRes()

    await loginHandler(req, res)

    assert.equal(res.statusCode, 202)
    assert.equal(res.body.requiresMfa, true)
    assert.equal(res.body.challengeToken, 'mfa-challenge')
    assert.equal(mailerMock.sendMailCalls.length, 1)
  } finally {
    process.env.MFA_ENABLED = previousMfaEnabled
    loggerMock.restore()
    mailerMock.restore()
    jwtMock.restore()
    bcryptMock.restore()
    prismaMock.restore()
  }
})

test('POST /login/mfa/verify conclui login quando codigo esta correto', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findUnique: async () => ({
        id: 'user-13',
        name: 'Paula',
        email: 'paula@test.com',
        password: 'hashed-password',
      }),
    },
  })
  const bcryptMock = mockBcrypt({
    compare: async (value) => value === '123456',
  })
  const jwtMock = mockJwt({
    verify: () => ({ id: 'user-13', email: 'paula@test.com', type: 'mfa', codeHash: 'hashed-code' }),
    sign: () => 'jwt-token-final',
  })
  const loggerMock = mockLogger()

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/login/mfa/verify',
      body: { challengeToken: 'valid-challenge', code: '123456' },
    })
    const res = createMockRes()

    await verifyMfaHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.token, 'jwt-token-final')
    assert.deepEqual(res.body.user, {
      id: 'user-13',
      name: 'Paula',
      email: 'paula@test.com',
    })
  } finally {
    loggerMock.restore()
    jwtMock.restore()
    bcryptMock.restore()
    prismaMock.restore()
  }
})

test('POST /esqueci-senha envia email com mailer e jwt mockados', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findUnique: async () => ({
        id: 'user-10',
        name: 'Ana',
        email: 'ana@test.com',
      }),
    },
  })
  const jwtMock = mockJwt({
    sign: () => 'reset-token',
  })
  const mailerMock = mockMailer()
  const loggerMock = mockLogger()

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/esqueci-senha',
      body: { email: 'ana@test.com' },
    })
    const res = createMockRes()

    await forgotPasswordHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.match(res.body.message, /Se o e-mail existir em nossa base/)
    assert.equal(mailerMock.sendMailCalls.length, 1)
    assert.equal(mailerMock.sendMailCalls[0][0].to, 'ana@test.com')
  } finally {
    loggerMock.restore()
    mailerMock.restore()
    jwtMock.restore()
    prismaMock.restore()
  }
})

test('POST /esqueci-senha retorna 200 mesmo quando o envio do email falha', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findUnique: async () => ({
        id: 'user-11',
        name: 'Bruna',
        email: 'bruna@test.com',
      }),
    },
  })
  const jwtMock = mockJwt({
    sign: () => 'reset-token',
  })
  const mailerMock = mockMailer(async () => {
    throw new Error('SMTP unavailable')
  })
  const loggerMock = mockLogger()

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/esqueci-senha',
      body: { email: 'bruna@test.com' },
    })
    const res = createMockRes()

    await forgotPasswordHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.match(res.body.message, /Se o e-mail existir em nossa base/)
    assert.equal(mailerMock.sendMailCalls.length, 1)
  } finally {
    loggerMock.restore()
    mailerMock.restore()
    jwtMock.restore()
    prismaMock.restore()
  }
})
