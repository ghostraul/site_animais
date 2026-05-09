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

    const apiKey = process.env.VENO_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'VENO_API_KEY não configurada nas variáveis de ambiente do Netlify.' }),
      };
    }

    const payload = JSON.stringify({
      amount: Math.round(Number(amount)),
      description: description || 'Doacao SOS Animal Help',
      external_id: `sos-${Date.now()}`,
      ...(process.env.WEBHOOK_URL ? { callback_url: process.env.WEBHOOK_URL } : {}),
    });

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
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout na API Veno')); });
      req.write(payload);
      req.end();
    });

    // Log para debug (aparece nos logs do Netlify Functions)
    console.log('[criar-pix] Status da API:', data.status);
    console.log('[criar-pix] Campos retornados:', Object.keys(data.data || {}));
    console.log('[criar-pix] qr_code_image tipo:', typeof data.data?.qr_code_image);
    console.log('[criar-pix] qr_code_image valor (primeiros 80 chars):', String(data.data?.qr_code_image || '').substring(0, 80));

    if (data.status >= 400) {
      return {
        statusCode: data.status,
        body: JSON.stringify({ error: 'Erro na API de pagamento', detail: data.data }),
      };
    }

    const qrRaw = data.data.qr_code_image || data.data.qrcode_image || data.data.qr_image || data.data.qrcode || '';

    // Normaliza: remove prefixo data:image se vier da API já com ele
    const qrClean = qrRaw.replace(/^data:image\/[a-z]+;base64,/, '');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:             data.data.id,
        pix_copy_paste: data.data.pix_copy_paste || data.data.copy_paste || data.data.emv || '',
        qr_code_image:  qrClean,
        expires_at:     data.data.expires_at,
        amount:         data.data.amount,
        // Devolve os campos brutos para debug fácil
        _debug_fields:  Object.keys(data.data),
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao criar PIX', detail: err.message }),
    };
  }
};
