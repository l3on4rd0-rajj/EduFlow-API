// routes/public.js
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import he from 'he'
import logger from '../utils/logger.js'
import prisma from '../utils/prisma.js'
import mailer from '../utils/mailer.js'

const router = express.Router()

/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *     description: Endpoints públicos de cadastro, login e recuperação de senha.
 *
 * components:
 *   schemas:
 *     UserAddress:
 *       type: object
 *       properties:
 *         cep:
 *           type: string
 *           example: "01001000"
 *         rua:
 *           type: string
 *           example: "Praca da Se"
 *         bairro:
 *           type: string
 *           example: "Se"
 *         numero:
 *           type: string
 *           example: "100"
 *         cidade:
 *           type: string
 *           example: "Sao Paulo"
 *         estado:
 *           type: string
 *           example: "SP"
 *
 *     AuthRegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - cpf
 *         - endereco
 *         - telefones
 *         - password
 *         - confirmPassword
 *       properties:
 *         name:
 *           type: string
 *           example: "João da Silva"
 *         email:
 *           type: string
 *           format: email
 *           example: "joao@mail.com"
 *         password:
 *           type: string
 *           example: "SenhaForte@123"
 *         confirmPassword:
 *           type: string
 *           example: "SenhaForte@123"
 *         cpf:
 *           type: string
 *           example: "52998224725"
 *         endereco:
 *           $ref: '#/components/schemas/UserAddress'
 *         telefones:
 *           type: array
 *           items:
 *             type: string
 *           example: ["11999998888", "1133334444"]
 *         foto:
 *           type: string
 *           format: binary
 *         documentos:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *
 *     AuthRegisterResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "6852095bbd7ede2a0a6c3337"
 *         name:
 *           type: string
 *           example: "João da Silva"
 *         email:
 *           type: string
 *           example: "joao@mail.com"
 *         cpf:
 *           type: string
 *           example: "52998224725"
 *         endereco:
 *           $ref: '#/components/schemas/UserAddress'
 *         telefones:
 *           type: array
 *           items:
 *             type: string
 *           example: ["11999998888", "1133334444"]
 *         fotoPath:
 *           type: string
 *           nullable: true
 *           example: "/uploads/usuarios/foto-123.png"
 *         documentos:
 *           type: array
 *           items:
 *             type: string
 *           example: ["/uploads/usuarios/documentos-1.pdf"]
 *         status:
 *           type: string
 *           example: "ATIVO"
 *         message:
 *           type: string
 *           example: "Usuário criado com sucesso"
 *
 *     AuthLoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "thomas@mail.com"
 *         password:
 *           type: string
 *           example: "SenhaForte@123"
 *
 *     UserPublic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "6852095bbd7ede2a0a6c3337"
 *         name:
 *           type: string
 *           example: "Thomas Anderson"
 *         email:
 *           type: string
 *           example: "thomas@mail.com"
 *         status:
 *           type: string
 *           example: "ATIVO"
 *
 *     AuthLoginResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Login realizado com sucesso"
 *         token:
 *           type: string
 *           description: JWT para autenticação (expira em 10 minutos)
 *         user:
 *           $ref: '#/components/schemas/UserPublic'
 *
 *     ForgotPasswordRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "usuario@mail.com"
 *
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - password
 *       properties:
 *         token:
 *           type: string
 *           description: Token de redefinição enviado por e-mail
 *         password:
 *           type: string
 *           example: "NovaSenhaForte@123"
 *
 *     MessageResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: "Mensagem de retorno da API"
 */

// Segredos
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET não definido no .env')
}

const RESET_PASSWORD_SECRET =
  process.env.RESET_PASSWORD_SECRET || `${JWT_SECRET || 'fallback'}_RESET`
const MFA_CHALLENGE_SECRET =
  process.env.MFA_CHALLENGE_SECRET || `${JWT_SECRET || 'fallback'}_MFA`

// Config SMTP Gmail:
// - SMTP_USER  = seuemail@gmail.com
// - SMTP_PASS  = senha de app gerada no Google (NÃO a senha normal)

// =============================
// Configurações de segurança
// =============================
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_BLOCK_TIME = 5 * 60 * 1000 // 5 minutos em ms
const MFA_CODE_TTL_MINUTES = Number(process.env.MFA_CODE_TTL_MINUTES || 10)
const MFA_CODE_LENGTH = Number(process.env.MFA_CODE_LENGTH || 6)
const failedLoginAttempts = new Map()
const CEP_RE = /^\d{8}$/
const BRAZIL_PHONE_RE = /^(?:[1-9][0-9])(?:9\d{8}|\d{8})$/

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

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i), 10) * (12 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.substring(10, 11), 10)) return false

  return true
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

const USER_UPLOAD_DIR = path.resolve('uploads', 'usuarios')
fs.mkdirSync(USER_UPLOAD_DIR, { recursive: true })

const userStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, USER_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname) || ''
    cb(null, `${file.fieldname}-${unique}${ext}`)
  },
})

const uploadCadastro = multer({
  storage: userStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 11,
  },
})

// Middleware para verificar tentativas de login por IP
const checkLoginAttempts = (req, res, next) => {
  const ip = req.ip
  const attempts = failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeRemainingMs = attempts.lastAttempt + LOGIN_BLOCK_TIME - Date.now()
    const timeRemainingMinutes = Math.ceil(timeRemainingMs / 1000 / 60)

    if (timeRemainingMs > 0) {
      return res.status(429).json({
        message: `Muitas tentativas falhas. Tente novamente em ${timeRemainingMinutes} minutos.`,
      })
    } else {
      // Tempo de bloqueio expirou, reseta contador
      failedLoginAttempts.delete(ip)
    }
  }
  next()
}

// Validador de senha forte
const isStrongPassword = (password) => {
  const strongRegex = new RegExp(
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})'
  )
  return strongRegex.test(password)
}

// Função auxiliar para envio de e-mail de redefinição
const generateMfaCode = () => {
  const min = 10 ** Math.max(MFA_CODE_LENGTH - 1, 0)
  const max = 10 ** MFA_CODE_LENGTH
  return String(crypto.randomInt(min, max)).padStart(MFA_CODE_LENGTH, '0')
}

const issueAuthToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '10m' })

const issueMfaChallengeToken = (user, codeHash) =>
  jwt.sign(
    { id: user.id, email: user.email, type: 'mfa', codeHash },
    MFA_CHALLENGE_SECRET,
    { expiresIn: `${MFA_CODE_TTL_MINUTES}m` }
  )

const isMfaEnabled = () => process.env.MFA_ENABLED === 'true'

const sendResetPasswordEmail = async (user, token) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetLink = `${appUrl}/reset-password.html?token=${encodeURIComponent(
    token
  )}`

  // Proteção contra XSS no conteúdo do e-mail
  const safeName = he.encode(user.name || '')
  const safeResetLink = he.encode(resetLink)

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Redefinição de senha - RAJJ',
    html: `
      <p>Olá, ${safeName}!</p>
      <p>Recebemos uma solicitação para redefinir a sua senha.</p>
      <p>Clique no link abaixo para criar uma nova senha (válido por 15 minutos):</p>
      <p><a href="${safeResetLink}">${safeResetLink}</a></p>
      <p>Se você não fez essa solicitação, ignore este e-mail.</p>
    `,
  })
}

const sendMfaCodeEmail = async (user, code) => {
  const safeName = he.encode(user.name || '')
  const safeCode = he.encode(code)

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Seu codigo MFA - RAJJ',
    html: `
      <p>OlÃ¡, ${safeName}!</p>
      <p>Seu cÃ³digo de verificaÃ§Ã£o Ã©:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${safeCode}</p>
      <p>Ele expira em ${MFA_CODE_TTL_MINUTES} minutos.</p>
      <p>Se vocÃª nÃ£o tentou entrar agora, troque sua senha.</p>
    `,
  })
}

// =============================
// CADASTRO
// =============================

/**
 * @swagger
 * /cadastro:
 *   post:
 *     summary: Cadastra um novo usuário do sistema
 *     description: Cria um usuario com CPF, endereco, telefones, anexos opcionais e senha inicial com confirmacao.
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AuthRegisterRequest'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthRegisterResponse'
 *       400:
 *         description: Erro de validacao (campos obrigatorios, CPF, telefones, senha ou duplicidade)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       500:
 *         description: Erro no servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 */
router.post(
  '/cadastro',
  uploadCadastro.fields([
    { name: 'foto', maxCount: 1 },
    { name: 'documentos', maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        confirmPassword,
        cpf,
        endereco,
        telefones,
      } = req.body

      logger.userAction('registro_iniciado', 'anonymous', { email })

      if (!name || !email || !password || !confirmPassword || !cpf || !endereco) {
        logger.warn('Cadastro: Campos obrigatorios faltando', { email })
        return res.status(400).json({
          message:
            'Nome, e-mail, CPF, endereco, senha e confirmacao de senha sao obrigatorios',
        })
      }

      if (password !== confirmPassword) {
        logger.warn('Cadastro: Confirmacao de senha divergente', { email })
        return res.status(400).json({ message: 'As senhas informadas nao coincidem' })
      }

      if (!isStrongPassword(password)) {
        logger.warn('Cadastro: Senha fraca', { email })
        return res.status(400).json({
          message:
            'A senha deve conter pelo menos 8 caracteres, incluindo maiusculas, minusculas, numeros e caracteres especiais',
        })
      }

      if (!validarCPF(cpf)) {
        logger.warn('Cadastro: CPF invalido', { email })
        return res.status(400).json({ message: 'CPF invalido' })
      }

      const telefonesNormalizados = parseArrayField(telefones)
        .map((telefone) => normalizarTelefoneBR(telefone))
        .filter(Boolean)

      if (telefonesNormalizados.length === 0) {
        logger.warn('Cadastro: Nenhum telefone valido informado', { email })
        return res.status(400).json({
          message: 'Informe ao menos um telefone brasileiro valido com DDD',
        })
      }

      const enderecoNormalizado = normalizarEndereco(endereco)
      if (enderecoNormalizado.error) {
        logger.warn('Cadastro: Endereco invalido', {
          email,
          detalhe: enderecoNormalizado.error,
        })
        return res.status(400).json({ message: enderecoNormalizado.error })
      }

      const cpfNormalizado = String(cpf).replace(/\D/g, '')
      const usuarioComCpf = await prisma.Cluster0.findFirst({
        where: { cpf: cpfNormalizado },
        select: { id: true },
      })

      if (usuarioComCpf) {
        logger.warn('Cadastro: CPF duplicado', { cpf: cpfNormalizado })
        return res.status(400).json({ message: 'CPF ja esta em uso' })
      }

      const salt = await bcrypt.genSalt(10)
      const hashPassword = await bcrypt.hash(password, salt)

      const fotoFile = req.files?.foto?.[0]
      const documentosFiles = req.files?.documentos || []
      const fotoPath = fotoFile ? `/uploads/usuarios/${fotoFile.filename}` : null
      const documentosPaths = documentosFiles.map(
        (file) => `/uploads/usuarios/${file.filename}`
      )

      const userDB = await prisma.Cluster0.create({
        data: {
          email: String(email).trim().toLowerCase(),
          name: String(name).trim(),
          password: hashPassword,
          cpf: cpfNormalizado,
          endereco: enderecoNormalizado.value,
          telefones: telefonesNormalizados,
          fotoPath,
          documentos: documentosPaths,
          status: 'ATIVO',
        },
      })

      logger.success('Usuario registrado com sucesso', {
        userId: userDB.id,
        email: userDB.email,
        name: userDB.name,
      })
      logger.userAction('registro_concluido', userDB.id, { email: userDB.email })

      res.status(201).json({
        id: userDB.id,
        name: userDB.name,
        email: userDB.email,
        cpf: userDB.cpf,
        endereco: userDB.endereco,
        telefones: userDB.telefones,
        fotoPath: userDB.fotoPath,
        documentos: userDB.documentos,
        status: userDB.status,
        message: 'Usuario criado com sucesso',
      })
    } catch (err) {
      logger.error('Erro no cadastro', err, { email: req.body.email })

      if (err.code === 'P2002') {
        logger.warn('Cadastro: E-mail duplicado', { email: req.body.email })
        return res.status(400).json({ message: 'E-mail ja esta em uso' })
      }

      res.status(500).json({ message: 'Erro no servidor, tente novamente' })
    }
  }
)

// =============================
// LOGIN
// =============================

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Realiza login e retorna um token JWT
 *     description: Valida e-mail e senha, aplica limite de tentativas por IP e retorna um JWT com expiração de 10 minutos.
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthLoginRequest'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthLoginResponse'
 *       400:
 *         description: Faltando e-mail ou senha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       429:
 *         description: Muitas tentativas de login para o mesmo IP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       500:
 *         description: Erro no servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 */
router.post('/login', checkLoginAttempts, async (req, res) => {
  try {
    const { email, password } = req.body
    const ip = req.ip

    logger.userAction('login_iniciado', 'anonymous', { email, ip })

    if (!email || !password) {
      logger.warn('Login: Campos obrigatórios faltando', { email, ip })
      return res
        .status(400)
        .json({ message: 'E-mail e senha são obrigatórios' })
    }

    const user = await prisma.Cluster0.findUnique({
      where: { email },
    })

    if (!user) {
      logger.warn('Login: Usuário não encontrado', { email, ip })
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    if (user.status && user.status !== 'ATIVO') {
      logger.warn('Login: Usuario inativo', { email, ip, userId: user.id })
      return res.status(403).json({ message: 'Cadastro inativo. Procure um administrador.' })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      const attempts = failedLoginAttempts.get(ip) || {
        count: 0,
        lastAttempt: 0,
      }

      failedLoginAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now(),
      })

      logger.warn('Login: Senha inválida', {
        email,
        ip,
        tentativasRestantes: MAX_LOGIN_ATTEMPTS - (attempts.count + 1),
      })

      return res.status(401).json({
        message: 'Credenciais inválidas',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - (attempts.count + 1),
      })
    }

    // Resetar contador após login bem-sucedido
    failedLoginAttempts.delete(ip)

    if (isMfaEnabled()) {
      const code = generateMfaCode()
      const salt = await bcrypt.genSalt(10)
      const codeHash = await bcrypt.hash(code, salt)

      try {
        await sendMfaCodeEmail(user, code)
      } catch (mailError) {
        logger.error('Falha ao enviar cÃ³digo MFA', mailError, {
          userId: user.id,
          email: user.email,
          ip,
        })

        return res.status(503).json({
          message: 'NÃ£o foi possÃ­vel enviar o cÃ³digo MFA. Tente novamente.',
        })
      }

      const challengeToken = issueMfaChallengeToken(user, codeHash)

      logger.userAction('mfa_challenge_emitido', user.id, { email: user.email, ip })

      return res.status(202).json({
        message: 'CÃ³digo de verificaÃ§Ã£o enviado para o e-mail.',
        requiresMfa: true,
        challengeToken,
        expiresInMinutes: MFA_CODE_TTL_MINUTES,
      })
    }

    const token = issueAuthToken(user)

    logger.success('Login realizado com sucesso', {
      userId: user.id,
      email: user.email,
      ip,
    })
    logger.userAction('login_concluido', user.id, { email: user.email, ip })

    res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, name: user.name, email: user.email, status: user.status },
    })
  } catch (err) {
    logger.error('Erro no login', err, { email: req.body.email, ip: req.ip })
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

router.post('/login/mfa/verify', async (req, res) => {
  try {
    const { challengeToken, code } = req.body

    if (!challengeToken || !code) {
      return res
        .status(400)
        .json({ message: 'Token do desafio MFA e cÃ³digo sÃ£o obrigatÃ³rios' })
    }

    let payload
    try {
      payload = jwt.verify(challengeToken, MFA_CHALLENGE_SECRET)
    } catch (err) {
      logger.warn('MFA verify: challenge invÃ¡lido ou expirado', {
        error: err.message,
      })
      return res.status(400).json({ message: 'Desafio MFA invÃ¡lido ou expirado' })
    }

    if (!payload || payload.type !== 'mfa' || !payload.codeHash) {
      return res.status(400).json({ message: 'Desafio MFA invÃ¡lido' })
    }

    const user = await prisma.Cluster0.findUnique({
      where: { id: payload.id },
    })

    if (!user) {
      return res.status(400).json({ message: 'UsuÃ¡rio do desafio MFA nÃ£o encontrado' })
    }

    if (user.status && user.status !== 'ATIVO') {
      return res.status(403).json({ message: 'Cadastro inativo. Procure um administrador.' })
    }

    const isCodeValid = await bcrypt.compare(String(code), payload.codeHash)

    if (!isCodeValid) {
      return res.status(401).json({
        message: 'CÃ³digo MFA invÃ¡lido',
      })
    }

    const token = issueAuthToken(user)

    logger.success('MFA validado com sucesso', {
      userId: user.id,
      email: user.email,
    })

    return res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, name: user.name, email: user.email, status: user.status },
    })
  } catch (err) {
    logger.error('Erro na verificaÃ§Ã£o de MFA', err)
    return res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

// =============================
// ESQUECI MINHA SENHA
// =============================

/**
 * @swagger
 * /esqueci-senha:
 *   post:
 *     summary: Solicita redefinição de senha
 *     description: Envia um e-mail com link para redefinição de senha, se o e-mail existir na base. A resposta é sempre genérica para não vazar se o usuário existe.
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Pedido de redefinição processado (sempre mensagem genérica)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: E-mail não enviado no corpo da requisição
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       500:
 *         description: Erro ao processar o pedido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 */
router.post('/esqueci-senha', async (req, res) => {
  try {
    const { email } = req.body

    logger.userAction('esqueci_senha_iniciado', 'anonymous', { email })

    if (!email) {
      logger.warn('Esqueci-senha: E-mail não fornecido')
      return res.status(400).json({ message: 'E-mail é obrigatório' })
    }

    const user = await prisma.Cluster0.findUnique({
      where: { email },
    })

    // Para não vazar se o e-mail existe ou não
    if (!user) {
      logger.info('Esqueci-senha: E-mail não encontrado', { email })
      return res.status(200).json({
        message:
          'Se o e-mail existir em nossa base, enviaremos um link de redefinição.',
      })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'reset' },
      RESET_PASSWORD_SECRET,
      { expiresIn: '15m' }
    )

    try {
      await sendResetPasswordEmail(user, token)

      logger.success('E-mail de redefinição enviado', {
        userId: user.id,
        email: user.email,
      })
      logger.userAction('esqueci_senha_email_enviado', user.id, {
        email: user.email,
      })
    } catch (mailError) {
      logger.error('Falha ao enviar e-mail de redefinição', mailError, {
        userId: user.id,
        email: user.email,
      })
    }

    return res.status(200).json({
      message:
        'Se o e-mail existir em nossa base, enviaremos um link de redefinição.',
    })
  } catch (err) {
    logger.error('Erro em /esqueci-senha', err, { email: req.body.email })
    return res
      .status(500)
      .json({ message: 'Erro ao processar pedido de redefinição.' })
  }
})

// =============================
// REDEFINIR SENHA (API)
// =============================

/**
 * @swagger
 * /reset-password:
 *   post:
 *     summary: Redefine a senha de um usuário
 *     description: Recebe o token de redefinição (enviado por e-mail) e a nova senha. Valida o token, aplica validação de senha forte e atualiza a senha do usuário.
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       400:
 *         description: Token inválido/expirado ou senha fraca/ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *       500:
 *         description: Erro ao redefinir senha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    logger.userAction('reset_password_iniciado', 'anonymous')

    if (!token || !password) {
      logger.warn('Reset-password: Token ou senha não fornecidos')
      return res
        .status(400)
        .json({ message: 'Token e nova senha são obrigatórios' })
    }

    if (!isStrongPassword(password)) {
      logger.warn('Reset-password: Senha fraca fornecida')
      return res.status(400).json({
        message:
          'A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais',
      })
    }

    let payload
    try {
      payload = jwt.verify(token, RESET_PASSWORD_SECRET)
    } catch (err) {
      logger.warn('Reset-password: Token inválido ou expirado', { error: err.message })
      return res.status(400).json({ message: 'Token inválido ou expirado' })
    }

    if (!payload || payload.type !== 'reset') {
      logger.warn('Reset-password: Payload inválido')
      return res.status(400).json({ message: 'Token inválido' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)

    await prisma.Cluster0.update({
      where: { id: payload.id },
      data: { password: hashPassword },
    })

    logger.success('Senha redefinida com sucesso', { userId: payload.id })
    logger.userAction('reset_password_concluido', payload.id, {
      email: payload.email,
    })

    return res
      .status(200)
      .json({ message: 'Senha redefinida com sucesso. Faça login novamente.' })
  } catch (err) {
    logger.error('Erro em /reset-password', err)
    return res.status(500).json({ message: 'Erro ao redefinir senha.' })
  }
})

export default router
