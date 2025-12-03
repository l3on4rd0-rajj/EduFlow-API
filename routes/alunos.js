// routes/alunos.js
import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()
const prisma = new PrismaClient()

// ====== CONSTANTES / HELPERS ======
const isNonEmptyString = (s) => typeof s === 'string' && s.trim().length > 0
const CEP_RE = /^\d{8}$/
const STATUS_VALUES = ['ATIVO', 'INATIVO']
const TURMA_VALUES = ['BERCARIO', 'MATERNAL', 'PRE_ESCOLAR', 'EXTRA_CLASSE']
const MAX_OBS_LEN = 500

const parseArrayField = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch (_) {}
  return [String(value)]
}

/**
 * @swagger
 * tags:
 *   - name: Alunos
 *     description: CRUD de alunos, incluindo endereços e anexos (foto/documentos).
 *
 * components:
 *   schemas:
 *     Endereco:
 *       type: object
 *       properties:
 *         cep:
 *           type: string
 *           example: "12345678"
 *         rua:
 *           type: string
 *           example: "Rua das Flores"
 *         bairro:
 *           type: string
 *           example: "Centro"
 *         numero:
 *           type: string
 *           example: "123"
 *         cidade:
 *           type: string
 *           example: "São Paulo"
 *         estado:
 *           type: string
 *           example: "SP"
 *
 *     AlunoInput:
 *       type: object
 *       required:
 *         - nome
 *         - cpf
 *         - dataNascimento
 *         - sexo
 *         - turma
 *         - dataMatricula
 *         - enderecos
 *       properties:
 *         nome:
 *           type: string
 *           example: "João da Silva"
 *         cpf:
 *           type: string
 *           example: "12345678909"
 *         dataNascimento:
 *           type: string
 *           format: date
 *           example: "2015-01-20"
 *         sexo:
 *           type: string
 *           example: "M"
 *         responsaveis:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Maria Silva", "José Silva"]
 *         alergias:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Leite", "Amendoim"]
 *         contatos:
 *           type: array
 *           items:
 *             type: string
 *           example: ["(11) 99999-9999", "maria@example.com"]
 *         enderecos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Endereco'
 *         status:
 *           type: string
 *           enum: [ATIVO, INATIVO]
 *           example: "ATIVO"
 *         turma:
 *           type: string
 *           enum: [BERCARIO, MATERNAL, PRE_ESCOLAR, EXTRA_CLASSE]
 *           example: "MATERNAL"
 *         dataMatricula:
 *           type: string
 *           format: date
 *           example: "2025-02-01"
 *         observacoes:
 *           type: string
 *           example: "Aluno com restrição alimentar."
 *
 *     AlunoUpdateInput:
 *       type: object
 *       description: Campos opcionais para atualização parcial do aluno.
 *       properties:
 *         nome:
 *           type: string
 *           example: "João da Silva Atualizado"
 *         cpf:
 *           type: string
 *           example: "12345678909"
 *         dataNascimento:
 *           type: string
 *           format: date
 *         sexo:
 *           type: string
 *           example: "M"
 *         responsaveis:
 *           type: array
 *           items:
 *             type: string
 *         alergias:
 *           type: array
 *           items:
 *             type: string
 *         contatos:
 *           type: array
 *           items:
 *             type: string
 *         enderecos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Endereco'
 *         status:
 *           type: string
 *           enum: [ATIVO, INATIVO]
 *         turma:
 *           type: string
 *           enum: [BERCARIO, MATERNAL, PRE_ESCOLAR, EXTRA_CLASSE]
 *         dataMatricula:
 *           type: string
 *           format: date
 *         observacoes:
 *           type: string
 *           example: "Observações atualizadas."
 *
 *     AlunoResponse:
 *       type: object
 *       description: Representa um aluno com endereços e caminhos de arquivos.
 *       properties:
 *         id:
 *           type: string
 *           example: "64f1a3b9c2d4e5f678901234"
 *         nome:
 *           type: string
 *         cpf:
 *           type: string
 *         dataNascimento:
 *           type: string
 *           format: date-time
 *         sexo:
 *           type: string
 *         responsaveis:
 *           type: array
 *           items:
 *             type: string
 *         alergias:
 *           type: array
 *           items:
 *             type: string
 *         contatos:
 *           type: array
 *           items:
 *             type: string
 *         enderecos:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Endereco'
 *         status:
 *           type: string
 *           enum: [ATIVO, INATIVO]
 *         turma:
 *           type: string
 *         dataMatricula:
 *           type: string
 *           format: date-time
 *         numeroMatricula:
 *           type: string
 *           example: "20251234"
 *         observacoes:
 *           type: string
 *           nullable: true
 *         fotoPath:
 *           type: string
 *           nullable: true
 *           example: "/uploads/alunos/foto-123.png"
 *         documentos:
 *           type: array
 *           items:
 *             type: string
 *           example: ["/uploads/alunos/doc-1.pdf", "/uploads/alunos/doc-2.pdf"]
 *
 *     SimpleErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Mensagem de erro descritiva."
 */

// ===== CPF: validação completa (back) =====
const validarCPF = (rawCpf) => {
  let cpf = String(rawCpf || '').replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) return false

  // rejeita 00000000000, 11111111111 etc.
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let soma = 0
  let resto

  // 1º dígito verificador
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(9, 10), 10)) return false

  // 2º dígito verificador
  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(10, 11), 10)) return false

  return true
}

// ===== MULTER (upload de foto/documentos) =====
const UPLOAD_DIR = path.resolve('uploads', 'alunos')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname) || ''
    cb(null, `${file.fieldname}-${unique}${ext}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  }
})

// ====== GERAÇÃO DINÂMICA DO NÚMERO DE MATRÍCULA ======
async function generateNumeroMatricula() {
  const ano = new Date().getFullYear().toString()
  let numero
  let existe = true

  while (existe) {
    const rand = Math.floor(1000 + Math.random() * 9000) // 4 dígitos
    numero = `${ano}${rand}` // ex: 20251234
    const found = await prisma.aluno.findUnique({
      where: { numeroMatricula: numero }
    })
    if (!found) existe = false
  }

  return numero
}

// ===== DEBUG: liste rotas registradas ao subir =====
process.nextTick(() => {
  const list = router.stack
    .map(r => r.route && `${Object.keys(r.route.methods).join(',').toUpperCase()} ${r.route.path}`)
    .filter(Boolean)
  console.log('[alunos] rotas registradas:', list)
})

// ===== DEBUG: logue tudo que bate neste router =====
router.use((req, _res, next) => {
  console.log('[alunos router]', req.method, req.path)
  next()
})

// =======================================
// Cadastrar aluno (POST /api/aluno)
// =======================================

/**
 * @swagger
 * /api/aluno:
 *   post:
 *     summary: Cadastra um novo aluno
 *     description: |
 *       Cria um aluno com geração automática do número de matrícula.
 *       Suporta envio de foto e documentos em `multipart/form-data`.
 *     tags:
 *       - Alunos
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/AlunoInput'
 *               - type: object
 *                 properties:
 *                   foto:
 *                     type: string
 *                     format: binary
 *                     description: Arquivo de imagem do aluno (opcional)
 *                   documentos:
 *                     type: array
 *                     items:
 *                       type: string
 *                       format: binary
 *                     description: Arquivos de documentos do aluno (opcional)
 *     responses:
 *       201:
 *         description: Aluno criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlunoResponse'
 *       400:
 *         description: Erro de validação (CPF inválido, campos obrigatórios, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       409:
 *         description: Conflito na geração do número de matrícula
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro interno ao cadastrar aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.post(
  '/aluno',
  upload.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'documentos', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const {
        nome,
        cpf,
        dataNascimento,
        sexo,
        responsaveis,
        alergias,
        contatos,
        enderecos,
        status,
        turma,
        dataMatricula,
        observacoes
      } = req.body

      // ==== validações ====
      if (!isNonEmptyString(nome)) {
        return res.status(400).json({ error: 'Nome é obrigatório' })
      }

      // CPF: validação completa
      if (!validarCPF(cpf)) {
        return res.status(400).json({ error: 'CPF inválido' })
      }

      if (!isNonEmptyString(dataNascimento)) {
        return res.status(400).json({ error: 'Data de nascimento é obrigatória' })
      }
      const nascimentoDate = new Date(dataNascimento)
      if (Number.isNaN(nascimentoDate.getTime())) {
        return res.status(400).json({ error: 'Data de nascimento inválida' })
      }

      if (!isNonEmptyString(sexo)) {
        return res.status(400).json({ error: 'Sexo é obrigatório' })
      }
      const sexoNorm = sexo.trim().toUpperCase()

      // STATUS: default ATIVO
      let statusNorm = 'ATIVO'
      if (isNonEmptyString(status)) {
        const s = status.trim().toUpperCase()
        if (!STATUS_VALUES.includes(s)) {
          return res.status(400).json({ error: 'Status inválido (ATIVO/INATIVO)' })
        }
        statusNorm = s
      }

      // TURMA (obrigatória)
      if (!isNonEmptyString(turma)) {
        return res.status(400).json({ error: 'Turma é obrigatória' })
      }
      const turmaNorm = turma.trim().toUpperCase()
      if (!TURMA_VALUES.includes(turmaNorm)) {
        return res.status(400).json({ error: 'Turma inválida' })
      }

      // DATA MATRÍCULA (obrigatória)
      if (!isNonEmptyString(dataMatricula)) {
        return res.status(400).json({ error: 'Data de matrícula é obrigatória' })
      }
      const dataMatriculaDate = new Date(dataMatricula)
      if (Number.isNaN(dataMatriculaDate.getTime())) {
        return res.status(400).json({ error: 'Data de matrícula inválida' })
      }

      let observacoesNorm = null
      if (isNonEmptyString(observacoes)) {
        if (observacoes.length > MAX_OBS_LEN) {
          return res.status(400).json({ error: `Observações deve ter no máximo ${MAX_OBS_LEN} caracteres` })
        }
        observacoesNorm = observacoes.trim()
      }

      const respArr = parseArrayField(responsaveis)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)

      const alergArr = parseArrayField(alergias)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)

      const contArr = parseArrayField(contatos)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)

      const endArr = parseArrayField(enderecos)

      for (const e of endArr) {
        if (!e) return res.status(400).json({ error: 'Endereço inválido' })
        const { cep, rua, bairro, numero, cidade, estado } = e
        if (![rua, bairro, numero, cidade, estado].every(isNonEmptyString)) {
          return res.status(400).json({ error: 'Campos de endereço são obrigatórios' })
        }
        if (!CEP_RE.test(String(cep))) {
          return res.status(400).json({ error: 'CEP deve conter 8 dígitos' })
        }
      }

      // arquivos
      const fotoFile = req.files?.foto?.[0]
      const documentosFiles = req.files?.documentos || []

      const fotoPath = fotoFile ? `/uploads/alunos/${fotoFile.filename}` : null
      const documentosPaths = documentosFiles.map(f => `/uploads/alunos/${f.filename}`)

      // número de matrícula gerado dinamicamente
      const numeroMatriculaGerado = await generateNumeroMatricula()

      const aluno = await prisma.aluno.create({
        data: {
          nome: nome.trim(),
          cpf: String(cpf).replace(/\D/g, ''),
          dataNascimento: nascimentoDate,
          sexo: sexoNorm,
          responsaveis: respArr,
          alergias: alergArr,
          contatos: contArr,
          enderecos: {
            create: endArr.map(e => ({
              cep: String(e.cep),
              rua: e.rua.trim(),
              bairro: e.bairro.trim(),
              numero: String(e.numero).trim(),
              cidade: e.cidade.trim(),
              estado: e.estado.trim()
            }))
          },
          status: statusNorm,
          turma: turmaNorm,
          dataMatricula: dataMatriculaDate,
          numeroMatricula: numeroMatriculaGerado,
          observacoes: observacoesNorm,
          fotoPath,
          documentos: documentosPaths
        },
        include: { enderecos: true }
      })

      res.status(201).json(aluno)
    } catch (error) {
      console.error(error)
      if (error.code === 'P2002' && error.meta?.target?.includes('numeroMatricula')) {
        return res.status(409).json({ error: 'Número de matrícula já existente (conflito na geração)' })
      }
      res.status(500).json({ error: 'Erro ao cadastrar aluno' })
    }
  }
)

// =======================================
// Listar alunos (GET /api/alunos)
// =======================================

/**
 * @swagger
 * /api/alunos:
 *   get:
 *     summary: Lista todos os alunos
 *     description: Retorna a lista de alunos com seus endereços.
 *     tags:
 *       - Alunos
 *     responses:
 *       200:
 *         description: Lista de alunos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AlunoResponse'
 *       500:
 *         description: Erro ao buscar alunos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.get('/alunos', async (_req, res) => {
  try {
    const alunos = await prisma.aluno.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { enderecos: true }
    })
    res.json(alunos)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao buscar alunos' })
  }
})

// =======================================
// Atualizar aluno (PATCH /api/aluno/:id)
// =======================================

/**
 * @swagger
 * /api/aluno/{id}:
 *   patch:
 *     summary: Atualiza parcialmente um aluno
 *     description: Atualiza campos do aluno e, se enviado, substitui a lista de endereços.
 *     tags:
 *       - Alunos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a3b9c2d4e5f678901234"
 *         description: ID do aluno (24 caracteres hexadecimais)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlunoUpdateInput'
 *     responses:
 *       200:
 *         description: Aluno atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlunoResponse'
 *       400:
 *         description: Erro de validação (CPF, datas, endereços, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       404:
 *         description: Aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       409:
 *         description: Conflito de número de matrícula
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao atualizar aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.patch('/aluno/:id', async (req, res) => {
  const { id } = req.params
  const data = { ...req.body }
  console.log('[PATCH /aluno/:id] payload:', JSON.stringify(data, null, 2))

  try {
    // não permitir edição de numeroMatricula
    if ('numeroMatricula' in data) {
      delete data.numeroMatricula
    }

    // ==== ENDEREÇOS (se vierem no body) ====
    let endArr = null
    if (data.enderecos !== undefined) {
      const enderecosInput = data.enderecos
      delete data.enderecos

      if (!Array.isArray(enderecosInput)) {
        return res.status(400).json({ error: 'Endereços deve ser um array' })
      }

      endArr = enderecosInput.map((e) => {
        if (!e) {
          throw new Error('Endereço inválido')
        }

        const cep = String(e.cep || '').trim()
        const rua = String(e.rua || '').trim()
        const bairro = String(e.bairro || '').trim()
        const numero = String(e.numero || '').trim()
        const cidade = String(e.cidade || '').trim()
        const estado = String(e.estado || '').trim()

        if (![rua, bairro, numero, cidade, estado].every(isNonEmptyString)) {
          throw new Error('Campos de endereço são obrigatórios')
        }
        if (!CEP_RE.test(cep)) {
          throw new Error('CEP deve conter 8 dígitos')
        }

        return { cep, rua, bairro, numero, cidade, estado }
      })
    }

    // ==== CAMPOS SIMPLES ====
    if (data.nome !== undefined && data.nome === '') {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }

    // CPF: validação também em updates
    if (data.cpf !== undefined && !validarCPF(data.cpf)) {
      return res.status(400).json({ error: 'CPF inválido' })
    }

    if (data.dataNascimento !== undefined) {
      const nascimentoDate = new Date(data.dataNascimento)
      if (Number.isNaN(nascimentoDate.getTime())) {
        return res.status(400).json({ error: 'Data de nascimento inválida' })
      }
      data.dataNascimento = nascimentoDate
    }

    if (data.dataMatricula !== undefined) {
      const dataMatriculaDate = new Date(data.dataMatricula)
      if (Number.isNaN(dataMatriculaDate.getTime())) {
        return res.status(400).json({ error: 'Data de matrícula inválida' })
      }
      data.dataMatricula = dataMatriculaDate
    }

    if (data.status !== undefined) {
      const statusNorm = String(data.status).trim().toUpperCase()
      if (!STATUS_VALUES.includes(statusNorm)) {
        return res.status(400).json({ error: 'Status inválido (ATIVO/INATIVO)' })
      }
      data.status = statusNorm
    }

    if (data.turma !== undefined) {
      const turmaNorm = String(data.turma).trim().toUpperCase()
      if (!TURMA_VALUES.includes(turmaNorm)) {
        return res.status(400).json({ error: 'Turma inválida' })
      }
      data.turma = turmaNorm
    }

    if (data.observacoes !== undefined) {
      const obs = String(data.observacoes).trim()
      if (obs.length === 0) {
        data.observacoes = null
      } else {
        if (obs.length > MAX_OBS_LEN) {
          return res.status(400).json({ error: `Observações deve ter no máximo ${MAX_OBS_LEN} caracteres` })
        }
        data.observacoes = obs
      }
    }

    // normalizar arrays
    if (data.responsaveis !== undefined) {
      data.responsaveis = parseArrayField(data.responsaveis)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)
    }

    if (data.alergias !== undefined) {
      data.alergias = parseArrayField(data.alergias)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)
    }

    if (data.contatos !== undefined) {
      data.contatos = parseArrayField(data.contatos)
        .map(String)
        .map(s => s.trim())
        .filter(isNonEmptyString)
    }

    // ==== TRANSAÇÃO: atualiza aluno + endereços ====
    const alunoAtualizado = await prisma.$transaction(async (tx) => {
      // se veio endArr, refaz todos os endereços do aluno
      if (endArr !== null) {
        await tx.endereco.deleteMany({ where: { alunoId: id } })
        if (endArr.length > 0) {
          await tx.endereco.createMany({
            data: endArr.map(e => ({
              cep: e.cep,
              rua: e.rua,
              bairro: e.bairro,
              numero: e.numero,
              cidade: e.cidade,
              estado: e.estado,
              alunoId: id
            }))
          })
        }
      }

      await tx.aluno.update({
        where: { id },
        data
      })

      // devolve já com endereços
      return tx.aluno.findUnique({
        where: { id },
        include: { enderecos: true }
      })
    })

    if (!alunoAtualizado) {
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }

    res.json(alunoAtualizado)
  } catch (error) {
    console.error('[PATCH /aluno/:id] ERRO:', error)

    // erros de validação de endereço caem aqui
    if (error.message === 'Endereço inválido' ||
        error.message === 'Campos de endereço são obrigatórios' ||
        error.message === 'CEP deve conter 8 dígitos') {
      return res.status(400).json({ error: error.message })
    }

    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('numeroMatricula')) {
      return res.status(409).json({ error: 'Número de matrícula já cadastrado' })
    }

    res.status(500).json({ error: 'Erro ao atualizar aluno' })
  }
})

// =======================================
// Excluir aluno (DELETE /api/aluno/:idAluno)
// =======================================

/**
 * @swagger
 * /api/aluno/{idAluno}:
 *   delete:
 *     summary: Exclui um aluno
 *     description: Remove o aluno e seus endereços associados.
 *     tags:
 *       - Alunos
 *     parameters:
 *       - in: path
 *         name: idAluno
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a3b9c2d4e5f678901234"
 *         description: ID do aluno (24 caracteres hexadecimais)
 *     responses:
 *       204:
 *         description: Aluno excluído com sucesso (sem corpo de resposta)
 *       404:
 *         description: Aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao excluir aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.delete('/aluno/:idAluno', async (req, res) => {
  const { idAluno } = req.params
  try {
    await prisma.endereco.deleteMany({ where: { alunoId: idAluno } })
    await prisma.aluno.delete({ where: { id: idAluno } })
    return res.status(204).send()
  } catch (error) {
    console.error('Erro da exclusão: ', error)
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }
    return res.status(500).json({ error: 'Erro ao excluir aluno' })
  }
})

// =======================================
// Buscar aluno por ID (GET /api/aluno/:id)
// =======================================

/**
 * @swagger
 * /api/aluno/{id}:
 *   get:
 *     summary: Busca um aluno pelo ID
 *     tags:
 *       - Alunos
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "64f1a3b9c2d4e5f678901234"
 *         description: ID do aluno (24 caracteres hexadecimais)
 *     responses:
 *       200:
 *         description: Aluno encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AlunoResponse'
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       404:
 *         description: Aluno não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 *       500:
 *         description: Erro ao buscar aluno
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimpleErrorResponse'
 */
router.get('/aluno/:id', async (req, res) => {
  const { id } = req.params

  // valida ID como ObjectId (24 hex) se for o caso
  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ error: 'ID inválido' })
  }

  try {
    const aluno = await prisma.aluno.findUnique({
      where: { id },
      include: { enderecos: true }
    })

    if (!aluno) {
      return res.status(404).json({ error: 'Aluno não encontrado' })
    }

    res.json(aluno)
  } catch (error) {
    console.error('Erro ao buscar aluno:', error)
    res.status(500).json({ error: 'Erro ao buscar aluno' })
  }
})

export default router
