import express from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '../generated/prisma/index.js'

const prisma = new PrismaClient()
const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET

// Configurações de segurança
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_BLOCK_TIME = 5 * 60 * 1000 // 5 minutos em milissegundos
const failedLoginAttempts = new Map()

// Middleware para verificar tentativas de login
const checkLoginAttempts = (req, res, next) => {
  const ip = req.ip
  const attempts = failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 }

  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const timeRemaining = Math.ceil((attempts.lastAttempt + LOGIN_BLOCK_TIME - Date.now()) / 1000 / 60)
    if (timeRemaining > 0) {
      return res.status(429).json({ 
        message: `Muitas tentativas falhas. Tente novamente em ${timeRemaining} minutos.` 
      })
    } else {
      // Reset após o tempo de bloqueio
      failedLoginAttempts.delete(ip)
    }
  }
  next()
}

// Validador de senha forte
const isStrongPassword = (password) => {
  const strongRegex = new RegExp(
    "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{8,})"
  )
  return strongRegex.test(password)
}

// CADASTRO
router.post('/cadastro', async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Verifica força da senha
    if (!isStrongPassword(password)) {
      return res.status(400).json({ 
        message: 'A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas, números e caracteres especiais' 
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
      message: 'Usuário criado com sucesso'
    })

  } catch (err) {
    if (err.code === 'P2002') { // Erro de email único do Prisma
      return res.status(400).json({ message: 'Email já está em uso' })
    }
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

// LOGIN
router.post('/login', checkLoginAttempts, async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip; // Adicione esta linha
    if (!email || !password) {
      return res.status(400).json({ message: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.Cluster0.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {

      // Registrar tentativa falha
      const attempts = failedLoginAttempts.get(ip) || { count: 0, lastAttempt: 0 }
      failedLoginAttempts.set(ip, {
        count: attempts.count + 1,
        lastAttempt: Date.now()
      })
      
      return res.status(401).json({ 
        message: 'Credenciais inválidas',
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - (attempts.count + 1)
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
      user: { id: user.id, name: user.name, email: user.email }
    })

  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

export default router