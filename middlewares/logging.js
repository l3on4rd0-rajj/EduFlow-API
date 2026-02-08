// middlewares/logging.js
import logger from '../utils/logger.js'

// Middleware para logar requisições HTTP
export const httpLoggingMiddleware = (req, res, next) => {
  const start = Date.now()

  // Captura o método original res.json para interceptar respostas
  const originalJson = res.json

  res.json = function (data) {
    const duration = Date.now() - start
    const userId = req.user?.id || 'anonymous'
    const statusCode = res.statusCode

    // Prepara detalhes da requisição (sem dados sensíveis)
    const details = {
      params: Object.keys(req.params).length > 0 ? req.params : undefined,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
    }

    // Log de requisição HTTP
    logger.http(req.method, req.path, statusCode, duration, userId, details)

    // Chama o json original
    return originalJson.call(this, data)
  }

  next()
}

// Middleware para logar erros
export const errorLoggingMiddleware = (err, req, res, next) => {
  const userId = req.user?.id || 'anonymous'

  logger.error(
    `[${req.method} ${req.path}] ${err.message}`,
    err,
    {
      userId,
      path: req.path,
      method: req.method,
      ip: req.ip,
    }
  )

  // Passa para o próximo middleware de erro
  next(err)
}

export default httpLoggingMiddleware
