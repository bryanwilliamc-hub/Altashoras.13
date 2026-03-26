const { abacateRequest, corsHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  Object.entries(corsHeaders()).forEach(([key, val]) => res.setHeader(key, val));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // billingId vem como query param (rewrite de /api/verificar-pagamento/:pedidoId não se aplica aqui)
    // O frontend vai enviar billingId como query param
    const { billingId } = req.query;

    if (!billingId) {
      return res.status(400).json({ error: 'billingId é obrigatório', status: 'erro' });
    }

    // Consultar status no Abacate Pay
    const resultado = await abacateRequest(`/billing/status/${billingId}`);

    if (resultado.data) {
      const status = resultado.data.status;
      const pago = status === 'PAID';

      return res.status(200).json({
        billingId,
        status,
        pago
      });
    }

    res.status(200).json({
      billingId,
      status: 'PENDING',
      pago: false
    });

  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    res.status(200).json({
      billingId: req.query.billingId,
      status: 'erro',
      pago: false
    });
  }
};
