import axios from 'axios';

export async function handler(event) {
  try {
    const { amount, description } = JSON.parse(event.body);

    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Valor inválido.' }),
      };
    }

    const payload = {
      amount: Math.round(Number(amount)),
      description: description || 'Doacao SOS Animal Help',
      external_id: `sos-${Date.now()}`,
    };

    if (process.env.WEBHOOK_URL) {
      payload.callback_url = process.env.WEBHOOK_URL;
    }

    const response = await axios.post(
      'https://beta.venopayments.com/api/v1/pix',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.VENO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        id: response.data.id,
        pix_copy_paste: response.data.pix_copy_paste,
        qr_code_image: response.data.qr_code_image,
        expires_at: response.data.expires_at,
        amount: response.data.amount,
      }),
    };

  } catch (err) {
    const status = err.response?.status || 500;
    const detail = err.response?.data || err.message;

    return {
      statusCode: status,
      body: JSON.stringify({ error: 'Erro ao criar PIX', detail }),
    };
  }
}