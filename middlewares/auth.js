// middlewares/auth.js
import jwt from 'jsonwebtoken'
import logger from '../utils/logger.js'

const JWT_SECRET = process.env.JWT_SECRET

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
