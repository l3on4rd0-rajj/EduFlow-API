# 📝 API Node (Gestão escolar)

Este repositório contém uma API Node.js construída com Express e Prisma, focada em autenticação segura (JWT), gerenciamento de contas e integração com e-mail. Este README foi preparado para equipes de desenvolvimento que precisam configurar, rodar, testar e contribuir com a aplicação.

## Sumário

- [Visão Geral](#vis%C3%A3o-geral)
- [Principais funcionalidades](#principais-funcionalidades)
- [Stack Tecnológica](#stack-tecnol%C3%B3gica)
- [Pré-requisitos](#pr%C3%A9-requisitos)
- [Instalação Rápida](#instala%C3%A7%C3%A3o-r%C3%A1pida)
- [Variáveis de Ambiente](#vari%C3%A1veis-de-ambiente)
- [Comandos úteis / Scripts](#comandos-%C3%BAteis--scripts)
- [Banco de Dados / Prisma](#banco-de-dados--prisma)
- [Docker / docker-compose](#docker--docker-compose)
- [Rotas principais e estrutura de pastas](#rotas-principais-e-estrutura-de-pastas)
- [Autenticação e segurança](#autentica%C3%A7%C3%A3o-e-seguran%C3%A7a)
- [Testes e qualidade de código](#testes-e-qualidade-de-c%C3%B3digo)
- [Contribuição](#contribui%C3%A7%C3%A3o)
- [Soluções de problemas comuns](#solu%C3%A7%C3%B5es-de-problemas-comuns)
- [Contato / Suporte](#contato--suporte)

## Visão geral

API para gerenciamento de usuários, contas e autenticação. Fornece endpoints públicos e privados, suporte a envio de e-mails (recuperação de senha), upload de arquivos simples e integrações com Prisma como ORM.

## Principais funcionalidades

- Autenticação baseada em JWT
- Registro e login de usuários
- Recuperação/Reset de senha via e-mail
- Uploads simples com `multer`
- Documentação Swagger integrada (dependências presentes)
- Boas práticas de segurança: `helmet`, rate limiting, sanitização de entradas

## Stack Tecnológica

- Node.js (ES Modules)
- Express
- Prisma + `@prisma/client`
- Banco de dados (qualquer suportado pelo Prisma; variável `DATABASE_URL` controla a conexão)
- Autenticação JWT (`jsonwebtoken`)
- Env: `dotenv`
- Envio de e-mail: `nodemailer`
- Segurança: `helmet`, `express-rate-limit`, `express-mongo-sanitize`

## Pré-requisitos

- Node.js v18+ instalado
- npm (ou yarn)
- Um banco de dados compatível com Prisma (Postgres, MySQL, SQLite, etc.)
- (Opcional) Docker e docker-compose para rodar database e/ou containerizar a app

## Instalação Rápida

1. Clone o repositório

```bash
git clone <repo-url>
cd api-node
```

2. Instale dependências

```bash
npm install
```

3. Gere o cliente Prisma (necessário sempre que o schema mudar)

```bash
npx prisma generate
```

4. Aplique migrations (se houver)

```bash
npx prisma migrate dev --name init
```

5. Inicie a aplicação em modo de desenvolvimento

```bash
node server.js
```

Observação: este repositório atualmente não contém scripts npm personalizados além de `test`. Você pode adicionar scripts úteis em `package.json`, por exemplo:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "prisma:generate": "npx prisma generate",
  "prisma:migrate": "npx prisma migrate dev"
}
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz com as variáveis abaixo (exemplo):

```
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
PORT=3000
JWT_SECRET=uma_chave_secreta_segura
JWT_EXPIRES_IN=1d
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario
SMTP_PASS=senha
```

Explique qualquer variável adicional específica do projeto que a equipe precise conhecer.

## Comandos úteis / Scripts

- `npm install` — instala dependências
- `node server.js` — inicia a aplicação (produção básica)
- `npx prisma generate` — gera o client do Prisma
- `npx prisma migrate dev` — aplica migrations localmente
- `docker-compose up` — (se usar `docker-compose.yml`) sobe containers definidos

## Banco de Dados / Prisma

- O projeto já usa `@prisma/client` e `prisma` como devDependency.
- Fluxo recomendado:
  1. Defina `DATABASE_URL` em `.env`.
  2. Execute `npx prisma generate`.
  3. Aplique migrations com `npx prisma migrate dev`.
  4. Caso use seed, execute o script de seed (implemente conforme necessário).

Arquivos relevantes:
- `prisma/schema.prisma` — modelo do banco
- `generated/` — cliente gerado (normalmente não versionar o client; idealmente gerar localmente)

## Docker / docker-compose

O repositório contém `docker-compose.yml` e `dockerfile`. Exemplos de uso:

```bash
docker-compose up --build
```

Isso pode subir o banco de dados e a aplicação dependendo da configuração do `docker-compose.yml`.

## Rotas principais e estrutura de pastas

- `server.js` — ponto de entrada (ex.: carga do Express, middlewares e rotas)
- `routes/` — rotas da API (ex.: `public.js`, `private.js`, `alunos.js`, `contas.js`)
- `middlewares/` — middlewares (ex.: `auth.js`)
- `prisma/` — schema do prisma e migrations
- `generated/` — cliente Prisma compilado
- `uploads/` — arquivos enviados

Documente endpoints importantes, por exemplo:

- `POST /auth/register` — registrar usuário
- `POST /auth/login` — login e recebimento de JWT
- `POST /auth/forgot-password` — envia e-mail de recuperação
- `POST /auth/reset-password` — reseta senha

Observação: Verifique os arquivos em `routes/` para confirmar rotas, parâmetros e exemplos de payload.

## Autenticação e segurança

- Tokens JWT usados para rotas privadas (middleware de verificação em `middlewares/auth.js`).
- Rate limiting aplicado para proteger endpoints sensíveis (ex.: login).
- `helmet`, `express-mongo-sanitize`, e outras proteções aplicadas para mitigar ataques comuns.

Boas práticas adicionais recomendadas:
- Rotacionar `JWT_SECRET` com cuidado (invalidação de tokens pode ser necessária).
- Usar HTTPS em produção.

## Testes e qualidade de código

- Atualmente não há testes automatizados configurados (`package.json` contém apenas `test` padrão).
- Recomenda-se adicionar uma suíte de testes (Jest, Vitest) e scripts em `package.json`.
- Adicionar lint (ESLint) e formatação (Prettier) para manter padrões.

## Contribuição

Para contribuir:

1. Fork do repositório
2. Crie branch com o formato `feat/<descrição>` ou `fix/<descrição>`
3. Adicione testes quando aplicável
4. Abra Pull Request descrevendo a mudança e motivação

## Soluções de problemas comuns

- Erro de conexão com o banco: verifique `DATABASE_URL` e se o DB está rodando
- Erros do Prisma P2002 (unique constraint): trate via checagens antes de inserir
- Problemas de envio de e-mail: valide credenciais SMTP e portas

## Contato / Suporte

Para dúvidas, abra uma issue ou contate os mantenedores do projeto.

---

Se desejar, eu posso também:

- adicionar scripts recomendados em `package.json` automaticamente;
- incluir um exemplo de `.env.example`;
- gerar um template de PR/ISSUE para o repositório.

Fim.
# 📝 API de Autenticação Segura

Esta API oferece um sistema de autenticação robusto com várias camadas de segurança e boas práticas de desenvolvimento.

## 🔒 Recursos de Segurança Implementados

- **Autenticação JWT**: Middleware bem definido para validação de tokens
- **Proteção contra ataques**: 
  - Rate Limiting para prevenir brute force
  - Helmet para headers de segurança HTTP
- **Controle de acesso**: 
  - Limite de tentativas de login falhas por IP
  - Validação de senha forte no registro
- **Boas práticas**: 
  - Tratamento adequado de erros do Prisma (como P2002 para registros duplicados)
  - Código limpo e organizado

## 🛠️ Configuração

### Pré-requisitos
- Node.js (v18 ou superior)
- npm ou yarn
- Banco de dados configurado com Prisma

### Instalação
```bash
npm install
