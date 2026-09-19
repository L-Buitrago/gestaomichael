/**
 * App — Sistema de Gestão Comercial & Estoque
 * Controlador principal: renderização, eventos, modais, exportação
 */

class CommercialApp {
  constructor() {
    this.currentTab = 'tab-dashboard';
    this.currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    this.confirmResolver = null;

    // Page title mapping
    this.tabTitles = {
      'tab-dashboard': 'Dashboard',
      'tab-estoque': 'Estoque & Margens',
      'tab-vendas': 'Vendas & Saídas',
      'tab-fiado': 'Contas a Receber',
      'tab-anual': 'Visão Anual',
      'tab-calc': 'Calculadora',
      'tab-pedidos': 'Pedidos da Fábrica'
    };
  }

  init() {
    this.initTheme();
    this.initUndoShortcut();
    this.bindEvents();
    this.startClock();
    this.initCalcInputs();
    this.initFactoryOrderInputs();
    this.initSidebar();

    // Subscribe to store changes
    window.appStore.subscribe((data) => this.renderAll(data));

    // Initial render
    this.renderAll(window.appStore.getCalculatedData());
    this.updateSaveIndicator();
  }

  // ================= THEME (CLARO / ESCURO) =================
  initTheme() {
    const savedTheme = localStorage.getItem('mano_app_theme') || 'dark';
    this.applyTheme(savedTheme, false);

    const toggleTheme = () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const nextTheme = current === 'light' ? 'dark' : 'light';
      this.applyTheme(nextTheme, true);
    };

    document.getElementById('btnThemeToggle')?.addEventListener('click', toggleTheme);
    document.getElementById('btnSidebarThemeToggle')?.addEventListener('click', toggleTheme);
  }

  applyTheme(theme, showToastNotification = false) {
    const isLight = theme === 'light';
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    localStorage.setItem('mano_app_theme', isLight ? 'light' : 'dark');

    const sunSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    const moonSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

    const sidebarSunSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    const sidebarMoonSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

    // Topbar button
    const topBtn = document.getElementById('btnThemeToggle');
    if (topBtn) {
      topBtn.title = isLight ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro';
      topBtn.innerHTML = `${isLight ? moonSvg : sunSvg} <span>${isLight ? 'Escuro' : 'Claro'}</span>`;
    }

    // Sidebar button
    const sideBtn = document.getElementById('btnSidebarThemeToggle');
    if (sideBtn) {
      sideBtn.title = isLight ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro';
      sideBtn.innerHTML = `${isLight ? sidebarMoonSvg : sidebarSunSvg} <span class="nav-label sidebar-footer-text">${isLight ? 'Tema Escuro' : 'Tema Claro'}</span>`;
    }

    if (showToastNotification) {
      this.showToast(isLight ? 'Tema Claro ativado' : 'Tema Escuro ativado');
    }
  }

  // ================= SIDEBAR =================
  initSidebar() {
    const sidebar = document.getElementById('sidebarEl');
    const btn = document.getElementById('btnSidebarToggle');
    const savedState = localStorage.getItem('sidebar_collapsed');

    if (savedState === 'true') {
      sidebar.classList.add('collapsed');
    }

    if (btn) {
      btn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
      });
    }
  }

  // ================= CUSTOM CONFIRM (replaces browser confirm) =================
  showConfirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
      this.confirmResolver = resolve;
      document.getElementById('confirmTitle').textContent = title;
      document.getElementById('confirmMessage').textContent = message;
      this.openModal('modalConfirm');
    });
  }

  resolveConfirm(result) {
    this.closeModal('modalConfirm');
    if (this.confirmResolver) {
      this.confirmResolver(result);
      this.confirmResolver = null;
    }
  }

  // ================= SAVE INDICATOR =================
  updateSaveIndicator() {
    const el = document.getElementById('lastSavedText');
    if (el) {
      const ts = window.appStore.getLastSavedTime();
      if (ts) {
        const d = new Date(ts);
        el.textContent = `Salvo ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      } else {
        el.textContent = 'Salvo';
      }
    }
  }

  // ================= UNDO (CTRL + Z) =================
  initUndoShortcut() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase())) {
          return;
        }
        e.preventDefault();
        this.undoAction();
      }
    });

    const btnUndo = document.getElementById('btnUndoAction');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.undoAction());
    }
  }

  undoAction() {
    if (!window.appStore.canUndo()) {
      this.showToast('Nada para desfazer');
      return;
    }
    const name = window.appStore.undo();
    this.showToast(`Desfeito: ${name || 'última ação'}`);
  }

  // ================= TOAST =================
  showToast(msg) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ================= CLOCK =================
  startClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const el = document.getElementById('liveClockDisplay');
      if (el) el.textContent = `${h}:${m}`;

      // Update user info
      const topUserNameEl = document.getElementById('topUserName');
      const userAvatarEl = document.getElementById('userAvatarText');
      const userName = window.appStore.getUserName();
      if (topUserNameEl) topUserNameEl.textContent = userName;
      if (userAvatarEl) userAvatarEl.textContent = (userName.charAt(0) || 'M').toUpperCase();
    };

    update();
    setInterval(update, 30000); // Every 30s is enough for HH:MM
  }

  // ================= TAB NAVIGATION =================
  switchTab(tabId) {
    this.currentTab = tabId;

    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    // Update page title
    const titleEl = document.getElementById('pageTitleText');
    if (titleEl) {
      titleEl.textContent = this.tabTitles[tabId] || 'Dashboard';
    }

    if (tabId === 'tab-calc') {
      this.updateCommercialCalc();
    }
  }

  // ================= RENDER ALL =================
  renderAll(data) {
    if (!data) data = window.appStore.getCalculatedData();

    this.renderKPIs(data);
    this.renderDashboardTables(data);
    this.renderStockTable(data);
    this.renderSalesTable(data);
    this.renderFiadoTable(data);
    this.renderPedidosTable(data);
    this.renderAnnualView(data);
    this.populateProductSelects(data);
    this.updateSaveIndicator();
  }

  fmtBRL(val) {
    return this.currencyFormatter.format(val || 0);
  }

  // ---- KPIs ----
  renderKPIs(data) {
    const kpi = data.kpis;
    document.getElementById('kpiFaturamento').textContent = this.fmtBRL(kpi.totalFaturamentoVendas);
    document.getElementById('kpiLucroReal').textContent = this.fmtBRL(kpi.totalLucroVendas);
    document.getElementById('kpiMargemMedia').textContent = kpi.margemMediaGeral;
    document.getElementById('kpiFiadoPendente').textContent = this.fmtBRL(kpi.totalFiadoPendente);
    document.getElementById('kpiFiadoClientes').textContent = kpi.totalClientesFiado;
    document.getElementById('kpiSaldoCaixa').textContent = this.fmtBRL(kpi.saldoCaixa);
    document.getElementById('kpiEstoqueValor').textContent = this.fmtBRL(kpi.totalEstoqueCusto);
    document.getElementById('kpiEstoqueQtd').textContent = kpi.totalEstoqueQtd;
    document.getElementById('kpiEstoqueBaixoQtd').textContent = kpi.itensEstoqueBaixo;

    // Nav badges
    document.getElementById('badgeStockCount').textContent = data.stock.length;
    document.getElementById('badgeSalesCount').textContent = data.sales.length;
    document.getElementById('badgeFiadoCount').textContent = data.receivables.filter(r => r.status === 'pendente').length;
    const badgePedidos = document.getElementById('badgePedidosCount');
    if (badgePedidos) {
      badgePedidos.textContent = (data.kpis && data.kpis.totalPedidosPendentes) || 0;
    }
  }

  // ---- Dashboard Tables ----
  renderDashboardTables(data) {
    const recentSales = data.sales.slice(0, 5);
    const salesTbody = document.getElementById('dashboardRecentSalesTbody');
    if (salesTbody) {
      if (recentSales.length === 0) {
        salesTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-disabled); padding: 20px;">Nenhuma venda registrada</td></tr>';
      } else {
        salesTbody.innerHTML = recentSales.map(s => `
          <tr>
            <td class="num-mono" style="color: var(--text-tertiary);">${s.data || s.mes}</td>
            <td><strong>${s.produto}</strong> <span style="font-size:0.7rem; color:var(--text-disabled);">${s.marca}</span></td>
            <td class="num-mono">${s.quantidade}</td>
            <td class="num-mono val-cyan">${this.fmtBRL(s.venda_total)}</td>
            <td class="num-mono val-positive">${this.fmtBRL(s.lucro)}</td>
            <td>${s.cliente}</td>
          </tr>
        `).join('');
      }
    }

    const pendingFiados = data.receivables.filter(r => r.status === 'pendente').slice(0, 5);
    const fiadoTbody = document.getElementById('dashboardRecentFiadosTbody');
    if (fiadoTbody) {
      if (pendingFiados.length === 0) {
        fiadoTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-disabled); padding: 20px;">Sem pendências</td></tr>';
      } else {
        fiadoTbody.innerHTML = pendingFiados.map(r => `
          <tr>
            <td><strong>${r.cliente}</strong></td>
            <td class="num-mono val-danger">${this.fmtBRL(r.valor)}</td>
            <td style="color: var(--text-tertiary);">${r.data_vencimento || 'A combinar'}</td>
            <td>
              <button type="button" class="btn btn-success btn-sm" onclick="app.payReceivable('${r.id}')">Receber</button>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  // ---- Stock Table ----
  renderStockTable(data) {
    const tbody = document.getElementById('stockTableBody');
    if (!tbody) return;

    const search = (document.getElementById('inputSearchStock').value || '').toLowerCase().trim();
    const brandFilter = document.getElementById('selectFilterStockBrand').value;
    const statusFilter = document.getElementById('selectFilterStockStatus').value;

    const brandSelect = document.getElementById('selectFilterStockBrand');
    if (brandSelect && brandSelect.options.length <= 1) {
      const brands = [...new Set(data.stock.map(p => p.marca).filter(Boolean))].sort();
      brands.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        brandSelect.appendChild(opt);
      });
    }

    const filtered = data.stock.filter(p => {
      const matchSearch = !search || p.produto.toLowerCase().includes(search) || p.marca.toLowerCase().includes(search);
      const matchBrand = brandFilter === 'ALL' || p.marca === brandFilter;
      let matchStatus = true;
      if (statusFilter === 'IN_STOCK') matchStatus = p.estoque > 2;
      else if (statusFilter === 'LOW_STOCK') matchStatus = p.isLowStock;
      else if (statusFilter === 'OUT_OF_STOCK') matchStatus = p.isOutOfStock;
      return matchSearch && matchBrand && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding: 20px; color: var(--text-disabled);">Nenhum produto encontrado</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(p => {
        let statusBadge = '';
        if (p.isOutOfStock) {
          statusBadge = `<span class="status-pill status-out-of-stock">Esgotado</span>`;
        } else if (p.isLowStock) {
          statusBadge = `<span class="status-pill status-low-stock">Baixo (${p.estoque})</span>`;
        } else {
          statusBadge = `<span class="status-pill status-in-stock">${p.estoque} un</span>`;
        }

        return `
          <tr>
            <td><strong>${p.produto}</strong></td>
            <td style="color: var(--accent);">${p.marca}</td>
            <td class="num-mono">${this.fmtBRL(p.custo)}</td>
            <td class="num-mono val-cyan">${this.fmtBRL(p.venda)}</td>
            <td>${statusBadge}</td>
            <td class="num-mono">${p.vendida}</td>
            <td class="num-mono">${this.fmtBRL(p.estoqueCusto)}</td>
            <td class="num-mono">${this.fmtBRL(p.estoqueVenda)}</td>
            <td class="num-mono val-purple">${p.margemPercent}</td>
            <td class="num-mono val-positive">${this.fmtBRL(p.lucroUnitario)}</td>
            <td class="num-mono">${this.fmtBRL(p.previsaoLucro)}</td>
            <td class="num-mono val-positive">${this.fmtBRL(p.lucroObtido)}</td>
            <td class="num-mono">${this.fmtBRL(p.totalCusto)}</td>
            <td>
              <div class="btn-group">
                <button type="button" class="btn btn-secondary btn-icon-only" onclick="app.adjustStock('${p.id}', 1)" title="+1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                </button>
                <button type="button" class="btn btn-secondary btn-icon-only" onclick="app.adjustStock('${p.id}', -1)" title="-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" x2="19" y1="12" y2="12"/></svg>
                </button>
                <button type="button" class="btn btn-secondary btn-icon-only" onclick="app.editStock('${p.id}')" title="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button type="button" class="btn btn-danger btn-icon-only" onclick="app.deleteStock('${p.id}')" title="Excluir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    const footQtd = filtered.reduce((acc, p) => acc + p.estoque, 0);
    const footVendidas = filtered.reduce((acc, p) => acc + p.vendida, 0);
    const footCusto = filtered.reduce((acc, p) => acc + p.estoqueCusto, 0);
    const footVenda = filtered.reduce((acc, p) => acc + p.estoqueVenda, 0);
    const footPrevLucro = filtered.reduce((acc, p) => acc + p.previsaoLucro, 0);
    const footLucroObtido = filtered.reduce((acc, p) => acc + p.lucroObtido, 0);
    const footTotalCusto = filtered.reduce((acc, p) => acc + p.totalCusto, 0);

    document.getElementById('footStockQtd').textContent = footQtd;
    document.getElementById('footStockVendidas').textContent = footVendidas;
    document.getElementById('footStockCusto').textContent = this.fmtBRL(footCusto);
    document.getElementById('footStockVenda').textContent = this.fmtBRL(footVenda);
    document.getElementById('footStockPrevisaoLucro').textContent = this.fmtBRL(footPrevLucro);
    document.getElementById('footStockLucroObtido').textContent = this.fmtBRL(footLucroObtido);
    document.getElementById('footStockTotalCusto').textContent = this.fmtBRL(footTotalCusto);
  }

  // ---- Sales Table ----
  renderSalesTable(data) {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;

    const search = (document.getElementById('inputSearchSales').value || '').toLowerCase().trim();
    const monthFilter = document.getElementById('selectFilterSalesMonth').value;

    const monthSelect = document.getElementById('selectFilterSalesMonth');
    if (monthSelect && monthSelect.options.length <= 1) {
      const months = [...new Set(data.sales.map(s => s.mes).filter(Boolean))];
      months.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        monthSelect.appendChild(opt);
      });
    }

    const filtered = data.sales.filter(s => {
      const matchSearch = !search ||
        s.produto.toLowerCase().includes(search) ||
        s.marca.toLowerCase().includes(search) ||
        s.cliente.toLowerCase().includes(search);
      const matchMonth = monthFilter === 'ALL' || s.mes === monthFilter;
      return matchSearch && matchMonth;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 20px; color: var(--text-disabled);">Nenhuma venda encontrada</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(s => `
        <tr>
          <td class="num-mono" style="color: var(--text-tertiary);">${s.data || '-'}</td>
          <td><span class="status-pill status-in-stock">${s.mes}</span></td>
          <td><strong>${s.produto}</strong></td>
          <td style="color: var(--accent);">${s.marca}</td>
          <td class="num-mono">${s.quantidade}</td>
          <td class="num-mono">${this.fmtBRL(s.custo)}</td>
          <td class="num-mono val-cyan">${this.fmtBRL(s.venda_total)}</td>
          <td class="num-mono val-positive">${this.fmtBRL(s.lucro)}</td>
          <td><strong>${s.cliente}</strong></td>
          <td>
            <button type="button" class="btn btn-danger btn-icon-only" onclick="app.deleteSale('${s.id}')" title="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `).join('');
    }

    const footQtd = filtered.reduce((acc, s) => acc + s.quantidade, 0);
    const footCusto = filtered.reduce((acc, s) => acc + s.custo, 0);
    const footBruto = filtered.reduce((acc, s) => acc + s.venda_total, 0);
    const footLucro = filtered.reduce((acc, s) => acc + s.lucro, 0);

    document.getElementById('footSalesQtd').textContent = footQtd;
    document.getElementById('footSalesCusto').textContent = this.fmtBRL(footCusto);
    document.getElementById('footSalesBruto').textContent = this.fmtBRL(footBruto);
    document.getElementById('footSalesLucro').textContent = this.fmtBRL(footLucro);
  }

  // ---- Fiado Table ----
  renderFiadoTable(data) {
    const tbody = document.getElementById('fiadoTableBody');
    if (!tbody) return;

    const search = (document.getElementById('inputSearchFiado').value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('selectFilterFiadoStatus').value;

    const filtered = data.receivables.filter(r => {
      const matchSearch = !search || r.cliente.toLowerCase().includes(search) || (r.observacao && r.observacao.toLowerCase().includes(search));
      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchSearch && matchStatus;
    });

    document.getElementById('fiadoBannerPendente').textContent = this.fmtBRL(data.kpis.totalFiadoPendente);
    document.getElementById('fiadoBannerRecebido').textContent = this.fmtBRL(data.kpis.totalFiadoRecebido);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: var(--text-disabled);">Nenhuma conta encontrada</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(r => {
        let statusHtml = '';
        if (r.status === 'pago') {
          statusHtml = `<span class="status-pill status-paid">Pago</span>`;
        } else if (r.isOverdue) {
          statusHtml = `<span class="status-pill status-overdue">Atrasado</span>`;
        } else {
          statusHtml = `<span class="status-pill status-pending">Pendente</span>`;
        }

        return `
          <tr>
            <td><strong>${r.cliente}</strong></td>
            <td class="num-mono ${r.status === 'pago' ? 'val-positive' : 'val-danger'}">${this.fmtBRL(r.valor)}</td>
            <td style="color: var(--text-tertiary);">${r.data_vencimento || 'A combinar'}</td>
            <td>${statusHtml}</td>
            <td style="color: var(--text-tertiary);">${r.data_recebimento || '-'}</td>
            <td style="color: var(--text-disabled); font-size: 0.75rem;">${r.observacao || '-'}</td>
            <td>
              <div class="btn-group">
                ${r.status === 'pendente' ? `
                  <button type="button" class="btn btn-success btn-sm" onclick="app.payReceivable('${r.id}')">Receber</button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="app.unpayReceivable('${r.id}')">Desfazer</button>
                `}
                <button type="button" class="btn btn-danger btn-icon-only" onclick="app.deleteReceivable('${r.id}')" title="Excluir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    const totalFiltered = filtered.reduce((acc, r) => acc + r.valor, 0);
    document.getElementById('footFiadoTotal').textContent = this.fmtBRL(totalFiltered);
  }

  // ---- Factory Orders (Pedidos da Fábrica) ----
  renderPedidosTable(data) {
    const tbody = document.getElementById('pedidosTableBody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('inputSearchPedidos')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('selectFilterPedidosStatus')?.value || 'ALL';

    const orders = data.factoryOrders || [];

    const filtered = orders.filter(o => {
      const matchSearch = !searchTerm ||
        o.produto.toLowerCase().includes(searchTerm) ||
        (o.marca && o.marca.toLowerCase().includes(searchTerm)) ||
        (o.fornecedor && o.fornecedor.toLowerCase().includes(searchTerm)) ||
        (o.rastreio && o.rastreio.toLowerCase().includes(searchTerm));

      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;

      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-disabled); padding: 24px;">Nenhum pedido de fábrica encontrado</td></tr>';
    } else {
      tbody.innerHTML = filtered.map(o => {
        const isReceived = o.status === 'recebido';
        const statusBadge = isReceived
          ? '<span class="badge-status badge-status-received"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>Recebido</span>'
          : '<span class="badge-status badge-status-pending"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Aguardando</span>';

        return `
          <tr>
            <td class="num-mono" style="color: var(--text-tertiary);">${o.data_pedido || '-'}</td>
            <td><strong>${o.produto}</strong></td>
            <td><span class="brand-tag">${o.marca || '-'}</span></td>
            <td class="num-mono"><strong>${o.quantidade}</strong></td>
            <td class="num-mono">${this.fmtBRL(o.valor_unitario)}</td>
            <td class="num-mono">${this.fmtBRL(o.subtotal)}</td>
            <td class="num-mono" style="color: var(--text-tertiary);">${this.fmtBRL(o.frete)}</td>
            <td class="num-mono val-positive" title="Custo com frete rateado: (Subtotal + Frete) / Qtd"><strong>${this.fmtBRL(o.custoUnitarioFinal)}</strong></td>
            <td class="num-mono val-cyan"><strong>${this.fmtBRL(o.total)}</strong></td>
            <td style="font-size: 0.775rem;">
              <div>${o.data_previsao ? 'Prev: ' + o.data_previsao : (o.data_recebimento ? 'Rec: ' + o.data_recebimento : '-')}</div>
              ${o.rastreio ? `<div style="color: var(--text-disabled); font-family: var(--font-mono); font-size: 0.7rem;">${o.rastreio}</div>` : ''}
            </td>
            <td>${statusBadge}</td>
            <td>
              <div class="table-actions">
                ${!isReceived ? `
                  <button type="button" class="btn btn-success btn-sm" onclick="app.receiveFactoryOrder('${o.id}')" title="Dar entrada no estoque">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
                    Receber
                  </button>
                ` : `
                  <button type="button" class="btn btn-secondary btn-sm" onclick="app.unreceiveFactoryOrder('${o.id}')" title="Reverter para pendente">
                    Desfazer
                  </button>
                `}
                <button type="button" class="btn btn-secondary btn-icon-only" onclick="app.editFactoryOrder('${o.id}')" title="Editar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button type="button" class="btn btn-danger btn-icon-only" onclick="app.deleteFactoryOrder('${o.id}')" title="Excluir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Totais de rodapé
    const totalQtd = filtered.reduce((acc, o) => acc + o.quantidade, 0);
    const totalSub = filtered.reduce((acc, o) => acc + o.subtotal, 0);
    const totalFrete = filtered.reduce((acc, o) => acc + o.frete, 0);
    const totalGeral = filtered.reduce((acc, o) => acc + o.total, 0);
    const custoMedio = totalQtd > 0 ? (totalGeral / totalQtd) : 0;

    const footQtd = document.getElementById('footPedidosQtd');
    const footSub = document.getElementById('footPedidosSubtotal');
    const footFrete = document.getElementById('footPedidosFrete');
    const footMedio = document.getElementById('footPedidosCustoMedio');
    const footTot = document.getElementById('footPedidosTotalGeral');

    if (footQtd) footQtd.textContent = totalQtd;
    if (footSub) footSub.textContent = this.fmtBRL(totalSub);
    if (footFrete) footFrete.textContent = this.fmtBRL(totalFrete);
    if (footMedio) footMedio.textContent = this.fmtBRL(custoMedio);
    if (footTot) footTot.textContent = this.fmtBRL(totalGeral);

    // Banner KPIs
    const bannerPendentes = document.getElementById('pedidosBannerPendentes');
    const bannerItens = document.getElementById('pedidosBannerItens');
    const bannerTotal = document.getElementById('pedidosBannerTotal');

    if (bannerPendentes) bannerPendentes.textContent = this.fmtBRL(data.kpis.totalValorPendentes);
    if (bannerItens) bannerItens.textContent = `${data.kpis.totalItensPendentes} un`;
    if (bannerTotal) bannerTotal.textContent = this.fmtBRL(data.kpis.totalGeralFabrica);
  }

  // ---- Annual View ----
  renderAnnualView(data) {
    const tbody = document.getElementById('annualTableBody');
    if (!tbody) return;

    document.getElementById('bannerThirdCusto').textContent = this.fmtBRL(data.totalAno.custoFixoVariado);
    document.getElementById('bannerThirdLabore').textContent = this.fmtBRL(data.totalAno.proLabore);
    document.getElementById('bannerThirdInvest').textContent = this.fmtBRL(data.totalAno.investir);

    tbody.innerHTML = data.monthsList.map(m => {
      const active = m.bruto > 0;
      return `
        <tr style="${active ? 'background: var(--bg-hover);' : ''}">
          <td><strong>${m.mes}</strong></td>
          <td class="num-mono">${m.quantidade}</td>
          <td class="num-mono val-cyan">${this.fmtBRL(m.bruto)}</td>
          <td class="num-mono">${this.fmtBRL(m.custo)}</td>
          <td class="num-mono val-positive">${this.fmtBRL(m.lucro)}</td>
          <td class="num-mono" style="color: var(--accent);">${this.fmtBRL(m.custoFixoVariado)}</td>
          <td class="num-mono" style="color: var(--success);">${this.fmtBRL(m.proLabore)}</td>
          <td class="num-mono" style="color: var(--color-purple);">${this.fmtBRL(m.investir)}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('footAnnualQtd').textContent = data.totalAno.quantidade;
    document.getElementById('footAnnualBruto').textContent = this.fmtBRL(data.totalAno.bruto);
    document.getElementById('footAnnualCusto').textContent = this.fmtBRL(data.totalAno.custo);
    document.getElementById('footAnnualLucro').textContent = this.fmtBRL(data.totalAno.lucro);
    document.getElementById('footAnnualCustoFixo').textContent = this.fmtBRL(data.totalAno.custoFixoVariado);
    document.getElementById('footAnnualProLabore').textContent = this.fmtBRL(data.totalAno.proLabore);
    document.getElementById('footAnnualInvestir').textContent = this.fmtBRL(data.totalAno.investir);

    // Bar chart
    const chartContainer = document.getElementById('annualChartBars');
    if (chartContainer) {
      const maxBruto = Math.max(...data.monthsList.map(m => m.bruto), 1000);
      chartContainer.innerHTML = data.monthsList.map(m => {
        const revHeight = Math.max(3, Math.round((m.bruto / maxBruto) * 140));
        const profHeight = Math.max(3, Math.round((m.lucro / maxBruto) * 140));
        const shortName = m.mes.split('/')[0].slice(0, 3);

        return `
          <div class="bar-col" title="${m.mes}: ${this.fmtBRL(m.bruto)} | Lucro ${this.fmtBRL(m.lucro)}">
            <div class="bar-group">
              <div class="bar bar-revenue" style="height: ${revHeight}px;"></div>
              <div class="bar bar-profit" style="height: ${profHeight}px;"></div>
            </div>
            <div class="bar-label">${shortName}</div>
          </div>
        `;
      }).join('');
    }
  }

  // ---- Product Selects ----
  populateProductSelects(data) {
    const saleSelect = document.getElementById('saleInputProduct');
    if (saleSelect) {
      const currentVal = saleSelect.value;
      saleSelect.innerHTML = '<option value="">Selecione...</option>' +
        data.stock.map(p => `
          <option value="${p.id}" data-custo="${p.custo}" data-venda="${p.venda}" data-estoque="${p.estoque}" data-marca="${p.marca}">
            ${p.produto} — ${p.marca} (${p.estoque} un | R$ ${p.venda.toFixed(2)})
          </option>
        `).join('');
      if (currentVal) saleSelect.value = currentVal;
    }

    const datalist = document.getElementById('stockProductsDatalist');
    if (datalist) {
      const uniqueNames = [...new Set((data.stock || []).map(p => p.produto))];
      datalist.innerHTML = uniqueNames.map(name => `<option value="${name}">`).join('');
    }
  }

  // ================= CALCULATOR =================
  initCalcInputs() {
    const inputs = ['calcInputCusto', 'calcInputMargem', 'calcInputPrecoVenda', 'calcInputQtd'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateCommercialCalc());
      }
    });
    this.updateCommercialCalc();
  }

  initFactoryOrderInputs() {
    const inputs = ['pedidoInputQtd', 'pedidoInputCustoUnit', 'pedidoInputFrete'];
    inputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.updateFactoryOrderModalCalcs());
      }
    });

    document.getElementById('pedidoInputProduto')?.addEventListener('input', (e) => {
      const val = (e.target.value || '').trim().toLowerCase();
      const found = window.appStore.getRawStock().find(p => p.produto.toLowerCase() === val);
      if (found && found.marca) {
        const marcaInput = document.getElementById('pedidoInputMarca');
        if (marcaInput && !marcaInput.value) {
          marcaInput.value = found.marca;
        }
      }
    });
  }

  updateFactoryOrderModalCalcs() {
    const qtd = Number(document.getElementById('pedidoInputQtd')?.value) || 0;
    const custoUnit = Number(document.getElementById('pedidoInputCustoUnit')?.value) || 0;
    const frete = Number(document.getElementById('pedidoInputFrete')?.value) || 0;

    const subtotal = qtd * custoUnit;
    const total = subtotal + frete;
    const freteUnit = qtd > 0 ? (frete / qtd) : 0;
    const custoMedio = qtd > 0 ? (total / qtd) : custoUnit;

    const elSub = document.getElementById('pedidoCalcSubtotal');
    const elTot = document.getElementById('pedidoCalcTotal');
    const elFrete = document.getElementById('pedidoCalcFreteUnit');
    const elMedio = document.getElementById('pedidoCalcMedio');

    if (elSub) elSub.textContent = this.fmtBRL(subtotal);
    if (elTot) elTot.textContent = this.fmtBRL(total);
    if (elFrete) elFrete.textContent = this.fmtBRL(freteUnit);
    if (elMedio) elMedio.textContent = this.fmtBRL(custoMedio);
  }

  updateCommercialCalc() {
    const custo = Number(document.getElementById('calcInputCusto')?.value) || 0;
    const precoVenda = Number(document.getElementById('calcInputPrecoVenda')?.value) || 0;
    const margem = Number(document.getElementById('calcInputMargem')?.value) || 0;
    const qtd = Number(document.getElementById('calcInputQtd')?.value) || 1;

    const res = window.businessCalculator.calculateCommercial({
      custo: custo,
      precoVenda: precoVenda > 0 ? precoVenda : undefined,
      margemPercent: precoVenda > 0 ? undefined : margem,
      quantidade: qtd
    });

    document.getElementById('calcResVendaUnit').textContent = this.fmtBRL(res.precoVendaUnitario);
    document.getElementById('calcResLucroUnit').textContent = this.fmtBRL(res.lucroUnitario);
    document.getElementById('calcResMargemEfetiva').textContent = res.margemPercent.toFixed(1) + '%';
    document.getElementById('calcResMarkup').textContent = res.markup.toFixed(2) + 'x';
    document.getElementById('calcResLucroTotal').textContent = this.fmtBRL(res.lucroTotalLote);
    document.getElementById('calcResTerco').textContent = this.fmtBRL(res.partilha.custoFixoVariado);
  }

  calcPress(key) {
    window.businessCalculator.handleStandardInput(key);
    document.getElementById('stdCalcExpr').textContent = window.businessCalculator.standardExpression;
    document.getElementById('stdCalcResult').textContent = window.businessCalculator.standardResult || '0';
  }

  // ================= ACTIONS =================
  bindEvents() {
    // Sidebar nav tabs
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Filters
    ['inputSearchStock', 'selectFilterStockBrand', 'selectFilterStockStatus'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderStockTable(window.appStore.getCalculatedData()));
    });

    ['inputSearchSales', 'selectFilterSalesMonth'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderSalesTable(window.appStore.getCalculatedData()));
    });

    ['inputSearchFiado', 'selectFilterFiadoStatus'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderFiadoTable(window.appStore.getCalculatedData()));
    });

    ['inputSearchPedidos', 'selectFilterPedidosStatus'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.renderPedidosTable(window.appStore.getCalculatedData()));
    });

    // Modals
    document.getElementById('btnModalNovaVenda')?.addEventListener('click', () => this.openSaleModal());
    document.getElementById('btnModalNovoProduto')?.addEventListener('click', () => this.openProductModal());
    document.getElementById('btnModalNovoFiado')?.addEventListener('click', () => this.openModal('modalNovoFiado'));
    document.getElementById('btnUserModal')?.addEventListener('click', () => this.openUserModal());
    document.getElementById('btnBackupModal')?.addEventListener('click', () => this.openModal('modalBackup'));

    // Sale product select auto-fill
    document.getElementById('saleInputProduct')?.addEventListener('change', (e) => {
      const selected = e.target.options[e.target.selectedIndex];
      if (selected && selected.value) {
        const custo = Number(selected.getAttribute('data-custo')) || 0;
        const venda = Number(selected.getAttribute('data-venda')) || 0;
        const qtd = Number(document.getElementById('saleInputQtd').value) || 1;
        document.getElementById('saleInputCusto').value = (custo * qtd).toFixed(2);
        document.getElementById('saleInputVendaTotal').value = (venda * qtd).toFixed(2);
      }
    });

    document.getElementById('saleInputQtd')?.addEventListener('input', () => {
      const select = document.getElementById('saleInputProduct');
      const selected = select.options[select.selectedIndex];
      if (selected && selected.value) {
        const custo = Number(selected.getAttribute('data-custo')) || 0;
        const venda = Number(selected.getAttribute('data-venda')) || 0;
        const qtd = Number(document.getElementById('saleInputQtd').value) || 1;
        document.getElementById('saleInputCusto').value = (custo * qtd).toFixed(2);
        document.getElementById('saleInputVendaTotal').value = (venda * qtd).toFixed(2);
      }
    });

    // Fiado checkbox toggle
    document.getElementById('saleInputIsFiado')?.addEventListener('change', (e) => {
      const fiadoDetails = document.getElementById('saleFiadoDetails');
      if (fiadoDetails) {
        fiadoDetails.style.display = e.target.checked ? 'block' : 'none';
      }
    });

    // Form: New Sale
    document.getElementById('formNovaVenda')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const select = document.getElementById('saleInputProduct');
      const selected = select.options[select.selectedIndex];
      if (!selected || !selected.value) {
        this.showToast('Selecione um produto');
        return;
      }

      const prodName = selected.text.split('—')[0].trim();
      const marca = selected.getAttribute('data-marca') || '';
      const qtd = Number(document.getElementById('saleInputQtd').value) || 1;
      const custo = Number(document.getElementById('saleInputCusto').value) || 0;
      const vendaTotal = Number(document.getElementById('saleInputVendaTotal').value) || 0;
      const cliente = document.getElementById('saleInputCliente').value.trim();
      const mes = document.getElementById('saleInputMes').value.trim();
      const isFiado = document.getElementById('saleInputIsFiado').checked;
      const dataVencimento = document.getElementById('saleInputDataVencimento').value || null;

      window.appStore.addSale({
        productId: selected.value,
        produto: prodName,
        marca: marca,
        quantidade: qtd,
        custo: custo,
        venda_total: vendaTotal,
        cliente: cliente,
        mes: mes,
        isFiado: isFiado,
        data_vencimento: dataVencimento
      });

      this.closeModal('modalNovaVenda');
      this.showToast(`Venda registrada: ${qtd}x ${prodName}`);
    });

    // Form: New Product
    document.getElementById('formNovoProduto')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('prodEditId').value;
      const nome = document.getElementById('prodInputNome').value.trim();
      const marca = document.getElementById('prodInputMarca').value.trim();
      const custo = Number(document.getElementById('prodInputCusto').value) || 0;
      const venda = Number(document.getElementById('prodInputVenda').value) || 0;
      const estoque = Number(document.getElementById('prodInputEstoque').value) || 0;
      const vendida = Number(document.getElementById('prodInputVendida').value) || 0;

      if (id) {
        window.appStore.updateStockItem(id, { produto: nome, marca, custo, venda, estoque, vendida });
      } else {
        window.appStore.addStockItem({ produto: nome, marca, custo, venda, estoque, vendida });
      }

      this.closeModal('modalNovoProduto');
      this.showToast(id ? 'Produto atualizado' : 'Produto cadastrado');
    });

    // Form: New Receivable
    document.getElementById('formNovoFiado')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const cliente = document.getElementById('fiadoInputCliente').value.trim();
      const valor = Number(document.getElementById('fiadoInputValor').value) || 0;
      const data = document.getElementById('fiadoInputData').value || null;
      const obs = document.getElementById('fiadoInputObs').value.trim();

      window.appStore.addReceivable({ cliente, valor, data_vencimento: data, observacao: obs });
      this.closeModal('modalNovoFiado');
      this.showToast('Conta cadastrada');
    });

    // Form: Factory Order
    document.getElementById('formNovoPedido')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('pedidoEditId').value;
      const produto = document.getElementById('pedidoInputProduto').value.trim();
      const marca = document.getElementById('pedidoInputMarca').value.trim();
      const qtd = Number(document.getElementById('pedidoInputQtd').value) || 1;
      const custoUnit = Number(document.getElementById('pedidoInputCustoUnit').value) || 0;
      const frete = Number(document.getElementById('pedidoInputFrete').value) || 0;
      const dataPedido = document.getElementById('pedidoInputData').value || null;
      const dataPrevisao = document.getElementById('pedidoInputPrevisao').value || null;
      const rastreio = document.getElementById('pedidoInputRastreio').value.trim();
      const obs = document.getElementById('pedidoInputObs').value.trim();
      const addToStock = document.getElementById('pedidoInputAddToStock')?.checked || false;

      if (id) {
        window.appStore.updateFactoryOrder(id, {
          produto,
          marca,
          quantidade: qtd,
          valor_unitario: custoUnit,
          frete: frete,
          data_pedido: dataPedido,
          data_previsao: dataPrevisao,
          rastreio: rastreio,
          observacao: obs
        });
        this.showToast('Pedido atualizado');
      } else {
        window.appStore.addFactoryOrder({
          produto,
          marca,
          quantidade: qtd,
          valor_unitario: custoUnit,
          frete: frete,
          status: addToStock ? 'recebido' : 'pendente',
          data_pedido: dataPedido,
          data_previsao: dataPrevisao,
          rastreio: rastreio,
          observacao: obs,
          addToStock: addToStock
        });
        this.showToast(addToStock ? 'Pedido cadastrado e adicionado ao estoque' : 'Pedido de fábrica cadastrado');
      }

      this.closeModal('modalNovoPedido');
    });

    // Form: User
    document.getElementById('formUsuario')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = document.getElementById('inputNomeUsuario').value.trim();
      window.appStore.setUserName(nome);
      this.closeModal('modalUsuario');
      this.showToast('Nome atualizado');
    });

    // Export & Backup
    document.getElementById('btnExportAllExcel')?.addEventListener('click', () => this.exportFullExcelWorkbook());
    document.getElementById('btnExportStockExcel')?.addEventListener('click', () => this.exportSheetExcel('Estoque'));
    document.getElementById('btnExportSalesExcel')?.addEventListener('click', () => this.exportSheetExcel('Vendas'));
    document.getElementById('btnExportFiadoExcel')?.addEventListener('click', () => this.exportSheetExcel('Fiado'));
    document.getElementById('btnExportAnnualExcel')?.addEventListener('click', () => this.exportSheetExcel('Anual'));
    document.getElementById('btnExportPedidosExcel')?.addEventListener('click', () => this.exportSheetExcel('Pedidos'));
    document.getElementById('btnDownloadBackupJson')?.addEventListener('click', () => {
      window.appStore.exportJSON();
      this.showToast('Backup JSON baixado');
    });

    // Upload backup
    document.getElementById('inputUploadBackupJson')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = window.appStore.importJSON(event.target.result);
          if (res.success) {
            this.showToast('Backup restaurado com sucesso');
            this.closeModal('modalBackup');
          } else {
            this.showToast('Erro: ' + res.error);
          }
        };
        reader.readAsText(file);
      }
    });

    // Reset original data
    document.getElementById('btnResetOriginalData')?.addEventListener('click', async () => {
      const confirmed = await this.showConfirm(
        'Restaurar dados originais da TABELA.xlsx? Alterações não salvas em backup serão perdidas.',
        'Restaurar Dados'
      );
      if (confirmed) {
        window.appStore.resetToOriginal();
        this.showToast('Dados originais restaurados');
        this.closeModal('modalBackup');
      }
    });
  }

  // ================= QUICK ACTIONS =================
  adjustStock(id, delta) {
    window.appStore.adjustStockQuantity(id, delta);
    this.showToast(`Estoque ajustado (${delta > 0 ? '+' : ''}${delta})`);
  }

  editStock(id) {
    const data = window.appStore.getCalculatedData();
    const prod = data.stock.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('modalProdutoTitle').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      Editar Produto
    `;
    document.getElementById('prodEditId').value = prod.id;
    document.getElementById('prodInputNome').value = prod.produto;
    document.getElementById('prodInputMarca').value = prod.marca;
    document.getElementById('prodInputCusto').value = prod.custo;
    document.getElementById('prodInputVenda').value = prod.venda;
    document.getElementById('prodInputEstoque').value = prod.estoque;
    document.getElementById('prodInputVendida').value = prod.vendida;

    this.openModal('modalNovoProduto');
  }

  async deleteStock(id) {
    const confirmed = await this.showConfirm('Remover este produto do estoque?', 'Excluir Produto');
    if (confirmed) {
      window.appStore.deleteStockItem(id);
      this.showToast('Produto excluído');
    }
  }

  async deleteSale(id) {
    const confirmed = await this.showConfirm('Excluir este registro de venda?', 'Excluir Venda');
    if (confirmed) {
      window.appStore.deleteSale(id);
      this.showToast('Venda excluída');
    }
  }

  payReceivable(id) {
    window.appStore.payReceivable(id);
    this.showToast('Conta marcada como recebida');
  }

  unpayReceivable(id) {
    window.appStore.unpayReceivable(id);
    this.showToast('Status revertido para pendente');
  }

  async deleteReceivable(id) {
    const confirmed = await this.showConfirm('Excluir esta conta a receber?', 'Excluir Conta');
    if (confirmed) {
      window.appStore.deleteReceivable(id);
      this.showToast('Conta excluída');
    }
  }

  openSaleModal() {
    document.getElementById('formNovaVenda').reset();
    document.getElementById('saleInputQtd').value = 1;
    document.getElementById('saleInputMes').value = window.appStore.getCurrentMonthString();
    document.getElementById('saleFiadoDetails').style.display = 'none';
    this.openModal('modalNovaVenda');
  }

  openProductModal() {
    document.getElementById('formNovoProduto').reset();
    document.getElementById('modalProdutoTitle').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
      Cadastrar Produto
    `;
    document.getElementById('prodEditId').value = '';
    document.getElementById('prodInputEstoque').value = 0;
    document.getElementById('prodInputVendida').value = 0;
    this.openModal('modalNovoProduto');
  }

  // ================= FACTORY ORDERS MODAL & ACTIONS =================
  openFactoryOrderModal() {
    document.getElementById('formNovoPedido').reset();
    document.getElementById('pedidoEditId').value = '';
    document.getElementById('modalPedidoTitle').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/></svg>
      Novo Pedido da Fábrica
    `;
    document.getElementById('pedidoInputData').value = new Date().toISOString().split('T')[0];
    const toggleBox = document.getElementById('pedidoStockToggleBox');
    if (toggleBox) toggleBox.style.display = 'block';
    const addToStockCheckbox = document.getElementById('pedidoInputAddToStock');
    if (addToStockCheckbox) addToStockCheckbox.checked = false;

    this.updateFactoryOrderModalCalcs();
    this.openModal('modalNovoPedido');
  }

  editFactoryOrder(id) {
    const data = window.appStore.getCalculatedData();
    const ord = (data.factoryOrders || []).find(o => o.id === id);
    if (!ord) return;

    document.getElementById('modalPedidoTitle').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
      Editar Pedido da Fábrica
    `;
    document.getElementById('pedidoEditId').value = ord.id;
    document.getElementById('pedidoInputProduto').value = ord.produto;
    document.getElementById('pedidoInputMarca').value = ord.marca || '';
    document.getElementById('pedidoInputQtd').value = ord.quantidade;
    document.getElementById('pedidoInputCustoUnit').value = ord.valor_unitario;
    document.getElementById('pedidoInputFrete').value = ord.frete || 0;
    document.getElementById('pedidoInputData').value = ord.data_pedido || '';
    document.getElementById('pedidoInputPrevisao').value = ord.data_previsao || '';
    document.getElementById('pedidoInputRastreio').value = ord.rastreio || '';
    document.getElementById('pedidoInputObs').value = ord.observacao || '';

    const toggleBox = document.getElementById('pedidoStockToggleBox');
    if (toggleBox) toggleBox.style.display = 'none';

    this.updateFactoryOrderModalCalcs();
    this.openModal('modalNovoPedido');
  }

  async receiveFactoryOrder(id) {
    const confirmed = await this.showConfirm(
      'Confirmar recebimento deste pedido? As quantidades serão adicionadas automaticamente ao estoque.',
      'Receber Pedido'
    );
    if (confirmed) {
      window.appStore.receiveFactoryOrder(id, true);
      this.showToast('Pedido marcado como recebido e estoque atualizado');
    }
  }

  async unreceiveFactoryOrder(id) {
    const confirmed = await this.showConfirm(
      'Reverter status para pendente? As unidades adicionadas ao estoque serão deduzidas.',
      'Desfazer Recebimento'
    );
    if (confirmed) {
      window.appStore.unreceiveFactoryOrder(id);
      this.showToast('Status revertido para pendente');
    }
  }

  async deleteFactoryOrder(id) {
    const confirmed = await this.showConfirm('Excluir este pedido da fábrica?', 'Excluir Pedido');
    if (confirmed) {
      window.appStore.deleteFactoryOrder(id);
      this.showToast('Pedido excluído');
    }
  }

  openUserModal() {
    document.getElementById('inputNomeUsuario').value = window.appStore.getUserName();
    this.openModal('modalUsuario');
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  }

  // ================= EXCEL EXPORT =================
  exportFullExcelWorkbook() {
    if (typeof XLSX === 'undefined') {
      this.showToast('SheetJS ainda carregando. Tente novamente.');
      return;
    }

    const calc = window.appStore.getCalculatedData();
    const wb = XLSX.utils.book_new();

    const stockRows = calc.stock.map(p => ({
      'Produto e Peso': p.produto, 'Marca': p.marca, 'Valor de Custo': p.custo, 'Valor de Venda': p.venda,
      'Estoque': p.estoque, 'Vendida': p.vendida, 'Estoque Custo': p.estoqueCusto, 'Estoque Venda': p.estoqueVenda,
      'Margem': p.margem, 'Lucro Unitário': p.lucroUnitario, 'Previsão de Lucro Final': p.previsaoLucro,
      'Lucro Obtido': p.lucroObtido, 'Total Custo': p.totalCusto
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'ESTOQUE');

    const salesRows = calc.sales.map(s => ({
      'DATA': s.data || '', 'MÊS': s.mes, 'NOME': s.produto, 'MARCA': s.marca,
      'QUANTIDADE': s.quantidade, 'VALOR DE CUSTO': s.custo, 'VALOR DE TOTAL DE VENDA': s.venda_total,
      'LUCRO': s.lucro, 'CLIENTE': s.cliente
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'CONTROLE DE SAÍDA');

    const fiadoRows = calc.receivables.map(r => ({
      'CLIENTE': r.cliente, 'VALOR': r.valor, 'DATA VENCIMENTO': r.data_vencimento || '',
      'STATUS': r.status.toUpperCase(), 'DATA RECEBIMENTO': r.data_recebimento || '', 'OBSERVAÇÃO': r.observacao || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fiadoRows), 'AGUARDANDO PAGAMENTO');

    const annualRows = calc.monthsList.map(m => ({
      'MÊS': m.mes, 'QUANTIDADE': m.quantidade, 'BRUTO': m.bruto, 'CUSTO': m.custo,
      'LUCRO': m.lucro, 'CUSTO FIXO/VARIADO (1/3)': m.custoFixoVariado,
      'PRO-LABORE (1/3)': m.proLabore, 'INVESTIR (1/3)': m.investir
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annualRows), 'VISAO ANUAL 2026');

    const factoryRows = (calc.factoryOrders || []).map(o => ({
      'DATA': o.data_pedido || '', 'PRODUTO': o.produto, 'MARCA': o.marca || '',
      'QUANTIDADE': o.quantidade, 'VALOR UNIT. FÁBRICA': o.valor_unitario, 'SUBTOTAL': o.subtotal,
      'FRETE': o.frete, 'CUSTO UNIT. FINAL': o.custoUnitarioFinal, 'TOTAL PEDIDO': o.total,
      'STATUS': (o.status || '').toUpperCase(), 'PREVISÃO / CHEGADA': o.data_previsao || o.data_recebimento || '',
      'RASTREIO': o.rastreio || '', 'OBSERVAÇÃO': o.observacao || ''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(factoryRows), 'PEDIDOS DA FÁBRICA');

    XLSX.writeFile(wb, `Gestao_Comercial_2026_${new Date().toISOString().split('T')[0]}.xlsx`);
    this.showToast('Excel exportado');
  }

  exportSheetExcel(type) {
    if (typeof XLSX === 'undefined') {
      this.showToast('SheetJS ainda carregando.');
      return;
    }
    const calc = window.appStore.getCalculatedData();
    const wb = XLSX.utils.book_new();

    if (type === 'Estoque') {
      const rows = calc.stock.map(p => ({
        'Produto': p.produto, 'Marca': p.marca, 'Custo': p.custo, 'Venda': p.venda,
        'Estoque': p.estoque, 'Vendida': p.vendida, 'Estoque Custo': p.estoqueCusto,
        'Estoque Venda': p.estoqueVenda, 'Margem %': p.margemPercent, 'Lucro Unit.': p.lucroUnitario,
        'Previsão Lucro': p.previsaoLucro, 'Lucro Obtido': p.lucroObtido, 'Total Custo': p.totalCusto
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Estoque');
      XLSX.writeFile(wb, 'Estoque_2026.xlsx');
    } else if (type === 'Vendas') {
      const rows = calc.sales.map(s => ({
        'Data': s.data, 'Mês': s.mes, 'Produto': s.produto, 'Marca': s.marca,
        'Qtd': s.quantidade, 'Custo': s.custo, 'Venda': s.venda_total, 'Lucro': s.lucro, 'Cliente': s.cliente
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Vendas');
      XLSX.writeFile(wb, 'Vendas_2026.xlsx');
    } else if (type === 'Fiado') {
      const rows = calc.receivables.map(r => ({
        'Cliente': r.cliente, 'Valor': r.valor, 'Vencimento': r.data_vencimento,
        'Status': r.status, 'Data Pagamento': r.data_recebimento
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Contas_a_Receber');
      XLSX.writeFile(wb, 'Contas_a_Receber_2026.xlsx');
    } else if (type === 'Anual') {
      const rows = calc.monthsList.map(m => ({
        'Mês': m.mes, 'Quantidade': m.quantidade, 'Faturamento': m.bruto, 'Custo': m.custo,
        'Lucro': m.lucro, '1/3 Custo Fixo': m.custoFixoVariado, '1/3 Pró-Labore': m.proLabore,
        '1/3 Reinvestir': m.investir
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Balanco_Anual');
      XLSX.writeFile(wb, 'Balanco_Anual_2026.xlsx');
    } else if (type === 'Pedidos') {
      const rows = (calc.factoryOrders || []).map(o => ({
        'Data': o.data_pedido, 'Produto': o.produto, 'Marca': o.marca,
        'Qtd': o.quantidade, 'Valor Un. Fábrica': o.valor_unitario, 'Subtotal': o.subtotal,
        'Frete': o.frete, 'Custo Un. Final': o.custoUnitarioFinal, 'Total Pedido': o.total,
        'Status': o.status, 'Previsão': o.data_previsao, 'Rastreio': o.rastreio
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Pedidos_Fabrica');
      XLSX.writeFile(wb, 'Pedidos_Fabrica_2026.xlsx');
    }
    this.showToast('Excel exportado');
  }
}

// Init
window.addEventListener('DOMContentLoaded', () => {
  window.app = new CommercialApp();
  window.app.init();
});
