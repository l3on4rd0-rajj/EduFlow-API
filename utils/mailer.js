import nodemailer from 'nodemailer'

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

const mailer = {
  sendMail(options) {
    return transporter.sendMail(options)
  },
}

export default mailer
