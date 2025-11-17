// teste-front/js/reset-password.js

// Pega o token da URL
const params = new URLSearchParams(window.location.search)
const token = params.get('token')

// Elementos
const form = document.getElementById('resetForm')
const msg = document.getElementById('msg')

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const password = document.getElementById('password').value
  const confirmPassword = document.getElementById('confirmPassword').value

  if (password !== confirmPassword) {
    msg.textContent = 'As senhas não coincidem.'
    return
  }

  try {
    const resp = await fetch('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })

    const data = await resp.json()
    msg.textContent = data.message || 'Resposta recebida.'
  } catch (err) {
    console.error(err)
    msg.textContent = 'Erro ao enviar requisição.'
  }
})
