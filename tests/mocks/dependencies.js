import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import logger from '../../utils/logger.js'
import prisma from '../../utils/prisma.js'
import mailer from '../../utils/mailer.js'

function createRestoreBag() {
  const restores = []

  return {
    add(fn) {
      restores.push(fn)
    },
    restoreAll() {
      while (restores.length > 0) {
        const restore = restores.pop()
        restore()
      }
    },
  }
}

export function mockPrisma(overrides = {}) {
  const bag = createRestoreBag()
  const modelMap = {
    Cluster0: prisma.Cluster0,
    conta: prisma.conta,
    aluno: prisma.aluno,
    endereco: prisma.endereco,
  }

  for (const [modelName, methods] of Object.entries(overrides)) {
    if (modelName === '$transaction') continue

    const model = modelMap[modelName]
    if (!model) continue

    for (const [methodName, implementation] of Object.entries(methods)) {
      const original = model[methodName]
      model[methodName] = implementation
      bag.add(() => {
        model[methodName] = original
      })
    }
  }

  if (overrides.$transaction) {
    const original = prisma.$transaction
    prisma.$transaction = overrides.$transaction
    bag.add(() => {
      prisma.$transaction = original
    })
  }

  return {
    restore: () => bag.restoreAll(),
  }
}

export function mockBcrypt(overrides = {}) {
  const bag = createRestoreBag()

  for (const [methodName, implementation] of Object.entries(overrides)) {
    const original = bcrypt[methodName]
    bcrypt[methodName] = implementation
    bag.add(() => {
      bcrypt[methodName] = original
    })
  }

  return {
    restore: () => bag.restoreAll(),
  }
}

export function mockJwt(overrides = {}) {
  const bag = createRestoreBag()

  for (const [methodName, implementation] of Object.entries(overrides)) {
    const original = jwt[methodName]
    jwt[methodName] = implementation
    bag.add(() => {
      jwt[methodName] = original
    })
  }

  return {
    restore: () => bag.restoreAll(),
  }
}

export function mockMailer(sendMailImpl) {
  const bag = createRestoreBag()
  const originalSendMail = mailer.sendMail
  const sendMailCalls = []

  mailer.sendMail = async (...args) => {
    sendMailCalls.push(args)
    if (sendMailImpl) {
      return sendMailImpl(...args)
    }
    return { accepted: ['mock@example.com'] }
  }

  bag.add(() => {
    mailer.sendMail = originalSendMail
  })

  return {
    sendMailCalls,
    restore: () => bag.restoreAll(),
  }
}

export function mockLogger(methods = ['info', 'warn', 'error', 'success', 'userAction', 'auth', 'http']) {
  const bag = createRestoreBag()
  const calls = {}

  for (const methodName of methods) {
    const original = logger[methodName]
    calls[methodName] = []
    logger[methodName] = (...args) => {
      calls[methodName].push(args)
    }
    bag.add(() => {
      logger[methodName] = original
    })
  }

  return {
    calls,
    restore: () => bag.restoreAll(),
  }
}
