const { abacateRequest, obterOuCriarCliente, corsHeaders } = require('./_utils');

module.exports = async function handler(req, res) {
  // CORS
  Object.entries(corsHeaders()).forEach(([key, val]) => res.setHeader(key, val));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { itens, cliente, endereco, retirarLoja, observacoes, total } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio ou inválido' });
    }
    if (!cliente || !cliente.nome) {
      return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
    }

    // Gerar ID do pedido
    const pedidoId = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Criar cliente no Abacate Pay
    const customerId = await obterOuCriarCliente(cliente.nome, cliente.email);

    // Criar cobrança
    const produtos = itens.map(item => ({
      externalId: String(item.id),
      name: item.nome,
      description: item.descricao || item.nome,
      quantity: item.quantidade,
      price: Math.round(item.preco * 100)
    }));

    const frontendUrl = process.env.FRONTEND_URL || `https://${req.headers.host}`;

    const billingData = {
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: produtos,
      customerId: customerId,
      returnUrl: `${frontendUrl}/index.html?pagamento=sucesso&pedido=${pedidoId}`,
      completionUrl: `${frontendUrl}/index.html?pagamento=completo&pedido=${pedidoId}`,
      metadata: {
        pedidoId,
        cliente: cliente.nome,
        endereco: endereco || 'Retirar na loja',
        observacoes: observacoes || ''
      }
    };

    const resultado = await abacateRequest('/billing/create', 'POST', billingData);

    if (resultado.error) {
      throw new Error(resultado.error);
    }

    res.status(200).json({
      success: true,
      pedidoId,
      billingId: resultado.data.id,
      initPoint: resultado.data.url,
      pixCopiaECola: resultado.data.pixCopiaECola || null,
      qrCodeBase64: resultado.data.pixQrCodeBase64 || null
    });

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ error: 'Erro ao criar pagamento', details: error.message });
  }
};
