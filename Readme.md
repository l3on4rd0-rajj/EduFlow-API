# API Node (Gestao escolar)

API Node.js com Express, Prisma e MongoDB para autenticacao, gestao de usuarios, alunos, contas e envio de e-mails.

## Funcionalidades

- Cadastro e login de usuarios com JWT.
- MFA opcional por codigo enviado por e-mail.
- Recuperacao e redefinicao de senha por e-mail.
- CRUD de alunos com upload de foto/documentos.
- CRUD de contas a pagar/receber com filtros e lembretes por e-mail.
- Rotas administrativas protegidas.
- Frontend estatico opcional em `teste-front/`.
- Documentacao Swagger em `/api-docs` fora de producao, ou em producao quando `EXPOSE_API_DOCS=true`.
- Logs estruturados e testes automatizados com `node --test`.

## Stack

- Node.js com ES Modules
- Express
- Prisma + MongoDB
- JWT com `jsonwebtoken`
- Uploads com `multer`
- E-mail com `nodemailer`
- Swagger com `swagger-jsdoc` e `swagger-ui-express`

## Requisitos

- Node.js 20 ou superior recomendado.
- npm.
- MongoDB com replica set habilitado para uso completo com Prisma.

## Configuracao

Copie o arquivo de exemplo e preencha os valores locais:

```bash
cp .env.example .env
```

Nunca versione `.env` nem outros arquivos com segredos reais. O `.env.example` deve manter apenas placeholders.

Variaveis principais:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=mongodb://mongo:27017/willdb
JWT_SECRET=change_this_jwt_secret
RESET_PASSWORD_SECRET=change_this_reset_secret
MFA_CHALLENGE_SECRET=change_this_mfa_secret
APP_URL=http://localhost:8080
CORS_ALLOWED_ORIGINS=http://localhost:8080
SERVE_STATIC_FRONTEND=false
FRONTEND_DIR=teste-front
EXPOSE_API_DOCS=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=change_this_smtp_password
SMTP_FROM=you@example.com
SMTP_TLS_REJECT_UNAUTHORIZED=true
MFA_ENABLED=false
CONTA_EMAIL_NOTIFICATIONS_ENABLED=false
```

Em producao, `JWT_SECRET`, `RESET_PASSWORD_SECRET` e `MFA_CHALLENGE_SECRET` sao obrigatorias. Tambem nao use `SMTP_TLS_REJECT_UNAUTHORIZED=false` em producao.

Em ambiente local com Docker, se a rede ou antivirus interceptar TLS do SMTP, use `SMTP_TLS_REJECT_UNAUTHORIZED=false` junto de `ALLOW_INSECURE_SMTP_TLS=true` apenas para desenvolvimento.

## Instalacao e execucao local

```bash
npm install
npx prisma generate
node server.js
```

A API sobe por padrao em `http://localhost:3000`.

## Execucao com Docker

```bash
docker compose up --build
```

Se o plugin Compose v2 nao estiver disponivel, use:

```bash
docker-compose up --build
```

O `docker-compose.yml` inicia a API, um MongoDB com replica set local e um Nginx para servir o frontend estatico de `teste-front/`.

- Frontend via Nginx: `http://localhost:8080`
- API Node direta: `http://localhost:3000`

A API usa o arquivo `.env`, que deve existir localmente e nao deve ser commitado. Para usar o frontend pelo Nginx, configure `APP_URL=http://localhost:8080`, `CORS_ALLOWED_ORIGINS=http://localhost:8080`, `SERVE_STATIC_FRONTEND=false`, `JWT_SECRET`, `RESET_PASSWORD_SECRET` e `MFA_CHALLENGE_SECRET`.

## Scripts

- `npm test`: executa todos os testes.
- `npm run test:unit`: executa testes de middlewares e utils.
- `npm run test:functional`: executa testes de rotas.
- `npx prisma generate`: gera o Prisma Client.
- `node server.js`: inicia a API.

## Rotas principais

- `POST /cadastro`
- `POST /login`
- `POST /login/mfa/verify`
- `POST /esqueci-senha`
- `POST /reset-password`
- `GET /private/listar-usuarios`
- `PATCH /private/usuarios/:id`
- `PATCH /private/usuarios/:id/inativar`
- `POST /api/aluno`
- `GET /api/alunos`
- `GET /api/aluno/:id`
- `PATCH /api/aluno/:id`
- `DELETE /api/aluno/:idAluno`
- `POST /api/conta`
- `GET /api/contas`
- `GET /api/conta/:id`
- `PATCH /api/conta/:id`
- `DELETE /api/conta/:id`

Rotas sob `/api`, `/private` e `/uploads` exigem token JWT. Rotas administrativas tambem exigem usuario admin.

## Estrutura

- `server.js`: ponto de entrada da aplicacao.
- `routes/`: rotas publicas, privadas, alunos e contas.
- `middlewares/`: autenticacao e logging.
- `utils/`: Prisma, mailer, logger e notificacoes.
- `prisma/schema.prisma`: modelos do banco.
- `tests/`: testes automatizados.
- `teste-front/`: frontend estatico opcional.
- `docs/`: documentacao complementar.

## Cuidados de versionamento

Nao commite:

- `.env`, `.env.*` ou qualquer arquivo com segredo real.
- `node_modules/`, `generated/`, `uploads/`, `logs/`, `coverage/`.
- `docker-images/`, `*.tar`, `*.zip` e outros artefatos locais.
- `owaspT10.md` ou `owapT10.md`.

Antes de commitar, confira:

```bash
git status --short
git diff --check
```

## Testes

```bash
npm test
```
