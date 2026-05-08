// ══════════════════════════════════════════════════════
//  SOS Animal Help — Backend PIX (Veno Payments)
//  Arquivo: backend/server.js  [VERSÃO CORRIGIDA]
// ══════════════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const axios   = require('axios');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const VENO_BASE_URL = 'https://beta.venopayments.com';
const VENO_API_KEY  = process.env.VENO_API_KEY;

// ── POST /criar-pix ──────────────────────────────────
app.post('/criar-pix', async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valor inválido.' });
    }

    // FIX PRINCIPAL: callback_url vazio causava erro 400 na Veno.
    // Só inclui o campo se estiver definido no .env.
    const payload = {
      amount:      Math.round(Number(amount)),
      description: description || 'Doacao SOS Animal Help',
      external_id: `sos-${Date.now()}`,
    };

    if (process.env.WEBHOOK_URL) {
      payload.callback_url = process.env.WEBHOOK_URL;
    }

    console.log('[criar-pix] Enviando para Veno:', JSON.stringify(payload));

    const response = await axios.post(
      `${VENO_BASE_URL}/api/v1/pix`,
      payload,
      {
        headers: {
          Authorization:  `Bearer ${VENO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const pix = response.data;
    console.log('[criar-pix] PIX criado! ID:', pix.id);

    res.json({
      id:             pix.id,
      pix_copy_paste: pix.pix_copy_paste,
      qr_code_image:  pix.qr_code_image,
      expires_at:     pix.expires_at,
      amount:         pix.amount,
    });

  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data   || err.message;

    console.error('══════════════════════════════════');
    console.error('[criar-pix] ERRO HTTP', status);
    console.error('Resposta da Veno:', JSON.stringify(detail, null, 2));
    console.error('API Key usada:', VENO_API_KEY ? VENO_API_KEY.slice(0,20)+'...' : 'NAO DEFINIDA');
    console.error('══════════════════════════════════');

    res.status(status).json({ error: 'Erro ao criar PIX.', detail });
  }
});

// ── GET /status-pix/:id ──────────────────────────────
app.get('/status-pix/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `${VENO_BASE_URL}/api/v1/pix/${req.params.id}/status`,
      { headers: { Authorization: `Bearer ${VENO_API_KEY}` }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data   || err.message;
    console.error('[status-pix] Erro:', detail);
    res.status(status).json({ error: 'Erro ao consultar PIX.', detail });
  }
});

// ── POST /webhook ────────────────────────────────────
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  console.log('[webhook] Evento:', event);
  if (event === 'pix.paid')     console.log(`PAGO R$ ${(data.amount/100).toFixed(2)} - ${data.payer?.name}`);
  if (event === 'pix.expired')  console.log(`EXPIRADO: ${data.id}`);
  if (event === 'pix.refunded') console.log(`ESTORNADO: ${data.id}`);
  res.sendStatus(200);
});

// ── Health ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Start ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\nServidor rodando na porta ${PORT}`);
  if (!VENO_API_KEY) {
    console.warn('ATENCAO: VENO_API_KEY nao definida no .env!');
  } else {
    console.log('API Key carregada:', VENO_API_KEY.slice(0, 20) + '...\n');
  }
});
