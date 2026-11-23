import { useEffect, useState } from "react";
import seed from "@/data/seed.json";

export type Tx = { id: string; date: string; type: "Entrada" | "Saída"; category: string; description: string; amount: number; payment: string; status: string };
export type Item = { code: string; name: string; category: string; min: number; qty: number; cost: number };
export type Service = { date: string; staff: string; client: string; service: string; amount: number; rate: number };
export type Withdrawal = { id: string; date: string; description: string; amount: number; payment: string };
export type Staff = { name: string; role: string; salary: number; rate: number; advance: number };
export type Data = { transactions: Tx[]; stock: Item[]; services: Service[]; withdrawals: Withdrawal[]; staff: Staff[]; safeRate: number };

const initial: Data = {
  ...(seed as Omit<Data, "staff" | "safeRate">),
  staff: [
    { name: "Camila Silva", role: "Cabeleireira & Colorista", salary: 1800, rate: 0.25, advance: 200 },
    { name: "Larissa Santos", role: "Manicure & Nail Designer", salary: 1500, rate: 0.3, advance: 150 },
  ],
  safeRate: 0.5,
};

const KEY = "geisa-lorena-financas-v1";

export function useStore() {
  const [data, setData] = useState<Data>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) try { setData(JSON.parse(raw)); } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(data)); }, [data, ready]);
  return { data, setData, reset: () => setData(initial) };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fdate = (s: string) => s.split("-").reverse().join("/");

export function summary(d: Data) {
  const sum = (a: Tx[]) => a.reduce((s, t) => s + t.amount, 0);
  const inc = d.transactions.filter((t) => t.type === "Entrada");
  const out = d.transactions.filter((t) => t.type === "Saída");
  const revenue = sum(inc), expenses = sum(out), profit = revenue - expenses;
  const services = sum(inc.filter((t) => t.category === "Serviços"));
  const products = sum(inc.filter((t) => t.category === "Venda Produtos"));
  const supplies = sum(out.filter((t) => t.category === "Insumos/Produtos"));
  const stockValue = d.stock.reduce((s, i) => s + i.qty * i.cost, 0);
  const critical = d.stock.filter((i) => i.qty <= i.min).length;
  const team = d.staff.map((s) => {
    const done = d.services.filter((v) => v.staff === s.name);
    const billed = done.reduce((a, v) => a + v.amount, 0);
    const commission = done.reduce((a, v) => a + v.amount * v.rate, 0);
    return { ...s, billed, commission, net: s.salary + commission - s.advance };
  });
  const payroll = team.reduce((a, t) => a + t.net, 0);
  const withdrawn = d.withdrawals.reduce((a, w) => a + w.amount, 0);
  const ceiling = profit * d.safeRate;
  return { revenue, expenses, profit, margin: revenue > 0 ? profit / revenue : 0, services, products, supplies, other: expenses - supplies, stockValue, critical, team, payroll, withdrawn, ceiling, residual: profit - withdrawn };
}

export const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export function monthly(d: Data) {
  let acc = 0;
  return MONTHS.map((m, i) => {
    const tx = d.transactions.filter((t) => Number(t.date.slice(5, 7)) === i + 1);
    const inc = tx.filter((t) => t.type === "Entrada").reduce((a, t) => a + t.amount, 0);
    const out = tx.filter((t) => t.type === "Saída").reduce((a, t) => a + t.amount, 0);
    const pl = d.withdrawals.filter((w) => Number(w.date.slice(5, 7)) === i + 1).reduce((a, w) => a + w.amount, 0);
    const profit = inc - out - pl;
    acc += profit;
    return { month: m, inc, out, pl, profit, acc, margin: inc > 0 ? profit / inc : 0 };
  });
}
