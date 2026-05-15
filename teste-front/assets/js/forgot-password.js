const forgotForm = document.getElementById('forgotForm')
const forgotFeedback = document.getElementById('auth-feedback')
const forgotButton = forgotForm?.querySelector('button[type="submit"]')

const setForgotFeedback = (message, type = '') => {
  if (!forgotFeedback) return
  forgotFeedback.textContent = message || ''
  forgotFeedback.className = `auth-feedback${type ? ` is-${type}` : ''}`
}

forgotForm?.addEventListener('submit', async (event) => {
  event.preventDefault()

  const email = document.getElementById('email').value.trim()

  forgotButton.disabled = true
  forgotButton.textContent = 'Enviando...'
  setForgotFeedback('')

  try {
    const data = await window.RAJJ.apiFetch('/esqueci-senha', {
      method: 'POST',
      body: { email },
    })

    setForgotFeedback(data.message || 'Solicitacao enviada.', 'success')
  } catch (error) {
    setForgotFeedback(error.message || 'Erro ao enviar solicitacao.', 'error')
  } finally {
    forgotButton.disabled = false
    forgotButton.textContent = 'Enviar link'
  }
})
