const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Carregue as credenciais da sua conta de serviço
// É crucial usar Variáveis de Ambiente no Vercel para segurança
const creds = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Corrige quebras de linha
};

// ID da sua planilha (pode ser encontrado na URL da planilha)
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI';

// Função principal que será executada pelo Vercel
export default async function handler(req, res) {
  // Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = req.body; // O Vercel já faz o parse do JSON

    // Validação básica dos dados recebidos
    if (!data.clienteNome || !Array.isArray(data.itens) || data.itens.length === 0) {
      return res.status(400).json({ error: 'Dados incompletos ou inválidos' });
    }

    // Autenticar com a conta de serviço
    const serviceAccountAuth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    } );

    // Inicializar o documento da planilha
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo(); // Carrega as propriedades do documento

    // Selecionar a aba "Pedidos"
    const sheet = doc.sheetsByTitle['Pedidos'];
    if (!sheet) {
      return res.status(500).json({ error: "Aba 'Pedidos' não encontrada." });
    }

    // Montar a observação final
    let observacaoFinal = data.observacaoGeral || '';
    if (data.endereco) {
      observacaoFinal += (observacaoFinal ? ' | ' : '') + `Endereço: ${data.endereco}`;
    }
    if (data.mesaComanda) {
      observacaoFinal += (observacaoFinal ? ' | ' : '') + `Mesa/Comanda: ${data.mesaComanda}`;
    }

    // Montar a linha para adicionar na planilha
    const newRow = {
      'Data/Hora': new Date().toLocaleString('pt-BR'),
      'Cliente': data.clienteNome,
      'Método': data.metodoEnvio || '',
      'Itens': data.itens.map(i => `${i.quantidade || 1}x ${i.titulo || ''}`).join(', '),
      'Forma de Pagamento': data.formaPagamento || '',
      'Observação': observacaoFinal,
      'Status': 'Recebido',
    };

    // Adicionar a nova linha
    await sheet.addRow(newRow);

    // Enviar resposta de sucesso
    res.status(200).json({ result: 'Pedido registrado com sucesso!' });

  } catch (error) {
    console.error('Erro ao salvar pedido:', error);
    res.status(500).json({ error: 'Erro interno do servidor ao registrar o pedido.' });
  }
}
