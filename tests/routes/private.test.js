import test from 'node:test'
import assert from 'node:assert/strict'

import privateRouter from '../../routes/private.js'
import { createMockReq, createMockRes, getRouteHandler } from '../helpers/http.js'
import { mockPrisma } from '../mocks/dependencies.js'

const listUsersHandler = getRouteHandler(privateRouter, 'get', '/listar-usuarios')
const updateUserHandler = getRouteHandler(privateRouter, 'patch', '/usuarios/:id')
const inactivateUserHandler = getRouteHandler(privateRouter, 'patch', '/usuarios/:id/inativar')

test('GET /private/listar-usuarios retorna usuarios sem senha', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findMany: async () => [
        {
          id: '507f1f77bcf86cd799439011',
          name: 'Maria',
          email: 'maria@test.com',
          cpf: '52998224725',
          status: 'ATIVO',
          telefones: ['11999998888'],
          endereco: {
            cep: '01001000',
            rua: 'Praca da Se',
            bairro: 'Se',
            numero: '100',
            cidade: 'Sao Paulo',
            estado: 'SP',
          },
          documentos: [],
          fotoPath: null,
          criadoEm: new Date('2026-04-25T00:00:00.000Z'),
        },
      ],
    },
  })

  try {
    const req = createMockReq({ method: 'GET', path: '/listar-usuarios' })
    const res = createMockRes()

    await listUsersHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.users.length, 1)
    assert.equal('password' in res.body.users[0], false)
  } finally {
    prismaMock.restore()
  }
})

test('PATCH /private/usuarios/:id retorna 400 para CPF invalido', async () => {
  const req = createMockReq({
    method: 'PATCH',
    path: '/usuarios/:id',
    params: { id: '507f1f77bcf86cd799439011' },
    body: { cpf: '12345678900' },
  })
  const res = createMockRes()

  await updateUserHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { message: 'CPF invalido' })
})

test('PATCH /private/usuarios/:id atualiza usuario com prisma mockado', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      findFirst: async () => null,
      update: async ({ where, data }) => ({
        id: where.id,
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        status: data.status,
        telefones: data.telefones,
        endereco: data.endereco,
        fotoPath: null,
        documentos: [],
        criadoEm: new Date('2026-04-25T00:00:00.000Z'),
      }),
    },
  })

  try {
    const req = createMockReq({
      method: 'PATCH',
      path: '/usuarios/:id',
      params: { id: '507f1f77bcf86cd799439011' },
      body: {
        name: 'Maria Atualizada',
        email: 'maria.atualizada@test.com',
        cpf: '52998224725',
        status: 'INATIVO',
        telefones: JSON.stringify(['11999998888', '1133334444']),
        endereco: JSON.stringify({
          cep: '01001000',
          rua: 'Praca da Se',
          bairro: 'Se',
          numero: '100',
          cidade: 'Sao Paulo',
          estado: 'sp',
        }),
      },
    })
    const res = createMockRes()

    await updateUserHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body.user, {
      id: '507f1f77bcf86cd799439011',
      name: 'Maria Atualizada',
      email: 'maria.atualizada@test.com',
      cpf: '52998224725',
      status: 'INATIVO',
      telefones: ['11999998888', '1133334444'],
      endereco: {
        cep: '01001000',
        rua: 'Praca da Se',
        bairro: 'Se',
        numero: '100',
        cidade: 'Sao Paulo',
        estado: 'SP',
      },
      fotoPath: null,
      documentos: [],
      criadoEm: new Date('2026-04-25T00:00:00.000Z'),
    })
  } finally {
    prismaMock.restore()
  }
})

test('PATCH /private/usuarios/:id/inativar marca usuario como INATIVO', async () => {
  const prismaMock = mockPrisma({
    Cluster0: {
      update: async ({ where, data }) => ({
        id: where.id,
        name: 'Maria',
        email: 'maria@test.com',
        cpf: '52998224725',
        status: data.status,
        telefones: ['11999998888'],
        endereco: {
          cep: '01001000',
          rua: 'Praca da Se',
          bairro: 'Se',
          numero: '100',
          cidade: 'Sao Paulo',
          estado: 'SP',
        },
        fotoPath: null,
        documentos: [],
        criadoEm: new Date('2026-04-25T00:00:00.000Z'),
      }),
    },
  })

  try {
    const req = createMockReq({
      method: 'PATCH',
      path: '/usuarios/:id/inativar',
      params: { id: '507f1f77bcf86cd799439011' },
    })
    const res = createMockRes()

    await inactivateUserHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.user.status, 'INATIVO')
  } finally {
    prismaMock.restore()
  }
})
