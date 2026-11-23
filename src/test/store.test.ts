import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAYMENT_METHODS,
  addPaymentMethod,
  addStaff,
  addStockItem,
  deletePaymentMethod,
  deleteStaff,
  deleteStockItem,
  deleteTransaction,
  getPaymentMethods,
  nextStockCode,
  normalizeData,
  summary,
  updatePaymentMethod,
  updateStaff,
  updateStockItem,
  updateTransaction,
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
});
