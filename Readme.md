# API Node (Gestao escolar)

API Node.js com Express e Prisma para autenticacao, gestao de alunos, contas e envio de e-mails.

## Principais funcionalidades

- Autenticacao baseada em JWT
- Registro e login de usuarios
- MFA opcional por codigo enviado por e-mail
- Recuperacao e redefinicao de senha por e-mail
- Cadastro e gestao de alunos
- Cadastro e gestao de contas
- Documentacao Swagger integrada

## Stack

- Node.js
- Express
- Prisma + `@prisma/client`
- MongoDB
- JWT com `jsonwebtoken`
- E-mail com `nodemailer`

## Instalacao rapida

```bash
npm install
node server.js
```

## Variaveis de ambiente

Exemplo basico:

```env
DATABASE_URL=mongodb://mongo:27017/willdb
PORT=3000
JWT_SECRET=uma_chave_secreta_segura
APP_URL=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
SERVE_STATIC_FRONTEND=true
FRONTEND_DIR=teste-front
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
SMTP_FROM=usuario@example.com
SMTP_TLS_REJECT_UNAUTHORIZED=true
MFA_ENABLED=false
MFA_CHALLENGE_SECRET=uma_chave_secreta_para_desafios_mfa
MFA_CODE_TTL_MINUTES=10
MFA_CODE_LENGTH=6
```

Variaveis uteis:

- `APP_URL`: URL base usada nos links enviados por e-mail.
- `CORS_ALLOWED_ORIGINS`: origens permitidas no CORS, separadas por virgula.
- `SERVE_STATIC_FRONTEND`: quando `true`, a API tambem serve o front estatico em `teste-front/`.
- `FRONTEND_DIR`: pasta estatica servida quando `SERVE_STATIC_FRONTEND=true`.
- `MFA_ENABLED`: ativa o segundo fator por e-mail no login.

## Scripts

- `npm test`
- `node server.js`
- `npx prisma generate`

## Estrutura principal

- `server.js`: ponto de entrada da aplicacao
- `routes/`: rotas publicas e privadas
- `middlewares/`: middlewares como autenticacao e logging
- `prisma/`: schema do Prisma
- `tests/`: testes automatizados
- `teste-front/`: frontend estatico servido pela API

## Seguranca

- JWT para rotas protegidas
- Rate limiting global
- Validacao de senha forte
- MFA por e-mail opcional no login
- Helmet e sanitizacao de entrada

## Testes

```bash
npm test
```

## Suporte

Abra uma issue no repositorio para duvidas ou problemas.
