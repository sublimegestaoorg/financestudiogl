import { useCallback, useEffect, useRef, useState } from "react";
import seed from "@/data/seed.json";
import { supabase } from "@/integrations/supabase/client";

export type Tx = { id: string; date: string; type: "Entrada" | "Saída"; category: string; description: string; amount: number; payment: string; status: string; installmentMonthsRemaining?: number };
export type Item = { code: string; name: string; category: string; min: number; qty: number; cost: number };
export type Service = { date: string; staff: string; client: string; service: string; amount: number; rate: number };
export type Withdrawal = { id: string; date: string; description: string; amount: number; payment: string };
export type Staff = { name: string; role: string; salary: number; rate: number; advance: number };
export type PayoutKind = "Comissão" | "Salário" | "Comissão + Salário" | "Adiantamento";
export type PayoutPeriodType = "Semana" | "Mês";
export type StaffPayout = {
  id: string;
  date: string;
  staff: string;
  kind: PayoutKind;
  periodType: PayoutPeriodType;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  amount: number;
  payment: string;
  notes?: string;
};
export type Data = {
  transactions: Tx[];
  stock: Item[];
  services: Service[];
  withdrawals: Withdrawal[];
  staff: Staff[];
  payouts?: StaffPayout[];
  safeRate: number;
  serviceGoal?: number;
  paymentMethods?: string[];
};

export const DEFAULT_SERVICE_GOAL = 12000;

export const DEFAULT_PAYMENT_METHODS = [
  "PIX",
  "Cartão Crédito",
  "Cartão Débito",
  "Dinheiro",
  "Boleto",
  "PIX Transferência",
];

const initial: Data = {
  ...(seed as Omit<Data, "staff" | "payouts" | "safeRate" | "serviceGoal" | "paymentMethods">),
  staff: [
    { name: "Camila Silva", role: "Cabeleireira & Colorista", salary: 1800, rate: 0.25, advance: 200 },
    { name: "Larissa Santos", role: "Manicure & Nail Designer", salary: 1500, rate: 0.3, advance: 150 },
  ],
  payouts: [],
  safeRate: 0.5,
  serviceGoal: DEFAULT_SERVICE_GOAL,
  paymentMethods: DEFAULT_PAYMENT_METHODS,
};

export function getPaymentMethods(d: Data): string[] {
  return Array.isArray(d.paymentMethods) ? d.paymentMethods : DEFAULT_PAYMENT_METHODS;
}

export function getStaffPayouts(d: Data): StaffPayout[] {
  return Array.isArray(d.payouts) ? d.payouts : [];
}

export function getServiceGoal(d: Data): number {
  return typeof d.serviceGoal === "number" && d.serviceGoal > 0 ? d.serviceGoal : DEFAULT_SERVICE_GOAL;
}

export function normalizeData(raw: Partial<Data> | null | undefined): Data {
  const transactions = Array.isArray(raw?.transactions) ? raw.transactions : initial.transactions;
  const stock = Array.isArray(raw?.stock) ? raw.stock : initial.stock;
  const services = Array.isArray(raw?.services) ? raw.services : initial.services;
  const withdrawals = Array.isArray(raw?.withdrawals) ? raw.withdrawals : initial.withdrawals;
  const staff = Array.isArray(raw?.staff) ? raw.staff : initial.staff;
  const payouts = Array.isArray(raw?.payouts) ? raw.payouts : [];
  const safeRate = typeof raw?.safeRate === "number" ? raw.safeRate : initial.safeRate;
  const serviceGoal =
    typeof raw?.serviceGoal === "number" && raw.serviceGoal > 0 ? raw.serviceGoal : DEFAULT_SERVICE_GOAL;
  let paymentMethods: string[];
  if (Array.isArray(raw?.paymentMethods)) {
    paymentMethods = raw.paymentMethods.map((m) => m.trim()).filter(Boolean);
  } else {
    const seen = new Set(DEFAULT_PAYMENT_METHODS.map((m) => m.toLowerCase()));
    paymentMethods = [...DEFAULT_PAYMENT_METHODS];
    for (const p of [
      ...transactions.map((t) => t.payment),
      ...withdrawals.map((w) => w.payment),
      ...payouts.map((po) => po.payment),
    ]) {
      const trimmed = p?.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        paymentMethods.push(trimmed);
      }
    }
  }
  return { transactions, stock, services, withdrawals, staff, payouts, safeRate, serviceGoal, paymentMethods };
}

export function installmentDetails(parcelled: boolean, months: string): Pick<Tx, "installmentMonthsRemaining"> {
  if (!parcelled) return {};
  const remaining = Number(months);
  if (!Number.isSafeInteger(remaining) || remaining < 1) {
    throw new Error("Informe uma quantidade inteira de meses restantes, maior que zero.");
  }
  return { installmentMonthsRemaining: remaining };
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

export function toggleTransactionPaid(d: Data, id: string): Data {
  return {
    ...d,
    transactions: d.transactions.map((t) => {
      if (t.id !== id) return t;
      const nextStatus =
        t.status === "Pendente" ? (t.type === "Saída" ? "Pago" : "Concluído") : "Pendente";
      return { ...t, status: nextStatus };
    }),
  };
}

export function updateService(d: Data, index: number, updated: Service): Data {
  return {
    ...d,
    services: d.services.map((v, i) => (i === index ? updated : v)),
  };
}

export function updateWithdrawal(d: Data, id: string, updated: Omit<Withdrawal, "id">): Data {
  return {
    ...d,
    withdrawals: d.withdrawals.map((w) => (w.id === id ? { ...updated, id } : w)),
  };
}

export type TxFilters = {
  query?: string | undefined;
  type?: "Todos" | Tx["type"] | undefined;
  category?: string | undefined;
  payment?: string | undefined;
  status?: string | undefined;
  onlyInstallments?: boolean | undefined;
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
  const status = filters.status && filters.status !== "Todos" ? filters.status : "";
  const onlyInstallments = Boolean(filters.onlyInstallments);
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";

  return transactions
    .filter((t) => {
      if (type && t.type !== type) return false;
      if (category && t.category !== category) return false;
      if (payment && t.payment !== payment) return false;
      if (status && t.status !== status) return false;
      if (onlyInstallments && !t.installmentMonthsRemaining) return false;
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

export type StockFilters = {
  query?: string | undefined;
  category?: string | undefined;
  onlyCritical?: boolean | undefined;
};

export function filterStock(stock: Item[], filters: StockFilters): Item[] {
  const q = filters.query ? normalizeSearch(filters.query.trim()) : "";
  const category = filters.category && filters.category !== "Todas" ? filters.category : "";
  const onlyCritical = Boolean(filters.onlyCritical);

  return stock.filter((i) => {
    if (category && i.category !== category) return false;
    if (onlyCritical && i.qty > i.min) return false;
    if (q) {
      const haystack = normalizeSearch(`${i.code} ${i.name} ${i.category}`);
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function buildShoppingListText(stock: Item[]): string {
  const critical = stock.filter((i) => i.qty <= i.min);
  if (critical.length === 0) return "";
  let total = 0;
  const lines = critical.map((i) => {
    const buy = Math.max(1, i.min * 2 - i.qty);
    const est = buy * i.cost;
    total += est;
    return `- ${i.name} (${i.code}): comprar ${buy} un. [atual: ${i.qty} / mín: ${i.min}] — est. ${brl(est)}`;
  });
  return `Lista de Compras — Estúdio Geisa Lorena\n${lines.join("\n")}\n\nTotal estimado: ${brl(total)}`;
}

export type BatchImportDefaults = {
  date: string;
  type: Tx["type"];
  category: string;
  payment: string;
  status: string;
  categories: string[];
  paymentMethods: string[];
};

export type ParsedBatchTx = Omit<Tx, "id">;

function parseBrAmount(raw: string): { amount: number; sign: "+" | "-" | null } | null {
  const m = /([+-])?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i.exec(raw);
  if (!m?.[2]) return null;
  const numStr = m[2].includes(",") ? m[2].replace(/\./g, "").replace(",", ".") : m[2];
  const amount = Number(numStr);
  if (!(amount > 0)) return null;
  const sign = m[1] === "+" || m[1] === "-" ? m[1] : null;
  return { amount, sign };
}

function parseDateFromText(raw: string): string | null {
  const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(raw);
  if (iso?.[1]) return iso[1];
  const br = /\b(\d{2})\/(\d{2})\/(\d{4})\b/.exec(raw);
  if (br?.[1] && br[2] && br[3]) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

export function parseBatchTransactions(text: string, defaults: BatchImportDefaults): ParsedBatchTx[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const hasBlockSeparators = /\n\s*-{3,}\s*\n|\n\s*\n/.test(trimmed);
  const rawBlocks = hasBlockSeparators
    ? trimmed
        .split(/\n\s*-{3,}\s*\n|\n\s*\n/)
        .map((b) => b.trim())
        .filter(Boolean)
    : trimmed
        .split(/\n/)
        .map((b) => b.trim())
        .filter(Boolean);

  const normalizedCategories = defaults.categories.map((c) => ({ raw: c, norm: normalizeSearch(c) }));
  const normalizedPayments = [...defaults.paymentMethods]
    .sort((a, b) => b.length - a.length)
    .map((p) => ({ raw: p, norm: normalizeSearch(p) }));

  const results: ParsedBatchTx[] = [];

  for (const block of rawBlocks) {
    const lines = block
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^-{3,}$/.test(l));
    if (lines.length === 0) continue;

    let date = defaults.date;
    let type: Tx["type"] = defaults.type;
    let category = defaults.category;
    let payment = defaults.payment;
    let amount = 0;
    const descParts: string[] = [];

    const firstLine = lines[0];
    if (lines.length === 1 && firstLine?.includes(";")) {
      const parts = firstLine.split(";").map((p) => p.trim());
      if (parts[0]) descParts.push(parts[0]);
      for (const p of parts.slice(1)) {
        const d = parseDateFromText(p);
        if (d) {
          date = d;
          continue;
        }
        const parsedVal = parseBrAmount(p);
        if (parsedVal && amount === 0) {
          amount = parsedVal.amount;
          if (parsedVal.sign === "+") type = "Entrada";
          if (parsedVal.sign === "-") type = "Saída";
          continue;
        }
        const normP = normalizeSearch(p);
        const matchedPay = normalizedPayments.find((m) => m.norm === normP || normP.includes(m.norm));
        if (matchedPay) {
          payment = matchedPay.raw;
          continue;
        }
        const matchedCat = normalizedCategories.find((c) => c.norm === normP);
        if (matchedCat) {
          category = matchedCat.raw;
          continue;
        }
      }
    } else {
      for (const line of lines) {
        const normLine = normalizeSearch(line);

        const dateFound = parseDateFromText(line);
        if (dateFound && line.replace(/\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}/, "").trim().length <= 6) {
          date = dateFound;
          continue;
        }

        if (/^descri[cç][aã]o\b/i.test(line)) {
          const cleaned = line.replace(/^descri[cç][aã]o\s*:?\s*/i, "").trim();
          if (cleaned) descParts.push(cleaned);
          continue;
        }

        if (/^via\s+/i.test(line)) {
          const payText = line.replace(/^via\s+/i, "").trim();
          const normPay = normalizeSearch(payText);
          const matchedPay = normalizedPayments.find((m) => m.norm === normPay || normPay.includes(m.norm));
          payment = matchedPay ? matchedPay.raw : payText;
          continue;
        }

        const exactCategory = normalizedCategories.find((c) => c.norm === normLine);
        if (exactCategory) {
          category = exactCategory.raw;
          continue;
        }

        const exactPayment = normalizedPayments.find((m) => m.norm === normLine);
        if (exactPayment) {
          payment = exactPayment.raw;
          continue;
        }

        if (/^[+-]?\s*R\$/.test(line) || /^[+-]\s*\d/.test(line)) {
          const parsedVal = parseBrAmount(line);
          if (parsedVal) {
            amount = parsedVal.amount;
            if (parsedVal.sign === "+") type = "Entrada";
            if (parsedVal.sign === "-") type = "Saída";
            continue;
          }
        }

        // Fallback: single line with trailing value like "Escova - Ana R$ 80,00" or "Escova Maria - 80,00"
        const inlineAmount =
          /([+-]?\s*R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]?\s*R\$\s*\d+(?:[.,]\d{1,2})?|(?:[-–—:]\s*|[+-]\s*|\s+)([+-]?\d{1,3}(?:\.\d{3})*,\d{2}))\s*$/i.exec(
            line,
          );
        if (inlineAmount?.[1] && amount === 0) {
          const valText = inlineAmount[2] ?? inlineAmount[1];
          const parsedVal = parseBrAmount(valText);
          if (parsedVal) {
            amount = parsedVal.amount;
            if (parsedVal.sign === "+") type = "Entrada";
            if (parsedVal.sign === "-") type = "Saída";
            const rest = line.slice(0, inlineAmount.index).replace(/[-–—:]\s*$/, "").trim();
            if (rest) descParts.push(rest);
            continue;
          }
        }

        descParts.push(line);
      }
    }

    const description = descParts.join(" — ").trim();
    if (description && amount > 0) {
      results.push({
        date,
        type,
        category,
        description,
        amount,
        payment,
        status: defaults.status === "Pendente" ? "Pendente" : type === "Saída" ? "Pago" : "Concluído",
      });
    }
  }

  return results;
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

export function recordStockPurchase(
  d: Data,
  params: {
    code: string;
    qty: number;
    unitCost: number;
    date: string;
    payment: string;
    syncCash: boolean;
  },
): Data {
  const target = d.stock.find((i) => i.code === params.code);
  if (!target) return d;
  const qty = Math.max(1, Math.floor(params.qty));
  const unitCost = Math.max(0, Number(params.unitCost) || 0);
  const nextStock = d.stock.map((i) =>
    i.code === params.code ? { ...i, qty: i.qty + qty, cost: unitCost } : i,
  );
  if (!params.syncCash || !(qty * unitCost > 0)) {
    return { ...d, stock: nextStock };
  }
  const total = Number((qty * unitCost).toFixed(2));
  return {
    ...d,
    stock: nextStock,
    transactions: [
      ...d.transactions,
      {
        id: `TR-${String(d.transactions.length + 1).padStart(3, "0")}-${Date.now() % 1000}`,
        date: params.date,
        type: "Saída",
        category: "Insumos/Produtos",
        description: `Compra estoque: ${target.name} (${qty} un.)`,
        amount: total,
        payment: params.payment,
        status: "Pago",
      },
    ],
  };
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
    payouts:
      nextName !== originalName
        ? getStaffPayouts(d).map((p) => (p.staff === originalName ? { ...p, staff: nextName } : p))
        : getStaffPayouts(d),
  };
}

export function deleteStaff(d: Data, name: string): Data {
  return { ...d, staff: d.staff.filter((s) => s.name !== name) };
}

export function addStaffPayout(
  d: Data,
  payout: Omit<StaffPayout, "id">,
  syncCash = false,
): Data {
  const id = `PG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const entry: StaffPayout = {
    id,
    date: payout.date,
    staff: payout.staff.trim(),
    kind: payout.kind,
    periodType: payout.periodType,
    periodLabel: payout.periodLabel.trim(),
    amount: Math.max(0, Number(payout.amount) || 0),
    payment: payout.payment.trim(),
    ...(payout.periodStart ? { periodStart: payout.periodStart } : {}),
    ...(payout.periodEnd ? { periodEnd: payout.periodEnd } : {}),
    ...(payout.notes?.trim() ? { notes: payout.notes.trim() } : {}),
  };
  const nextPayouts = [...getStaffPayouts(d), entry];
  if (!syncCash || !(entry.amount > 0)) {
    return { ...d, payouts: nextPayouts };
  }
  const category = entry.kind === "Salário" ? "Despesas Fixas" : "Comissão";
  const desc = `${entry.kind} - ${entry.staff} (${entry.periodLabel})`;
  return {
    ...d,
    payouts: nextPayouts,
    transactions: [
      ...d.transactions,
      {
        id: `TR-${String(d.transactions.length + 1).padStart(3, "0")}-${Date.now() % 1000}`,
        date: entry.date,
        type: "Saída",
        category,
        description: desc,
        amount: entry.amount,
        payment: entry.payment,
        status: "Pago",
      },
    ],
  };
}

export function updateStaffPayout(d: Data, id: string, updated: Omit<StaffPayout, "id">): Data {
  const entry: StaffPayout = {
    id,
    date: updated.date,
    staff: updated.staff.trim(),
    kind: updated.kind,
    periodType: updated.periodType,
    periodLabel: updated.periodLabel.trim(),
    amount: Math.max(0, Number(updated.amount) || 0),
    payment: updated.payment.trim(),
    ...(updated.periodStart ? { periodStart: updated.periodStart } : {}),
    ...(updated.periodEnd ? { periodEnd: updated.periodEnd } : {}),
    ...(updated.notes?.trim() ? { notes: updated.notes.trim() } : {}),
  };
  return {
    ...d,
    payouts: getStaffPayouts(d).map((p) => (p.id === id ? entry : p)),
  };
}

export function deleteStaffPayout(d: Data, id: string): Data {
  return {
    ...d,
    payouts: getStaffPayouts(d).filter((p) => p.id !== id),
  };
}

export function getWeekBounds(dateStr: string): { start: string; end: string; label: string } {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = (parts[1] ?? 1) - 1;
  const day = parts[2] ?? 1;
  const dt = new Date(year, month, day);
  const dow = dt.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(year, month, day + diffToMon);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  const fmtIso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const fmtBrShort = (x: Date) =>
    `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
  const start = fmtIso(monday);
  const end = fmtIso(sunday);
  const label = `${fmtBrShort(monday)} a ${fmtBrShort(sunday)}/${sunday.getFullYear()}`;
  return { start, end, label };
}

export type ServiceFilters = {
  query?: string | undefined;
  staff?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

export function filterIndexedServices(
  services: Service[],
  filters: ServiceFilters,
): { service: Service; index: number }[] {
  const q = filters.query ? normalizeSearch(filters.query.trim()) : "";
  const staff = filters.staff && filters.staff !== "Todos" ? filters.staff : "";
  const dateFrom = filters.dateFrom?.trim() ?? "";
  const dateTo = filters.dateTo?.trim() ?? "";

  return services
    .map((service, index) => ({ service, index }))
    .filter(({ service: s }) => {
      if (staff && s.staff !== staff) return false;
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      if (q) {
        const haystack = normalizeSearch(
          `${s.staff} ${s.client} ${s.service} ${s.date} ${fdate(s.date)} ${s.amount} ${brl(s.amount)}`,
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.service.date.localeCompare(a.service.date));
}

export type WeeklyCommissionRow = {
  key: string;
  weekStart: string;
  weekEnd: string;
  label: string;
  staff: string;
  count: number;
  billed: number;
  commission: number;
  paid: number;
  remaining: number;
  status: "Pago" | "Parcial" | "Pendente";
};

export function weeklyCommissionBreakdown(
  services: Service[],
  payouts: StaffPayout[],
  staffFilter?: string | undefined,
): WeeklyCommissionRow[] {
  const filteredServices =
    staffFilter && staffFilter !== "Todos"
      ? services.filter((s) => s.staff === staffFilter)
      : services;

  const map = new Map<
    string,
    { weekStart: string; weekEnd: string; label: string; staff: string; count: number; billed: number; commission: number }
  >();

  for (const s of filteredServices) {
    const wb = getWeekBounds(s.date);
    const key = `${wb.start}__${s.staff}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.billed += s.amount;
      existing.commission += s.amount * s.rate;
    } else {
      map.set(key, {
        weekStart: wb.start,
        weekEnd: wb.end,
        label: wb.label,
        staff: s.staff,
        count: 1,
        billed: s.amount,
        commission: s.amount * s.rate,
      });
    }
  }

  const rows: WeeklyCommissionRow[] = [];
  for (const [key, entry] of map.entries()) {
    const paid = payouts
      .filter((p) => {
        if (p.staff !== entry.staff) return false;
        if (p.kind !== "Comissão" && p.kind !== "Comissão + Salário") return false;
        if (p.periodType !== "Semana") return false;
        if (p.periodStart) return p.periodStart === entry.weekStart;
        if (p.periodLabel === entry.label) return true;
        return p.date >= entry.weekStart && p.date <= entry.weekEnd;
      })
      .reduce((acc, p) => acc + p.amount, 0);
    const remaining = Math.max(0, Number((entry.commission - paid).toFixed(2)));
    const status: WeeklyCommissionRow["status"] =
      paid >= entry.commission - 0.01 && entry.commission > 0
        ? "Pago"
        : paid > 0
          ? "Parcial"
          : "Pendente";
    rows.push({
      key,
      ...entry,
      paid,
      remaining,
      status,
    });
  }

  return rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.staff.localeCompare(b.staff));
}

export function payoutsInPeriod(payouts: StaffPayout[], yearMonth: string): StaffPayout[] {
  if (!yearMonth || yearMonth === "all") return payouts;
  return payouts.filter((p) => {
    if (p.periodStart && p.periodStart.startsWith(yearMonth)) return true;
    if (p.periodEnd && p.periodEnd.startsWith(yearMonth)) return true;
    return p.date.startsWith(yearMonth);
  });
}

export function staffTransferTotals(staffName: string, net: number, payouts: StaffPayout[]) {
  const mine = payouts.filter((p) => p.staff === staffName);
  const paidCommission = mine
    .filter((p) => p.kind === "Comissão")
    .reduce((a, p) => a + p.amount, 0);
  const paidSalary = mine
    .filter((p) => p.kind === "Salário")
    .reduce((a, p) => a + p.amount, 0);
  const paidTotal = mine.reduce((a, p) => a + p.amount, 0);
  const remaining = Math.max(0, Number((net - paidTotal).toFixed(2)));
  return { paidCommission, paidSalary, paidTotal, remaining, count: mine.length };
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
    payouts:
      trimmed !== originalName
        ? getStaffPayouts(d).map((p) => (p.payment === originalName ? { ...p, payment: trimmed } : p))
        : getStaffPayouts(d),
  };
}

export function deletePaymentMethod(d: Data, name: string): Data {
  return { ...d, paymentMethods: getPaymentMethods(d).filter((m) => m !== name) };
}

const KEY = "geisa-lorena-financas-v1";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useStore(userId: string) {
  const [data, setDataState] = useState<Data>(initial);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [reloadTick, setReloadTick] = useState(0);
  const dirtyRef = useRef(false);
  const latestDataRef = useRef<Data>(initial);
  latestDataRef.current = data;

  const setData = useCallback((updater: Data | ((prev: Data) => Data)) => {
    dirtyRef.current = true;
    setSaveStatus("saving");
    setDataState(updater);
  }, []);

  const persistToCloud = useCallback(
    async (snapshot: Data) => {
      setSaveStatus("saving");
      try {
        localStorage.setItem(`${KEY}:${userId}`, JSON.stringify(snapshot));
      } catch {
        /* ignore storage quota errors */
      }
      const { error } = await supabase
        .from("studio_data")
        .upsert({ user_id: userId, data: snapshot as never, updated_at: new Date().toISOString() });
      if (error) {
        console.error(error);
        setSaveStatus("error");
        return false;
      }
      dirtyRef.current = false;
      setSaveStatus("saved");
      return true;
    },
    [userId],
  );

  useEffect(() => {
    let alive = true;
    setLoadError(null);
    setReady(false);
    (async () => {
      const { data: row, error } = await supabase
        .from("studio_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        console.error(error);
        setLoadError("Não foi possível carregar seus dados da nuvem. Verifique sua conexão e tente novamente.");
        return;
      }
      if (row?.data) {
        const normalized = normalizeData(row.data as unknown as Partial<Data>);
        dirtyRef.current = false;
        setDataState(normalized);
        setSaveStatus("saved");
      } else {
        // first login: bring over anything saved on this device
        let start = initial;
        const raw = localStorage.getItem(`${KEY}:${userId}`) ?? localStorage.getItem(KEY);
        if (raw) {
          try {
            start = normalizeData(JSON.parse(raw));
          } catch {
            /* ignore */
          }
        }
        dirtyRef.current = false;
        setDataState(start);
        const { error: insertError } = await supabase
          .from("studio_data")
          .insert({ user_id: userId, data: start as never });
        if (!alive) return;
        if (insertError) {
          console.error(insertError);
          setSaveStatus("error");
        } else {
          setSaveStatus("saved");
        }
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [userId, reloadTick]);

  useEffect(() => {
    if (!ready || !dirtyRef.current) return;
    const t = setTimeout(() => {
      void persistToCloud(data);
    }, 600);
    return () => clearTimeout(t);
  }, [data, ready, persistToCloud]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current || saveStatus === "saving" || saveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  return {
    data,
    setData,
    ready,
    loadError,
    saveStatus,
    retryLoad: () => setReloadTick((n) => n + 1),
    retrySave: () => void persistToCloud(latestDataRef.current),
    reset: () => setData(initial),
  };
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
export const fdate = (s: string) => s.split("-").reverse().join("/");

export function availableMonths(d: Data): string[] {
  const set = new Set<string>();
  for (const date of [
    ...d.transactions.map((t) => t.date),
    ...d.services.map((s) => s.date),
    ...d.withdrawals.map((w) => w.date),
    ...getStaffPayouts(d).map((p) => p.periodStart ?? p.date),
  ]) {
    if (/^\d{4}-\d{2}/.test(date)) set.add(date.slice(0, 7));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function availableYears(d: Data): string[] {
  const set = new Set<string>();
  for (const ym of availableMonths(d)) set.add(ym.slice(0, 4));
  if (set.size === 0) set.add(todayLocal().slice(0, 4));
  return [...set].sort((a, b) => b.localeCompare(a));
}

export function formatYearMonth(ym: string): string {
  const year = ym.slice(0, 4);
  const monthIndex = Number(ym.slice(5, 7)) - 1;
  const monthName = MONTHS[monthIndex];
  return monthName ? `${monthName}/${year}` : ym;
}

export function scopeDataByMonth(d: Data, yearMonth: string): Data {
  if (!yearMonth || yearMonth === "all") return d;
  return {
    ...d,
    transactions: d.transactions.filter((t) => t.date.startsWith(yearMonth)),
    services: d.services.filter((s) => s.date.startsWith(yearMonth)),
    withdrawals: d.withdrawals.filter((w) => w.date.startsWith(yearMonth)),
    payouts: payoutsInPeriod(getStaffPayouts(d), yearMonth),
  };
}

export function summary(d: Data) {
  const sum = (a: Tx[]) => a.reduce((s, t) => s + t.amount, 0);
  const active = d.transactions.filter((t) => t.status !== "Cancelado");
  const inc = active.filter((t) => t.type === "Entrada");
  const out = active.filter((t) => t.type === "Saída");
  const realizedInc = inc.filter((t) => t.status !== "Pendente");
  const realizedOut = out.filter((t) => t.status !== "Pendente");
  const pendingInc = inc.filter((t) => t.status === "Pendente");
  const pendingOutList = out.filter((t) => t.status === "Pendente");
  const revenue = sum(inc), expenses = sum(out), profit = revenue - expenses;
  const realizedRevenue = sum(realizedInc), realizedExpenses = sum(realizedOut), realizedProfit = realizedRevenue - realizedExpenses;
  const pendingIn = sum(pendingInc), pendingOut = sum(pendingOutList), pendingCount = pendingInc.length + pendingOutList.length;
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
  const ceiling = Math.max(0, profit * d.safeRate);
  return {
    revenue,
    expenses,
    profit,
    realizedRevenue,
    realizedExpenses,
    realizedProfit,
    pendingIn,
    pendingOut,
    pendingCount,
    margin: revenue > 0 ? profit / revenue : 0,
    services,
    products,
    supplies,
    other: expenses - supplies,
    stockValue,
    critical,
    team,
    payroll,
    withdrawn,
    ceiling,
    residual: profit - withdrawn,
  };
}

export const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
export function monthly(d: Data, year?: string | undefined) {
  let acc = 0;
  const activeTx = d.transactions.filter(
    (t) => t.status !== "Cancelado" && (!year || year === "all" || t.date.startsWith(year)),
  );
  const activeWd = d.withdrawals.filter((w) => !year || year === "all" || w.date.startsWith(year));
  return MONTHS.map((m, i) => {
    const tx = activeTx.filter((t) => Number(t.date.slice(5, 7)) === i + 1);
    const inc = tx.filter((t) => t.type === "Entrada").reduce((a, t) => a + t.amount, 0);
    const out = tx.filter((t) => t.type === "Saída").reduce((a, t) => a + t.amount, 0);
    const pl = activeWd.filter((w) => Number(w.date.slice(5, 7)) === i + 1).reduce((a, w) => a + w.amount, 0);
    const profit = inc - out - pl;
    acc += profit;
    return { month: m, inc, out, pl, profit, acc, margin: inc > 0 ? profit / inc : 0 };
  });
}
