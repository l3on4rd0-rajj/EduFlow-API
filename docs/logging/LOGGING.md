# 📊 Sistema de Logging

Um sistema completo e robusto de logging foi implementado na aplicação para fornecer visibilidade total das operações, erros e ações do usuário **sem comprometer dados sensíveis**.

## 📁 Arquivos Criados/Modificados

- **`utils/logger.js`** - Utilitário principal de logging
- **`middlewares/logging.js`** - Middleware para logar requisições HTTP
- **`middlewares/auth.js`** - Atualizado com logs de autenticação
- **`routes/public.js`** - Atualizado com logs de ações do usuário
- **`server.js`** - Atualizado para usar middlewares de logging

## 🎯 Funcionalidades do Logger

### 1. **Tipos de Log**

| Tipo | Método | Descrição |
|------|--------|-----------|
| **ERROR** | `logger.error()` | Erros da aplicação com stack trace |
| **WARN** | `logger.warn()` | Avisos e situações anômalas |
| **INFO** | `logger.info()` | Informações gerais |
| **SUCCESS** | `logger.success()` | Ações bem-sucedidas |
| **DEBUG** | `logger.debug()` | Informações de debug (apenas se `DEBUG=true`) |
| **USER_ACTION** | `logger.userAction()` | Ações do usuário (registros, logins, etc.) |
| **HTTP** | `logger.http()` | Requisições HTTP com duração |
| **AUTH** | `logger.auth()` | Eventos de autenticação |
| **DATABASE** | `logger.database()` | Operações de banco de dados |

### 2. **Logs Separados por Tipo**

Os logs são salvos em arquivos separados na pasta `logs/`:

```
logs/
├── general-2026-02-07.log      # INFO, SUCCESS
├── errors-2026-02-07.log       # ERROR
├── warnings-2026-02-07.log     # WARN
├── auth-2026-02-07.log         # AUTH (logins, tokens, etc.)
├── user-actions-2026-02-07.log # USER_ACTION (ações do usuário)
├── http-2026-02-07.log         # HTTP (requisições)
├── database-2026-02-07.log     # DATABASE (operações BD)
└── debug-2026-02-07.log        # DEBUG (quando DEBUG=true)
```

### 3. **Proteção de Dados Sensíveis**

O logger **automaticamente redacta** dados sensíveis em logs:

- `password` → `***REDACTED***`
- `token` → `***REDACTED***`
- `authorization` → `***REDACTED***`
- `secret` → `***REDACTED***`
- `api_key` → `***REDACTED***`
- `cpf` → `***REDACTED***`
- `phone` → `***REDACTED***`

**Exemplo:**
```javascript
logger.userAction('login_iniciado', 'user123', { 
  email: 'joao@example.com',
  password: '1234567890' // Será redactado automaticamente
})
// Log: [2026-02-07T10:30:45.123Z] [USER_ACTION] User: user123 | Action: login_iniciado | Details: {"email":"joao@example.com","password":"***REDACTED***"}
```

### 4. **Cores no Console**

Os logs possuem cores no console para fácil visualização:

- 🟥 **Vermelho** - Erros
- 🟨 **Amarelo** - Avisos
- 🟩 **Verde** - Sucesso e ações do usuário
- 🔵 **Azul** - Informações
- ⚫ **Cinza** - Debug

## 📝 Exemplos de Uso

### Logger de Erro
```javascript
try {
  // código que pode falhar
} catch (err) {
  logger.error('Falha ao processar documento', err, {
    userId: user.id,
    documentType: 'invoice'
  })
}
```

### Logger de Ação do Usuário
```javascript
logger.userAction('usuario_criado', userId, {
  email: user.email,
  name: user.name
})
```

### Logger HTTP
```javascript
logger.http('POST', '/api/users', 201, 145, userId, {
  params: req.params,
  query: req.query
})
```

### Logger de Autenticação
```javascript
logger.auth('login_attempt', email, 'success', {
  ip: req.ip,
  userAgent: req.get('user-agent')
})
```

## 🔧 Configuração

### Ativar Debug Mode

No seu `.env`:
```env
DEBUG=true
```

Isso ativará logs de debug na pasta `logs/debug-YYYY-MM-DD.log`.

## 📊 O Que Está Sendo Logado

### ✅ Autenticação
- Tentativas de login (sucesso e falha)
- Registros de usuário
- Redefinições de senha
- Validações de token

### ✅ Ações do Usuário
- Registro de novo usuário
- Login bem-sucedido
- Solicitação de redefinição de senha
- Email de redefinição enviado

### ✅ Erros
- Falhas em operações de banco de dados
- Erros de validação
- Erros não capturados com stack trace completo

### ✅ Requisições HTTP
- Método HTTP (GET, POST, etc.)
- Path da requisição
- Status code da resposta
- Duração da requisição em ms
- ID do usuário (se autenticado)

### ✅ Avisos (Warnings)
- Tentativas com dados inválidos
- Emails duplicados
- Senhas fracas
- Falhas na autenticação

## 🚀 Próximos Passos

Para adicionar logs a outras rotas:

```javascript
// Em suas rotas
import logger from '../utils/logger.js'

// Log de sucesso
logger.success('Aluno criado', { alunoId: aluno.id, email: aluno.email })

// Log de erro
logger.error('Erro ao atualizar aluno', err, { alunoId, field: 'email' })

// Ação do usuário
logger.userAction('aluno_criado', userId, { alunoId: aluno.id })

// Database
logger.database('CREATE', 'aluno', 'success', { alunoId: aluno.id })
```

## 📈 Visualizando Logs

### No Console (em tempo real)
Ao rodar a aplicação, você verá logs coloridos no console.

### Em Arquivo
Acesse a pasta `logs/` para ver o histórico de logs organizados por dia e tipo.

### Exemplo de Log Completo
```
[2026-02-07T10:45:32.567Z] [USER_ACTION] User: 650a2c3e4f5b6c7d8e9f0a1b | Action: login_concluido | Details: {"email":"joao@example.com","ip":"192.168.1.100"}
[2026-02-07T10:45:32.789Z] [HTTP] POST /login | Status: 200 | Duration: 234ms | User: 650a2c3e4f5b6c7d8e9f0a1b | Details: {"params":{},"query":{}}
[2026-02-07T10:45:45.123Z] [ERROR] Erro no reset de senha [POST /reset-password] Payload inválido
  Stack: Error: Invalid token
    at verifyToken (server.js:123)
  Context: {"userId":"anonymous","path":"/reset-password","method":"POST"}
```

---

**✨ O sistema está pronto para produção com máxima visibilidade e segurança!**
