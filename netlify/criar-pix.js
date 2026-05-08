import axios from 'axios'

export async function handler(event) {
  try {
    const data = JSON.parse(event.body)

    const response = await axios.post(
      'https://beta.venopayments.com/api/v1/pix',
      {
        amount: data.amount,
        description: data.description || 'Doação via PIX'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.VENO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )

    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    }

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erro ao gerar PIX' })
    }
  }
}