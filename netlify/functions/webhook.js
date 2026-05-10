exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (body.event !== "pix.paid") {
    return { statusCode: 200, body: "ignored" };
  }

  const amount = body.data?.amount / 100;

  const payload = {
    pixel_code: "D7Q3LGJC77U4TTGIF2F0",
    events: [{
      event: "Purchase",
      timestamp: new Date().toISOString(),
      properties: {
        value: amount,
        currency: "BRL",
        contents: [{
          content_id: body.data?.id,
          content_name: "Doação",
          quantity: 1,
          price: amount
        }]
      }
    }]
  };

  try {
    await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": "c717ba54b582789eb727f7d62d0a647fca892912"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Erro ao enviar para TikTok:", e);
  }

  return { statusCode: 200, body: "ok" };
};
