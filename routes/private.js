// routes/private.js
import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'
import auth from '../middlewares/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(auth) // protege tudo abaixo se montar sem auth no server

router.get('/listar-usuarios', async (req, res) => {
  try {
    const users = await prisma.Cluster0.findMany({
      select: { id: true, name: true, email: true }
    })
    res.status(200).json({ message: 'Usuários listados com sucesso', users })
  } catch (err) {
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

export default router
