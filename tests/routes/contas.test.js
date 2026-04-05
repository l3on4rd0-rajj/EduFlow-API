import test from 'node:test'
import assert from 'node:assert/strict'

import contasRouter from '../../routes/contas.js'
import {
  createMockReq,
  createMockRes,
  getRouteHandler,
} from '../helpers/http.js'
import { mockPrisma } from '../mocks/dependencies.js'

const createContaHandler = getRouteHandler(contasRouter, 'post', '/conta')
const getContaHandler = getRouteHandler(contasRouter, 'get', '/conta/:id')
const patchContaHandler = getRouteHandler(contasRouter, 'patch', '/conta/:id')
const deleteContaHandler = getRouteHandler(contasRouter, 'delete', '/conta/:id')

test('POST /conta valida o tipo informado', async () => {
  const req = createMockReq({
    method: 'POST',
    path: '/conta',
    body: {
      tipo: 'INVALIDO',
      descricao: 'Conta de teste',
      valor: 100,
      dataVencimento: '2026-05-10',
    },
  })
  const res = createMockRes()

  await createContaHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'Tipo deve ser PAGAR ou RECEBER' })
})

test('POST /conta valida valor positivo', async () => {
  const req = createMockReq({
    method: 'POST',
    path: '/conta',
    body: {
      tipo: 'PAGAR',
      descricao: 'Conta de teste',
      valor: 0,
      dataVencimento: '2026-05-10',
    },
  })
  const res = createMockRes()

  await createContaHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'Valor deve ser maior que zero' })
})

test('GET /conta/:id retorna 400 para id invalido', async () => {
  const req = createMockReq({
    method: 'GET',
    path: '/conta/invalido',
    params: { id: 'abc' },
  })
  const res = createMockRes()

  await getContaHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'ID inválido' })
})

test('PATCH /conta/:id retorna 400 para id invalido', async () => {
  const req = createMockReq({
    method: 'PATCH',
    path: '/conta/invalido',
    params: { id: 'abc' },
    body: { status: 'PAGA' },
  })
  const res = createMockRes()

  await patchContaHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'ID inválido' })
})

test('DELETE /conta/:id retorna 400 para id invalido', async () => {
  const req = createMockReq({
    method: 'DELETE',
    path: '/conta/invalido',
    params: { id: 'abc' },
  })
  const res = createMockRes()

  await deleteContaHandler(req, res)

  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { error: 'ID inválido' })
})

test('POST /conta cria registro com prisma mockado', async () => {
  let receivedPayload
  const prismaMock = mockPrisma({
    conta: {
      create: async ({ data }) => {
        receivedPayload = data
        return { id: '507f1f77bcf86cd799439011', ...data }
      },
    },
  })

  try {
    const req = createMockReq({
      method: 'POST',
      path: '/conta',
      body: {
        tipo: 'PAGAR',
        descricao: '  Mensalidade  ',
        valor: '250.50',
        dataVencimento: '2026-05-10',
        recorrencia: 'MENSAL',
        status: 'ABERTA',
        categoria: '  Escola  ',
        observacoes: '  pagar dia 10  ',
      },
    })
    const res = createMockRes()

    await createContaHandler(req, res)

    assert.equal(res.statusCode, 201)
    assert.equal(res.body.id, '507f1f77bcf86cd799439011')
    assert.equal(receivedPayload.descricao, 'Mensalidade')
    assert.equal(receivedPayload.valor, 250.5)
    assert.equal(receivedPayload.categoria, 'Escola')
    assert.equal(receivedPayload.observacoes, 'pagar dia 10')
    assert.ok(receivedPayload.dataVencimento instanceof Date)
  } finally {
    prismaMock.restore()
  }
})
