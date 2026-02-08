// routes/public.js
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { PrismaClient } from '../generated/prisma/index.js'
import he from 'he'
import logger from '../utils/logger.js'

const prisma = new PrismaClient()
const router = express.Router()

/**
 * @swagger
 * tags:
 *   - name: Autenticação
 *     description: Endpoints públicos de cadastro, login e recuperação de senha.
 *
 * components:
 *   schemas:
 *     AuthRegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
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

// Config SMTP Gmail:
// - SMTP_USER  = seuemail@gmail.com
// - SMTP_PASS  = senha de app gerada no Google (NÃO a senha normal)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// =============================
// Configurações de segurança
// =============================
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_BLOCK_TIME = 5 * 60 * 1000 // 5 minutos em ms
const failedLoginAttempts = new Map()

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
const sendResetPasswordEmail = async (user, token) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const resetLink = `${appUrl}/reset-password.html?token=${encodeURIComponent(
    token
  )}`

  // Proteção contra XSS no conteúdo do e-mail
  const safeName = he.encode(user.name || '')
  const safeResetLink = he.encode(resetLink)

  await transporter.sendMail({
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

// =============================
// CADASTRO
// =============================

/**
 * @swagger
 * /cadastro:
 *   post:
 *     summary: Cadastra um novo usuário do sistema
 *     description: Cria um usuário com nome, e-mail e senha forte. A senha é armazenada com hash (bcrypt).
 *     tags:
 *       - Autenticação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
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
 *         description: Erro de validação (campos obrigatórios ou senha fraca, e-mail duplicado)
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
router.post('/cadastro', async (req, res) => {
  try {
    const { name, email, password } = req.body

    logger.userAction('registro_iniciado', 'anonymous', { email })

    if (!name || !email || !password) {
      logger.warn('Cadastro: Campos obrigatórios faltando', { email })
      return res
        .status(400)
        .json({ message: 'Nome, e-mail e senha são obrigatórios' })
    }

    if (!isStrongPassword(password)) {
      logger.warn('Cadastro: Senha fraca', { email })
      return res.status(400).json({
        message:
          'A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais',
      })
    }

    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)

    const userDB = await prisma.Cluster0.create({
      data: {
        email,
        name,
        password: hashPassword,
      },
    })

    logger.success('Usuário registrado com sucesso', {
      userId: userDB.id,
      email: userDB.email,
      name: userDB.name,
    })
    logger.userAction('registro_concluido', userDB.id, { email: userDB.email })

    res.status(201).json({
      id: userDB.id,
      name: userDB.name,
      email: userDB.email,
      message: 'Usuário criado com sucesso',
    })
  } catch (err) {
    logger.error('Erro no cadastro', err, { email: req.body.email })

    if (err.code === 'P2002') {
      logger.warn('Cadastro: E-mail duplicado', { email: req.body.email })
      return res.status(400).json({ message: 'E-mail já está em uso' })
    }

    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

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

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '10m' }
    )

    logger.success('Login realizado com sucesso', {
      userId: user.id,
      email: user.email,
      ip,
    })
    logger.userAction('login_concluido', user.id, { email: user.email, ip })

    res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (err) {
    logger.error('Erro no login', err, { email: req.body.email, ip: req.ip })
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
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

    await sendResetPasswordEmail(user, token)

    logger.success('E-mail de redefinição enviado', {
      userId: user.id,
      email: user.email,
    })
    logger.userAction('esqueci_senha_email_enviado', user.id, {
      email: user.email,
    })

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
