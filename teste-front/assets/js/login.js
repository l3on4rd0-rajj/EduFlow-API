const loginForm = document.getElementById('login-form')
const loginFeedback = document.getElementById('auth-feedback')
const loginButton = loginForm?.querySelector('button[type="submit"]')
const emailGroup = document.getElementById('email-group')
const passwordGroup = document.getElementById('password-group')
const mfaGroup = document.getElementById('mfa-group')
const mfaDigitInputs = Array.from(document.querySelectorAll('.mfa-digit'))
const mfaBackWrapper = document.getElementById('mfa-back-wrapper')
const mfaBackButton = document.getElementById('mfa-back-button')
const loginSubtitle = document.getElementById('login-subtitle')
const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('senha')

let mfaChallenge = null

const setLoginFeedback = (message, type = '') => {
  if (!loginFeedback) return
  loginFeedback.textContent = message || ''
  loginFeedback.className = `auth-feedback${type ? ` is-${type}` : ''}`
}

const getMfaCode = () => mfaDigitInputs.map((input) => input.value).join('')

const clearMfaCode = () => {
  mfaDigitInputs.forEach((input) => {
    input.value = ''
  })
}

const setStep = (step) => {
  const isMfaStep = step === 'mfa'

  emailGroup?.classList.toggle('is-hidden', isMfaStep)
  passwordGroup?.classList.toggle('is-hidden', isMfaStep)
  mfaGroup?.classList.toggle('is-hidden', !isMfaStep)
  mfaBackWrapper?.classList.toggle('is-hidden', !isMfaStep)

  if (emailInput) emailInput.required = !isMfaStep
  if (passwordInput) passwordInput.required = !isMfaStep

  if (loginSubtitle) {
    loginSubtitle.textContent = isMfaStep
      ? 'Digite o codigo enviado para o seu e-mail para concluir o acesso.'
      : 'Informe seu e-mail e senha para acessar a plataforma.'
  }

  if (loginButton) {
    loginButton.textContent = isMfaStep ? 'Validar codigo' : 'Entrar'
  }

  if (isMfaStep) {
    mfaDigitInputs[0]?.focus()
  } else {
    clearMfaCode()
  }
}

const resetToPasswordStep = () => {
  mfaChallenge = null
  setStep('password')
  setLoginFeedback('')
}

mfaBackButton?.addEventListener('click', () => {
  resetToPasswordStep()
})

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const isMfaStep = Boolean(mfaChallenge)
  const email = emailInput.value.trim()
  const password = passwordInput.value
  const code = getMfaCode()

  if (isMfaStep && code.length !== mfaDigitInputs.length) {
    setLoginFeedback('Preencha todos os digitos do codigo MFA.', 'error')
    mfaDigitInputs.find((input) => !input.value)?.focus()
    return
  }

  loginButton.disabled = true
  loginButton.textContent = isMfaStep ? 'Validando...' : 'Entrando...'
  mfaBackButton?.setAttribute('disabled', 'disabled')
  setLoginFeedback('')

  try {
    const data = isMfaStep
      ? await window.RAJJ.apiFetch('/login/mfa/verify', {
          method: 'POST',
          body: {
            challengeToken: mfaChallenge.challengeToken,
            code,
          },
        })
      : await window.RAJJ.apiFetch('/login', {
          method: 'POST',
          body: { email, password },
        })

    if (data?.requiresMfa) {
      mfaChallenge = data
      setStep('mfa')
      setLoginFeedback(data.message || 'Codigo enviado para o e-mail.', 'success')
      return
    }

    window.localStorage.setItem(window.RAJJ.storageKeys.token, data.token)
    window.localStorage.setItem(window.RAJJ.storageKeys.user, JSON.stringify(data.user))
    window.location.href = 'cadastro-aluno.html'
  } catch (error) {
    setLoginFeedback(error.message || 'Nao foi possivel entrar.', 'error')
  } finally {
    loginButton.disabled = false
    mfaBackButton?.removeAttribute('disabled')
    if (mfaChallenge) {
      loginButton.textContent = 'Validar codigo'
    } else {
      loginButton.textContent = 'Entrar'
    }
  }
})

mfaDigitInputs.forEach((input, index) => {
  input.addEventListener('input', (event) => {
    const digits = event.target.value.replace(/\D/g, '')

    if (!digits) {
      event.target.value = ''
      return
    }

    if (digits.length > 1) {
      digits.split('').slice(0, mfaDigitInputs.length - index).forEach((digit, offset) => {
        const target = mfaDigitInputs[index + offset]
        if (target) target.value = digit
      })

      const nextTarget = mfaDigitInputs[Math.min(index + digits.length, mfaDigitInputs.length - 1)]
      nextTarget?.focus()
      return
    }

    event.target.value = digits
    mfaDigitInputs[index + 1]?.focus()
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Backspace' && !event.currentTarget.value && index > 0) {
      mfaDigitInputs[index - 1].focus()
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      mfaDigitInputs[index - 1].focus()
    }

    if (event.key === 'ArrowRight' && index < mfaDigitInputs.length - 1) {
      event.preventDefault()
      mfaDigitInputs[index + 1].focus()
    }
  })

  input.addEventListener('paste', (event) => {
    event.preventDefault()
    const pastedDigits = (event.clipboardData?.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, mfaDigitInputs.length)

    if (!pastedDigits) return

    pastedDigits.split('').forEach((digit, pastedIndex) => {
      if (mfaDigitInputs[pastedIndex]) {
        mfaDigitInputs[pastedIndex].value = digit
      }
    })

    const nextEmptyInput = mfaDigitInputs.find((digitInput) => !digitInput.value)
    ;(nextEmptyInput || mfaDigitInputs[mfaDigitInputs.length - 1])?.focus()
  })
})

setStep('password')
