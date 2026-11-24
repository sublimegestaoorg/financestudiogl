import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAYMENT_METHODS,
  addPaymentMethod,
  addStaff,
  addStockItem,
  availableMonths,
  availableYears,
  buildShoppingListText,
  deletePaymentMethod,
  deleteStaff,
  deleteStockItem,
  deleteTransaction,
  filterStock,
  filterTransactions,
  getPaymentMethods,
  getServiceGoal,
  installmentDetails,
  monthly,
  nextStockCode,
  normalizeData,
  parseBatchTransactions,
  scopeDataByMonth,
  summary,
  toggleTransactionPaid,
  updatePaymentMethod,
  updateService,
  updateStaff,
  updateStockItem,
  updateTransaction,
  updateWithdrawal,
  type Data,
} from "@/lib/store";

const base: Data = {
  transactions: [],
  stock: [],
  services: [],
  withdrawals: [],
  staff: [],
  safeRate: 0.5,
  paymentMethods: [...DEFAULT_PAYMENT_METHODS],
};

describe("regras financeiras", () => {
  it("registra 6 meses restantes em uma conta a pagar sem multiplicar a despesa", () => {
    const transaction = { id: "parcelada", date: "2026-11-24", type: "Saída" as const, category: "Despesas Fixas", description: "Equipamento", amount: 200, payment: "PIX", status: "Pendente", ...installmentDetails(true, "6") };
    const data = normalizeData({ ...base, transactions: [transaction] });
    expect(data.transactions[0]?.installmentMonthsRemaining).toBe(6);
    expect(summary(data).expenses).toBe(200);
    expect(data.transactions).toHaveLength(1);
  });

  it("registra 3 meses restantes em uma conta a receber sem multiplicar a receita", () => {
    const transaction = { id: "receber", date: "2026-11-24", type: "Entrada" as const, category: "Serviços", description: "Pacote", amount: 150, payment: "PIX", status: "Pendente", ...installmentDetails(true, "3") };
    expect(transaction.installmentMonthsRemaining).toBe(3);
    expect(summary({ ...base, transactions: [transaction] }).revenue).toBe(150);
  });

  it("permite atualizar os meses restantes e remover o parcelamento", () => {
    const transaction = { id: "editar", date: "2026-11-24", type: "Saída" as const, category: "Despesas Fixas", description: "Conta", amount: 100, payment: "PIX", status: "Pendente", ...installmentDetails(true, "6") };
    const data = updateTransaction({ ...base, transactions: [transaction] }, transaction.id, { ...transaction, ...installmentDetails(true, "5") });
    expect(data.transactions[0]?.installmentMonthsRemaining).toBe(5);
    const { installmentMonthsRemaining: _remaining, ...ordinary } = transaction;
    expect(updateTransaction(data, transaction.id, { ...ordinary, ...installmentDetails(false, "5") }).transactions[0]).not.toHaveProperty("installmentMonthsRemaining");
  });

  it("exige meses restantes inteiros e positivos apenas para contas parceladas", () => {
    for (const value of ["", "0", "-1", "1.5", "abc"]) expect(() => installmentDetails(true, value)).toThrow();
    expect(installmentDetails(false, "")).toEqual({});
    expect(installmentDetails(true, "1")).toEqual({ installmentMonthsRemaining: 1 });
  });

  it("teto de pró-labore é 50% do lucro", () => {
    const s = summary({
      ...base,
      transactions: [
        { id: "1", date: "2026-11-01", type: "Entrada", category: "Serviços", description: "", amount: 1000, payment: "", status: "" },
        { id: "2", date: "2026-11-01", type: "Saída", category: "Marketing", description: "", amount: 400, payment: "", status: "" },
      ],
    });
    expect(s.profit).toBe(600);
    expect(s.ceiling).toBe(300);
  });

  it("líquido da funcionária = salário + comissão - adiantamento", () => {
    const s = summary({
      ...base,
      staff: [{ name: "A", role: "", salary: 1800, rate: 0.25, advance: 200 }],
      services: [{ date: "2026-11-01", staff: "A", client: "", service: "", amount: 400, rate: 0.25 }],
    });
    expect(s.team[0]?.net).toBe(1700);
  });

  it("item com estoque atual <= mínimo é crítico", () => {
    expect(summary({ ...base, stock: [{ code: "x", name: "", category: "", min: 5, qty: 5, cost: 1 }] }).critical).toBe(1);
  });
});

describe("CRUD de lançamentos, estoque, funcionários e formas de pagamento", () => {
  it("edita e exclui lançamento no fluxo de caixa", () => {
    const d0: Data = {
      ...base,
      transactions: [
        { id: "TR-001", date: "2026-11-01", type: "Entrada", category: "Serviços", description: "Corte", amount: 120, payment: "PIX", status: "Concluído" },
      ],
    };
    const d1 = updateTransaction(d0, "TR-001", {
      date: "2026-11-02",
      type: "Saída",
      category: "Marketing",
      description: "Anúncio atualizado",
      amount: 250,
      payment: "Cartão Crédito",
      status: "Pago",
    });
    expect(d1.transactions[0]).toEqual({
      id: "TR-001",
      date: "2026-11-02",
      type: "Saída",
      category: "Marketing",
      description: "Anúncio atualizado",
      amount: 250,
      payment: "Cartão Crédito",
      status: "Pago",
    });
    expect(deleteTransaction(d1, "TR-001").transactions).toHaveLength(0);
  });

  it("adiciona, edita e exclui itens do estoque com código automático", () => {
    const d1 = addStockItem(base, { name: "Shampoo 1L", category: "Tratamento Capilar", min: 3, qty: 5, cost: 110 });
    expect(d1.stock[0]?.code).toBe("EST-001");
    expect(nextStockCode(d1.stock)).toBe("EST-002");

    const d2 = updateStockItem(d1, "EST-001", {
      code: "EST-010",
      name: "Shampoo Nutritivo 1L",
      category: "Home Care",
      min: 4,
      qty: 2,
      cost: 130,
    });
    expect(d2.stock[0]).toEqual({
      code: "EST-010",
      name: "Shampoo Nutritivo 1L",
      category: "Home Care",
      min: 4,
      qty: 2,
      cost: 130,
    });
    expect(deleteStockItem(d2, "EST-010").stock).toHaveLength(0);
  });

  it("adiciona, edita (propagando nome para atendimentos) e exclui funcionário", () => {
    const d1 = addStaff(base, { name: "Ana Paula", role: "Esteticista", salary: 2000, rate: 0.2, advance: 100 });
    const dWithService: Data = {
      ...d1,
      services: [{ date: "2026-11-10", staff: "Ana Paula", client: "Maria", service: "Limpeza de pele", amount: 200, rate: 0.2 }],
    };
    const d2 = updateStaff(dWithService, "Ana Paula", {
      name: "Ana Paula Lima",
      role: "Esteticista Sênior",
      salary: 2200,
      rate: 0.25,
      advance: 50,
    });
    expect(d2.staff[0]?.name).toBe("Ana Paula Lima");
    expect(d2.services[0]?.staff).toBe("Ana Paula Lima");
    expect(summary(d2).team[0]?.billed).toBe(200);

    const d3 = deleteStaff(d2, "Ana Paula Lima");
    expect(d3.staff).toHaveLength(0);
    expect(d3.services).toHaveLength(1);
  });

  it("adiciona, renomeia (propagando para lançamentos e retiradas) e exclui formas de pagamento", () => {
    const d0: Data = {
      ...base,
      transactions: [
        { id: "TR-1", date: "2026-11-01", type: "Entrada", category: "Serviços", description: "Escova", amount: 100, payment: "Link de Pagamento", status: "Concluído" },
      ],
      withdrawals: [
        { id: "PL-1", date: "2026-11-02", description: "Retirada", amount: 300, payment: "Link de Pagamento" },
      ],
    };
    const d1 = addPaymentMethod(d0, "Link de Pagamento");
    expect(getPaymentMethods(d1)).toContain("Link de Pagamento");
    // evita duplicado case-insensitive
    expect(getPaymentMethods(addPaymentMethod(d1, "link de pagamento")).length).toBe(getPaymentMethods(d1).length);

    const d2 = updatePaymentMethod(d1, "Link de Pagamento", "Cartão Link 2x");
    expect(getPaymentMethods(d2)).toContain("Cartão Link 2x");
    expect(getPaymentMethods(d2)).not.toContain("Link de Pagamento");
    expect(d2.transactions[0]?.payment).toBe("Cartão Link 2x");
    expect(d2.withdrawals[0]?.payment).toBe("Cartão Link 2x");

    const d3 = deletePaymentMethod(d2, "Cartão Link 2x");
    expect(getPaymentMethods(d3)).not.toContain("Cartão Link 2x");
  });

  it("normaliza dados legados sem paymentMethods preservando formas já utilizadas", () => {
    const legacy = normalizeData({
      transactions: [
        { id: "1", date: "2026-11-01", type: "Entrada", category: "Serviços", description: "Teste", amount: 50, payment: "PicPay", status: "Concluído" },
      ],
      withdrawals: [],
      stock: [],
      services: [],
      staff: [],
      safeRate: 0.5,
    });
    expect(getPaymentMethods(legacy)).toContain("PIX");
    expect(getPaymentMethods(legacy)).toContain("PicPay");
  });

  it("pesquisa e filtra lançamentos por texto sem acento, tipo, categoria, pagamento e período", () => {
    const txs = [
      { id: "1", date: "2026-11-03", type: "Entrada" as const, category: "Serviços", description: "Escova Médio - Bárbara Veiga", amount: 60, payment: "PIX", status: "Concluído" },
      { id: "2", date: "2026-11-05", type: "Saída" as const, category: "Comissão", description: "Comissão Camila", amount: 250, payment: "Transferência", status: "Pago" },
      { id: "3", date: "2026-11-10", type: "Entrada" as const, category: "Venda Produtos", description: "Kit Home Care", amount: 180, payment: "Cartão Crédito", status: "Concluído" },
    ];
    expect(filterTransactions(txs, { query: "barbara" }).map((t) => t.id)).toEqual(["1"]);
    expect(filterTransactions(txs, { query: "comissao" }).map((t) => t.id)).toEqual(["2"]);
    expect(filterTransactions(txs, { type: "Entrada", payment: "PIX" }).map((t) => t.id)).toEqual(["1"]);
    expect(filterTransactions(txs, { category: "Venda Produtos" }).map((t) => t.id)).toEqual(["3"]);
    expect(filterTransactions(txs, { dateFrom: "2026-11-04", dateTo: "2026-11-09" }).map((t) => t.id)).toEqual(["2"]);
  });

  it("filtra por mês/ano e calcula realizado vs pendente", () => {
    const d: Data = {
      ...base,
      serviceGoal: 15000,
      transactions: [
        { id: "1", date: "2025-11-10", type: "Entrada", category: "Serviços", description: "Ano passado", amount: 500, payment: "PIX", status: "Concluído" },
        { id: "2", date: "2026-11-03", type: "Entrada", category: "Serviços", description: "Pago", amount: 300, payment: "PIX", status: "Concluído" },
        { id: "3", date: "2026-11-05", type: "Entrada", category: "Serviços", description: "A receber", amount: 120, payment: "PIX", status: "Pendente", installmentMonthsRemaining: 2 },
        { id: "4", date: "2026-11-06", type: "Saída", category: "Despesas Fixas", description: "A pagar", amount: 80, payment: "Boleto", status: "Pendente" },
        { id: "5", date: "2026-11-07", type: "Saída", category: "Marketing", description: "Cancelado", amount: 999, payment: "PIX", status: "Cancelado" },
      ],
    };
    expect(getServiceGoal(d)).toBe(15000);
    expect(availableMonths(d)).toEqual(["2026-11", "2025-11"]);
    expect(availableYears(d)).toEqual(["2026", "2025"]);

    const nov26 = scopeDataByMonth(d, "2026-11");
    const s = summary(nov26);
    expect(s.revenue).toBe(420);
    expect(s.realizedRevenue).toBe(300);
    expect(s.pendingIn).toBe(120);
    expect(s.expenses).toBe(80);
    expect(s.realizedExpenses).toBe(0);
    expect(s.pendingOut).toBe(80);
    expect(s.pendingCount).toBe(2);

    expect(monthly(d, "2026")[10]?.inc).toBe(420);
    expect(monthly(d, "2025")[10]?.inc).toBe(500);

    expect(filterTransactions(nov26.transactions, { status: "Pendente" })).toHaveLength(2);
    expect(filterTransactions(nov26.transactions, { onlyInstallments: true }).map((t) => t.id)).toEqual(["3"]);

    const toggled = toggleTransactionPaid(nov26, "4");
    expect(toggled.transactions.find((t) => t.id === "4")?.status).toBe("Pago");
  });

  it("edita atendimento, edita retirada, filtra estoque e gera lista de compras", () => {
    const d0: Data = {
      ...base,
      services: [{ date: "2026-11-03", staff: "Camila", client: "Ana", service: "Escova", amount: 80, rate: 0.25 }],
      withdrawals: [{ id: "PL-1", date: "2026-11-05", description: "Quinzenal", amount: 300, payment: "PIX" }],
      stock: [
        { code: "EST-001", name: "Coloração Wella", category: "Colorimetria", min: 5, qty: 2, cost: 40 },
        { code: "EST-002", name: "Gel Vòlia", category: "Nail Care", min: 4, qty: 10, cost: 60 },
      ],
    };
    const d1 = updateService(d0, 0, { date: "2026-11-04", staff: "Camila", client: "Ana", service: "Escova + Hidratação", amount: 140, rate: 0.3 });
    expect(d1.services[0]?.amount).toBe(140);
    expect(d1.services[0]?.rate).toBe(0.3);

    const d2 = updateWithdrawal(d1, "PL-1", { date: "2026-11-06", description: "Atualizada", amount: 450, payment: "Dinheiro" });
    expect(d2.withdrawals[0]?.amount).toBe(450);
    expect(d2.withdrawals[0]?.payment).toBe("Dinheiro");

    expect(filterStock(d2.stock, { query: "coloracao" }).map((i) => i.code)).toEqual(["EST-001"]);
    expect(filterStock(d2.stock, { onlyCritical: true }).map((i) => i.code)).toEqual(["EST-001"]);
    const shopping = buildShoppingListText(d2.stock);
    expect(shopping).toContain("Coloração Wella");
    expect(shopping).toContain("comprar 8 un.");
  });

  it("interpreta importação em lote de blocos e linhas separadas por ponto e vírgula", () => {
    const raw = `descriçao Atendimento: Escova Médio - Margareth Santos de Souza
Serviços
via PIX
+ R$ 60,00
-------
descriçao Atendimento: Tratamentos Wella - Daiane Farias
Serviços
via Cartão Crédito
+ R$ 150,00`;

    const parsed = parseBatchTransactions(raw, {
      date: "2026-11-03",
      type: "Entrada",
      category: "Serviços",
      payment: "PIX",
      status: "Concluído",
      categories: ["Serviços", "Venda Produtos", "Comissão"],
      paymentMethods: [...DEFAULT_PAYMENT_METHODS],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      date: "2026-11-03",
      type: "Entrada",
      category: "Serviços",
      description: "Atendimento: Escova Médio - Margareth Santos de Souza",
      amount: 60,
      payment: "PIX",
    });
    expect(parsed[1]).toMatchObject({
      amount: 150,
      payment: "Cartão Crédito",
    });

    const csvParsed = parseBatchTransactions("Compra luvas; -85,50; Dinheiro; 04/11/2026", {
      date: "2026-11-03",
      type: "Entrada",
      category: "Insumos/Produtos",
      payment: "PIX",
      status: "Concluído",
      categories: ["Serviços", "Insumos/Produtos"],
      paymentMethods: [...DEFAULT_PAYMENT_METHODS],
    });
    expect(csvParsed[0]).toMatchObject({
      date: "2026-11-04",
      type: "Saída",
      amount: 85.5,
      payment: "Dinheiro",
    });
  });
});
