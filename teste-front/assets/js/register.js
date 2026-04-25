const registerForm = document.getElementById('cadastro-form')
const registerFeedback = document.getElementById('auth-feedback')
const registerButton = document.getElementById('submit-step')
const nextStepButton = document.getElementById('next-step')
const prevStepButton = document.getElementById('prev-step')
const telefonesWrapper = document.getElementById('telefones-wrapper')
const addTelefoneButton = document.getElementById('add-telefone')
const cepInput = document.getElementById('cep')
const formSteps = Array.from(document.querySelectorAll('.form-step'))
const stepIndicators = Array.from(document.querySelectorAll('[data-step-indicator]'))

let currentStep = 0

const setRegisterFeedback = (message, type = '') => {
  if (!registerFeedback) return
  registerFeedback.textContent = message || ''
  registerFeedback.className = `auth-feedback${type ? ` is-${type}` : ''}`
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

const formatPhone = (value) => {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) return digits
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, '($1) $2')
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
  if (digits[2] !== '9') return digits.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
  return digits.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3')
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

const createPhoneRow = () => {
  const row = document.createElement('div')
  row.className = 'phone-row'
  row.innerHTML = `
    <input type="text" name="telefones[]" placeholder="(11) 99999-9999" inputmode="tel" maxlength="15" required>
    <button type="button" class="secondary-button inline-button remove-phone">Remover</button>
  `
  return row
}

const fillAddressFromCep = async () => {
  const cep = onlyDigits(cepInput?.value)
  if (cep.length !== 8) return

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
    const data = await response.json()

    if (data.erro) {
      setRegisterFeedback('CEP nao encontrado.', 'error')
      return
    }

    document.getElementById('rua').value = data.logradouro || ''
    document.getElementById('bairro').value = data.bairro || ''
    document.getElementById('cidade').value = data.localidade || ''
    document.getElementById('estado').value = data.uf || ''
    setRegisterFeedback('')
  } catch (_error) {
    setRegisterFeedback('Nao foi possivel buscar o CEP agora.', 'error')
  }
}

const updateStepUI = () => {
  formSteps.forEach((step, index) => {
    step.classList.toggle('is-active', index === currentStep)
  })

  stepIndicators.forEach((indicator, index) => {
    indicator.classList.toggle('is-active', index === currentStep)
    indicator.classList.toggle('is-complete', index < currentStep)
  })

  prevStepButton.classList.toggle('is-hidden', currentStep === 0)
  nextStepButton.classList.toggle('is-hidden', currentStep === formSteps.length - 1)
  registerButton.classList.toggle('is-hidden', currentStep !== formSteps.length - 1)
}

const getTelefones = () =>
  Array.from(
    registerForm.querySelectorAll('input[name="telefones[]"]'),
    (input) => input.value.trim()
  ).filter(Boolean)

const validateCurrentStep = () => {
  if (currentStep === 0) {
    const name = document.getElementById('nome').value.trim()
    const email = document.getElementById('email').value.trim()
    const cpf = onlyDigits(document.getElementById('cpf').value)
    const telefones = getTelefones()

    if (!name || !email) {
      setRegisterFeedback('Preencha nome e e-mail para continuar.', 'error')
      return false
    }

    if (!validarCPF(cpf)) {
      setRegisterFeedback('CPF invalido. Confira os digitos e tente novamente.', 'error')
      return false
    }

    if (telefones.length === 0 || telefones.some((telefone) => !validarTelefone(telefone))) {
      setRegisterFeedback(
        'Informe telefone com DDD no padrao (11) 99999-9999 ou (11) 3333-4444.',
        'error'
      )
      return false
    }

    setRegisterFeedback('')
    return true
  }

  if (currentStep === 1) {
    const endereco = {
      cep: onlyDigits(document.getElementById('cep').value),
      rua: document.getElementById('rua').value.trim(),
      bairro: document.getElementById('bairro').value.trim(),
      numero: document.getElementById('numero').value.trim(),
      cidade: document.getElementById('cidade').value.trim(),
      estado: document.getElementById('estado').value.trim().toUpperCase(),
    }

    if (
      endereco.cep.length !== 8 ||
      !endereco.rua ||
      !endereco.bairro ||
      !endereco.numero ||
      !endereco.cidade ||
      !endereco.estado
    ) {
      setRegisterFeedback('Preencha todo o endereco antes de avancar.', 'error')
      return false
    }

    setRegisterFeedback('')
    return true
  }

  if (currentStep === 2) {
    const password = document.getElementById('senha').value
    const confirmPassword = document.getElementById('confirmar-senha').value

    if (!password || !confirmPassword) {
      setRegisterFeedback('Informe e confirme a senha inicial.', 'error')
      return false
    }

    if (password !== confirmPassword) {
      setRegisterFeedback('A confirmacao da senha precisa ser igual a senha inicial.', 'error')
      return false
    }
  }

  setRegisterFeedback('')
  return true
}

addTelefoneButton?.addEventListener('click', () => {
  telefonesWrapper?.appendChild(createPhoneRow())
})

telefonesWrapper?.addEventListener('click', (event) => {
  const button = event.target.closest('.remove-phone')
  if (!button) return

  const rows = telefonesWrapper.querySelectorAll('.phone-row')
  if (rows.length <= 1) {
    rows[0]?.querySelector('input')?.focus()
    return
  }

  button.closest('.phone-row')?.remove()
})

telefonesWrapper?.addEventListener('input', (event) => {
  if (event.target.matches('input[name="telefones[]"]')) {
    event.target.value = formatPhone(event.target.value)
  }
})

document.getElementById('cpf')?.addEventListener('input', (event) => {
  event.target.value = formatCpf(event.target.value)
})

cepInput?.addEventListener('input', (event) => {
  event.target.value = formatCep(event.target.value)
})

cepInput?.addEventListener('blur', fillAddressFromCep)

nextStepButton?.addEventListener('click', () => {
  if (!validateCurrentStep()) return

  currentStep += 1
  updateStepUI()
})

prevStepButton?.addEventListener('click', () => {
  if (currentStep === 0) return
  setRegisterFeedback('')
  currentStep -= 1
  updateStepUI()
})

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  if (!validateCurrentStep()) return

  const name = document.getElementById('nome').value.trim()
  const email = document.getElementById('email').value.trim()
  const cpf = onlyDigits(document.getElementById('cpf').value)
  const password = document.getElementById('senha').value
  const confirmPassword = document.getElementById('confirmar-senha').value
  const telefones = getTelefones()

  const endereco = {
    cep: onlyDigits(document.getElementById('cep').value),
    rua: document.getElementById('rua').value.trim(),
    bairro: document.getElementById('bairro').value.trim(),
    numero: document.getElementById('numero').value.trim(),
    cidade: document.getElementById('cidade').value.trim(),
    estado: document.getElementById('estado').value.trim().toUpperCase(),
  }

  const formData = new FormData()
  formData.append('name', name)
  formData.append('email', email)
  formData.append('cpf', cpf)
  formData.append('password', password)
  formData.append('confirmPassword', confirmPassword)
  formData.append('endereco', JSON.stringify(endereco))
  formData.append('telefones', JSON.stringify(telefones.map(onlyDigits)))

  const fotoInput = document.getElementById('foto')
  const documentosInput = document.getElementById('documentos')

  if (fotoInput?.files?.[0]) {
    formData.append('foto', fotoInput.files[0])
  }

  if (documentosInput?.files?.length) {
    Array.from(documentosInput.files).forEach((file) => {
      formData.append('documentos', file)
    })
  }

  registerButton.disabled = true
  registerButton.textContent = 'Cadastrando...'
  setRegisterFeedback('')

  try {
    await window.RAJJ.apiFetch('/cadastro', {
      method: 'POST',
      body: formData,
    })

    registerForm.reset()
    telefonesWrapper.innerHTML = `
      <div class="phone-row">
        <input type="text" name="telefones[]" placeholder="(11) 99999-9999" inputmode="tel" maxlength="15" required>
      </div>
    `
    currentStep = 0
    updateStepUI()
    window.localStorage.setItem(
      'rajj.flashMessage',
      JSON.stringify({
        type: 'success',
        message: 'Cadastro concluido com sucesso. Entre com o e-mail e a senha inicial.',
      })
    )
    window.location.href = 'login.html'
  } catch (error) {
    setRegisterFeedback(error.message || 'Nao foi possivel concluir o cadastro.', 'error')
  } finally {
    registerButton.disabled = false
    registerButton.textContent = 'Criar conta'
  }
})

updateStepUI()
