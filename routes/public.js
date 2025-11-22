// routes/public.js
import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import { PrismaClient } from '../generated/prisma/index.js'
import he from 'he'

const prisma = new PrismaClient()
const router = express.Router()

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
router.post('/cadastro', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Nome, e-mail e senha são obrigatórios' })
    }

    if (!isStrongPassword(password)) {
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

    res.status(201).json({
      id: userDB.id,
      name: userDB.name,
      email: userDB.email,
      message: 'Usuário criado com sucesso',
    })
  } catch (err) {
    console.error('Erro no cadastro:', err)

    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'E-mail já está em uso' })
    }

    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

// =============================
// LOGIN
// =============================
router.post('/login', checkLoginAttempts, async (req, res) => {
  try {
    const { email, password } = req.body
    const ip = req.ip

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'E-mail e senha são obrigatórios' })
    }

    const user = await prisma.Cluster0.findUnique({
      where: { email },
    })

    if (!user) {
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

    res.status(200).json({
      message: 'Login realizado com sucesso',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    })
  } catch (err) {
    console.error('Erro no login:', err)
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

// =============================
// ESQUECI MINHA SENHA
// =============================
router.post('/esqueci-senha', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'E-mail é obrigatório' })
    }

    const user = await prisma.Cluster0.findUnique({
      where: { email },
    })

    // Para não vazar se o e-mail existe ou não
    if (!user) {
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

    return res.status(200).json({
      message:
        'Se o e-mail existir em nossa base, enviaremos um link de redefinição.',
    })
  } catch (err) {
    console.error('Erro em /esqueci-senha:', err)
    return res
      .status(500)
      .json({ message: 'Erro ao processar pedido de redefinição.' })
  }
})

// =============================
// REDEFINIR SENHA (API)
// =============================
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: 'Token e nova senha são obrigatórios' })
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          'A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais',
      })
    }

    let payload
    try {
      payload = jwt.verify(token, RESET_PASSWORD_SECRET)
    } catch (err) {
      console.error('Erro ao verificar token de reset:', err)
      return res.status(400).json({ message: 'Token inválido ou expirado' })
    }

    if (!payload || payload.type !== 'reset') {
      return res.status(400).json({ message: 'Token inválido' })
    }

    const salt = await bcrypt.genSalt(10)
    const hashPassword = await bcrypt.hash(password, salt)

    await prisma.Cluster0.update({
      where: { id: payload.id },
      data: { password: hashPassword },
    })

    return res
      .status(200)
      .json({ message: 'Senha redefinida com sucesso. Faça login novamente.' })
  } catch (err) {
    console.error('Erro em /reset-password:', err)
    return res.status(500).json({ message: 'Erro ao redefinir senha.' })
  }
})

export default router
