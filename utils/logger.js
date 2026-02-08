// utils/logger.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Criar diretório de logs se não existir
const logsDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Cores para console (apenas para desenvolvimento)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}

// Níveis de log
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  SUCCESS: 'SUCCESS',
}

// Função auxiliar para formatar data
function getFormattedDate() {
  return new Date().toISOString()
}

// Função para obter nome do arquivo de log do dia
function getLogFileName(type = 'general') {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return path.join(logsDir, `${type}-${date}.log`)
}

// Função para escrever no arquivo de log
function writeToFile(message, type = 'general') {
  const logFile = getLogFileName(type)
  fs.appendFileSync(logFile, message + '\n', 'utf8')
}

// Função auxiliar para sanitizar dados sensíveis
function sanitizeSensitiveData(data) {
  if (!data) return data

  const sensitiveKeys = [
    'password',
    'token',
    'authorization',
    'secret',
    'api_key',
    'creditCard',
    'cpf',
    'phone',
  ]

  if (typeof data === 'object') {
    const sanitized = { ...data }
    Object.keys(sanitized).forEach((key) => {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '***REDACTED***'
      }
    })
    return sanitized
  }

  return data
}

// Logger main
const logger = {
  // Log de erro
  error: (message, error = null, context = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedContext = sanitizeSensitiveData(context)
    const errorDetails = error
      ? `\n  Stack: ${error.stack}`
      : ''
    const logMessage = `[${timestamp}] [ERROR] ${message} ${
      Object.keys(sanitizedContext).length > 0
        ? '\n  Context: ' + JSON.stringify(sanitizedContext)
        : ''
    }${errorDetails}`

    console.error(`${colors.red}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'errors')
  },

  // Log de aviso
  warn: (message, context = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedContext = sanitizeSensitiveData(context)
    const logMessage = `[${timestamp}] [WARN] ${message} ${
      Object.keys(sanitizedContext).length > 0
        ? '\n  Context: ' + JSON.stringify(sanitizedContext)
        : ''
    }`

    console.warn(`${colors.yellow}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'warnings')
  },

  // Log de informação
  info: (message, context = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedContext = sanitizeSensitiveData(context)
    const logMessage = `[${timestamp}] [INFO] ${message} ${
      Object.keys(sanitizedContext).length > 0
        ? '\n  Context: ' + JSON.stringify(sanitizedContext)
        : ''
    }`

    console.log(`${colors.blue}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'general')
  },

  // Log de sucesso
  success: (message, context = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedContext = sanitizeSensitiveData(context)
    const logMessage = `[${timestamp}] [SUCCESS] ${message} ${
      Object.keys(sanitizedContext).length > 0
        ? '\n  Context: ' + JSON.stringify(sanitizedContext)
        : ''
    }`

    console.log(`${colors.green}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'general')
  },

  // Log de debug
  debug: (message, data = null, context = {}) => {
    if (process.env.DEBUG !== 'true') return

    const timestamp = getFormattedDate()
    const sanitizedContext = sanitizeSensitiveData(context)
    const sanitizedData = sanitizeSensitiveData(data)
    const logMessage = `[${timestamp}] [DEBUG] ${message} ${
      sanitizedData ? '\n  Data: ' + JSON.stringify(sanitizedData) : ''
    } ${
      Object.keys(sanitizedContext).length > 0
        ? '\n  Context: ' + JSON.stringify(sanitizedContext)
        : ''
    }`

    console.log(`${colors.gray}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'debug')
  },

  // Log de ação do usuário (sem dados sensíveis)
  userAction: (action, userId = 'anonymous', details = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedDetails = sanitizeSensitiveData(details)
    const logMessage = `[${timestamp}] [USER_ACTION] User: ${userId} | Action: ${action} ${
      Object.keys(sanitizedDetails).length > 0
        ? '| Details: ' + JSON.stringify(sanitizedDetails)
        : ''
    }`

    console.log(`${colors.green}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'user-actions')
  },

  // Log de requisição HTTP
  http: (method, path, statusCode, duration, userId = 'anonymous', details = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedDetails = sanitizeSensitiveData(details)
    const statusColor =
      statusCode >= 400 ? colors.red : statusCode >= 300 ? colors.yellow : colors.green
    const logMessage = `[${timestamp}] [HTTP] ${method} ${path} | Status: ${statusCode} | Duration: ${duration}ms | User: ${userId} ${
      Object.keys(sanitizedDetails).length > 0
        ? '| Details: ' + JSON.stringify(sanitizedDetails)
        : ''
    }`

    console.log(`${statusColor}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'http')
  },

  // Log de autenticação
  auth: (action, identifier = '', result = 'success', details = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedDetails = sanitizeSensitiveData(details)
    const logMessage = `[${timestamp}] [AUTH] Action: ${action} | Identifier: ${identifier} | Result: ${result} ${
      Object.keys(sanitizedDetails).length > 0
        ? '| Details: ' + JSON.stringify(sanitizedDetails)
        : ''
    }`

    const color = result === 'success' ? colors.green : colors.red
    console.log(`${color}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'auth')
  },

  // Log de database
  database: (operation, entity, status = 'success', details = {}) => {
    const timestamp = getFormattedDate()
    const sanitizedDetails = sanitizeSensitiveData(details)
    const logMessage = `[${timestamp}] [DATABASE] Operation: ${operation} | Entity: ${entity} | Status: ${status} ${
      Object.keys(sanitizedDetails).length > 0
        ? '| Details: ' + JSON.stringify(sanitizedDetails)
        : ''
    }`

    const color = status === 'success' ? colors.green : colors.red
    console.log(`${color}${logMessage}${colors.reset}`)
    writeToFile(logMessage, 'database')
  },
}

export default logger
