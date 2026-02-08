// server.js
import 'dotenv/config'              // garante que o .env seja carregado
import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

import swaggerJSDoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

import publicRoutes from './routes/public.js'
import privateRoutes from './routes/private.js'
import alunoRoutes from './routes/alunos.js'
import contasRoutes from './routes/contas.js'
import auth from './middlewares/auth.js'
import { httpLoggingMiddleware, errorLoggingMiddleware } from './middlewares/logging.js'
import logger from './utils/logger.js'

const app = express()
const PORT = process.env.PORT || 3000

// ====== paths auxiliares (ESM) ======
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ====== segurança / básicos ======
app.use(helmet())
app.use(express.json({ limit: '10kb' }))
app.disable('x-powered-by')

// CORS liberado pra testes. Em produção, restrinja o origin.
app.use(cors({ origin: '*' }))

// Rate limit global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// ====== Logging de requisições HTTP ======
app.use(httpLoggingMiddleware)

// ====== arquivos estáticos (FRONT-END) ======
// Agora servindo a pasta "teste-front"
app.use(express.static(path.join(__dirname, 'teste-front')))

// uploads de alunos (fotos/documentos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// ====== Swagger (OpenAPI) ======
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RAJJ API',
      version: '1.0.0',
      description: 'Documentação da API RAJJ (alunos, contas, autenticação)',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  // Arquivos onde ficarão as anotações Swagger (JSDoc)
  apis: [path.join(__dirname, 'routes', '*.js')], // <-- mais robusto que './routes/*.js'
}

const swaggerSpec = swaggerJSDoc(swaggerOptions)

// endpoint da documentação
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// ====== Rotas públicas (sem token) ======
app.use('/', publicRoutes)

// ====== Debug para /api ======
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

// ====== Rotas de alunos (pode colocar auth aqui se quiser) ======
app.use('/api', alunoRoutes)

// ====== Rotas de contas protegidas por token ======
app.use('/api', auth, contasRoutes)

// ====== Rotas privadas (exemplo) ======
// private.js já tem router.use(auth), então aqui não precisa passar de novo.
// Se quiser deixar a proteção só aqui, é só remover o router.use(auth) de lá.
app.use('/private', privateRoutes)

// Redirecionar / para a tela de login (opcional)
// (se publicRoutes não tratar '/', isso aqui cuida)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'teste-front', 'login.html'))
})

// 404 JSON para qualquer coisa não atendida
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    method: req.method,
    path: req.originalUrl,
  })
})

// 500
app.use((err, req, res, next) => {
  errorLoggingMiddleware(err, req, res, next)
  res.status(500).json({ error: 'Algo deu errado!' })
})

app.listen(PORT, () => {
  logger.success(`Servidor online na porta ${PORT}`, { port: PORT })
})
