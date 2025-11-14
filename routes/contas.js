import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'

const router = express.Router()
const prisma = new PrismaClient()

const isNonEmptyString = (s) => typeof s === 'string' && s.trim().length > 0
const TIPOS = ['PAGAR', 'RECEBER']
const STATUS = ['ABERTA', 'PAGA', 'REN']
const RECORRENCIAS = ['NENHUMA', 'MENSAL', 'SEMANAL', 'ANUAL']

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
