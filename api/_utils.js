const ABACATE_API_URL = 'https://api.abacatepay.com/v1';

async function abacateRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${process.env.ABACATE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${ABACATE_API_URL}${endpoint}`, options);
  return response.json();
}

async function obterOuCriarCliente(nome, email) {
  const clienteEmail = email || `${nome.toLowerCase().replace(/\s+/g, '.')}@cliente.adega.local`;

  const resultado = await abacateRequest('/customer/create', 'POST', {
    name: nome,
    email: clienteEmail,
    cellphone: '5513999999999',
    taxId: '52998224725'
  });

  if (resultado.data && resultado.data.id) {
    return resultado.data.id;
  }

  // Se já existe, buscar na lista
  const lista = await abacateRequest('/customer/list', 'GET');
  if (lista.data && Array.isArray(lista.data)) {
    const clienteExistente = lista.data.find(c => c.email === clienteEmail);
    if (clienteExistente) {
      return clienteExistente.id;
    }
  }

  if (resultado.id) {
    return resultado.id;
  }

  throw new Error(`Não foi possível criar cliente. Resposta: ${JSON.stringify(resultado)}`);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

module.exports = { abacateRequest, obterOuCriarCliente, corsHeaders };
