# SOS Animal Help — Integração PIX (Veno Payments)

## 📁 Estrutura de arquivos

```
/
├── backend/
│   ├── server.js       ← servidor Node.js
│   ├── package.json
│   ├── .env            ← sua API Key fica aqui (nunca suba no GitHub)
│   └── .gitignore
│
└── frontend/
    ├── index.html
    ├── css/
    │   └── styles.css
    └── js/
        └── main.js     ← integração com o backend
```

---

## Como rodar localmente

### 1. Backend

```bash
cd backend
npm install
```

Edite o arquivo .env e cole sua API Key:
```
VENO_API_KEY=veno_live_SUA_CHAVE_AQUI
```

Inicie o servidor:
```bash
node server.js
```

O servidor roda em: http://localhost:3000

### 2. Frontend

Abra o frontend/index.html com a extensão Live Server do VS Code,
ou sirva com:
```bash
cd frontend
npx serve .
```

---

## Como colocar em producao

### Backend — Railway

1. Acesse https://railway.app
2. New Project > Deploy from GitHub Repo
3. Suba a pasta backend/ no GitHub (sem o .env!)
4. No Railway, adicione as variaveis de ambiente:
   - VENO_API_KEY = sua chave
   - WEBHOOK_URL  = https://seu-projeto.railway.app/webhook
5. URL publica gerada automaticamente.

### Frontend — Vercel / Netlify / Hostinger

Suba a pasta frontend/ normalmente.

Depois edite js/main.js linha 14:

  // TROQUE:
  const BACKEND_URL = 'http://localhost:3000';

  // POR:
  const BACKEND_URL = 'https://seu-projeto.railway.app';

---

## Configurar Webhook

No painel da Veno:
Dashboard > Integracoes > Webhooks > Adicionar URL

Cole: https://seu-projeto.railway.app/webhook

Ative os eventos:
  - pix.paid
  - pix.expired
  - pix.refunded

---

## Fluxo completo

  1. Usuario escolhe valor
  2. Order Bump aparece
  3. Usuario confirma -> JS chama /criar-pix no backend
  4. Backend chama a API da Veno com a API Key (segura, nunca exposta)
  5. Veno retorna QR Code + Copia e Cola
  6. Modal exibe QR Code real
  7. A cada 5s o JS consulta /status-pix/:id
  8. PIX pago -> tela de confirmacao aparece automaticamente
  9. Webhook notifica o backend em paralelo
