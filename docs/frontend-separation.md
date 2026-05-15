# Separacao entre API e front-end

O projeto agora tem duas opcoes de front:

- `teste-front/`: versao HTML/CSS/JS original evoluida.
- `frontend/`: nova versao em React com Vite, mantendo a mesma API.

## Como funciona

- No front estatico, o helper em `teste-front/assets/js/app-core.js` resolve a URL da API.
- No front React, o helper em `frontend/src/lib/api.js` usa `VITE_API_URL` ou assume `http://localhost:3000` quando o dev server roda em `http://localhost:5173`.

## Front React

Para usar a nova stack:

```env
SERVE_STATIC_FRONTEND=false
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
APP_URL=http://localhost:5173
```

Depois:

```bash
cd frontend
npm install
npm run dev
```

## Back-end

As origens permitidas agora podem ser controladas por `CORS_ALLOWED_ORIGINS`.

Exemplo:

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://app.exemplo.com
SERVE_STATIC_FRONTEND=false
```

Com `SERVE_STATIC_FRONTEND=false`, a API deixa de servir o front estatico e fica pronta para rodar como servico separado.
