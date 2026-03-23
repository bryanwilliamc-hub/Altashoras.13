/**
 * ========================================
 * SERVIDOR BACKEND - ADEGA ALTAS HORAS
 * Integração com Abacate Pay
 * ========================================
 */

require('dotenv').config();

// Configuração para ambiente de desenvolvimento (certificados SSL)
// Em produção, remova esta linha ou configure certificados corretamente
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================
// CONFIGURAÇÕES
// ========================================

// API do Abacate Pay
const ABACATE_API_URL = 'https://api.abacatepay.com/v1';
const ABACATE_API_KEY = process.env.ABACATE_API_KEY;

// Middleware
app.use(cors({
  origin: '*', // Em produção, especifique o domínio do seu site
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Armazenamento em memória dos pedidos (em produção, use banco de dados)
const pedidos = new Map();

// ========================================
// FUNÇÕES AUXILIARES - ABACATE PAY API
// ========================================

async function abacateRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${ABACATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${ABACATE_API_URL}${endpoint}`, options);
  return response.json();
}

// Cache de clientes para reutilização
const clientesCache = new Map();

// Criar ou buscar cliente no Abacate Pay
async function obterOuCriarCliente(nome, email) {
  // Usar email como chave do cache (ou gerar um fake email se não tiver)
  const clienteEmail = email || `${nome.toLowerCase().replace(/\s+/g, '.')}@cliente.adega.local`;
  
  // Verificar cache
  if (clientesCache.has(clienteEmail)) {
    return clientesCache.get(clienteEmail);
  }
  
  // Criar novo cliente
  console.log(`[${new Date().toLocaleTimeString()}] Criando cliente: ${nome} - ${clienteEmail}`);
  
  // Gerar um CPF formatado (exemplo para teste - em produção pedir ao cliente)
  const resultado = await abacateRequest('/customer/create', 'POST', {
    name: nome,
    email: clienteEmail,
    cellphone: '5513999999999',
    taxId: '52998224725' // CPF válido de teste
  });
  
  console.log(`[${new Date().toLocaleTimeString()}] Resposta criar cliente:`, JSON.stringify(resultado));
  
  if (resultado.data && resultado.data.id) {
    clientesCache.set(clienteEmail, resultado.data.id);
    console.log(`[${new Date().toLocaleTimeString()}] Cliente criado com sucesso: ${resultado.data.id}`);
    return resultado.data.id;
  }
  
  // Verificar se retornou erro específico de email já existente
  if (resultado.error && resultado.error.includes && resultado.error.includes('already')) {
    // Tentar listar para encontrar o cliente
    console.log(`[${new Date().toLocaleTimeString()}] Cliente pode existir, buscando...`);
  }
  
  // Se falhou ao criar, tentar listar e encontrar por email
  const lista = await abacateRequest('/customer/list', 'GET');
  console.log(`[${new Date().toLocaleTimeString()}] Lista de clientes:`, JSON.stringify(lista).substring(0, 500));
  
  if (lista.data && Array.isArray(lista.data)) {
    const clienteExistente = lista.data.find(c => c.email === clienteEmail);
    if (clienteExistente) {
      clientesCache.set(clienteEmail, clienteExistente.id);
      return clienteExistente.id;
    }
  }
  
  // Verificar se o resultado tem formato diferente
  if (resultado.id) {
    clientesCache.set(clienteEmail, resultado.id);
    return resultado.id;
  }
  
  throw new Error(`Não foi possível criar cliente. Resposta: ${JSON.stringify(resultado)}`);
}

// ========================================
// ROTAS
// ========================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Servidor Adega Altas Horas - API de Pagamentos (Abacate Pay)',
    version: '2.0.0'
  });
});

/**
 * CRIAR PAGAMENTO PIX (ABACATE PAY)
 * POST /api/criar-pagamento
 */
app.post('/api/criar-pagamento', async (req, res) => {
  try {
    const { 
      itens, 
      cliente, 
      endereco, 
      retirarLoja, 
      observacoes,
      total 
    } = req.body;

    // Validações
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: 'Carrinho vazio ou inválido' });
    }

    if (!cliente || !cliente.nome) {
      return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
    }

    // Gerar ID único do pedido
    const pedidoId = uuidv4().substring(0, 8).toUpperCase();

    // Criar ou obter cliente no Abacate Pay
    const customerId = await obterOuCriarCliente(cliente.nome, cliente.email);

    // Criar cobrança no Abacate Pay
    // Preço em CENTAVOS (R$ 10,00 = 1000)
    const produtos = itens.map(item => ({
      externalId: String(item.id),
      name: item.nome,
      description: item.descricao || item.nome,
      quantity: item.quantidade,
      price: Math.round(item.preco * 100) // Converter para centavos
    }));

    const billingData = {
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      products: produtos,
      customerId: customerId,
      returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/index.html?pagamento=sucesso&pedido=${pedidoId}`,
      completionUrl: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/index.html?pagamento=completo&pedido=${pedidoId}`,
      metadata: {
        pedidoId: pedidoId,
        cliente: cliente.nome,
        endereco: endereco || 'Retirar na loja',
        observacoes: observacoes || ''
      }
    };

    const resultado = await abacateRequest('/billing/create', 'POST', billingData);

    if (resultado.error) {
      throw new Error(resultado.error);
    }

    // Salvar pedido em memória
    pedidos.set(pedidoId, {
      id: pedidoId,
      billingId: resultado.data.id,
      itens: itens,
      cliente: cliente,
      endereco: endereco,
      retirarLoja: retirarLoja,
      observacoes: observacoes,
      total: total,
      status: 'PENDING',
      criadoEm: new Date().toISOString(),
      pixCopiaECola: resultado.data.pixCopiaECola || null
    });

    console.log(`[${new Date().toLocaleTimeString()}] Pedido ${pedidoId} criado - Billing: ${resultado.data.id} - Total: R$ ${total}`);

    res.json({
      success: true,
      pedidoId: pedidoId,
      billingId: resultado.data.id,
      initPoint: resultado.data.url, // URL de pagamento
      pixCopiaECola: resultado.data.pixCopiaECola || null,
      qrCodeBase64: resultado.data.pixQrCodeBase64 || null
    });

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({ 
      error: 'Erro ao criar pagamento',
      details: error.message 
    });
  }
});

/**
 * VERIFICAR STATUS DO PAGAMENTO
 * GET /api/verificar-pagamento/:pedidoId
 */
app.get('/api/verificar-pagamento/:pedidoId', async (req, res) => {
  const { pedidoId } = req.params;
  const pedido = pedidos.get(pedidoId);

  if (!pedido) {
    return res.status(404).json({ 
      error: 'Pedido não encontrado',
      status: 'nao_encontrado'
    });
  }

  try {
    // Consultar status no Abacate Pay
    const resultado = await abacateRequest(`/billing/status/${pedido.billingId}`);
    
    if (resultado.data) {
      const status = resultado.data.status;
      pedido.status = status;
      
      // PAID = pago, PENDING = aguardando, EXPIRED = expirado, REFUNDED = estornado
      const pago = status === 'PAID';
      
      if (pago && pedido.status !== 'notificado') {
        console.log(`[${new Date().toLocaleTimeString()}] Pagamento confirmado: Pedido ${pedidoId}`);
        pedido.status = 'notificado';
      }

      res.json({
        pedidoId: pedido.id,
        status: status,
        pago: pago,
        total: pedido.total,
        cliente: pedido.cliente,
        criadoEm: pedido.criadoEm
      });
    } else {
      res.json({
        pedidoId: pedido.id,
        status: pedido.status,
        pago: false,
        total: pedido.total
      });
    }
  } catch (error) {
    // Se falhar a verificação online, retorna status local
    res.json({
      pedidoId: pedido.id,
      status: pedido.status,
      pago: pedido.status === 'PAID' || pedido.status === 'notificado',
      total: pedido.total,
      cliente: pedido.cliente,
      criadoEm: pedido.criadoEm
    });
  }
});

/**
 * WEBHOOK DO ABACATE PAY
 * POST /api/webhook
 * Recebe notificações de pagamento
 */
app.post('/api/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;

    console.log(`[${new Date().toLocaleTimeString()}] Webhook Abacate: ${event}`);
    console.log('Dados:', JSON.stringify(data, null, 2));

    // Verificar se é notificação de pagamento aprovado
    if (event === 'billing.paid' || event === 'BILLING.PAID') {
      const billingId = data.billing?.id || data.id;
      
      // Encontrar pedido pelo billingId
      let pedidoEncontrado = null;
      for (const [pedidoId, pedido] of pedidos.entries()) {
        if (pedido.billingId === billingId) {
          pedidoEncontrado = pedido;
          break;
        }
      }

      if (pedidoEncontrado) {
        pedidoEncontrado.status = 'PAID';
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Pedido ${pedidoEncontrado.id} PAGO!`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] Pedido não encontrado para billing: ${billingId}`);
      }
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erro no webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
});

/**
 * OBTER DADOS DO PEDIDO PARA WHATSAPP
 * GET /api/pedido/:pedidoId
 */
app.get('/api/pedido/:pedidoId', (req, res) => {
  const { pedidoId } = req.params;
  const pedido = pedidos.get(pedidoId);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  // Só retornar dados completos se pagamento aprovado
  if (pedido.status !== 'PAID' && pedido.status !== 'notificado') {
    return res.json({
      pedidoId: pedido.id,
      status: pedido.status,
      pago: false
    });
  }

  res.json({
    pedidoId: pedido.id,
    status: pedido.status,
    pago: true,
    itens: pedido.itens,
    cliente: pedido.cliente,
    endereco: pedido.endereco,
    retirarLoja: pedido.retirarLoja,
    observacoes: pedido.observacoes,
    total: pedido.total,
    billingId: pedido.billingId
  });
});

/**
 * LISTAR TODOS OS PEDIDOS (para debug/admin)
 * GET /api/pedidos
 */
app.get('/api/pedidos', (req, res) => {
  const listaPedidos = Array.from(pedidos.values()).map(p => ({
    id: p.id,
    cliente: p.cliente?.nome,
    total: p.total,
    status: p.status,
    criadoEm: p.criadoEm
  }));

  res.json({
    total: listaPedidos.length,
    pedidos: listaPedidos.reverse() // Mais recentes primeiro
  });
});

// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('  ADEGA ALTAS HORAS - SERVIDOR API');
  console.log('========================================');
  console.log(`  Status: ONLINE`);
  console.log(`  Porta: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('  - POST /api/criar-pagamento');
  console.log('  - GET  /api/verificar-pagamento/:id');
  console.log('  - POST /api/webhook');
  console.log('  - GET  /api/pedido/:id');
  console.log('  - GET  /api/pedidos');
  console.log('========================================');
  console.log('');
});
