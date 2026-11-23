import { describe, it, expect } from "vitest";
import { summary, type Data } from "@/lib/store";
const base: Data = { transactions: [], stock: [], services: [], withdrawals: [], staff: [], safeRate: 0.5 };
describe("regras financeiras", () => {
  it("teto de pró-labore é 50% do lucro", () => {
    const s = summary({ ...base, transactions: [
      { id: "1", date: "2026-11-01", type: "Entrada", category: "Serviços", description: "", amount: 1000, payment: "", status: "" },
      { id: "2", date: "2026-11-01", type: "Saída", category: "Marketing", description: "", amount: 400, payment: "", status: "" }] });
    expect(s.profit).toBe(600); expect(s.ceiling).toBe(300);
  });
  it("líquido da funcionária = salário + comissão - adiantamento", () => {
    const s = summary({ ...base, staff: [{ name: "A", role: "", salary: 1800, rate: 0.25, advance: 200 }],
      services: [{ date: "2026-11-01", staff: "A", client: "", service: "", amount: 400, rate: 0.25 }] });
    expect(s.team[0]?.net).toBe(1700);
  });
  it("item com estoque atual <= mínimo é crítico", () => {
    expect(summary({ ...base, stock: [{ code: "x", name: "", category: "", min: 5, qty: 5, cost: 1 }] }).critical).toBe(1);
  });
});
