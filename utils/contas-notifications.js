import he from 'he'
import mailer from './mailer.js'
import prisma from './prisma.js'
import logger from './logger.js'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_DAYS_BEFORE = 5

const startOfLocalDay = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const diffInDays = (targetDate, baseDate = new Date()) => {
  const target = startOfLocalDay(new Date(targetDate))
  const base = startOfLocalDay(baseDate)
  return Math.round((target - base) / DAY_MS)
}

const wasSentToday = (date, today = new Date()) => {
  if (!date) return false
  return startOfLocalDay(new Date(date)).getTime() === startOfLocalDay(today).getTime()
}

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

const formatDate = (value) =>
  new Date(value).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })

const sendContaEmail = async (conta, subject, intro) => {
  const safeDescricao = he.encode(conta.descricao || 'Conta')
  const safeIntro = he.encode(intro)
  const safeObservacoes = conta.observacoes ? he.encode(conta.observacoes) : ''

  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: conta.emailCobranca,
    subject,
    html: `
      <p>${safeIntro}</p>
      <p><strong>Conta:</strong> ${safeDescricao}</p>
      <p><strong>Tipo:</strong> ${conta.tipo === 'PAGAR' ? 'A pagar' : 'A receber'}</p>
      <p><strong>Valor:</strong> ${formatCurrency(conta.valor)}</p>
      <p><strong>Vencimento:</strong> ${formatDate(conta.dataVencimento)}</p>
      ${safeObservacoes ? `<p><strong>Observacoes:</strong> ${safeObservacoes}</p>` : ''}
    `,
  })
}

export const processContaNotifications = async (now = new Date()) => {
  const contas = await prisma.conta.findMany({
    where: {
      status: 'ABERTA',
      emailCobranca: { not: null },
    },
  })

  let sent = 0

  for (const conta of contas) {
    const daysUntilDue = diffInDays(conta.dataVencimento, now)

    if (
      daysUntilDue === REMINDER_DAYS_BEFORE &&
      !conta.lembreteCincoDiasEnviadoEm
    ) {
      await sendContaEmail(
        conta,
        'Lembrete de vencimento - RAJJ',
        'Esta conta vence em 5 dias.'
      )
      await prisma.conta.update({
        where: { id: conta.id },
        data: { lembreteCincoDiasEnviadoEm: now },
      })
      sent += 1
      continue
    }

    if (daysUntilDue < 0 && !wasSentToday(conta.ultimaCobrancaVencidaEm, now)) {
      await sendContaEmail(
        conta,
        'Cobranca de conta vencida - RAJJ',
        'Esta conta esta vencida. Este e um aviso diario enquanto ela permanecer aberta.'
      )
      await prisma.conta.update({
        where: { id: conta.id },
        data: { ultimaCobrancaVencidaEm: now },
      })
      sent += 1
    }
  }

  return { checked: contas.length, sent }
}

export const startContaNotificationScheduler = () => {
  if (process.env.CONTA_EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
    logger.info('Notificacoes de contas desabilitadas por ambiente')
    return null
  }

  const run = async () => {
    try {
      const result = await processContaNotifications()
      logger.info('Notificacoes de contas processadas', result)
    } catch (error) {
      logger.error('Erro ao processar notificacoes de contas', error)
    }
  }

  const DEFAULT_INITIAL_DELAY_MS = 10000
  const MIN_INITIAL_DELAY_MS = 0
  const MAX_INITIAL_DELAY_MS = DAY_MS
  const rawInitialDelay = process.env.CONTA_EMAIL_INITIAL_DELAY_MS
  const parsedInitialDelay = Number(rawInitialDelay)
  const initialDelayMs = Number.isFinite(parsedInitialDelay)
    ? Math.min(MAX_INITIAL_DELAY_MS, Math.max(MIN_INITIAL_DELAY_MS, parsedInitialDelay))
    : DEFAULT_INITIAL_DELAY_MS

  setTimeout(run, initialDelayMs)
  return setInterval(run, DAY_MS)
}
