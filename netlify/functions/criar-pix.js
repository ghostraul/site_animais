const https = require('https');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { amount, description } = JSON.parse(event.body);

    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Valor inválido.' }),
      };
    }

    const payload = JSON.stringify({
      amount: Math.round(Number(amount)),
      description: description || 'Doacao SOS Animal Help',
      external_id: `sos-${Date.now()}`,
      ...(process.env.WEBHOOK_URL ? { callback_url: process.env.WEBHOOK_URL } : {}),
    });

    const apiKey = process.env.VENO_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Chave de API não configurada. Adicione VENO_API_KEY nas variáveis de ambiente do Netlify.' }),
      };
    }

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'beta.venopayments.com',
        path: '/api/v1/pix',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
      req.write(payload);
      req.end();
    });

    if (data.status >= 400) {
      return {
        statusCode: data.status,
        body: JSON.stringify({ error: 'Erro na API de pagamento', detail: data.data }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: data.data.id,
        pix_copy_paste: data.data.pix_copy_paste,
        qr_code_image: data.data.qr_code_image,
        expires_at: data.data.expires_at,
        amount: data.data.amount,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao criar PIX', detail: err.message }),
    };
  }
};
