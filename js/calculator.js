/**
 * Calculadora Integrada: Modo Comercial (Margem/Markup/Partilha) + Modo Padrão
 */

class BusinessCalculator {
  constructor() {
    this.standardExpression = '';
    this.standardResult = '0';
    this.hasEvaluated = false;
  }

  // ================= CALCULADORA COMERCIAL =================
  calculateCommercial({ custo, margemPercent, precoVenda, quantidade = 1 }) {
    custo = Number(custo) || 0;
    quantidade = Math.max(1, Number(quantidade) || 1);

    let finalVenda = 0;
    let finalMargem = 0;
    let finalLucroUnit = 0;

    if (precoVenda !== undefined && precoVenda !== null && precoVenda > 0) {
      finalVenda = Number(precoVenda);
      finalLucroUnit = finalVenda - custo;
      finalMargem = finalVenda > 0 ? (finalLucroUnit / finalVenda) * 100 : 0;
    } else if (margemPercent !== undefined && margemPercent !== null) {
      const margemFrac = Number(margemPercent) / 100;
      if (margemFrac < 1) {
        // Preço = Custo / (1 - Margem)
        finalVenda = margemFrac < 0.999 ? custo / (1 - margemFrac) : custo * 2;
      } else {
        finalVenda = custo * (1 + margemFrac);
      }
      finalLucroUnit = finalVenda - custo;
      finalMargem = finalVenda > 0 ? (finalLucroUnit / finalVenda) * 100 : 0;
    }

    const lucroTotalLote = finalLucroUnit * quantidade;
    const faturamentoLote = finalVenda * quantidade;
    const custoTotalLote = custo * quantidade;
    const markup = custo > 0 ? finalVenda / custo : 0;

    // Regra da empresa: divisão do lucro em 3 partes
    const partilha = {
      custoFixoVariado: lucroTotalLote > 0 ? lucroTotalLote / 3 : 0,
      proLabore: lucroTotalLote > 0 ? lucroTotalLote / 3 : 0,
      investir: lucroTotalLote > 0 ? lucroTotalLote / 3 : 0
    };

    return {
      custoUnitario: custo,
      precoVendaUnitario: finalVenda,
      lucroUnitario: finalLucroUnit,
      margemPercent: finalMargem,
      markup: markup,
      quantidade: quantidade,
      custoTotalLote: custoTotalLote,
      faturamentoLote: faturamentoLote,
      lucroTotalLote: lucroTotalLote,
      partilha: partilha
    };
  }

  // ================= CALCULADORA PADRÃO =================
  handleStandardInput(char) {
    if (char === 'C') {
      this.standardExpression = '';
      this.standardResult = '0';
      this.hasEvaluated = false;
      return;
    }

    if (char === 'CE') {
      this.standardExpression = this.standardExpression.slice(0, -1);
      return;
    }

    if (char === '=') {
      try {
        if (!this.standardExpression) return;
        // Sanitiza caracteres permitidos
        const sanitized = this.standardExpression.replace(/×/g, '*').replace(/÷/g, '/');
        if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(sanitized)) {
          this.standardResult = 'Erro';
          return;
        }
        // eslint-disable-next-line no-new-func
        const res = Function(`'use strict'; return (${sanitized})`)();
        this.standardResult = Number.isFinite(res) ? String(Number(res.toFixed(6))) : 'Erro';
        this.hasEvaluated = true;
      } catch (e) {
        this.standardResult = 'Erro';
      }
      return;
    }

    if (char === '%') {
      try {
        const val = Number(this.standardResult || this.standardExpression);
        if (!isNaN(val)) {
          this.standardResult = String(val / 100);
          this.standardExpression = String(val / 100);
        }
      } catch (e) {}
      return;
    }

    if (char === '±') {
      if (this.standardExpression.startsWith('-')) {
        this.standardExpression = this.standardExpression.slice(1);
      } else if (this.standardExpression) {
        this.standardExpression = '-' + this.standardExpression;
      }
      return;
    }

    if (this.hasEvaluated && ['+', '-', '×', '÷'].includes(char)) {
      this.standardExpression = this.standardResult + char;
      this.hasEvaluated = false;
      return;
    }

    if (this.hasEvaluated && !['+', '-', '×', '÷'].includes(char)) {
      this.standardExpression = char;
      this.hasEvaluated = false;
      return;
    }

    this.standardExpression += char;
  }
}

window.businessCalculator = new BusinessCalculator();
