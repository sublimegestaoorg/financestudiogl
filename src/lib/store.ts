import { useEffect, useState } from "react";
import seed from "@/data/seed.json";
import { supabase } from "@/integrations/supabase/client";

export type Tx = { id: string; date: string; type: "Entrada" | "Saída"; category: string; description: string; amount: number; payment: string; status: string };
export type Item = { code: string; name: string; category: string; min: number; qty: number; cost: number };
export type Service = { date: string; staff: string; client: string; service: string; amount: number; rate: number };
export type Withdrawal = { id: string; date: string; description: string; amount: number; payment: string };
export type Staff = { name: string; role: string; salary: number; rate: number; advance: number };
export type Data = {
  transactions: Tx[];
  stock: Item[];
  services: Service[];
  withdrawals: Withdrawal[];
  staff: Staff[];
  safeRate: number;
  paymentMethods?: string[];
};

export const DEFAULT_PAYMENT_METHODS = [
  "PIX",
  "Cartão Crédito",
  "Cartão Débito",
  "Dinheiro",
  "Boleto",
  "PIX Transferência",
];

const initial: Data = {
  ...(seed as Omit<Data, "staff" | "safeRate" | "paymentMethods">),
  staff: [
    { name: "Camila Silva", role: "Cabeleireira & Colorista", salary: 1800, rate: 0.25, advance: 200 },
    { name: "Larissa Santos", role: "Manicure & Nail Designer", salary: 1500, rate: 0.3, advance: 150 },
  ],
  safeRate: 0.5,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

export function getPaymentMethods(d: Data): string[] {
  return Array.isArray(d.paymentMethods) ? d.paymentMethods : DEFAULT_PAYMENT_METHODS;
}

export function normalizeData(raw: Partial<Data> | null | undefined): Data {
  const transactions = Array.isArray(raw?.transactions) ? raw.transactions : initial.transactions;
  const stock = Array.isArray(raw?.stock) ? raw.stock : initial.stock;
  const services = Array.isArray(raw?.services) ? raw.services : initial.services;
  const withdrawals = Array.isArray(raw?.withdrawals) ? raw.withdrawals : initial.withdrawals;
  const staff = Array.isArray(raw?.staff) ? raw.staff : initial.staff;
  const safeRate = typeof raw?.safeRate === "number" ? raw.safeRate : initial.safeRate;
  let paymentMethods: string[];
  if (Array.isArray(raw?.paymentMethods)) {
    paymentMethods = raw.paymentMethods.map((m) => m.trim()).filter(Boolean);
  } else {
    const seen = new Set(DEFAULT_PAYMENT_METHODS.map((m) => m.toLowerCase()));
    paymentMethods = [...DEFAULT_PAYMENT_METHODS];
    for (const p of [...transactions.map((t) => t.payment), ...withdrawals.map((w) => w.payment)]) {
      const trimmed = p?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        paymentMethods.push(trimmed);
      }
    }
  }
  return { transactions, stock, services, withdrawals, staff, safeRate, paymentMethods };
}

export function updateTransaction(d: Data, id: string, updated: Omit<Tx, "id">): Data {
  return {
    ...d,
    transactions: d.transactions.map((t) => (t.id === id ? { ...updated, id } : t)),
  };
}

export function deleteTransaction(d: Data, id: string): Data {
  return { ...d, transactions: d.transactions.filter((t) => t.id !== id) };
}

export type TxFilters = {
  query?: string | undefined;
  type?: "Todos" | Tx["type"] | undefined;
  category?: string | undefined;
  payment?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

const normalizeSearch = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function filterTransactions(transactions: Tx[], filters: TxFilters): Tx[] {
  const q = filters.query ? normalizeSearch(filters.query.trim()) : "";
  const type = filters.type && filters.type !== "Todos" ? filters.type : "";
  const category = filters.category && filters.category !== "Todas" ? filters.category : "";
  const payment = filters.payment && filters.payment !== "Todas" ? filters.payment : "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";

  return transactions
    .filter((t) => {
      if (type && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (payment && t.payment !== payment) return false;
      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;
      if (q) {
        const haystack = normalizeSearch(
          `${t.description} ${t.category} ${t.payment} ${t.status} ${t.date} ${fdate(t.date)} ${t.amount} ${brl(t.amount)}`,
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function nextStockCode(stock: Item[]): string {
  let max = stock.length;
  const existing = new Set(stock.map((i) => i.code.toUpperCase()));
  for (const item of stock) {
    const m = /^EST-(\d+)$/i.exec(item.code.trim());
    if (m?.[1]) max = Math.max(max, Number(m[1]));
  }
  let candidate = `EST-${String(max + 1).padStart(3, "0")}`;
  while (existing.has(candidate.toUpperCase())) {
    max += 1;
    candidate = `EST-${String(max + 1).padStart(3, "0")}`;
  }
  return candidate;
}

export function addStockItem(d: Data, item: Omit<Item, "code"> & { code?: string | undefined }): Data {
  const code = item.code?.trim() || nextStockCode(d.stock);
  const next: Item = {
    code,
    name: item.name.trim(),
    category: item.category.trim() || "Geral",
    min: Math.max(0, Number(item.min) || 0),
    qty: Math.max(0, Number(item.qty) || 0),
    cost: Math.max(0, Number(item.cost) || 0),
  };
  return { ...d, stock: [...d.stock, next] };
}

export function updateStockItem(d: Data, originalCode: string, updated: Item): Data {
  const next: Item = {
    code: updated.code.trim() || originalCode,
    name: updated.name.trim(),
    category: updated.category.trim() || "Geral",
    min: Math.max(0, Number(updated.min) || 0),
    qty: Math.max(0, Number(updated.qty) || 0),
    cost: Math.max(0, Number(updated.cost) || 0),
  };
  return {
    ...d,
    stock: d.stock.map((i) => (i.code === originalCode ? next : i)),
  };
}

export function deleteStockItem(d: Data, code: string): Data {
  return { ...d, stock: d.stock.filter((i) => i.code !== code) };
}

export function addStaff(d: Data, member: Staff): Data {
  const next: Staff = {
    name: member.name.trim(),
    role: member.role.trim(),
    salary: Math.max(0, Number(member.salary) || 0),
    rate: Math.min(1, Math.max(0, Number(member.rate) || 0)),
    advance: Math.max(0, Number(member.advance) || 0),
  };
  return { ...d, staff: [...d.staff, next] };
}

export function updateStaff(d: Data, originalName: string, updated: Staff): Data {
  const nextName = updated.name.trim();
  const next: Staff = {
    name: nextName,
    role: updated.role.trim(),
    salary: Math.max(0, Number(updated.salary) || 0),
    rate: Math.min(1, Math.max(0, Number(updated.rate) || 0)),
    advance: Math.max(0, Number(updated.advance) || 0),
  };
  return {
    ...d,
    staff: d.staff.map((s) => (s.name === originalName ? next : s)),
    services:
      nextName !== originalName
        ? d.services.map((v) => (v.staff === originalName ? { ...v, staff: nextName } : v))
        : d.services,
  };
}

export function deleteStaff(d: Data, name: string): Data {
  return { ...d, staff: d.staff.filter((s) => s.name !== name) };
}

export function addPaymentMethod(d: Data, name: string): Data {
  const trimmed = name.trim();
  if (!trimmed) return d;
  const current = getPaymentMethods(d);
  if (current.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return d;
  return { ...d, paymentMethods: [...current, trimmed] };
}

export function updatePaymentMethod(d: Data, originalName: string, newName: string): Data {
  const trimmed = newName.trim();
  if (!trimmed) return d;
  const current = getPaymentMethods(d);
  if (current.some((m) => m !== originalName && m.toLowerCase() === trimmed.toLowerCase())) return d;
  return {
    ...d,
    paymentMethods: current.map((m) => (m === originalName ? trimmed : m)),
    transactions:
      trimmed !== originalName
        ? d.transactions.map((t) => (t.payment === originalName ? { ...t, payment: trimmed } : t))
        : d.transactions,
    withdrawals:
      trimmed !== originalName
        ? d.withdrawals.map((w) => (w.payment === originalName ? { ...w, payment: trimmed } : w))
        : d.withdrawals,
  };
}

export function deletePaymentMethod(d: Data, name: string): Data {
  return { ...d, paymentMethods: getPaymentMethods(d).filter((m) => m !== name) };
}

const KEY = "geisa-lorena-financas-v1";

export function useStore(userId: string) {
  const [data, setData] = useState<Data>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: row } = await supabase.from("studio_data").select("data").eq("user_id", userId).maybeSingle();
      if (!alive) return;
      if (row?.data) setData(normalizeData(row.data as unknown as Partial<Data>));
      else {
        // first login: bring over anything saved on this device
        let start = initial;
        const raw = localStorage.getItem(KEY);
        if (raw) try { start = normalizeData(JSON.parse(raw)); } catch { /* ignore */ }
        setData(start);
        await supabase.from("studio_data").insert({ user_id: userId, data: start as never });
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, [userId]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      supabase.from("studio_data").upsert({ user_id: userId, data: data as never, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) console.error(error); });
    }, 600);
    return () => clearTimeout(t);
  }, [data, ready, userId]);
  return { data, setData, ready, reset: () => setData(initial) };
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
