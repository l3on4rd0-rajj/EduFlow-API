import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'

const router = express.Router()
const prisma = new PrismaClient()

const isNonEmptyString = (s) => typeof s === 'string' && s.trim().length > 0
const TIPOS = ['PAGAR', 'RECEBER']
const STATUS = ['ABERTA', 'PAGA', 'REN']
const RECORRENCIAS = ['NENHUMA', 'MENSAL', 'SEMANAL', 'ANUAL']

/**
 * @swagger
 * tags:
 *   - name: Contas
 *     description: Endpoints de contas a pagar e a receber (financeiro).
 *
 * components:
 *   schemas:
 *     Conta:
 *       type: object
 *       description: Representa uma conta a pagar ou a receber.
 *       properties:
 *         id:
 *           type: string
 *           example: "64f1a3b9c2d4e5f678901234"
 *         tipo:
 *           type: string
 *           enum: [PAGAR, RECEBER]
 *           example: "PAGAR"
 *         descricao:
 *           type: string
 *           example: "Mensalidade escola"
 *         valor:
 *           type: number
 *           example: 750.5
 *         dataVencimento:
 *           type: string
 *           format: date-time
 *           example: "2025-11-10T00:00:00.000Z"
 *         recorrencia:
 *           type: string
 *           enum: [NENHUMA, MENSAL, SEMANAL, ANUAL]
 *           example: "MENSAL"
 *         status:
 *           type: string
 *           enum: [ABERTA, PAGA, REN]
 *           example: "ABERTA"
 *         categoria:
 *           type: string
 *           nullable: true
 *           example: "Educação"
 *         observacoes:
 *           type: string
 *           nullable: true
 *           example: "Pagar até dia 10 com desconto"
 *
 *     ContaCreateRequest:
 *       type: object
 *       required:
 *         - tipo
 *         - descricao
 *         - valor
 *         - dataVencimento
 *       properties:
 *         tipo:
 *           type: string
 *           enum: [PAGAR, RECEBER]
 *           example: "PAGAR"
 *         descricao:
 *           type: string
 *           example: "Mensalidade escola"
 *         valor:
 *           type: number
 *           example: 750.5
 *         dataVencimento:
 *           type: string
 *           format: date
 *           example: "2025-11-10"
 *         recorrencia:
 *           type: string
 *           enum: [NENHUMA, MENSAL, SEMANAL, ANUAL]
 *           example: "MENSAL"
 *         status:
 *           type: string
 *           enum: [ABERTA, PAGA, REN]
 *           example: "ABERTA"
 *         categoria:
 *           type: string
 *           example: "Educação"
 *         observacoes:
 *           type: string
 *           example: "Pagar até dia 10 com desconto"
 *
 *     ContaUpdateRequest:
 *       type: object
 *       description: Campos opcionais para atualização parcial de uma conta.
 *       properties:
 *         tipo:
 *           type: string
 *           enum: [PAGAR, RECEBER]
 *           example: "RECEBER"
 *         descricao:
 *           type: string
 *           example: "Mensalidade atualizada"
 *         valor:
 *           type: number
 *           example: 800.0
 *         dataVencimento:
 *           type: string
 *           format: date
 *           example: "2025-12-10"
 *         recorrencia:
 *           type: string
 *           enum: [NENHUMA, MENSAL, SEMANAL, ANUAL]
 *           example: "NENHUMA"
 *         status:
 *           type: string
 *           enum: [ABERTA, PAGA, REN]
 *           example: "PAGA"
 *         categoria:
 *           type: string
 *           example: "Educação"
 *         observacoes:
 *           type: string
 *           example: "Conta quitada."
 *
 *     SimpleErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Mensagem de erro descritiva."
 */

// ===== DEBUG: liste rotas registradas ao subir =====
process.nextTick(() => {
  const list = router.stack
    .map(r => r.route && `${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`)
    .filter(Boolean)
  console.log('[contas] rotas registradas:', list)
})

// ===== DEBUG: logue tudo que bate neste router =====
router.use((req, _res, next) => {
  console.log('[contas router]', req.method, req.path, req.query)
  next()
})

// Helper: parse ISO date (yyyy-mm-dd)
function parseDateOr400(value, res, fieldName) {
  if (!isNonEmptyString(value)) {
    res.status(400).json({ error: `${fieldName} é obrigatório` })
    return null
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    res.status(400).json({ error: `${fieldName} inválida` })
    return null
  }
  return d
}

// ================== POST /conta ==================

/**
 * @swagger
 * /api/conta:
 *   post:
 *     summary: Cria uma nova conta (a pagar ou a receber)
 *     description: |
 *       Cadastra uma conta com tipo, descrição, valor, data de vencimento e campos opcionais como recorrência, status, categoria e observações.
 *     tags:
 *       - Contas
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContaCreateRequest'
 *     responses:
 *       201:
 *         description: Conta criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conta'
 *       400:
 *         description: Erro de validação (tipo, descrição, valor, datas, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao cadastrar conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.post('/conta', async (req, res) => {
  try {
    const {
      tipo,
      descricao,
      valor,
      dataVencimento,
      recorrencia = 'NENHUMA',
      status = 'ABERTA',
      categoria,
      observacoes
    } = req.body

    if (!TIPOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo deve ser PAGAR ou RECEBER' })
    }

    if (!isNonEmptyString(descricao)) {
      return res.status(400).json({ error: 'Descrição é obrigatória' })
    }

    const numValor = Number(valor)
    if (!Number.isFinite(numValor) || numValor <= 0) {
      return res.status(400).json({ error: 'Valor deve ser maior que zero' })
    }

    const dtVenc = parseDateOr400(dataVencimento, res, 'Data de vencimento')
    if (!dtVenc) return

    if (!RECORRENCIAS.includes(recorrencia)) {
      return res.status(400).json({ error: 'Recorrência inválida' })
    }

    if (!STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' })
    }

    const conta = await prisma.conta.create({
      data: {
        tipo,
        descricao: descricao.trim(),
        valor: numValor,
        dataVencimento: dtVenc,
        recorrencia,
        status,
        categoria: isNonEmptyString(categoria) ? categoria.trim() : null,
        observacoes: isNonEmptyString(observacoes) ? observacoes.trim() : null
      }
    })

    res.status(201).json(conta)
  } catch (error) {
    console.error('[POST /conta] erro:', error)
    res.status(500).json({ error: 'Erro ao cadastrar conta' })
  }
})

// ================== GET /contas ==================
// Suporta filtros opcionais via query: ?tipo=PAGAR&status=ABERTA&mes=2025-11

/**
 * @swagger
 * /api/contas:
 *   get:
 *     summary: Lista contas com filtros opcionais
 *     description: |
 *       Retorna a lista de contas, podendo filtrar por tipo, status e mês (formato YYYY-MM).
 *     tags:
 *       - Contas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [PAGAR, RECEBER]
 *         description: Filtra pelo tipo da conta
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ABERTA, PAGA, REN]
 *         description: Filtra pelo status da conta
 *       - in: query
 *         name: mes
 *         schema:
 *           type: string
 *           example: "2025-11"
 *         description: Filtra por mês (YYYY-MM) da data de vencimento
 *     responses:
 *       200:
 *         description: Lista de contas encontrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conta'
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao buscar contas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.get('/contas', async (req, res) => {
  try {
    const { tipo, status, mes } = req.query

    const where = {}

    if (tipo && TIPOS.includes(tipo)) {
      where.tipo = tipo
    }

    if (status && STATUS.includes(status)) {
      where.status = status
    }

    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [ano, m] = mes.split('-').map(Number)
      const inicio = new Date(ano, m - 1, 1)
      const fim = new Date(ano, m, 1) // próximo mês
      where.dataVencimento = { gte: inicio, lt: fim }
    }

    const contas = await prisma.conta.findMany({
      where,
      orderBy: { dataVencimento: 'asc' }
    })

    res.json(contas)
  } catch (error) {
    console.error('[GET /contas] erro:', error)
    res.status(500).json({ error: 'Erro ao buscar contas' })
  }
})

// ================== GET /conta/:id ==================

/**
 * @swagger
 * /api/conta/{id}:
 *   get:
 *     summary: Busca uma conta pelo ID
 *     tags:
 *       - Contas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           description: ID da conta (24 caracteres hexadecimais)
 *           example: "64f1a3b9c2d4e5f678901234"
 *     responses:
 *       200:
 *         description: Conta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conta'
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       404:
 *         description: Conta não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao buscar conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.get('/conta/:id', async (req, res) => {
  const { id } = req.params

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' })
  }

  try {
    const conta = await prisma.conta.findUnique({
      where: { id }
    })

    if (!conta) return res.status(404).json({ error: 'Conta não encontrada' })

    res.json(conta)
  } catch (error) {
    console.error('[GET /conta/:id] erro:', error)
    res.status(500).json({ error: 'Erro ao buscar conta' })
  }
})

// ================== PATCH /conta/:id ==================

/**
 * @swagger
 * /api/conta/{id}:
 *   patch:
 *     summary: Atualiza parcialmente uma conta
 *     description: |
 *       Atualiza alguns campos da conta, como tipo, descrição, valor, datas, status, categoria e observações.
 *     tags:
 *       - Contas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           description: ID da conta (24 caracteres hexadecimais)
 *           example: "64f1a3b9c2d4e5f678901234"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContaUpdateRequest'
 *     responses:
 *       200:
 *         description: Conta atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conta'
 *       400:
 *         description: Dados inválidos (ID, tipo, status, valor, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       404:
 *         description: Conta não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao atualizar conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.patch('/conta/:id', async (req, res) => {
  const { id } = req.params
  const body = req.body

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' })
  }

  try {
    const dataUpdate = {}

    if (body.tipo !== undefined) {
      if (!TIPOS.includes(body.tipo)) {
        return res.status(400).json({ error: 'Tipo deve ser PAGAR ou RECEBER' })
      }
      dataUpdate.tipo = body.tipo
    }

    if (body.descricao !== undefined) {
      if (!isNonEmptyString(body.descricao)) {
        return res.status(400).json({ error: 'Descrição é obrigatória' })
      }
      dataUpdate.descricao = body.descricao.trim()
    }

    if (body.valor !== undefined) {
      const numValor = Number(body.valor)
      if (!Number.isFinite(numValor) || numValor <= 0) {
        return res.status(400).json({ error: 'Valor deve ser maior que zero' })
      }
      dataUpdate.valor = numValor
    }

    if (body.dataVencimento !== undefined) {
      const dtVenc = parseDateOr400(body.dataVencimento, res, 'Data de vencimento')
      if (!dtVenc) return
      dataUpdate.dataVencimento = dtVenc
    }

    if (body.recorrencia !== undefined) {
      if (!RECORRENCIAS.includes(body.recorrencia)) {
        return res.status(400).json({ error: 'Recorrência inválida' })
      }
      dataUpdate.recorrencia = body.recorrencia
    }

    if (body.status !== undefined) {
      if (!STATUS.includes(body.status)) {
        return res.status(400).json({ error: 'Status inválido' })
      }
      dataUpdate.status = body.status
    }

    if (body.categoria !== undefined) {
      dataUpdate.categoria = isNonEmptyString(body.categoria) ? body.categoria.trim() : null
    }

    if (body.observacoes !== undefined) {
      dataUpdate.observacoes = isNonEmptyString(body.observacoes) ? body.observacoes.trim() : null
    }

    const conta = await prisma.conta.update({
      where: { id },
      data: dataUpdate
    })

    res.json(conta)
  } catch (error) {
    console.error('[PATCH /conta/:id] erro:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Conta não encontrada' })
    }
    res.status(500).json({ error: 'Erro ao atualizar conta' })
  }
})

// ================== DELETE /conta/:id ==================

/**
 * @swagger
 * /api/conta/{id}:
 *   delete:
 *     summary: Remove uma conta
 *     tags:
 *       - Contas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           description: ID da conta (24 caracteres hexadecimais)
 *           example: "64f1a3b9c2d4e5f678901234"
 *     responses:
 *       204:
 *         description: Conta removida com sucesso (sem corpo de resposta)
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       404:
 *         description: Conta não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao excluir conta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.delete('/conta/:id', async (req, res) => {
  const { id } = req.params

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' })
  }

  try {
    await prisma.conta.delete({ where: { id } })
    return res.status(204).send()
  } catch (error) {
    console.error('[DELETE /conta/:id] erro:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Conta não encontrada' })
    }
    return res.status(500).json({ error: 'Erro ao excluir conta' })
  }
})

process.nextTick(() => {
  const list = router.stack
    .map(r => r.route && `${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`)
    .filter(Boolean)
  console.log('[contas] rotas registradas (2a pass):', list)
})

export default router
