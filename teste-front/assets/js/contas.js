const DIAS_ALERTA = 5
const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const weekdayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

let contas = []
let viewDate = new Date()
let selectedDateKey = null

const els = {
  year: document.getElementById('calendarYear'),
  month: document.getElementById('calendarMonth'),
  weekdays: document.getElementById('calendarWeekdays'),
  grid: document.getElementById('calendarGrid'),
  list: document.getElementById('accountList'),
  selectedDayTitle: document.getElementById('selectedDayTitle'),
  summary: document.getElementById('summaryGrid'),
  form: document.getElementById('accountForm'),
  formTitle: document.getElementById('formTitle'),
  filters: ['filtroTipo', 'filtroStatus', 'filtroBusca'].map((id) => document.getElementById(id)),
}

const pad = (value) => String(value).padStart(2, '0')
const dateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const parseDateOnly = (value) => {
  const [year, month, day] = String(value || '').substring(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}
const contaDateKey = (conta) => String(conta.dataVencimento || '').substring(0, 10)
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const brDate = (value) => parseDateOnly(value).toLocaleDateString('pt-BR')
const escapeHtml = (value) => window.RAJJ.escapeHtml(value ?? '')

const getDynamicStatus = (conta) => {
  if (conta.status === 'PAGA') return 'PAGA'
  if (conta.status === 'REN') return 'REN'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((parseDateOnly(conta.dataVencimento) - today) / 86400000)
  if (diff < 0) return 'VENCIDA'
  if (diff <= DIAS_ALERTA) return 'VENCENDO'
  return 'ABERTA'
}

const statusLabel = (status) => ({
  VENCIDA: 'Vencida',
  VENCENDO: 'Proxima',
  PAGA: 'Paga',
  REN: 'Renegociacao',
  ABERTA: 'Aberta',
}[status] || status)

const statusColor = (status) => ({
  VENCIDA: 'red',
  VENCENDO: 'yellow',
  PAGA: 'green',
  REN: 'orange',
  ABERTA: 'blue',
}[status] || 'blue')

const monthBounds = () => {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  return { year, month, first: new Date(year, month, 1), last: new Date(year, month + 1, 0) }
}

const filteredContas = () => {
  const tipo = document.getElementById('filtroTipo').value
  const status = document.getElementById('filtroStatus').value
  const search = document.getElementById('filtroBusca').value.trim().toLowerCase()
  const { year, month } = monthBounds()

  return contas.filter((conta) => {
    const date = parseDateOnly(conta.dataVencimento)
    const dynamicStatus = getDynamicStatus(conta)
    const haystack = [conta.descricao, conta.categoria, conta.observacoes, conta.emailCobranca].join(' ').toLowerCase()
    return date.getFullYear() === year &&
      date.getMonth() === month &&
      (tipo === 'TODOS' || conta.tipo === tipo) &&
      (status === 'TODOS' || dynamicStatus === status) &&
      (!search || haystack.includes(search))
  }).sort((a, b) => parseDateOnly(a.dataVencimento) - parseDateOnly(b.dataVencimento))
}

const statusPriority = (items) => {
  const statuses = items.map(getDynamicStatus)
  if (statuses.includes('VENCIDA')) return 'is-overdue'
  if (statuses.includes('VENCENDO')) return 'is-due-soon'
  if (statuses.includes('REN')) return 'is-renegotiation'
  if (statuses.includes('PAGA')) return 'is-paid'
  return ''
}

function renderCalendar() {
  const { year, month, first, last } = monthBounds()
  els.year.textContent = year
  els.month.textContent = monthNames[month]
  els.weekdays.innerHTML = weekdayNames.map((day) => `<div class="calendar-weekday">${day}</div>`).join('')
  els.grid.innerHTML = ''

  const list = filteredContas()
  const byDay = new Map()
  list.forEach((conta) => {
    const key = contaDateKey(conta)
    byDay.set(key, [...(byDay.get(key) || []), conta])
  })

  const startOffset = first.getDay()
  const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const todayKey = dateKey(new Date())

  for (let i = 0; i < totalCells; i += 1) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    const key = dateKey(cellDate)
    const dayItems = byDay.get(key) || []
    const isOutside = cellDate.getMonth() !== month
    const total = dayItems.reduce((acc, conta) => acc + Number(conta.valor || 0), 0)
    const classes = ['calendar-day', statusPriority(dayItems)]
    if (isOutside) classes.push('is-outside')
    if (key === todayKey) classes.push('is-today')
    if (key === selectedDateKey) classes.push('is-selected')

    const dots = [...new Set(dayItems.map((conta) => statusColor(getDynamicStatus(conta))))]
      .map((color) => `<span class="dot dot-${color}"></span>`)
      .join('')

    const button = document.createElement('button')
    button.type = 'button'
    button.className = classes.filter(Boolean).join(' ')
    button.dataset.date = key
    button.innerHTML = `<span class="day-number">${cellDate.getDate()}</span>${dayItems.length ? `<span class="day-total">${dayItems.length} conta(s)<br>${money(total)}</span><span class="day-dots">${dots}</span>` : ''}`
    button.addEventListener('click', () => {
      selectedDateKey = key
      if (isOutside) viewDate = new Date(cellDate.getFullYear(), cellDate.getMonth(), 1)
      renderAll()
    })
    els.grid.appendChild(button)
  }
}

function renderSummary() {
  const list = filteredContas()
  const pagar = list.filter((conta) => conta.tipo === 'PAGAR').reduce((acc, conta) => acc + Number(conta.valor || 0), 0)
  const receber = list.filter((conta) => conta.tipo === 'RECEBER').reduce((acc, conta) => acc + Number(conta.valor || 0), 0)
  const vencidas = list.filter((conta) => getDynamicStatus(conta) === 'VENCIDA').length
  const proximas = list.filter((conta) => getDynamicStatus(conta) === 'VENCENDO').length
  els.summary.innerHTML = `<div class="summary-box"><strong>${money(pagar)}</strong><span>A pagar no mes</span></div><div class="summary-box"><strong>${money(receber)}</strong><span>A receber no mes</span></div><div class="summary-box"><strong>${vencidas}</strong><span>Vencidas</span></div><div class="summary-box"><strong>${proximas}</strong><span>Proximas</span></div>`
}

function renderList() {
  let list = filteredContas()
  if (selectedDateKey) list = list.filter((conta) => contaDateKey(conta) === selectedDateKey)
  els.selectedDayTitle.textContent = selectedDateKey ? `Contas de ${brDate(selectedDateKey)}` : 'Contas do mes'
  if (!list.length) {
    els.list.innerHTML = '<p class="empty-text">Nenhuma conta encontrada.</p>'
    return
  }

  els.list.innerHTML = list.map((conta) => {
    const status = getDynamicStatus(conta)
    return `<article class="account-card"><header><div><h3>${escapeHtml(conta.descricao)}</h3><small>${conta.tipo === 'PAGAR' ? 'A pagar' : 'A receber'} em ${brDate(conta.dataVencimento)}</small></div><strong>${money(conta.valor)}</strong></header><div class="pill-row"><span class="pill pill-${statusColor(status)}">${statusLabel(status)}</span><span class="pill pill-blue">${escapeHtml(conta.recorrencia || 'NENHUMA')}</span></div><small><strong>Categoria:</strong> ${escapeHtml(conta.categoria || 'Sem categoria')}</small>${conta.emailCobranca ? `<small><strong>E-mail:</strong> ${escapeHtml(conta.emailCobranca)}</small>` : ''}${conta.observacoes ? `<small><strong>Obs.:</strong> ${escapeHtml(conta.observacoes)}</small>` : ''}<div class="card-actions"><button type="button" data-action="edit" data-id="${conta.id}">Editar</button><button type="button" data-action="paid" data-id="${conta.id}">Paga</button><button type="button" data-action="ren" data-id="${conta.id}">Renegociar</button><button type="button" data-action="delete" data-id="${conta.id}">Excluir</button></div></article>`
  }).join('')
}

function renderAll() {
  renderCalendar()
  renderSummary()
  renderList()
}

async function loadContas() {
  window.RAJJ.requireAuth()
  contas = await window.RAJJ.apiFetch('/api/contas', { auth: true })
  renderAll()
}

function clearForm() {
  els.formTitle.textContent = 'Nova conta'
  els.form.reset()
  document.getElementById('contaId').value = ''
  document.getElementById('tipo').value = 'PAGAR'
  document.getElementById('status').value = 'ABERTA'
  document.getElementById('recorrencia').value = 'NENHUMA'
  document.getElementById('dataVencimento').value = selectedDateKey || dateKey(new Date())
}

function fillForm(conta) {
  els.formTitle.textContent = 'Editar conta'
  document.getElementById('contaId').value = conta.id
  document.getElementById('tipo').value = conta.tipo
  document.getElementById('status').value = conta.status || 'ABERTA'
  document.getElementById('descricao').value = conta.descricao || ''
  document.getElementById('valor').value = conta.valor || ''
  document.getElementById('dataVencimento').value = contaDateKey(conta)
  document.getElementById('recorrencia').value = conta.recorrencia || 'NENHUMA'
  document.getElementById('categoria').value = conta.categoria || ''
  document.getElementById('emailCobranca').value = conta.emailCobranca || ''
  document.getElementById('observacoes').value = conta.observacoes || ''
  els.form.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function saveConta(event) {
  event.preventDefault()
  const id = document.getElementById('contaId').value
  const payload = {
    tipo: document.getElementById('tipo').value,
    status: document.getElementById('status').value,
    descricao: document.getElementById('descricao').value.trim(),
    valor: Number(document.getElementById('valor').value),
    dataVencimento: document.getElementById('dataVencimento').value,
    recorrencia: document.getElementById('recorrencia').value,
    categoria: document.getElementById('categoria').value.trim(),
    emailCobranca: document.getElementById('emailCobranca').value.trim(),
    observacoes: document.getElementById('observacoes').value.trim(),
  }

  const saved = await window.RAJJ.apiFetch(id ? `/api/conta/${id}` : '/api/conta', {
    method: id ? 'PATCH' : 'POST',
    auth: true,
    body: payload,
  })
  const index = contas.findIndex((conta) => conta.id === saved.id)
  if (index >= 0) contas[index] = saved
  else contas.push(saved)
  selectedDateKey = contaDateKey(saved)
  viewDate = parseDateOnly(saved.dataVencimento)
  clearForm()
  renderAll()
}

async function patchConta(id, body) {
  const saved = await window.RAJJ.apiFetch(`/api/conta/${id}`, { method: 'PATCH', auth: true, body })
  const index = contas.findIndex((conta) => conta.id === id)
  if (index >= 0) contas[index] = saved
  renderAll()
}

async function deleteConta(id) {
  if (!confirm('Deseja realmente excluir esta conta?')) return
  await window.RAJJ.apiFetch(`/api/conta/${id}`, { method: 'DELETE', auth: true })
  contas = contas.filter((conta) => conta.id !== id)
  renderAll()
}

document.getElementById('prevMonth').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); selectedDateKey = null; renderAll() })
document.getElementById('nextMonth').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); selectedDateKey = null; renderAll() })
document.getElementById('prevYear').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1); selectedDateKey = null; renderAll() })
document.getElementById('nextYear').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1); selectedDateKey = null; renderAll() })
document.getElementById('todayButton').addEventListener('click', () => { viewDate = new Date(); selectedDateKey = dateKey(new Date()); renderAll() })
document.getElementById('clearFormButton').addEventListener('click', clearForm)
document.getElementById('logoutButton').addEventListener('click', () => window.RAJJ.signOut())
els.form.addEventListener('submit', (event) => saveConta(event).catch((error) => alert(error.message || 'Erro ao salvar conta.')))
els.filters.forEach((el) => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { selectedDateKey = null; renderAll() }))
els.list.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]')
  if (!button) return
  const conta = contas.find((item) => item.id === button.dataset.id)
  if (!conta) return
  if (button.dataset.action === 'edit') fillForm(conta)
  if (button.dataset.action === 'paid') patchConta(conta.id, { status: 'PAGA' }).catch((error) => alert(error.message))
  if (button.dataset.action === 'ren') patchConta(conta.id, { status: 'REN' }).catch((error) => alert(error.message))
  if (button.dataset.action === 'delete') deleteConta(conta.id).catch((error) => alert(error.message))
})

clearForm()
loadContas().catch((error) => alert(error.message || 'Erro ao carregar contas.'))
