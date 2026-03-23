# 🥑 Backend do Cardápio Digital - Abacate Pay

Este servidor Node.js processa pagamentos PIX via **Abacate Pay** para o cardápio digital da Adega e Tabacaria Altas Horas.

## 📋 Requisitos

- Node.js 18+ instalado ([Download](https://nodejs.org/))
- Conta no Abacate Pay

## 🚀 Instalação

1. **Abra o terminal na pasta `server`:**
   ```bash
   cd server
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as credenciais:**
   - Copie o arquivo de exemplo:
     ```bash
     copy .env.example .env
     ```
   - Edite o arquivo `.env` com sua API Key

## 🔑 Obtendo Credenciais do Abacate Pay

1. Acesse: https://abacatepay.com

2. Crie uma conta ou faça login

3. No Dashboard, vá em **Configurações** → **API**

4. Copie sua **API Key**

5. Cole no arquivo `.env`:
   ```
   ABACATE_API_KEY=sua-api-key-aqui
   ```

## ⚙️ Configuração do `.env`

```env
# API Key do Abacate Pay (OBRIGATÓRIO)
ABACATE_API_KEY=sua-api-key-aqui

# Porta do servidor (padrão: 3001)
PORT=3001

# URL do frontend (para CORS e redirecionamentos)
FRONTEND_URL=http://localhost:5500

# URL pública do servidor (para webhooks)
SERVER_URL=http://localhost:3001
```

## ▶️ Executando o Servidor

**Desenvolvimento:**
```bash
npm run dev
```

**Produção:**
```bash
npm start
```

O servidor estará disponível em: http://localhost:3001

## 🔌 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/criar-pagamento` | Cria um pagamento PIX |
| GET | `/api/verificar-pagamento/:id` | Verifica status do pagamento |
| POST | `/api/webhook` | Recebe notificações do Abacate Pay |
| GET | `/api/pedido/:id` | Obtém detalhes de um pedido |
| GET | `/api/pedidos` | Lista todos os pedidos (admin) |

## 🌐 Configurando para Produção

### 1. Hospedagem do Backend

Opções recomendadas:
- **Render.com** (grátis com limitações)
- **Railway.app** (grátis com limitações)
- **Vercel** (Node.js serverless)
- **DigitalOcean** (pago)

### 2. Configurar Webhook

No painel do Abacate Pay:

1. Vá em **Configurações** → **Webhooks**
2. Adicione a URL: `https://seu-servidor.com/api/webhook`
3. Selecione o evento: `billing.paid`

### 3. Atualizar URLs

No arquivo `index.html`, altere a constante `API_URL`:
```javascript
const API_URL = "https://seu-servidor.com";
```

No arquivo `.env` do servidor:
```env
SERVER_URL=https://seu-servidor.com
FRONTEND_URL=https://seu-site.com
```

## 🧪 Testando Localmente

1. Inicie o servidor: `npm run dev`
2. Abra o `index.html` no navegador (use Live Server)
3. Adicione produtos ao carrinho
4. Selecione PIX como forma de pagamento
5. Clique em "Gerar Pagamento PIX"

## 💰 Taxas do Abacate Pay

- **PIX**: ~0.99% por transação
- Sem mensalidade
- Recebimento em 1 dia útil

## ⚠️ Limitações

- Os pedidos são armazenados em memória (perdem-se ao reiniciar)
- Para produção, recomenda-se usar um banco de dados (MongoDB, PostgreSQL, etc.)

## 📞 Suporte

- Documentação Abacate Pay: https://docs.abacatepay.com
- Suporte: suporte@abacatepay.com

---

**Adega e Tabacaria Altas Horas**  
Rua Joaquim Marques Alves 90, Centro - Registro/SP
