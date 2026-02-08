# 🔧 Troubleshooting - Sistema de Logging

## ❓ Problemas Comuns e Soluções

### 1. **Logs não estão sendo criados na pasta `logs/`**

**Problema:** A pasta `logs/` não aparece ou os arquivos não são criados

**Solução:**
- Verifique se a aplicação está rodando corretamente
- Certifique-se de que a pasta tem permissão de escrita
- Tente criar a pasta manualmente: `mkdir logs`
- Rode um teste de escrita:
  ```bash
  node -e "require('fs').writeFileSync('logs/test.log', 'teste')"
  ```

---

### 2. **Dados sensíveis aparecem nos logs**

**Problema:** Senhas, tokens ou outros dados aparecem em texto claro

**Solução:**
- ❌ **NÃO PASSE DADOS SENSÍVEIS DIRETAMENTE:**
  ```javascript
  // ❌ ERRADO
  logger.info('Dados', { password: user.password, token: token })
  
  // ✅ CERTO - O logger faz a redação automaticamente
  logger.info('User criado', { userId: user.id, email: user.email })
  ```

- O logger redacta automaticamente chaves que contenham: `password`, `token`, `secret`, `api_key`, `cpf`, `phone`
- Se precisa redactar outras chaves, adicione à array `sensitiveKeys` em `utils/logger.js`

---

### 3. **Logs em Debug não aparecem**

**Problema:** `logger.debug()` não está gerando output

**Solução:**
- Debug logs só aparecem quando `DEBUG=true` no `.env`
- Adicione ao arquivo `.env`:
  ```env
  DEBUG=true
  ```
- Reinicie a aplicação
- Agora você verá logs em `logs/debug-YYYY-MM-DD.log` e no console

---

### 4. **Erro: "Cannot find module '../utils/logger.js'"**

**Problema:** Arquivo de logger não está sendo encontrado

**Solução:**
- Verifique se o arquivo `utils/logger.js` existe
- Verifique se o caminho está correto (relativo ao arquivo que está importando)
- Se está em uma pasta diferente, ajuste o import:
  ```javascript
  // Se estiver em routes/
  import logger from '../utils/logger.js'
  
  // Se estiver em controllers/
  import logger from '../../utils/logger.js'
  ```

---

### 5. **Arquivo de log muito grande**

**Problema:** O arquivo `general-YYYY-MM-DD.log` ficou muito grande

**Solução:**
- Isso é normal! Os logs são separados por dia
- Cada dia terá seu próprio arquivo (ex: `general-2026-02-08.log`)
- Você pode comprimir logs antigos:
  ```bash
  gzip logs/general-2026-02-07.log
  ```
- Ou criar um script para limpar logs com mais de X dias

---

### 6. **Performance: Logs estão deixando a aplicação lenta**

**Problema:** Aplicação está mais lenta depois de adicionar logs

**Solução:**
- Escrever em arquivo é assíncrono, mas o I/O pode impactar
- **Opção 1:** Desabilitar debug em produção (não escrever em `debug-*.log`)
- **Opção 2:** Em `.env`:
  ```env
  DEBUG=false
  ```
- **Opção 3:** Adicionar um serviço de logs externo (Sentry, LogRocket)
  - Envia logs para servidor externo sem bloquear a aplicação

---

### 7. **Erro ao inicializar: "Cannot read property 'split' of undefined"**

**Problema:** Erro ao tentar fazer split de um valor undefined

**Solução:**
- Geralmente ocorre em `logger.http()` quando `req.ip` é undefined
- Adicione validação:
  ```javascript
  const ip = req.ip || req.connection.remoteAddress || 'unknown'
  logger.http(...)
  ```

---

### 8. **Cores não aparecem no console (Windows)**

**Problema:** Cores ANSI não funcionam no PowerShell do Windows

**Solução:**
- PowerShell moderno (7.0+) suporta cores ANSI
- Se usar CMD antigo, as cores podem não aparecer (mas os logs continuam sendo salvos!)
- **Recomendado:** Use PowerShell 7+ ou Windows Terminal

```powershell
# Instalar Windows Terminal (recomendado)
# Ou atualizar PowerShell:
winget install PowerShell
```

---

### 9. **Context vazio ou undefined nos logs**

**Problema:** Logs mostram `Context: {}`

**Solução:**
- Você pode não estar passando contexto
- ✅ **CORRETO:**
  ```javascript
  logger.info('Algo', { userId: user.id, action: 'create' })
  ```
- Se não quer contexto, simplesmente não passe:
  ```javascript
  logger.info('Algo')
  ```

---

### 10. **Erro: "EACCES: permission denied" ao criar pasta logs**

**Problema:** Permissão negada para criar pasta `logs/`

**Solução:**
- Verifique permissões da pasta do projeto:
  ```bash
  # Windows
  icacls . /grant "%USERNAME%":F /t
  
  # Linux/Mac
  chmod 755 .
  ```
- Ou crie manualmente a pasta antes:
  ```bash
  mkdir -p logs
  chmod 755 logs
  ```

---

## 🧪 Teste o Logger

### Teste Rápido:
```javascript
// No seu server.js ou arquivo de teste
import logger from './utils/logger.js'

logger.info('Teste INFO')
logger.warn('Teste WARN')
logger.error('Teste ERROR', new Error('Teste Error'))
logger.success('Teste SUCCESS')
logger.userAction('teste_acao', 'user123', { teste: true })
logger.http('GET', '/teste', 200, 150, 'user123')
logger.auth('teste_auth', 'email@test.com', 'success')
logger.database('CREATE', 'teste_table', 'success', { id: 1 })

console.log('✅ Todos os tipos de log foram testados!')
console.log('✅ Verifique a pasta "logs/" para ver os arquivos gerados')
```

---

## 📊 Validar Tudo Está Funcionando

Checklist:
- [ ] Pasta `logs/` foi criada
- [ ] Arquivos `*.log` foram criados na pasta `logs/`
- [ ] Logs aparecem com cores no console
- [ ] Arquivos separados por tipo (general, errors, auth, etc.)
- [ ] Dados sensíveis (password, token) aparecem como `***REDACTED***`
- [ ] IP do usuário e duração das requisições nos logs HTTP

---

## 🆘 Ainda Não Funcionou?

### Debug Checklist:
1. Verifique se `utils/logger.js` existe e tem conteúdo
2. Verifique se `middlewares/logging.js` existe
3. Verifique se `server.js` tem o import: `import { httpLoggingMiddleware } from './middlewares/logging.js'`
4. Verifique se o middleware está sendo usado: `app.use(httpLoggingMiddleware)`
5. Rode a aplicação e faça uma requisição (ex: POST /login)
6. Verifique pasta `logs/` para ver se os arquivos foram criados

### Se tudo falhar:
- Procure por mensagens de erro no console
- Copie o stack trace e procure no Google
- Verifique os caminhos dos arquivos estão corretos
- Certifique-se que `package.json` tem `"type": "module"` (para imports ES6)

---

✨ **Se ainda houver dúvidas, verifique `LOGGING.md` para documentação completa!**
