window.RAJJ.requireAuth()

const usersList = document.getElementById('users-list')
const usersCount = document.getElementById('users-count')
const usersSearch = document.getElementById('users-search')
const usersFeedback = document.getElementById('users-feedback')
const editForm = document.getElementById('user-edit-form')
const editFeedback = document.getElementById('edit-feedback')
const saveUserButton = document.getElementById('save-user-button')
const inactivateUserButton = document.getElementById('inactivate-user-button')
const logoutButton = document.getElementById('logout-button')
const editUserModal = document.getElementById('edit-user-modal')
const closeEditModalButton = document.getElementById('close-edit-modal')

let allUsers = []
let selectedUserId = null

const formFields = {
  name: document.getElementById('edit-name'),
  email: document.getElementById('edit-email'),
  cpf: document.getElementById('edit-cpf'),
  status: document.getElementById('edit-status'),
  telefones: document.getElementById('edit-telefones'),
  cep: document.getElementById('edit-cep'),
  rua: document.getElementById('edit-rua'),
  bairro: document.getElementById('edit-bairro'),
  numero: document.getElementById('edit-numero'),
  cidade: document.getElementById('edit-cidade'),
  estado: document.getElementById('edit-estado'),
  fotoPreview: document.getElementById('edit-foto-preview'),
  documentosList: document.getElementById('edit-documentos-list'),
}

const setFeedback = (element, message, type = '') => {
  if (!element) return
  element.textContent = message || ''
  element.className = `auth-feedback${type ? ` is-${type}` : ''}`
}

const onlyDigits = (value) => String(value || '').replace(/\D/g, '')

const formatCpf = (value) => {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

const formatCep = (value) => {
  const digits = onlyDigits(value).slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, '$1-$2')
}

const validarCPF = (rawCpf) => {
  const cpf = onlyDigits(rawCpf)
  if (!cpf || cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let soma = 0
  let resto = 0

  for (let i = 1; i <= 9; i += 1) {
    soma += Number.parseInt(cpf.substring(i - 1, i), 10) * (11 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== Number.parseInt(cpf.substring(9, 10), 10)) return false

  soma = 0
  for (let i = 1; i <= 10; i += 1) {
    soma += Number.parseInt(cpf.substring(i - 1, i), 10) * (12 - i)
  }

  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === Number.parseInt(cpf.substring(10, 11), 10)
}

const validarTelefone = (value) =>
  /^(?:[1-9][0-9])(?:9\d{8}|\d{8})$/.test(onlyDigits(value))

const openEditModal = () => {
  editUserModal?.classList.remove('is-hidden')
  editUserModal?.setAttribute('aria-hidden', 'false')
}

const closeEditModal = () => {
  editUserModal?.classList.add('is-hidden')
  editUserModal?.setAttribute('aria-hidden', 'true')
}

const fillForm = (user) => {
  selectedUserId = user.id

  formFields.name.value = user.name || ''
  formFields.email.value = user.email || ''
  formFields.cpf.value = formatCpf(user.cpf || '')
  formFields.status.value = user.status || 'ATIVO'
  formFields.telefones.value = (user.telefones || []).join('\n')
  formFields.cep.value = formatCep(user.endereco?.cep || '')
  formFields.rua.value = user.endereco?.rua || ''
  formFields.bairro.value = user.endereco?.bairro || ''
  formFields.numero.value = user.endereco?.numero || ''
  formFields.cidade.value = user.endereco?.cidade || ''
  formFields.estado.value = user.endereco?.estado || ''

  Object.values(formFields).forEach((field) => {
    if (field instanceof HTMLElement && 'disabled' in field) {
      field.disabled = false
    }
  })

  saveUserButton.disabled = false
  inactivateUserButton.disabled = false

  if (user.fotoPath) {
    formFields.fotoPreview.innerHTML = `<img src="${window.RAJJ.fileUrl(user.fotoPath)}" alt="Foto de ${window.RAJJ.escapeHtml(user.name)}">`
  } else {
    formFields.fotoPreview.textContent = 'Sem foto'
  }

  if (user.documentos?.length) {
    formFields.documentosList.innerHTML = user.documentos
      .map((documento, index) => {
        const safeLabel = `Documento ${index + 1}`
        return `<a href="${window.RAJJ.fileUrl(documento)}" target="_blank" rel="noreferrer">${safeLabel}</a>`
      })
      .join('')
  } else {
    formFields.documentosList.textContent = 'Nenhum documento'
  }

  setFeedback(editFeedback, '')
  openEditModal()
}

const renderUsers = () => {
  const search = usersSearch.value.trim().toLowerCase()
  const filteredUsers = allUsers.filter((user) => {
    const haystack = [user.name, user.email, user.cpf, user.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(search)
  })

  usersCount.textContent = `${filteredUsers.length} usuario(s) encontrado(s)`

  if (filteredUsers.length === 0) {
    usersList.innerHTML = '<p class="subtitle">Nenhum usuario encontrado.</p>'
    return
  }

  usersList.innerHTML = filteredUsers
    .map((user) => {
      const telefones = (user.telefones || []).join(', ') || 'Sem telefone'
      const endereco = user.endereco
        ? `${user.endereco.rua}, ${user.endereco.numero} - ${user.endereco.bairro}`
        : 'Endereco nao informado'
      const documentos = user.documentos?.length
        ? `${user.documentos.length} documento(s)`
        : 'Sem documentos'
      const fotoLabel = user.fotoPath ? 'Com foto' : 'Sem foto'

      return `
        <article class="user-card ${selectedUserId === user.id ? 'is-selected' : ''}" data-user-id="${user.id}">
          <div class="user-card-header">
            <div>
              <h3>${window.RAJJ.escapeHtml(user.name || 'Sem nome')}</h3>
              <p>${window.RAJJ.escapeHtml(user.email || 'Sem e-mail')}</p>
            </div>
            <div class="user-card-actions">
              <span class="user-status status-${String(user.status || 'ATIVO').toLowerCase()}">${window.RAJJ.escapeHtml(user.status || 'ATIVO')}</span>
              <button type="button" class="users-icon-button edit-user-button" data-edit-user="${user.id}" aria-label="Editar ${window.RAJJ.escapeHtml(user.name || 'usuario')}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0l-1.13 1.13 3.75 3.75 1.14-1.13z"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="user-card-grid">
            <p><strong>CPF:</strong> ${window.RAJJ.escapeHtml(formatCpf(user.cpf || 'Nao informado'))}</p>
            <p><strong>Telefones:</strong> ${window.RAJJ.escapeHtml(telefones)}</p>
            <p><strong>Endereco:</strong> ${window.RAJJ.escapeHtml(endereco)}</p>
            <p><strong>Arquivos:</strong> ${window.RAJJ.escapeHtml(`${fotoLabel} • ${documentos}`)}</p>
          </div>
        </article>
      `
    })
    .join('')
}

const loadUsers = async () => {
  setFeedback(usersFeedback, '')

  try {
    const data = await window.RAJJ.apiFetch('/private/listar-usuarios', {
      method: 'GET',
      auth: true,
    })

    allUsers = data.users || []
    renderUsers()

    if (selectedUserId) {
      const selectedUser = allUsers.find((user) => user.id === selectedUserId)
      if (selectedUser) fillForm(selectedUser)
    }
  } catch (error) {
    setFeedback(usersFeedback, error.message || 'Nao foi possivel carregar os usuarios.', 'error')
  }
}

const getPayload = () => {
  const telefones = formFields.telefones.value
    .split('\n')
    .map((telefone) => telefone.trim())
    .filter(Boolean)

  return {
    name: formFields.name.value.trim(),
    email: formFields.email.value.trim(),
    cpf: onlyDigits(formFields.cpf.value),
    status: formFields.status.value,
    telefones,
    endereco: {
      cep: onlyDigits(formFields.cep.value),
      rua: formFields.rua.value.trim(),
      bairro: formFields.bairro.value.trim(),
      numero: formFields.numero.value.trim(),
      cidade: formFields.cidade.value.trim(),
      estado: formFields.estado.value.trim().toUpperCase(),
    },
  }
}

usersSearch?.addEventListener('input', renderUsers)

usersList?.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-user]')
  const targetId = editButton?.dataset.editUser || event.target.closest('[data-user-id]')?.dataset.userId
  if (!targetId) return

  const card = usersList.querySelector(`[data-user-id="${targetId}"]`)
  if (!card) return

  const user = allUsers.find((item) => item.id === targetId)
  if (!user) return

  fillForm(user)
  renderUsers()
})

formFields.cpf?.addEventListener('input', (event) => {
  event.target.value = formatCpf(event.target.value)
})

formFields.cep?.addEventListener('input', (event) => {
  event.target.value = formatCep(event.target.value)
})

editForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!selectedUserId) return

  const payload = getPayload()

  if (!payload.name || !payload.email) {
    setFeedback(editFeedback, 'Nome e e-mail sao obrigatorios.', 'error')
    return
  }

  if (!validarCPF(payload.cpf)) {
    setFeedback(editFeedback, 'CPF invalido.', 'error')
    return
  }

  if (payload.telefones.length === 0 || payload.telefones.some((telefone) => !validarTelefone(telefone))) {
    setFeedback(editFeedback, 'Informe telefones validos com DDD, um por linha.', 'error')
    return
  }

  if (
    payload.endereco.cep.length !== 8 ||
    !payload.endereco.rua ||
    !payload.endereco.bairro ||
    !payload.endereco.numero ||
    !payload.endereco.cidade ||
    !payload.endereco.estado
  ) {
    setFeedback(editFeedback, 'Preencha o endereco completo.', 'error')
    return
  }

  saveUserButton.disabled = true
  setFeedback(editFeedback, '')

  try {
    const data = await window.RAJJ.apiFetch(`/private/usuarios/${selectedUserId}`, {
      method: 'PATCH',
      auth: true,
      body: {
        ...payload,
        telefones: JSON.stringify(payload.telefones),
        endereco: JSON.stringify(payload.endereco),
      },
    })

    setFeedback(editFeedback, data.message || 'Usuario atualizado com sucesso.', 'success')
    await loadUsers()
  } catch (error) {
    setFeedback(editFeedback, error.message || 'Nao foi possivel atualizar o usuario.', 'error')
  } finally {
    saveUserButton.disabled = false
  }
})

inactivateUserButton?.addEventListener('click', async () => {
  if (!selectedUserId) return
  if (!window.confirm('Deseja realmente inativar este cadastro?')) return

  inactivateUserButton.disabled = true
  setFeedback(editFeedback, '')

  try {
    const data = await window.RAJJ.apiFetch(`/private/usuarios/${selectedUserId}/inativar`, {
      method: 'PATCH',
      auth: true,
    })

    setFeedback(editFeedback, data.message || 'Usuario inativado com sucesso.', 'success')
    await loadUsers()
  } catch (error) {
    setFeedback(editFeedback, error.message || 'Nao foi possivel inativar o usuario.', 'error')
  } finally {
    inactivateUserButton.disabled = false
  }
})

logoutButton?.addEventListener('click', () => {
  window.RAJJ.signOut('login.html')
})

closeEditModalButton?.addEventListener('click', closeEditModal)

editUserModal?.addEventListener('click', (event) => {
  if (event.target.hasAttribute('data-close-edit-modal')) {
    closeEditModal()
  }
})

loadUsers()
