const { corsHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, val]) => res.setHeader(key, val));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { event, data } = req.body;
    console.log(`Webhook Abacate: ${event}`, JSON.stringify(data));
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
};
