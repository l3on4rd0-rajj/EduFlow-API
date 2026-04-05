import test from 'node:test'
import assert from 'node:assert/strict'

import alunosRouter from '../../routes/alunos.js'
import {
  createMockReq,
  createMockRes,
  getRouteHandler,
} from '../helpers/http.js'
import { mockPrisma } from '../mocks/dependencies.js'

const updateAlunoHandler = getRouteHandler(alunosRouter, 'patch', '/aluno/:id')
const getAlunoHandler = getRouteHandler(alunosRouter, 'get', '/aluno/:id')

test('PATCH /aluno/:id retorna 400 quando o CPF e invalido', async () => {
  const req = createMockReq({
    method: 'PATCH',
    path: '/aluno/507f1f77bcf86cd799439011',
    params: { id: '507f1f77bcf86cd799439011' },
    body: { cpf: '12345678900' },
  })
  const res = createMockRes()

  await updateAlunoHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'CPF inválido' })
})

test('PATCH /aluno/:id retorna 400 para turma invalida', async () => {
  const req = createMockReq({
    method: 'PATCH',
    path: '/aluno/507f1f77bcf86cd799439011',
    params: { id: '507f1f77bcf86cd799439011' },
    body: { turma: 'FUNDAMENTAL' },
  })
  const res = createMockRes()

  await updateAlunoHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'Turma inválida' })
})

test('GET /aluno/:id retorna 400 para id invalido', async () => {
  const req = createMockReq({
    method: 'GET',
    path: '/aluno/abc',
    params: { id: 'abc' },
  })
  const res = createMockRes()

  await getAlunoHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'ID inválido' })
})

test('PATCH /aluno/:id atualiza arrays e normaliza campos com prisma mockado', async () => {
  let updatedData
  const prismaMock = mockPrisma({
    $transaction: async (callback) => {
      const tx = {
        endereco: {
          deleteMany: async () => {},
          createMany: async () => {},
        },
        aluno: {
          update: async ({ data }) => {
            updatedData = data
          },
          findUnique: async ({ where }) => ({
            id: where.id,
            ...updatedData,
            enderecos: [],
          }),
        },
      }

      return callback(tx)
    },
  })

  try {
    const req = createMockReq({
      method: 'PATCH',
      path: '/aluno/507f1f77bcf86cd799439011',
      params: { id: '507f1f77bcf86cd799439011' },
      body: {
        status: 'ativo',
        turma: 'maternal',
        responsaveis: '[" Maria ","Jose "]',
        alergias: [' Leite ', ' '],
        contatos: '[" (11)99999-9999 "]',
        observacoes: '  observacao importante  ',
      },
    })
    const res = createMockRes()

    await updateAlunoHandler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(updatedData.responsaveis, ['Maria', 'Jose'])
    assert.deepEqual(updatedData.alergias, ['Leite'])
    assert.deepEqual(updatedData.contatos, ['(11)99999-9999'])
    assert.equal(updatedData.status, 'ATIVO')
    assert.equal(updatedData.turma, 'MATERNAL')
    assert.equal(updatedData.observacoes, 'observacao importante')
  } finally {
    prismaMock.restore()
  }
})
