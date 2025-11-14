import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const router = express.Router()
const prisma = new PrismaClient()

// ====== CONSTANTES / HELPERS ======
const toArray = (v) => (Array.isArray(v) ? v : (v == null ? [] : [v]))
const isNonEmptyString = (s) => typeof s === 'string' && s.trim().length > 0
const CEP_RE = /^\d{8}$/
const CPF_RE = /^\d{11}$/
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
// - número de matrícula gerado automaticamente
// - status default = ATIVO (se não enviado)
// - upload de foto + documentos
// =======================================
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
        // numeroMatricula NÃO vem do front
      } = req.body

      // ==== validações ====
      if (!isNonEmptyString(nome)) {
        return res.status(400).json({ error: 'Nome é obrigatório' })
      }

      if (!CPF_RE.test(String(cpf))) {
        return res.status(400).json({ error: 'CPF deve conter 11 dígitos numéricos' })
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
          cpf: String(cpf).trim(),
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

// Listar alunos (GET /api/alunos) – com foto e documentos disponíveis
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

// Atualizar (PATCH) – mantém lógica, permite mudar status/turma/etc.
router.patch('/aluno/:id', async (req, res) => {
  const { id } = req.params
  const data = req.body
  console.log('[PATCH /aluno/:id] payload:', data)

  try {
    if (data.nome === '') {
      return res.status(400).json({ error: 'Nome é obrigatório' })
    }

    if (data.cpf !== undefined && !CPF_RE.test(String(data.cpf))) {
      return res.status(400).json({ error: 'CPF deve conter 11 dígitos numéricos' })
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
        return res.status(400).json({ error: 'Status inválido' })
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

    if (data.observacoes !== undefined && data.observacoes !== null) {
      if (String(data.observacoes).length > MAX_OBS_LEN) {
        return res.status(400).json({ error: `Observações deve ter no máximo ${MAX_OBS_LEN} caracteres` })
      }
    }

    const aluno = await prisma.aluno.update({
      where: { id },
      data
    })
    res.json(aluno)
  } catch (error) {
    console.error(error)
    if (error.code === 'P2025') return res.status(404).json({ error: 'Aluno não encontrado' })
    if (error.code === 'P2002' && error.meta?.target?.includes('numeroMatricula')) {
      return res.status(409).json({ error: 'Número de matrícula já cadastrado' })
    }
    res.status(500).json({ error: 'Erro ao atualizar aluno' })
  }
})

// Excluir (DELETE)
router.delete('/aluno/:idAluno', async (req, res) => {
  const { idAluno } = req.params
  try {
    await prisma.endereco.deleteMany({ where: { alunoId: idAluno } })
    await prisma.aluno.delete({ where: { id: idAluno } })
    return res.status(204).send()
  } catch (error) {
    console.error('Erro da exclusão: ', error)
    if (error.code === 'P2025') return res.status(404).json({ error: 'Aluno não encontrado' })
    return res.status(500).json({ error: 'Erro ao excluir aluno' })
  }
})

// Buscar um aluno por ID
router.get('/aluno/:id', async (req, res) => {
  const { id } = req.params

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
