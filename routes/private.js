// routes/private.js
import express from 'express'
import auth from '../middlewares/auth.js'
import prisma from '../utils/prisma.js'

const router = express.Router()
const CEP_RE = /^\d{8}$/
const BRAZIL_PHONE_RE = /^(?:[1-9][0-9])(?:9\d{8}|\d{8})$/
const STATUS_VALUES = ['ATIVO', 'INATIVO']

const parseArrayField = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch (_) {}
  return [value]
}

const parseObjectField = (value) => {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed
    }
  } catch (_) {}
  return null
}

const validarCPF = (rawCpf) => {
  const cpf = String(rawCpf || '').replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let soma = 0
  let resto = 0

  for (let i = 1; i <= 9; i += 1) {
    soma += Number.parseInt(cpf.substring(i - 1, i), 10) * (11 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== Number.parseInt(cpf.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i += 1) {
    soma += Number.parseInt(cpf.substring(i - 1, i), 10) * (12 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === Number.parseInt(cpf.substring(10, 11), 10)
}

const normalizarTelefoneBR = (value) => {
  const digits = String(value || '').replace(/\D/g, '')
  if (!BRAZIL_PHONE_RE.test(digits)) return null
  return digits
}

const normalizarEndereco = (value) => {
  const endereco = parseObjectField(value)
  if (!endereco) return { error: 'Endereco invalido' }

  const cep = String(endereco.cep || '').replace(/\D/g, '')
  const rua = String(endereco.rua || '').trim()
  const bairro = String(endereco.bairro || '').trim()
  const numero = String(endereco.numero || '').trim()
  const cidade = String(endereco.cidade || '').trim()
  const estado = String(endereco.estado || '').trim().toUpperCase()

  if (!CEP_RE.test(cep)) return { error: 'CEP deve conter 8 digitos' }
  if (![rua, bairro, numero, cidade, estado].every(Boolean)) {
    return { error: 'Todos os campos do endereco sao obrigatorios' }
  }

  return {
    value: {
      cep,
      rua,
      bairro,
      numero,
      cidade,
      estado,
    },
  }
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  cpf: true,
  endereco: true,
  telefones: true,
  fotoPath: true,
  documentos: true,
  status: true,
  criadoEm: true,
}

/**
 * @swagger
 * tags:
 *   - name: Usuários
 *     description: Endpoints privados para administração e consulta de usuários.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PrivateUserAddress:
 *       type: object
 *       nullable: true
 *       properties:
 *         cep:
 *           type: string
 *           nullable: true
 *         rua:
 *           type: string
 *           nullable: true
 *         bairro:
 *           type: string
 *           nullable: true
 *         numero:
 *           type: string
 *           nullable: true
 *         cidade:
 *           type: string
 *           nullable: true
 *         estado:
 *           type: string
 *           nullable: true
 *     PrivateUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         cpf:
 *           type: string
 *           nullable: true
 *         endereco:
 *           $ref: '#/components/schemas/PrivateUserAddress'
 *         telefones:
 *           type: array
 *           items:
 *             type: string
 *         fotoPath:
 *           type: string
 *           nullable: true
 *         documentos:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *         criadoEm:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     PrivateUserUpdateRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         cpf:
 *           type: string
 *         endereco:
 *           $ref: '#/components/schemas/PrivateUserAddress'
 *         telefones:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [ATIVO, INATIVO]
 *     PrivateUsersListResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PrivateUser'
 *     PrivateUserResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         user:
 *           $ref: '#/components/schemas/PrivateUser'
 */
router.use(auth)

/**
 * @swagger
 * /private/listar-usuarios:
 *   get:
 *     summary: Lista usuarios cadastrados
 *     tags:
 *       - Usuários
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuarios listados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PrivateUsersListResponse'
 *       401:
 *         description: Token ausente, invalido ou expirado
 *       500:
 *         description: Erro no servidor
 */
router.get('/listar-usuarios', async (_req, res) => {
  try {
    const usersRaw = await prisma.Cluster0.findMany({
      select: userSelect,
      orderBy: { criadoEm: 'desc' },
    })
    const users = usersRaw.map((user) => ({
      ...user,
      cpf: user.cpf || null,
      status: user.status || 'ATIVO',
      telefones: Array.isArray(user.telefones) ? user.telefones : [],
      documentos: Array.isArray(user.documentos) ? user.documentos : [],
      endereco: user.endereco || null,
      criadoEm: user.criadoEm || null,
    }))
    res.status(200).json({ message: 'Usuários listados com sucesso', users })
  } catch (err) {
    console.error('[GET /private/listar-usuarios] erro:', err)
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

/**
 * @swagger
 * /private/usuarios/{id}:
 *   patch:
 *     summary: Atualiza dados de um usuario
 *     tags:
 *       - Usuários
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PrivateUserUpdateRequest'
 *     responses:
 *       200:
 *         description: Usuario atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PrivateUserResponse'
 *       400:
 *         description: Dados invalidos
 *       401:
 *         description: Token ausente, invalido ou expirado
 *       404:
 *         description: Usuario nao encontrado
 *       500:
 *         description: Erro no servidor
 */
router.patch('/usuarios/:id', async (req, res) => {
  const { id } = req.params

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ message: 'ID invalido' })
  }

  try {
    const data = {}

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) return res.status(400).json({ message: 'Nome e obrigatorio' })
      data.name = name
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase()
      if (!email) return res.status(400).json({ message: 'E-mail e obrigatorio' })
      data.email = email
    }

    if (req.body.cpf !== undefined) {
      if (!validarCPF(req.body.cpf)) {
        return res.status(400).json({ message: 'CPF invalido' })
      }

      const cpfNormalizado = String(req.body.cpf).replace(/\D/g, '')
      const usuarioComCpf = await prisma.Cluster0.findFirst({
        where: { cpf: cpfNormalizado },
        select: { id: true },
      })

      if (usuarioComCpf && usuarioComCpf.id !== id) {
        return res.status(400).json({ message: 'CPF ja esta em uso' })
      }

      data.cpf = cpfNormalizado
    }

    if (req.body.telefones !== undefined) {
      const telefones = parseArrayField(req.body.telefones)
        .map((telefone) => normalizarTelefoneBR(telefone))
        .filter(Boolean)

      if (telefones.length === 0) {
        return res.status(400).json({
          message: 'Informe ao menos um telefone brasileiro valido com DDD',
        })
      }

      data.telefones = telefones
    }

    if (req.body.endereco !== undefined) {
      const enderecoNormalizado = normalizarEndereco(req.body.endereco)
      if (enderecoNormalizado.error) {
        return res.status(400).json({ message: enderecoNormalizado.error })
      }
      data.endereco = enderecoNormalizado.value
    }

    if (req.body.status !== undefined) {
      const status = String(req.body.status).trim().toUpperCase()
      if (!STATUS_VALUES.includes(status)) {
        return res.status(400).json({ message: 'Status invalido' })
      }
      data.status = status
    }

    const updatedUser = await prisma.Cluster0.update({
      where: { id },
      data,
      select: userSelect,
    })

    return res.status(200).json({
      message: 'Usuario atualizado com sucesso',
      user: updatedUser,
    })
  } catch (err) {
    console.error('[PATCH /private/usuarios/:id] erro:', err)

    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Usuario nao encontrado' })
    }

    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'E-mail ja esta em uso' })
    }

    return res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

/**
 * @swagger
 * /private/usuarios/{id}/inativar:
 *   patch:
 *     summary: Inativa um cadastro de usuario
 *     tags:
 *       - Usuários
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuario
 *     responses:
 *       200:
 *         description: Usuario inativado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PrivateUserResponse'
 *       400:
 *         description: ID invalido
 *       401:
 *         description: Token ausente, invalido ou expirado
 *       404:
 *         description: Usuario nao encontrado
 *       500:
 *         description: Erro no servidor
 */
router.patch('/usuarios/:id/inativar', async (req, res) => {
  const { id } = req.params

  if (!/^[a-fA-F0-9]{24}$/.test(id)) {
    return res.status(400).json({ message: 'ID invalido' })
  }

  try {
    const user = await prisma.Cluster0.update({
      where: { id },
      data: { status: 'INATIVO' },
      select: userSelect,
    })

    return res.status(200).json({
      message: 'Usuario inativado com sucesso',
      user,
    })
  } catch (err) {
    console.error('[PATCH /private/usuarios/:id/inativar] erro:', err)

    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Usuario nao encontrado' })
    }

    return res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

export default router
