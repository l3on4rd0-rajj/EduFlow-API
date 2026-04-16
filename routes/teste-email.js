import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
dotenv.config()

const rejectUnauthorized =
  process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized,
  },
})

async function main() {
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.SMTP_USER, // manda pra você mesmo
      subject: 'Teste SMTP RAJJ',
      text: 'Funcionou!',
    })

    console.log('Email enviado:', info.messageId)
  } catch (error) {
    console.error('Erro:', error)
  }
}

main()
