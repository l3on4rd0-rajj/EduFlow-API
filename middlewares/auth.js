// middlewares/auth.js
import jwt from 'jsonwebtoken'
import logger from '../utils/logger.js'

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-jwt-secret')

export const isAdminUser = (user = {}) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return (
    user.role === 'ADMIN' ||
    user.isAdmin === true ||
    (user.email && adminEmails.includes(String(user.email).toLowerCase()))
  )
}

export const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    logger.auth('admin_authorization', req.user?.email || 'unknown', 'failure', {
      path: req.path,
      method: req.method,
    })
    return res.status(403).json({ message: 'Acesso administrativo requerido' })
  }

  return next()
}

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.auth('token_verification', 'unknown', 'failure', {
      reason: 'No token provided or invalid format',
      path: req.path,
      method: req.method,
    })
    return res.status(401).json({ message: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    if (!JWT_SECRET) {
      logger.error('JWT_SECRET nao configurado para verificacao de token')
      return res.status(500).json({ message: 'Configuracao de autenticacao invalida' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded // você pode usar req.user nos controllers
    logger.auth('token_verification', decoded.email, 'success', {
      path: req.path,
      method: req.method,
    })
    next()
  } catch (err) {
    logger.auth('token_verification', 'unknown', 'failure', {
      reason: err.message,
      path: req.path,
      method: req.method,
    })
    return res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}

export default auth
