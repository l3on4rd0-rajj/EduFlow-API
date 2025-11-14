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