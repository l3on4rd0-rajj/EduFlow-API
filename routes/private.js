// routes/private.js
import express from 'express'
import { PrismaClient } from '../generated/prisma/index.js'
import auth from '../middlewares/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * @swagger
 * tags:
 *   - name: Usuários
 *     description: Endpoints privados para administração e consulta de usuários.
 */

/**
 * @swagger
 * /private/listar-usuarios:
 *   get:
 *     summary: Lista usuários cadastrados (rota privada)
 *     description: Retorna a lista de usuários com id, nome e e-mail. Requer autenticação via token JWT.
 *     tags:
 *       - Usuários
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuários listados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Usuários listados com sucesso"
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserPublic'
 *       401:
 *         description: Não autorizado (token ausente ou inválido)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Token inválido ou não fornecido"
 *       500:
 *         description: Erro no servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Erro no servidor, tente novamente"
 */

router.use(auth) // protege tudo abaixo

router.get('/listar-usuarios', async (_req, res) => {
  try {
    const users = await prisma.Cluster0.findMany({
      select: { id: true, name: true, email: true }
    })
    res.status(200).json({ message: 'Usuários listados com sucesso', users })
  } catch (err) {
    console.error('[GET /private/listar-usuarios] erro:', err)
    res.status(500).json({ message: 'Erro no servidor, tente novamente' })
  }
})

export default router
