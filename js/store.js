/**
 * Store - Sistema de Gestão Comercial & Estoque
 * Gerenciador de Estado com Persistência em localStorage, Histórico para Desfazer (Ctrl+Z)
 * e Recálculo Automático das Fórmulas do Excel
 */

const STORAGE_KEY = 'mano_gestao_comercial_db_v2';
const USER_KEY = 'mano_gestao_usuario_nome';

class AppStore {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.data = this.loadData();
    this.listeners = [];
  }

  // Carrega do localStorage ou inicia com os dados completos da TABELA.xlsx
  loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.stock && parsed.sales) {
          // Garante que contas a receber estejam sempre completas
          if (!parsed.receivables || parsed.receivables.length === 0) {
            parsed.receivables = JSON.parse(JSON.stringify((window.INITIAL_DATA && window.INITIAL_DATA.receivables) || []));
          }
          // Garante que pedidos da fábrica estejam inicializados
          if (!parsed.factory_orders || parsed.factory_orders.length === 0) {
            parsed.factory_orders = JSON.parse(JSON.stringify((window.INITIAL_DATA && window.INITIAL_DATA.factory_orders) || []));
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar do localStorage, usando INITIAL_DATA', e);
    }
    return JSON.parse(JSON.stringify(window.INITIAL_DATA || {}));
  }

  // Snapshot do estado para permitir Ctrl + Z (Desfazer)
  snapshot(actionName = 'Alteração') {
    try {
      this.undoStack.push({
        name: actionName,
        timestamp: Date.now(),
        state: JSON.stringify(this.data)
      });
      // Limita pilha a 50 passos
      if (this.undoStack.length > 50) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    } catch (e) {
      console.warn('Erro ao criar snapshot:', e);
    }
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const last = this.undoStack.pop();
    this.redoStack.push({
      name: last.name,
      timestamp: Date.now(),
      state: JSON.stringify(this.data)
    });
    this.data = JSON.parse(last.state);
    this.saveData(false);
    return last.name;
  }

  redo() {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop();
    this.undoStack.push({
      name: next.name,
      timestamp: Date.now(),
      state: JSON.stringify(this.data)
    });
    this.data = JSON.parse(next.state);
    this.saveData(false);
    return next.name;
  }

  // Salva no localStorage e notifica ouvintes
  saveData(pushSnapshot = false) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.lastSavedTime = Date.now();
      localStorage.setItem(STORAGE_KEY + '_lastSaved', String(this.lastSavedTime));
      this.notifyListeners();
    } catch (e) {
      console.error('Erro ao salvar no localStorage', e);
    }
  }

  getLastSavedTime() {
    if (this.lastSavedTime) return this.lastSavedTime;
    const saved = localStorage.getItem(STORAGE_KEY + '_lastSaved');
    return saved ? Number(saved) : null;
  }

  // Registra listener de atualização
  subscribe(fn) {
    this.listeners.push(fn);
  }

  notifyListeners() {
    for (const fn of this.listeners) {
      try {
        fn(this.getCalculatedData());
      } catch (err) {
        console.error('Erro em listener do store:', err);
      }
    }
  }

  // Reseta para os dados originais da TABELA.xlsx
  resetToOriginal() {
    this.snapshot('Restaurar dados originais');
    this.data = JSON.parse(JSON.stringify(window.INITIAL_DATA));
    this.saveData();
  }

  // Nome do usuário logado
  getUserName() {
    return localStorage.getItem(USER_KEY) || (this.data.app_config && this.data.app_config.default_user) || 'Mano';
  }

  setUserName(name) {
    const cleanName = (name || '').trim() || 'Mano';
    this.snapshot(`Alterar usuário para ${cleanName}`);
    localStorage.setItem(USER_KEY, cleanName);
    this.notifyListeners();
  }

  // ==================== OPERAÇÕES DE ESTOQUE ====================
  getRawStock() {
    return this.data.stock || [];
  }

  addStockItem(item) {
    this.snapshot(`Adicionar produto ${item.produto}`);
    const newItem = {
      id: 'prod_' + Date.now(),
      produto: item.produto.trim().toUpperCase(),
      marca: (item.marca || '').trim().toUpperCase(),
      custo: Number(item.custo) || 0,
      venda: Number(item.venda) || 0,
      estoque: Number(item.estoque) || 0,
      vendida: Number(item.vendida) || 0
    };
    this.data.stock.unshift(newItem);
    this.saveData();
    return newItem;
  }

  updateStockItem(id, updates) {
    const idx = this.data.stock.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.snapshot(`Editar produto ${this.data.stock[idx].produto}`);
      this.data.stock[idx] = {
        ...this.data.stock[idx],
        ...updates,
        custo: updates.custo !== undefined ? Number(updates.custo) : this.data.stock[idx].custo,
        venda: updates.venda !== undefined ? Number(updates.venda) : this.data.stock[idx].venda,
        estoque: updates.estoque !== undefined ? Number(updates.estoque) : this.data.stock[idx].estoque,
        vendida: updates.vendida !== undefined ? Number(updates.vendida) : this.data.stock[idx].vendida,
      };
      this.saveData();
    }
  }

  adjustStockQuantity(id, delta) {
    const idx = this.data.stock.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.snapshot(`Ajustar estoque de ${this.data.stock[idx].produto} (${delta > 0 ? '+' : ''}${delta})`);
      const current = this.data.stock[idx].estoque;
      const next = Math.max(0, current + delta);
      this.data.stock[idx].estoque = next;
      this.saveData();
    }
  }

  deleteStockItem(id) {
    const item = this.data.stock.find(p => p.id === id);
    if (item) {
      this.snapshot(`Excluir produto ${item.produto}`);
    }
    this.data.stock = this.data.stock.filter(p => p.id !== id);
    this.saveData();
  }

  // ==================== OPERAÇÕES DE VENDAS / SAÍDAS ====================
  getRawSales() {
    return this.data.sales || [];
  }

  addSale(saleData) {
    const qtd = Number(saleData.quantidade) || 1;
    const custo = Number(saleData.custo) || 0;
    const vendaTotal = Number(saleData.venda_total) || 0;
    const mes = saleData.mes || this.getCurrentMonthString();
    const dataVenda = saleData.data || new Date().toISOString().split('T')[0];

    this.snapshot(`Registrar venda de ${qtd}x ${saleData.produto}`);

    const newSale = {
      id: 'sale_' + Date.now(),
      produto: saleData.produto.trim().toUpperCase(),
      marca: (saleData.marca || '').trim().toUpperCase(),
      quantidade: qtd,
      custo: custo,
      venda_total: vendaTotal,
      cliente: (saleData.cliente || 'Consumidor').trim().toUpperCase(),
      mes: mes,
      data: dataVenda
    };

    this.data.sales.unshift(newSale);

    // Baixa automática no estoque se produto existir
    if (saleData.productId) {
      const prod = this.data.stock.find(p => p.id === saleData.productId);
      if (prod) {
        prod.estoque = Math.max(0, prod.estoque - qtd);
        prod.vendida = (prod.vendida || 0) + qtd;
      }
    } else {
      const prod = this.data.stock.find(p => p.produto.toLowerCase() === newSale.produto.toLowerCase());
      if (prod) {
        prod.estoque = Math.max(0, prod.estoque - qtd);
        prod.vendida = (prod.vendida || 0) + qtd;
      }
    }

    // Se a venda for a prazo, cria automaticamente em Contas a Receber
    if (saleData.isFiado) {
      this.addReceivableInternal({
        cliente: newSale.cliente,
        valor: vendaTotal,
        data_vencimento: saleData.data_vencimento || null,
        observacao: `Venda #${newSale.id.slice(-4)}: ${qtd}x ${newSale.produto}`
      });
    }

    this.saveData();
    return newSale;
  }

  deleteSale(id) {
    const sale = this.data.sales.find(s => s.id === id);
    if (sale) {
      this.snapshot(`Excluir venda de ${sale.produto}`);
    }
    this.data.sales = this.data.sales.filter(s => s.id !== id);
    this.saveData();
  }

  // ==================== CONTAS A RECEBER ====================
  getRawReceivables() {
    return this.data.receivables || [];
  }

  addReceivable(rec) {
    this.snapshot(`Cadastrar conta de ${rec.cliente}`);
    return this.addReceivableInternal(rec);
  }

  addReceivableInternal(rec) {
    const newRec = {
      id: 'rec_' + Date.now(),
      cliente: rec.cliente.trim().toUpperCase(),
      valor: Number(rec.valor) || 0,
      data_vencimento: rec.data_vencimento || null,
      status: 'pendente',
      data_recebimento: null,
      observacao: rec.observacao || ''
    };
    this.data.receivables.unshift(newRec);
    this.saveData();
    return newRec;
  }

  payReceivable(id) {
    const idx = this.data.receivables.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.snapshot(`Receber conta de ${this.data.receivables[idx].cliente}`);
      this.data.receivables[idx].status = 'pago';
      this.data.receivables[idx].data_recebimento = new Date().toISOString().split('T')[0];
      this.saveData();
    }
  }

  unpayReceivable(id) {
    const idx = this.data.receivables.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.snapshot(`Desfazer recebimento de ${this.data.receivables[idx].cliente}`);
      this.data.receivables[idx].status = 'pendente';
      this.data.receivables[idx].data_recebimento = null;
      this.saveData();
    }
  }

  deleteReceivable(id) {
    const rec = this.data.receivables.find(r => r.id === id);
    if (rec) {
      this.snapshot(`Excluir conta de ${rec.cliente}`);
    }
    this.data.receivables = this.data.receivables.filter(r => r.id !== id);
    this.saveData();
  }

  // ==================== SAÍDAS / DESPESAS ====================
  getRawExpenses() {
    return this.data.expenses || [];
  }

  addExpense(exp) {
    this.snapshot(`Adicionar despesa ${exp.descricao}`);
    const newExp = {
      id: 'exp_' + Date.now(),
      descricao: exp.descricao.trim(),
      valor: Number(exp.valor) || 0,
      data: exp.data || new Date().toISOString().split('T')[0],
      categoria: exp.categoria || 'Outros'
    };
    this.data.expenses.unshift(newExp);
    this.saveData();
    return newExp;
  }

  deleteExpense(id) {
    const exp = this.data.expenses.find(e => e.id === id);
    if (exp) {
      this.snapshot(`Excluir despesa ${exp.descricao}`);
    }
    this.data.expenses = this.data.expenses.filter(e => e.id !== id);
    this.saveData();
  }

  // ==================== PEDIDOS DA FÁBRICA ====================
  getRawFactoryOrders() {
    return this.data.factory_orders || [];
  }

  addFactoryOrder(order) {
    const qtd = Number(order.quantidade) || 1;
    const valorUnit = Number(order.valor_unitario) || 0;
    const frete = Number(order.frete) || 0;
    this.snapshot(`Adicionar pedido de fábrica ${qtd}x ${order.produto}`);

    const isRecebido = order.status === 'recebido';
    const newOrder = {
      id: 'ord_' + Date.now(),
      produto: (order.produto || '').trim().toUpperCase(),
      marca: (order.marca || '').trim().toUpperCase(),
      quantidade: qtd,
      valor_unitario: valorUnit,
      frete: frete,
      fornecedor: (order.fornecedor || '').trim(),
      status: isRecebido ? 'recebido' : 'pendente',
      data_pedido: order.data_pedido || new Date().toISOString().split('T')[0],
      data_previsao: order.data_previsao || null,
      data_recebimento: isRecebido ? (order.data_recebimento || new Date().toISOString().split('T')[0]) : null,
      rastreio: (order.rastreio || '').trim(),
      observacao: (order.observacao || '').trim(),
      autoStockAdded: Boolean(order.addToStock && isRecebido)
    };

    if (!this.data.factory_orders) this.data.factory_orders = [];
    this.data.factory_orders.unshift(newOrder);

    // Se já recebido e marcado para dar entrada imediata no estoque
    if (newOrder.autoStockAdded) {
      this.addOrderItemsToStock(newOrder);
    }

    this.saveData();
    return newOrder;
  }

  updateFactoryOrder(id, updates) {
    const idx = (this.data.factory_orders || []).findIndex(o => o.id === id);
    if (idx !== -1) {
      this.snapshot(`Editar pedido ${this.data.factory_orders[idx].produto}`);
      this.data.factory_orders[idx] = {
        ...this.data.factory_orders[idx],
        ...updates,
        quantidade: updates.quantidade !== undefined ? Number(updates.quantidade) : this.data.factory_orders[idx].quantidade,
        valor_unitario: updates.valor_unitario !== undefined ? Number(updates.valor_unitario) : this.data.factory_orders[idx].valor_unitario,
        frete: updates.frete !== undefined ? Number(updates.frete) : this.data.factory_orders[idx].frete
      };
      this.saveData();
    }
  }

  receiveFactoryOrder(id, addToStock = true) {
    const ord = (this.data.factory_orders || []).find(o => o.id === id);
    if (ord) {
      this.snapshot(`Receber pedido da fábrica ${ord.produto}`);
      ord.status = 'recebido';
      ord.data_recebimento = new Date().toISOString().split('T')[0];
      if (addToStock && !ord.autoStockAdded) {
        this.addOrderItemsToStock(ord);
        ord.autoStockAdded = true;
      }
      this.saveData();
    }
  }

  unreceiveFactoryOrder(id) {
    const ord = (this.data.factory_orders || []).find(o => o.id === id);
    if (ord) {
      this.snapshot(`Desfazer recebimento do pedido ${ord.produto}`);
      ord.status = 'pendente';
      ord.data_recebimento = null;
      if (ord.autoStockAdded) {
        const prod = this.data.stock.find(p => p.produto.toLowerCase() === ord.produto.toLowerCase());
        if (prod) {
          prod.estoque = Math.max(0, prod.estoque - ord.quantidade);
        }
        ord.autoStockAdded = false;
      }
      this.saveData();
    }
  }

  addOrderItemsToStock(ord) {
    const prod = this.data.stock.find(p => 
      p.produto.toLowerCase() === ord.produto.toLowerCase() && 
      (!ord.marca || p.marca.toLowerCase() === ord.marca.toLowerCase())
    );
    const custoReal = ord.quantidade > 0 ? ((ord.quantidade * ord.valor_unitario + ord.frete) / ord.quantidade) : ord.valor_unitario;

    if (prod) {
      prod.estoque = (prod.estoque || 0) + ord.quantidade;
      // Atualiza custo se for fornecido
      if (custoReal > 0) {
        // Custo médio ponderado do estoque
        const totalEstoqueAnterior = prod.estoque - ord.quantidade;
        if (totalEstoqueAnterior > 0) {
          prod.custo = Math.round(((prod.custo * totalEstoqueAnterior) + (custoReal * ord.quantidade)) / prod.estoque * 100) / 100;
        } else {
          prod.custo = Math.round(custoReal * 100) / 100;
        }
      }
    } else {
      // Adiciona novo produto ao estoque
      this.data.stock.unshift({
        id: 'prod_' + Date.now(),
        produto: ord.produto,
        marca: ord.marca,
        custo: Math.round(custoReal * 100) / 100,
        venda: Math.round(custoReal * 1.5 * 100) / 100,
        estoque: ord.quantidade,
        vendida: 0
      });
    }
  }

  deleteFactoryOrder(id) {
    const ord = (this.data.factory_orders || []).find(o => o.id === id);
    if (ord) {
      this.snapshot(`Excluir pedido de fábrica ${ord.produto}`);
    }
    this.data.factory_orders = (this.data.factory_orders || []).filter(o => o.id !== id);
    this.saveData();
  }

  // ==================== MOTOR DE CÁLCULO DAS FÓRMULAS DO EXCEL ====================
  getCalculatedData() {
    // 1. Cálculos de Estoque
    let totalEstoqueQtd = 0;
    let totalVendidosEstoque = 0;
    let totalEstoqueCusto = 0;
    let totalEstoqueVenda = 0;
    let totalPrevisaoLucro = 0;
    let totalLucroObtidoEstoque = 0;
    let totalCustoMercadoriaVendida = 0;

    const calculatedStock = (this.data.stock || []).map(p => {
      const custo = Number(p.custo) || 0;
      const venda = Number(p.venda) || 0;
      const estoque = Number(p.estoque) || 0;
      const vendida = Number(p.vendida) || 0;

      const lucroUnitario = venda - custo;
      const margem = venda > 0 ? (lucroUnitario / venda) : 0;
      const estoqueCusto = estoque * custo;
      const estoqueVenda = estoque * venda;
      const previsaoLucro = estoqueVenda - estoqueCusto;
      const lucroObtido = vendida * lucroUnitario;
      const totalCusto = custo * vendida;

      totalEstoqueQtd += estoque;
      totalVendidosEstoque += vendida;
      totalEstoqueCusto += estoqueCusto;
      totalEstoqueVenda += estoqueVenda;
      totalPrevisaoLucro += previsaoLucro;
      totalLucroObtidoEstoque += lucroObtido;
      totalCustoMercadoriaVendida += totalCusto;

      return {
        ...p,
        lucroUnitario,
        margem,
        margemPercent: (margem * 100).toFixed(1) + '%',
        estoqueCusto,
        estoqueVenda,
        previsaoLucro,
        lucroObtido,
        totalCusto,
        isLowStock: estoque <= 2 && estoque > 0,
        isOutOfStock: estoque === 0
      };
    });

    // 2. Cálculos de Vendas
    let totalFaturamentoVendas = 0;
    let totalCustoVendas = 0;
    let totalLucroVendas = 0;
    let totalItensVendas = 0;

    const calculatedSales = (this.data.sales || []).map(s => {
      const qtd = Number(s.quantidade) || 0;
      const custo = Number(s.custo) || 0;
      const vendaTotal = Number(s.venda_total) || 0;
      const lucro = vendaTotal - custo;

      totalFaturamentoVendas += vendaTotal;
      totalCustoVendas += custo;
      totalLucroVendas += lucro;
      totalItensVendas += qtd;

      return {
        ...s,
        lucro
      };
    });

    // 3. Cálculos de Contas a Receber
    let totalFiadoPendente = 0;
    let totalFiadoRecebido = 0;
    let totalClientesFiado = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const calculatedReceivables = (this.data.receivables || []).map(r => {
      const valor = Number(r.valor) || 0;
      const isPaid = r.status === 'pago';
      let isOverdue = false;

      if (!isPaid && r.data_vencimento) {
        isOverdue = r.data_vencimento < todayStr;
      }

      if (isPaid) {
        totalFiadoRecebido += valor;
      } else {
        totalFiadoPendente += valor;
        totalClientesFiado += 1;
      }

      return {
        ...r,
        isOverdue
      };
    });

    // 4. Cálculos de Despesas / Saídas
    let totalDespesasSaques = 0;
    (this.data.expenses || []).forEach(e => {
      totalDespesasSaques += Number(e.valor) || 0;
    });

    // 5. Saldo Líquido de Caixa (Planilha F2 - (E2 + E3))
    const saldoCaixa = totalFaturamentoVendas - (totalCustoMercadoriaVendida + totalDespesasSaques);

    // 6. Cálculos de Pedidos da Fábrica (Planilha FÓRMULAS: Quantidade * Valor + Frete)
    let totalItensFabrica = 0;
    let totalCustoProdutosFabrica = 0;
    let totalFreteFabrica = 0;
    let totalGeralFabrica = 0;
    let totalPedidosPendentes = 0;
    let totalValorPendentes = 0;
    let totalItensPendentes = 0;
    let totalPedidosRecebidos = 0;
    let totalValorRecebidos = 0;

    const calculatedFactoryOrders = (this.data.factory_orders || []).map(o => {
      const qtd = Number(o.quantidade) || 0;
      const valorUnit = Number(o.valor_unitario) || 0;
      const frete = Number(o.frete) || 0;
      const subtotal = qtd * valorUnit;
      const total = subtotal + frete;
      // Custo unitário final com frete rateado
      const custoUnitarioFinal = qtd > 0 ? (total / qtd) : valorUnit;
      const isReceived = o.status === 'recebido';

      totalItensFabrica += qtd;
      totalCustoProdutosFabrica += subtotal;
      totalFreteFabrica += frete;
      totalGeralFabrica += total;

      if (isReceived) {
        totalPedidosRecebidos += 1;
        totalValorRecebidos += total;
      } else {
        totalPedidosPendentes += 1;
        totalValorPendentes += total;
        totalItensPendentes += qtd;
      }

      return {
        ...o,
        subtotal,
        frete,
        total,
        custoUnitarioFinal
      };
    });

    // 7. Fechamento Mês a Mês (Visão Anual) com a REGRA DE 1/3
    const monthsMap = {};
    const defaultMonths = [
      'JANEIRO/26', 'FEVEREIRO/26', 'MARÇO/26', 'ABRIL/26', 'MAIO/26', 'JUNHO/26',
      'JULHO/26', 'AGOSTO/26', 'SETEMBRO/26', 'OUTUBRO/26', 'NOVEMBRO/26', 'DEZEMBRO/26'
    ];

    defaultMonths.forEach(m => {
      monthsMap[m] = {
        mes: m,
        quantidade: 0,
        bruto: 0,
        custo: 0,
        lucro: 0,
        custoFixoVariado: 0,
        proLabore: 0,
        investir: 0
      };
    });

    calculatedSales.forEach(s => {
      let mKey = (s.mes || '').trim().toUpperCase();
      if (!mKey.includes('/26')) {
        mKey = mKey + '/26';
      }
      if (!monthsMap[mKey]) {
        monthsMap[mKey] = {
          mes: mKey,
          quantidade: 0,
          bruto: 0,
          custo: 0,
          lucro: 0,
          custoFixoVariado: 0,
          proLabore: 0,
          investir: 0
        };
      }
      monthsMap[mKey].quantidade += Number(s.quantidade) || 0;
      monthsMap[mKey].bruto += Number(s.venda_total) || 0;
      monthsMap[mKey].custo += Number(s.custo) || 0;
      monthsMap[mKey].lucro += (Number(s.venda_total) || 0) - (Number(s.custo) || 0);
    });

    const monthsList = Object.values(monthsMap).map(m => {
      const third = m.lucro > 0 ? (m.lucro / 3) : 0;
      return {
        ...m,
        custoFixoVariado: third,
        proLabore: third,
        investir: third
      };
    });

    const totalAno = {
      quantidade: totalItensVendas,
      bruto: totalFaturamentoVendas,
      custo: totalCustoVendas,
      lucro: totalLucroVendas,
      custoFixoVariado: totalLucroVendas > 0 ? totalLucroVendas / 3 : 0,
      proLabore: totalLucroVendas > 0 ? totalLucroVendas / 3 : 0,
      investir: totalLucroVendas > 0 ? totalLucroVendas / 3 : 0
    };

    return {
      userName: this.getUserName(),
      canUndo: this.canUndo(),
      undoCount: this.undoStack.length,
      stock: calculatedStock,
      sales: calculatedSales,
      receivables: calculatedReceivables,
      factoryOrders: calculatedFactoryOrders,
      expenses: this.data.expenses || [],
      monthsList,
      totalAno,
      kpis: {
        totalFaturamentoVendas,
        totalCustoVendas,
        totalLucroVendas,
        margemMediaGeral: totalFaturamentoVendas > 0 ? (totalLucroVendas / totalFaturamentoVendas * 100).toFixed(1) + '%' : '0%',
        totalEstoqueQtd,
        totalEstoqueCusto,
        totalEstoqueVenda,
        totalPrevisaoLucro,
        totalFiadoPendente,
        totalFiadoRecebido,
        totalClientesFiado,
        totalDespesasSaques,
        saldoCaixa,
        itensEstoqueBaixo: calculatedStock.filter(p => p.isLowStock || p.isOutOfStock).length,
        // KPIs de Fábrica
        totalPedidosPendentes,
        totalValorPendentes,
        totalItensPendentes,
        totalPedidosRecebidos,
        totalValorRecebidos,
        totalGeralFabrica,
        custoMedioFabrica: totalItensFabrica > 0 ? (totalGeralFabrica / totalItensFabrica) : 0
      }
    };
  }

  getCurrentMonthString() {
    const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    const now = new Date();
    return `${months[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`;
  }

  // Backup / Exportação JSON
  exportJSON() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sistema_comercial_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(fileContent) {
    try {
      const parsed = JSON.parse(fileContent);
      if (parsed && (parsed.stock || parsed.sales)) {
        this.snapshot('Importar backup JSON');
        this.data = parsed;
        this.saveData();
        return { success: true };
      }
      return { success: false, error: 'Formato inválido' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

// Singleton global
window.appStore = new AppStore();
