// server.js
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

import publicRoutes from './routes/public.js'
import privateRoutes from './routes/private.js'
import alunoRoutes from './routes/alunos.js'
import contasRoutes from './routes/contas.js'
import auth from './middlewares/auth.js'

const app = express()

// ====== paths auxiliares (ESM) ======
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ====== segurança / básicos ======
app.use(helmet())
app.use(express.json({ limit: '10kb' }))
app.disable('x-powered-by')
app.use(cors({ origin: '*' }))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// ====== arquivos estáticos ======
// front-end (ajuste se seu HTML estiver em outra pasta)
app.use(express.static(path.join(__dirname, 'public')))

// uploads de alunos (fotos/documentos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ---------- Rotas públicas (sem token) ----------
app.use('/', publicRoutes)

// ---------- Debug para /api ----------
app.use('/api', (req, _res, next) => {
  console.log(
    '[API hit]',
    req.method,
    req.originalUrl,
    'Auth:',
    req.headers.authorization || '---'
  )
  next()
})

// ---------- Rotas de alunos (pode colocar auth aqui se quiser) ----------
app.use('/api', alunoRoutes)

// ---------- Rotas de contas protegidas por token ----------
app.use('/api', auth, contasRoutes)

// ---------- Rotas privadas (exemplo) ----------
app.use('/private', auth, privateRoutes)

// 404 JSON
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    method: req.method,
    path: req.originalUrl
  })
})

// 500
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Algo deu errado!' })
})

app.listen(3000, () => {
  console.info('Servidor online na porta 3000', { timestamp: new Date().toISOString() })
})
