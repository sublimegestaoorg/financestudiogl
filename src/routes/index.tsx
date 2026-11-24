import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  Copy,
  CreditCard,
  Download,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Sun,
  Trash2,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { DashboardCharts } from "@/components/studio/charts";
import { InstallmentFields } from "@/components/studio/installment-fields";
import { BatchImportDialog } from "@/components/studio/batch-import";
import { StaffPayoutDialog, TeamPayoutsSection, type PayoutPrefill } from "@/components/studio/team-payouts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadCsv, printReport } from "@/lib/export";
import {
  addStaff,
  addStaffPayout,
  addStockItem,
  availableMonths,
  availableYears,
  brl,
  buildShoppingListText,
  deleteStaff,
  deleteStockItem,
  deleteTransaction,
  fdate,
  filterIndexedServices,
  filterStock,
  filterTransactions,
  formatYearMonth,
  getPaymentMethods,
  getServiceGoal,
  getStaffPayouts,
  installmentDetails,
  monthly,
  payoutsInPeriod,
  pct,
  recordStockPurchase,
  scopeDataByMonth,
  staffTransferTotals,
  summary,
  todayLocal,
  toggleTransactionPaid,
  updateService,
  updateStaff,
  updateStockItem,
  updateTransaction,
  updateWithdrawal,
  useStore,
  type Data,
  type Item,
  type SaveStatus,
  type Service,
  type Staff,
  type Tx,
  type Withdrawal,
} from "@/lib/store";
import {
  ConfirmDeleteDialog,
  ServiceEditDialog,
  StaffDialog,
  StockItemDialog,
  StockPurchaseDialog,
  TX_CATEGORIES,
  TX_STATUSES,
  TransactionEditDialog,
  WithdrawalEditDialog,
} from "@/components/studio/dialogs";
import { PaymentMethodsDialog, PaymentMethodsManager } from "@/components/studio/payment-methods";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel Financeiro — Estúdio Geisa Lorena" },
      { name: "description", content: "Gestão de fluxo de caixa, estoque, equipe, comissões e pró-labore do Estúdio Geisa Lorena." },
      { property: "og:title", content: "Painel Financeiro — Estúdio Geisa Lorena" },
      { property: "og:description", content: "Fluxo de caixa, estoque, equipe e pró-labore em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

const TABS = ["Painel", "Fluxo de Caixa", "Estoque", "Equipe", "Pró-Labore", "Formas de Pagamento", "Anual"] as const;
type Tab = (typeof TABS)[number];
type Props = { data: Data; setData: (f: (d: Data) => Data) => void };

function App() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (userId === undefined) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (!userId) return <Login />;
  return <Studio key={userId} userId={userId} />;
}

function authError(m: string) {
  const t = m.toLowerCase();
  if (t.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (t.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (t.includes("already registered") || t.includes("already been registered")) return "Este e-mail já tem conta. Use \"Entrar\".";
  if (t.includes("not allowed") || t.includes("invalid")) return "Este e-mail não é válido. Confira se digitou certo.";
  if (t.includes("password") && (t.includes("weak") || t.includes("pwned") || t.includes("known"))) return "Senha fraca ou muito conhecida. Escolha outra.";
  if (t.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (t.includes("rate limit") || t.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  return "Não foi possível concluir. Tente novamente.";
}

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    const { data, error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg(authError(error.message));
    if (mode === "up" && !data.session) setMsg("Conta criada! Confira seu e-mail para confirmar o cadastro.");
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg("Não foi possível entrar com o Google.");
  }
  return (
    <div className="min-h-screen grid place-items-center p-5 bg-background">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Estúdio</p>
        <h1 className="text-4xl font-semibold mb-6">Geisa Lorena</h1>
        <button type="button" onClick={google} className="w-full flex items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-[#FFFFFF] text-[#1F1F1F] px-3 py-2.5 text-sm font-medium">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continuar com o Google
        </button>
        <p className="my-4 text-center text-xs text-muted-foreground">ou</p>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          <button disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-60">{mode === "in" ? "Entrar" : "Criar conta"}</button>
        </form>
        {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
        <button type="button" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }} className="mt-4 text-sm text-primary underline-offset-4 hover:underline">
          {mode === "in" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}

const THEME_KEY = "geisa-lorena-theme";

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      const isDark = saved === "dark";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return { dark, toggle };
}

function SyncBadge({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 cursor-pointer"
      >
        <CloudOff className="h-3.5 w-3.5" />
        Erro ao salvar · Tentar novamente
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      <Cloud className="h-3.5 w-3.5 text-success" />
      Salvo na nuvem
    </span>
  );
}

function Studio({ userId }: { userId: string }) {
  const { data, setData, reset, ready, loadError, saveStatus, retryLoad, retrySave } = useStore(userId);
  const { dark, toggle: toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("Painel");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [resetOpen, setResetOpen] = useState(false);
  const months = availableMonths(data);
  const effectiveMonth =
    selectedMonth === "all" || (selectedMonth && months.includes(selectedMonth))
      ? selectedMonth
      : (months[0] ?? "all");

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-sidebar text-sidebar-foreground md:w-60 md:min-h-screen p-5 flex flex-wrap items-start md:flex-nowrap md:flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sidebar-primary">Estúdio</p>
          <h1 className="text-3xl font-semibold leading-none">Geisa Lorena</h1>
        </div>
        <nav className="order-last md:order-none w-full flex md:flex-col gap-1 overflow-x-auto md:mt-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-left whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors cursor-pointer ${tab === t ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent"}`}>
              {t}
            </button>
          ))}
        </nav>
        <div className="hidden md:flex mt-auto flex-col gap-2.5 items-start w-full">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-sidebar-foreground cursor-pointer"
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {dark ? "Modo claro" : "Modo escuro"}
          </button>
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground text-left cursor-pointer"
          >
            Restaurar dados da planilha
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground text-left cursor-pointer">
            Sair
          </button>
        </div>
        <div className="md:hidden ml-auto flex items-center gap-3">
          <button
            type="button"
            aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-sidebar-accent cursor-pointer"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => supabase.auth.signOut()} className="text-xs whitespace-nowrap cursor-pointer">
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-5 md:p-10 max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-4xl font-semibold">{tab}</h2>
            {ready && <SyncBadge status={saveStatus} onRetry={retrySave} />}
          </div>
          {ready && (tab === "Painel" || tab === "Equipe" || tab === "Pró-Labore") && (
            <MonthPicker months={months} value={effectiveMonth} onChange={setSelectedMonth} />
          )}
        </div>
        {loadError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-destructive font-medium">{loadError}</p>
            <button type="button" onClick={retryLoad} className={btn}>
              Tentar novamente
            </button>
          </div>
        )}
        {!ready && !loadError && <p className="text-muted-foreground">Carregando seus dados…</p>}
        {ready && <>
        {tab === "Painel" && <Dashboard data={data} setData={setData} selectedMonth={effectiveMonth} />}
        {tab === "Fluxo de Caixa" && <Cash data={data} setData={setData} />}
        {tab === "Estoque" && <Stock data={data} setData={setData} />}
        {tab === "Equipe" && <Team data={data} setData={setData} selectedMonth={effectiveMonth} />}
        {tab === "Pró-Labore" && <ProLabore data={data} setData={setData} selectedMonth={effectiveMonth} />}
        {tab === "Formas de Pagamento" && <PaymentMethodsTab data={data} setData={setData} />}
        {tab === "Anual" && <Annual data={data} />}
        </>}
      </main>
      <ConfirmDeleteDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Restaurar dados originais da planilha?"
        description="Todos os seus lançamentos, estoque, equipe e configurações atuais serão substituídos pelos dados iniciais de exemplo."
        onConfirm={() => {
          reset();
          toast.success("Dados restaurados para o padrão da planilha.");
        }}
      />
    </div>
  );
}

function MonthPicker({ months, value, onChange }: { months: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Período:</span>
      <select
        aria-label="Selecionar mês"
        className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">Todos os períodos</option>
        {months.map((m) => (
          <option key={m} value={m}>{formatYearMonth(m)}</option>
        ))}
      </select>
    </label>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string | undefined; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-primary"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">{children}</div>;
function Table({ head, rows, stickyLast = false }: { head: string[]; rows: ReactNode[][]; stickyLast?: boolean }) {
  const lastIdx = head.length - 1;
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            {head.map((h, idx) => (
              <th
                key={h}
                className={`px-3 py-2 text-left font-medium whitespace-nowrap ${stickyLast && idx === lastIdx ? "sticky right-0 bg-muted shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]" : ""}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 whitespace-nowrap ${stickyLast && j === lastIdx ? "sticky right-0 bg-card shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]" : ""}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Bar({ value, max }: { value: number; max: number }) {
  return <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} /></div>;
}
const input = "rounded-md border bg-background px-3 py-2 text-sm";
const btn = "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer";
const secondaryBtn = "inline-flex items-center justify-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted cursor-pointer";
const del = (onClick: () => void) => <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-destructive text-xs hover:underline cursor-pointer"><Trash2 className="h-3.5 w-3.5" />Excluir</button>;
const editBtn = (onClick: () => void) => <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-primary text-xs hover:underline cursor-pointer"><Pencil className="h-3.5 w-3.5" />Editar</button>;

function Dashboard({ data, setData, selectedMonth }: Props & { selectedMonth: string }) {
  const scoped = scopeDataByMonth(data, selectedMonth);
  const s = summary(scoped);
  const goal = getServiceGoal(data);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(goal));

  const saveGoal = () => {
    const parsed = Number(goalInput);
    if (!(parsed > 0)) {
      toast.error("Informe uma meta maior que zero.");
      return;
    }
    setData((d) => ({ ...d, serviceGoal: parsed }));
    setEditingGoal(false);
    toast.success("Meta de serviços atualizada.");
  };

  const lines = [["Serviços de beleza", s.services], ["Venda de produtos", s.products], ["Insumos e produtos", s.supplies], ["Despesas fixas e variáveis", s.other]] as const;
  const chartYear = selectedMonth === "all" ? undefined : selectedMonth.slice(0, 4);

  return (
    <>
      <Grid>
        <Kpi
          label="Receita total"
          value={brl(s.revenue)}
          hint={s.pendingIn > 0 ? `Em caixa ${brl(s.realizedRevenue)} · A receber ${brl(s.pendingIn)}` : "Faturamento bruto"}
        />
        <Kpi
          label="Despesas operacionais"
          value={brl(s.expenses)}
          hint={s.pendingOut > 0 ? `Pagas ${brl(s.realizedExpenses)} · A pagar ${brl(s.pendingOut)}` : "Custos e saídas"}
        />
        <Kpi
          label="Lucro líquido"
          value={brl(s.profit)}
          tone={s.profit >= 0 ? "good" : "bad"}
          hint={s.pendingCount > 0 ? `Realizado em caixa: ${brl(s.realizedProfit)}` : "Receita − despesas"}
        />
        <Kpi label="Margem líquida" value={pct(s.margin)} hint={s.pendingCount > 0 ? `${s.pendingCount} lançamento(s) pendente(s)` : undefined} />
        <Kpi label="Estoque ativo" value={brl(s.stockValue)} hint={`${s.critical} itens para repor`} tone={s.critical ? "bad" : undefined} />
        <Kpi label="Pró-labore retirado" value={brl(s.withdrawn)} hint={`Teto seguro ${brl(s.ceiling)}`} tone={s.withdrawn > s.ceiling ? "bad" : "good"} />
        <Kpi label="Folha equipe" value={brl(s.payroll)} hint="Salários + comissões" />
        <Kpi label="Saldo residual" value={brl(s.residual)} hint="Lucro após pró-labore" />
      </Grid>
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="text-2xl font-semibold">Composição</h3>
        {lines.map(([l, v]) => (
          <div key={l}><div className="flex justify-between text-sm mb-1"><span>{l}</span><span className="font-medium">{brl(v)}</span></div><Bar value={v} max={Math.max(s.revenue, s.expenses)} /></div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm text-muted-foreground">
          {editingGoal ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Meta de serviços (R$):</span>
              <input
                type="number"
                step="100"
                min="1"
                className="w-32 rounded-md border bg-background px-2.5 py-1 text-sm text-foreground"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveGoal();
                  if (e.key === "Escape") setEditingGoal(false);
                }}
                autoFocus
              />
              <button type="button" onClick={saveGoal} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer">
                <Check className="h-3.5 w-3.5" />Salvar
              </button>
              <button type="button" onClick={() => setEditingGoal(false)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline cursor-pointer">
                <X className="h-3.5 w-3.5" />Cancelar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span>Meta de serviços: {brl(goal)} — {pct(goal > 0 ? s.services / goal : 0)} atingido</span>
              <button
                type="button"
                onClick={() => {
                  setGoalInput(String(goal));
                  setEditingGoal(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
                Editar meta
              </button>
            </div>
          )}
        </div>
      </div>
      <DashboardCharts data={scoped} annualData={data} year={chartYear} />
    </>
  );
}

function Cash({ data, setData }: Props) {
  const paymentMethods = getPaymentMethods(data);
  const [parcelled, setParcelled] = useState(false);
  const [months, setMonths] = useState("");
  const [f, setF] = useState({
    date: todayLocal(),
    type: "Entrada" as Tx["type"],
    category: "Serviços",
    description: "",
    amount: "",
    payment: paymentMethods[0] ?? "PIX",
    status: "Concluído",
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"Todos" | Tx["type"]>("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [paymentFilter, setPaymentFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [onlyInstallments, setOnlyInstallments] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [deletingTx, setDeletingTx] = useState<Tx | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const effectivePayment = paymentMethods.includes(f.payment) ? f.payment : (paymentMethods[0] ?? "");
  const filterCategoryOptions = Array.from(
    new Set([...TX_CATEGORIES, ...data.transactions.map((t) => t.category).filter(Boolean)]),
  );
  const filterPaymentOptions = Array.from(
    new Set([...paymentMethods, ...data.transactions.map((t) => t.payment).filter(Boolean)]),
  );
  const activeCategoryFilter =
    categoryFilter === "Todas" || filterCategoryOptions.includes(categoryFilter) ? categoryFilter : "Todas";
  const activePaymentFilter =
    paymentFilter === "Todas" || filterPaymentOptions.includes(paymentFilter) ? paymentFilter : "Todas";

  const hasActiveFilters =
    Boolean(search.trim()) ||
    filter !== "Todos" ||
    activeCategoryFilter !== "Todas" ||
    activePaymentFilter !== "Todas" ||
    statusFilter !== "Todos" ||
    onlyInstallments ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const clearFilters = () => {
    setSearch("");
    setFilter("Todos");
    setCategoryFilter("Todas");
    setPaymentFilter("Todas");
    setStatusFilter("Todos");
    setOnlyInstallments(false);
    setDateFrom("");
    setDateTo("");
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!f.description.trim()) { toast.error("Preencha a descrição do lançamento."); return; }
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    if (!effectivePayment) { toast.error("Cadastre e selecione uma forma de pagamento."); return; }
    let installment: Pick<Tx, "installmentMonthsRemaining">;
    try { installment = installmentDetails(parcelled, months); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Confira os meses restantes."); return; }
    const resolvedStatus =
      f.status === "Pendente" ? "Pendente" : f.type === "Saída" ? "Pago" : "Concluído";
    setData((d) => ({
      ...d,
      transactions: [
        ...d.transactions,
        {
          ...f,
          ...installment,
          description: f.description.trim(),
          payment: effectivePayment,
          amount: Number(f.amount),
          id: `TR-${String(d.transactions.length + 1).padStart(3, "0")}-${Date.now() % 1000}`,
          status: resolvedStatus,
        },
      ],
    }));
    setF({ ...f, description: "", amount: "", payment: effectivePayment });
    setParcelled(false);
    setMonths("");
    toast.success("Lançamento registrado.");
  };

  const s = summary(data);
  const list = filterTransactions(data.transactions, {
    query: search,
    type: filter,
    category: activeCategoryFilter,
    payment: activePaymentFilter,
    status: statusFilter,
    onlyInstallments,
    dateFrom,
    dateTo,
  });
  const filteredIn = list.filter((t) => t.type === "Entrada" && t.status !== "Cancelado").reduce((a, t) => a + t.amount, 0);
  const filteredOut = list.filter((t) => t.type === "Saída" && t.status !== "Cancelado").reduce((a, t) => a + t.amount, 0);

  const renderStatus = (t: Tx) => {
    if (t.status === "Cancelado") {
      return <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground line-through">Cancelado</span>;
    }
    const isPending = t.status === "Pendente";
    return (
      <button
        type="button"
        title={isPending ? "Clique para marcar como pago/recebido" : "Clique para marcar como pendente"}
        onClick={() => {
          setData((d) => toggleTransactionPaid(d, t.id));
          toast.success(isPending ? "Lançamento marcado como pago/concluído." : "Lançamento marcado como pendente.");
        }}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${
          isPending
            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            : "bg-success/15 text-success"
        }`}
      >
        <CheckCircle2 className="h-3 w-3" />
        {t.status || (t.type === "Saída" ? "Pago" : "Concluído")}
      </button>
    );
  };

  return (
    <>
      <Grid>
        <Kpi
          label="Entradas"
          value={brl(s.revenue)}
          tone="good"
          hint={s.pendingIn > 0 ? `Em caixa ${brl(s.realizedRevenue)} · A receber ${brl(s.pendingIn)}` : "Realizado no caixa"}
        />
        <Kpi
          label="Saídas"
          value={brl(s.expenses)}
          tone="bad"
          hint={s.pendingOut > 0 ? `Pagas ${brl(s.realizedExpenses)} · A pagar ${brl(s.pendingOut)}` : "Despesas registradas"}
        />
        <Kpi
          label="Saldo"
          value={brl(s.profit)}
          tone={s.profit >= 0 ? "good" : "bad"}
          hint={s.pendingCount > 0 ? `Realizado em caixa: ${brl(s.realizedProfit)}` : `${data.transactions.length} movimentações`}
        />
        <Kpi
          label="Pendentes"
          value={String(s.pendingCount)}
          tone={s.pendingCount > 0 ? "bad" : "good"}
          hint={s.pendingCount > 0 ? `Receber ${brl(s.pendingIn)} · Pagar ${brl(s.pendingOut)}` : "Tudo quitado"}
        />
      </Grid>
      <form onSubmit={add} className="rounded-xl border bg-card p-4 mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Tx["type"] })}><option>Entrada</option><option>Saída</option></select>
        <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{TX_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select className={input} aria-label="Forma de pagamento" value={effectivePayment} onChange={(e) => setF({ ...f, payment: e.target.value })}>
          {paymentMethods.length === 0 && <option value="">Cadastre uma forma...</option>}
          {paymentMethods.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input className={`${input} sm:col-span-2`} placeholder="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={input} aria-label={parcelled ? "Valor da parcela" : "Valor"} type="number" step="0.01" min="0.01" placeholder={parcelled ? "Valor da parcela" : "Valor"} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={input} aria-label="Status do lançamento" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="Concluído">{f.type === "Saída" ? "Pago" : "Concluído"}</option>
          <option value="Pendente">Pendente</option>
        </select>
        <InstallmentFields id="cash" parcelled={parcelled} months={months} onParcelledChange={setParcelled} onMonthsChange={setMonths} />
        <Button type="submit" className="sm:col-span-2 lg:col-span-full">Lançar</Button>
      </form>
      <div className="rounded-xl border bg-card p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Pesquisar lançamentos"
              className="w-full rounded-md border bg-background pl-9 pr-8 py-2 text-sm"
              placeholder="Pesquisar por descrição, categoria, pagamento, data ou valor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["Todos", "Entrada", "Saída"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setFilter(x)}
                className={`rounded-full px-3 py-1.5 text-sm border cursor-pointer ${filter === x ? "bg-secondary font-medium" : "bg-background hover:bg-muted"}`}
              >
                {x}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyInstallments((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-sm border cursor-pointer ${onlyInstallments ? "bg-secondary font-medium" : "bg-background hover:bg-muted"}`}
            >
              Parcelados
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setBatchOpen(true)} className={secondaryBtn}>
              <Upload className="h-4 w-4" />
              Importar em lote
            </button>
            <button type="button" onClick={() => setPaymentsOpen(true)} className={secondaryBtn}>
              <CreditCard className="h-4 w-4" />
              Formas de pagamento
            </button>
            <button
              type="button"
              onClick={() => {
                downloadCsv(
                  `fluxo-de-caixa-${todayLocal()}.csv`,
                  ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", "Status", "Meses restantes"],
                  list.map((t) => [
                    fdate(t.date),
                    t.type,
                    t.category,
                    t.description,
                    t.amount.toFixed(2).replace(".", ","),
                    t.payment,
                    t.status,
                    t.installmentMonthsRemaining ?? "",
                  ]),
                );
                toast.success("CSV exportado.");
              }}
              className={secondaryBtn}
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => {
                const ok = printReport({
                  title: "Fluxo de Caixa",
                  subtitle: hasActiveFilters ? "Relatório com filtros aplicados" : "Todos os lançamentos",
                  kpis: [
                    { label: "Entradas", value: brl(filteredIn) },
                    { label: "Saídas", value: brl(filteredOut) },
                    { label: "Saldo", value: brl(filteredIn - filteredOut) },
                  ],
                  headers: ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", "Status"],
                  rows: list.map((t) => [
                    fdate(t.date),
                    t.type,
                    t.category,
                    t.description,
                    brl(t.amount),
                    t.payment,
                    t.status,
                  ]),
                });
                if (!ok) toast.error("Permita pop-ups para imprimir ou salvar em PDF.");
              }}
              className={secondaryBtn}
            >
              <Printer className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6 items-center">
          <select
            aria-label="Filtrar por categoria"
            className={input}
            value={activeCategoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="Todas">Todas as categorias</option>
            {filterCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            aria-label="Filtrar por forma de pagamento"
            className={input}
            value={activePaymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="Todas">Todas as formas</option>
            {filterPaymentOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            aria-label="Filtrar por status"
            className={input}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="Todos">Todos os status</option>
            {TX_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">De:</span>
            <input
              type="date"
              aria-label="Data inicial"
              className={`${input} w-full`}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">Até:</span>
            <input
              type="date"
              aria-label="Data final"
              className={`${input} w-full`}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className={`${secondaryBtn} w-full lg:w-auto`}>
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t text-xs text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{list.length}</strong> de {data.transactions.length} lançamentos
            </span>
            <span>
              Entradas: <strong className="text-success">{brl(filteredIn)}</strong>
            </span>
            <span>
              Saídas: <strong className="text-destructive">{brl(filteredOut)}</strong>
            </span>
            <span>
              Saldo filtrado: <strong className="text-foreground">{brl(filteredIn - filteredOut)}</strong>
            </span>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum lançamento encontrado para os filtros selecionados.
        </div>
      ) : (
        <Table
          stickyLast
          head={["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", "Status", "Parcelamento", "Ações"]}
          rows={list.map((t) => [
            fdate(t.date),
            <span className={t.type === "Entrada" ? "text-success" : "text-destructive"}>{t.type}</span>,
            t.category,
            <div className="min-w-44 max-w-xs whitespace-normal leading-snug">{t.description}</div>,
            brl(t.amount),
            t.payment,
            renderStatus(t),
            t.installmentMonthsRemaining ? `${t.installmentMonthsRemaining} ${t.installmentMonthsRemaining === 1 ? "mês restante" : "meses restantes"}` : "—",
            <span className="inline-flex items-center gap-3">
              {editBtn(() => setEditingTx(t))}
              {del(() => setDeletingTx(t))}
            </span>,
          ])}
        />
      )}
      <TransactionEditDialog
        tx={editingTx}
        open={Boolean(editingTx)}
        onOpenChange={(open) => !open && setEditingTx(null)}
        paymentMethods={paymentMethods}
        onSave={(id, updated) => {
          setData((d) => updateTransaction(d, id, updated));
          toast.success("Lançamento atualizado.");
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingTx)}
        onOpenChange={(open) => !open && setDeletingTx(null)}
        title="Excluir lançamento?"
        description={deletingTx ? `Remover "${deletingTx.description}" (${brl(deletingTx.amount)}) do fluxo de caixa?` : ""}
        onConfirm={() => {
          if (!deletingTx) return;
          setData((d) => deleteTransaction(d, deletingTx.id));
          setDeletingTx(null);
          toast.success("Lançamento excluído.");
        }}
      />
      <PaymentMethodsDialog open={paymentsOpen} onOpenChange={setPaymentsOpen} data={data} setData={setData} />
      <BatchImportDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        paymentMethods={paymentMethods}
        onImport={(items) => {
          setData((d) => {
            const baseCount = d.transactions.length;
            const stamp = Date.now() % 1000;
            const created: Tx[] = items.map((item, idx) => ({
              ...item,
              id: `TR-${String(baseCount + idx + 1).padStart(3, "0")}-${(stamp + idx) % 1000}`,
            }));
            return { ...d, transactions: [...d.transactions, ...created] };
          });
          toast.success(`${items.length} lançamento(s) importado(s).`);
        }}
      />
    </>
  );
}

function Stock({ data, setData }: Props) {
  const paymentMethods = getPaymentMethods(data);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [buyingItem, setBuyingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [onlyCritical, setOnlyCritical] = useState(false);

  const upd = (code: string, qty: number) => setData((d) => ({ ...d, stock: d.stock.map((i) => (i.code === code ? { ...i, qty: Math.max(0, qty) } : i)) }));
  const s = summary(data);

  const stockCategories = Array.from(new Set(data.stock.map((i) => i.category).filter(Boolean)));
  const activeCategory =
    categoryFilter === "Todas" || stockCategories.includes(categoryFilter) ? categoryFilter : "Todas";
  const hasFilters = Boolean(search.trim()) || activeCategory !== "Todas" || onlyCritical;
  const visibleStock = filterStock(data.stock, {
    query: search,
    category: activeCategory,
    onlyCritical,
  });

  const openNew = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };
  const openEdit = (item: Item) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const copyShoppingList = async () => {
    const text = buildShoppingListText(data.stock);
    if (!text) {
      toast.info("Nenhum item abaixo do mínimo para repor.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lista de compras copiada para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Verifique a permissão do navegador.");
    }
  };

  const exportStockCsv = () => {
    downloadCsv(
      `estoque-${todayLocal()}.csv`,
      ["Código", "Item", "Categoria", "Mínimo", "Atual", "Custo un.", "Total", "Status", "Comprar"],
      visibleStock.map((i) => [
        i.code,
        i.name,
        i.category,
        i.min,
        i.qty,
        i.cost.toFixed(2).replace(".", ","),
        (i.qty * i.cost).toFixed(2).replace(".", ","),
        i.qty <= i.min ? "Repor urgente" : "Regular",
        Math.max(0, i.min * 2 - i.qty),
      ]),
    );
    toast.success("CSV do estoque exportado.");
  };

  const printStockPdf = () => {
    const ok = printReport({
      title: "Estoque",
      subtitle: hasFilters ? "Itens filtrados" : "Inventário completo",
      kpis: [
        { label: "Valor em estoque", value: brl(s.stockValue) },
        { label: "Itens exibidos", value: String(visibleStock.length) },
        { label: "Repor urgente", value: String(s.critical) },
      ],
      headers: ["Código", "Item", "Categoria", "Mín.", "Atual", "Custo un.", "Total", "Comprar"],
      rows: visibleStock.map((i) => [
        i.code,
        i.name,
        i.category,
        i.min,
        i.qty,
        brl(i.cost),
        brl(i.qty * i.cost),
        Math.max(0, i.min * 2 - i.qty),
      ]),
    });
    if (!ok) toast.error("Permita pop-ups para imprimir ou salvar em PDF.");
  };

  return (
    <>
      <Grid>
        <Kpi label="Valor em estoque" value={brl(s.stockValue)} />
        <Kpi label="Itens cadastrados" value={String(data.stock.length)} />
        <Kpi label="Repor urgente" value={String(s.critical)} tone={s.critical ? "bad" : "good"} />
        <Kpi label="Custo médio unitário" value={brl(data.stock.reduce((a, i) => a + i.cost, 0) / (data.stock.length || 1))} />
      </Grid>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-2xl font-semibold">Itens do estoque</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyShoppingList}
            disabled={s.critical === 0}
            className={`${secondaryBtn} disabled:opacity-50`}
          >
            <Copy className="h-4 w-4" />
            Copiar lista de compras
          </button>
          <button type="button" onClick={exportStockCsv} className={secondaryBtn}>
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button type="button" onClick={printStockPdf} className={secondaryBtn}>
            <Printer className="h-4 w-4" />
            PDF
          </button>
          <button type="button" onClick={openNew} className={btn}>
            <Plus className="h-4 w-4" />
            Novo item
          </button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            aria-label="Pesquisar itens do estoque"
            className="w-full rounded-md border bg-background pl-9 pr-8 py-2 text-sm"
            placeholder="Pesquisar por nome, código ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Limpar pesquisa"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <select
          aria-label="Filtrar estoque por categoria"
          className={input}
          value={activeCategory}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="Todas">Todas as categorias</option>
          {stockCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setOnlyCritical((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-sm border cursor-pointer ${onlyCritical ? "bg-destructive/15 border-destructive/40 text-destructive font-medium" : "bg-background hover:bg-muted"}`}
        >
          Repor urgente ({s.critical})
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("Todas");
              setOnlyCritical(false);
            }}
            className={secondaryBtn}
          >
            <X className="h-4 w-4" />
            Limpar
          </button>
        )}
      </div>
      {data.stock.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum item no estoque. Clique em &quot;Novo item&quot; para cadastrar.
        </div>
      ) : visibleStock.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum item encontrado para os filtros selecionados.
        </div>
      ) : (
        <Table
          stickyLast
          head={["Item", "Mín.", "Atual", "Custo un.", "Total", "Status", "Comprar", "Ações"]}
          rows={visibleStock.map((i) => [
            <div className="min-w-44 max-w-xs whitespace-normal">
              <div className="font-medium leading-snug">{i.name}</div>
              <div className="text-xs text-muted-foreground">{i.code} · {i.category}</div>
            </div>,
            i.min,
            <span className="inline-flex items-center gap-2">
              <button type="button" className="px-2 rounded border cursor-pointer" onClick={() => upd(i.code, i.qty - 1)}>−</button>
              {i.qty}
              <button type="button" className="px-2 rounded border cursor-pointer" onClick={() => upd(i.code, i.qty + 1)}>+</button>
            </span>,
            brl(i.cost),
            brl(i.qty * i.cost),
            i.qty <= i.min ? <span className="text-destructive font-medium">Repor urgente</span> : <span className="text-success">Regular</span>,
            Math.max(0, i.min * 2 - i.qty),
            <span className="inline-flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBuyingItem(i)}
                className="inline-flex items-center gap-1 text-success text-xs hover:underline cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Comprar
              </button>
              {editBtn(() => openEdit(i))}
              {del(() => setDeletingItem(i))}
            </span>,
          ])}
        />
      )}
      <StockPurchaseDialog
        item={buyingItem}
        open={Boolean(buyingItem)}
        onOpenChange={(open) => !open && setBuyingItem(null)}
        paymentMethods={paymentMethods}
        onConfirm={(params) => {
          setData((d) => recordStockPurchase(d, params));
          toast.success(
            params.syncCash
              ? "Compra registrada no estoque e lançada no Fluxo de Caixa."
              : "Quantidade adicionada ao estoque.",
          );
        }}
      />
      <StockItemDialog
        item={editingItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingStock={data.stock}
        onDelete={(item) => setDeletingItem(item)}
        onSave={(originalCode, item) => {
          if (originalCode) {
            setData((d) => updateStockItem(d, originalCode, item));
            toast.success("Item do estoque atualizado.");
          } else {
            setData((d) => addStockItem(d, item));
            toast.success("Item adicionado ao estoque.");
          }
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingItem)}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Excluir "${deletingItem?.name ?? ""}"?`}
        description="Este item será removido permanentemente do estoque."
        onConfirm={() => {
          if (!deletingItem) return;
          setData((d) => deleteStockItem(d, deletingItem.code));
          setDeletingItem(null);
          toast.success("Item excluído do estoque.");
        }}
      />
    </>
  );
}

function Team({ data, setData, selectedMonth }: Props & { selectedMonth: string }) {
  const scoped = scopeDataByMonth(data, selectedMonth);
  const s = summary(scoped);
  const paymentMethods = getPaymentMethods(data);
  const scopedPayouts = payoutsInPeriod(getStaffPayouts(data), selectedMonth);

  const [staffFilter, setStaffFilter] = useState("Todos");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceDateFrom, setServiceDateFrom] = useState("");
  const [serviceDateTo, setServiceDateTo] = useState("");

  const [f, setF] = useState({ date: todayLocal(), staff: data.staff[0]?.name ?? "", client: "", service: "", amount: "" });
  const [syncCash, setSyncCash] = useState(false);
  const [cashPayment, setCashPayment] = useState(paymentMethods[0] ?? "PIX");
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Staff | null>(null);
  const [deletingMember, setDeletingMember] = useState<Staff | null>(null);
  const [editingService, setEditingService] = useState<{ index: number; service: Service } | null>(null);
  const [deletingService, setDeletingService] = useState<{ index: number; service: Service } | null>(null);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutPrefill, setPayoutPrefill] = useState<PayoutPrefill | null>(null);

  const activeStaffFilter =
    staffFilter === "Todos" || data.staff.some((x) => x.name === staffFilter) ? staffFilter : "Todos";

  const selectedStaff =
    activeStaffFilter !== "Todos"
      ? activeStaffFilter
      : data.staff.some((x) => x.name === f.staff)
        ? f.staff
        : (data.staff[0]?.name ?? "");
  const effectiveCashPayment = paymentMethods.includes(cashPayment) ? cashPayment : (paymentMethods[0] ?? "PIX");

  const visibleTeam =
    activeStaffFilter === "Todos" ? s.team : s.team.filter((t) => t.name === activeStaffFilter);

  const periodServices = filterIndexedServices(data.services, {
    query: serviceSearch,
    staff: activeStaffFilter,
    dateFrom: serviceDateFrom,
    dateTo: serviceDateTo,
  }).filter(({ service }) => selectedMonth === "all" || service.date.startsWith(selectedMonth));

  const hasServiceFilters =
    Boolean(serviceSearch.trim()) ||
    activeStaffFilter !== "Todos" ||
    Boolean(serviceDateFrom) ||
    Boolean(serviceDateTo);

  const filteredBilled = periodServices.reduce((a, { service }) => a + service.amount, 0);
  const filteredCommission = periodServices.reduce((a, { service }) => a + service.amount * service.rate, 0);

  const openPayDialog = (prefill: PayoutPrefill) => {
    setPayoutPrefill(prefill);
    setPayoutDialogOpen(true);
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    const st = data.staff.find((x) => x.name === selectedStaff);
    if (!st) { toast.error("Cadastre e escolha um funcionário."); return; }
    if (!f.service.trim()) { toast.error("Preencha o serviço realizado."); return; }
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    const amount = Number(f.amount);
    const client = f.client.trim();
    const serviceName = f.service.trim();
    setData((d) => {
      const nextServices = [
        ...d.services,
        {
          date: f.date,
          staff: st.name,
          client,
          service: serviceName,
          amount,
          rate: st.rate,
        },
      ];
      if (!syncCash) return { ...d, services: nextServices };
      const desc = client ? `${serviceName} - ${client}` : serviceName;
      return {
        ...d,
        services: nextServices,
        transactions: [
          ...d.transactions,
          {
            id: `TR-${String(d.transactions.length + 1).padStart(3, "0")}-${Date.now() % 1000}`,
            date: f.date,
            type: "Entrada",
            category: "Serviços",
            description: desc,
            amount,
            payment: effectiveCashPayment,
            status: "Concluído",
          },
        ],
      };
    });
    setF({ ...f, staff: st.name, client: "", service: "", amount: "" });
    toast.success(syncCash ? "Atendimento registrado e lançado no Fluxo de Caixa." : "Atendimento registrado.");
  };

  const deletingServiceCount = deletingMember
    ? data.services.filter((v) => v.staff === deletingMember.name).length
    : 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-2xl font-semibold">Profissionais</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadCsv(
                `folha-equipe-${selectedMonth === "all" ? "todos" : selectedMonth}.csv`,
                ["Profissional", "Cargo", "Salário base", "Comissão %", "Serviços realizados", "Comissão devida", "Adiantamentos", "Líquido", "Já pago", "Falta repassar"],
                visibleTeam.map((t) => {
                  const tr = staffTransferTotals(t.name, t.net, scopedPayouts);
                  return [
                    t.name,
                    t.role,
                    t.salary.toFixed(2).replace(".", ","),
                    (t.rate * 100).toFixed(1).replace(".", ","),
                    t.billed.toFixed(2).replace(".", ","),
                    t.commission.toFixed(2).replace(".", ","),
                    t.advance.toFixed(2).replace(".", ","),
                    t.net.toFixed(2).replace(".", ","),
                    tr.paidTotal.toFixed(2).replace(".", ","),
                    tr.remaining.toFixed(2).replace(".", ","),
                  ];
                }),
              );
              toast.success("CSV da folha exportado.");
            }}
            className={secondaryBtn}
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const totalNet = visibleTeam.reduce((a, t) => a + t.net, 0);
              const totalPaid = visibleTeam.reduce((a, t) => a + staffTransferTotals(t.name, t.net, scopedPayouts).paidTotal, 0);
              const totalRem = visibleTeam.reduce((a, t) => a + staffTransferTotals(t.name, t.net, scopedPayouts).remaining, 0);
              const ok = printReport({
                title: activeStaffFilter === "Todos" ? "Folha da Equipe" : `Repasse — ${activeStaffFilter}`,
                subtitle: selectedMonth === "all" ? "Todos os períodos" : formatYearMonth(selectedMonth),
                kpis: [
                  { label: "Líquido no período", value: brl(totalNet) },
                  { label: "Já pago", value: brl(totalPaid) },
                  { label: "Falta repassar", value: brl(totalRem) },
                ],
                headers: ["Profissional", "Cargo", "Salário", "Serviços", "Comissão", "Adiant.", "Líquido", "Já pago", "A repassar"],
                rows: visibleTeam.map((t) => {
                  const tr = staffTransferTotals(t.name, t.net, scopedPayouts);
                  return [
                    t.name,
                    t.role,
                    brl(t.salary),
                    brl(t.billed),
                    brl(t.commission),
                    brl(t.advance),
                    brl(t.net),
                    brl(tr.paidTotal),
                    brl(tr.remaining),
                  ];
                }),
              });
              if (!ok) toast.error("Permita pop-ups para imprimir ou salvar em PDF.");
            }}
            className={secondaryBtn}
          >
            <Printer className="h-4 w-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingMember(null);
              setStaffDialogOpen(true);
            }}
            className={btn}
          >
            <Plus className="h-4 w-4" />
            Novo funcionário
          </button>
        </div>
      </div>

      {data.staff.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Separar por profissional:</span>
          <button
            type="button"
            onClick={() => setStaffFilter("Todos")}
            className={`rounded-full px-3 py-1 text-sm border cursor-pointer ${activeStaffFilter === "Todos" ? "bg-secondary font-medium" : "bg-card hover:bg-muted"}`}
          >
            Todas ({data.staff.length})
          </button>
          {data.staff.map((st) => (
            <button
              key={st.name}
              type="button"
              onClick={() => {
                setStaffFilter(st.name);
                setF((prev) => ({ ...prev, staff: st.name }));
              }}
              className={`rounded-full px-3 py-1 text-sm border cursor-pointer ${activeStaffFilter === st.name ? "bg-primary text-primary-foreground border-primary font-medium" : "bg-card hover:bg-muted"}`}
            >
              {st.name}
            </button>
          ))}
        </div>
      )}

      {visibleTeam.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground mb-8">
          Nenhum funcionário cadastrado. Clique em &quot;Novo funcionário&quot; para adicionar à equipe.
        </div>
      ) : (
        <div className={`grid gap-4 mb-8 ${visibleTeam.length === 1 ? "md:grid-cols-1 max-w-2xl" : "md:grid-cols-2"}`}>
          {visibleTeam.map((t) => {
            const transfer = staffTransferTotals(t.name, t.net, scopedPayouts);
            const srvCount = scoped.services.filter((v) => v.staff === t.name).length;
            const isFocused = activeStaffFilter === t.name;
            return (
              <div key={t.name} className="rounded-xl border bg-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="text-2xl font-semibold">{t.name}</h3>
                      <p className="text-sm text-muted-foreground">{t.role} · comissão {pct(t.rate)}</p>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      {editBtn(() => {
                        setEditingMember({ name: t.name, role: t.role, salary: t.salary, rate: t.rate, advance: t.advance });
                        setStaffDialogOpen(true);
                      })}
                      {del(() =>
                        setDeletingMember({ name: t.name, role: t.role, salary: t.salary, rate: t.rate, advance: t.advance }),
                      )}
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt>Salário base</dt><dd className="text-right">{brl(t.salary)}</dd>
                    <dt>Serviços ({srvCount})</dt><dd className="text-right">{brl(t.billed)}</dd>
                    <dt>Comissão devida</dt><dd className="text-right">{brl(t.commission)}</dd>
                    <dt>Adiantamentos</dt><dd className="text-right">− {brl(t.advance)}</dd>
                    <dt className="font-medium pt-2 border-t">Total líquido no período</dt><dd className="text-right font-medium pt-2 border-t">{brl(t.net)}</dd>
                    <dt className="text-success">Já pago no período</dt><dd className="text-right text-success">− {brl(transfer.paidTotal)}</dd>
                    <dt className="font-semibold pt-2 border-t">Falta repassar</dt>
                    <dd className={`text-right font-semibold pt-2 border-t ${transfer.remaining > 0 ? "text-primary" : "text-success"}`}>
                      {transfer.remaining > 0 ? brl(transfer.remaining) : "Quitado"}
                    </dd>
                  </dl>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setStaffFilter(isFocused ? "Todos" : t.name);
                      if (!isFocused) setF((prev) => ({ ...prev, staff: t.name }));
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                  >
                    {isFocused ? "Mostrar todas as profissionais" : "Ver só esta profissional"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openPayDialog({
                        staff: t.name,
                        kind: t.salary > 0 && t.commission > 0 ? "Comissão + Salário" : t.commission > 0 ? "Comissão" : "Salário",
                        periodType: selectedMonth === "all" ? "Semana" : "Mês",
                        periodDate: selectedMonth === "all" ? todayLocal() : `${selectedMonth}-01`,
                        amount: transfer.remaining > 0 ? transfer.remaining : t.commission > 0 ? t.commission : t.salary,
                      })
                    }
                    className={secondaryBtn}
                  >
                    <Wallet className="h-4 w-4 text-primary" />
                    Registrar repasse
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="text-2xl font-semibold mb-3">
        Atendimentos e comissões{activeStaffFilter !== "Todos" ? ` — ${activeStaffFilter}` : ""}
      </h3>
      <form onSubmit={add} className="rounded-xl border bg-card p-4 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className={input} value={selectedStaff} onChange={(e) => setF({ ...f, staff: e.target.value })}>
          {data.staff.length === 0 && <option value="">Cadastre um funcionário</option>}
          {data.staff.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
        </select>
        <input className={input} placeholder="Cliente" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
        <input className={input} placeholder="Serviço" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} />
        <input className={input} type="number" step="0.01" min="0.01" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button type="submit" className={btn}>Registrar</button>
        <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Checkbox id="team-sync-cash" checked={syncCash} onCheckedChange={(checked) => setSyncCash(checked === true)} />
            <label htmlFor="team-sync-cash" className="text-sm cursor-pointer">
              Lançar entrada automaticamente no Fluxo de Caixa
            </label>
          </div>
          {syncCash && (
            <select
              aria-label="Forma de pagamento para o fluxo de caixa"
              className="rounded-md border bg-background px-2.5 py-1 text-sm"
              value={effectiveCashPayment}
              onChange={(e) => setCashPayment(e.target.value)}
            >
              {paymentMethods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
      </form>

      <div className="rounded-xl border bg-card p-4 mb-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 items-center">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Pesquisar atendimentos"
              className="w-full rounded-md border bg-background pl-9 pr-8 py-2 text-sm"
              placeholder="Pesquisar cliente, serviço, profissional, data ou valor..."
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
            {serviceSearch && (
              <button
                type="button"
                aria-label="Limpar pesquisa de atendimentos"
                onClick={() => setServiceSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">De:</span>
            <input
              type="date"
              aria-label="Data inicial de atendimentos"
              className={`${input} w-full`}
              value={serviceDateFrom}
              onChange={(e) => setServiceDateFrom(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">Até:</span>
            <input
              type="date"
              aria-label="Data final de atendimentos"
              className={`${input} w-full`}
              value={serviceDateTo}
              onChange={(e) => setServiceDateTo(e.target.value)}
            />
          </label>
          <div className="flex justify-end">
            {hasServiceFilters && (
              <button
                type="button"
                onClick={() => {
                  setServiceSearch("");
                  setStaffFilter("Todos");
                  setServiceDateFrom("");
                  setServiceDateTo("");
                }}
                className={`${secondaryBtn} w-full lg:w-auto`}
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t text-xs text-muted-foreground">
          <span>
            Atendimentos exibidos: <strong className="text-foreground">{periodServices.length}</strong>
          </span>
          <span>
            Faturado: <strong className="text-foreground">{brl(filteredBilled)}</strong>
          </span>
          <span>
            Comissão total: <strong className="text-primary">{brl(filteredCommission)}</strong>
          </span>
        </div>
      </div>

      {periodServices.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum atendimento encontrado para os filtros selecionados.
        </div>
      ) : (
        <Table
          stickyLast
          head={["Data", "Profissional", "Cliente", "Serviço", "Valor", "Comissão", "Ações"]}
          rows={periodServices.map(({ service: v, index }) => [
            fdate(v.date),
            v.staff,
            v.client,
            <div className="min-w-40 max-w-xs whitespace-normal leading-snug">{v.service}</div>,
            brl(v.amount),
            brl(v.amount * v.rate),
            <span className="inline-flex items-center gap-3">
              {editBtn(() => setEditingService({ index, service: v }))}
              {del(() => setDeletingService({ index, service: v }))}
            </span>,
          ])}
        />
      )}

      <TeamPayoutsSection
        data={data}
        setData={setData}
        selectedMonth={selectedMonth}
        selectedStaff={activeStaffFilter}
        onOpenPay={openPayDialog}
      />

      <StaffPayoutDialog
        open={payoutDialogOpen}
        onOpenChange={setPayoutDialogOpen}
        editing={null}
        prefill={payoutPrefill}
        staffNames={data.staff.map((x) => x.name)}
        paymentMethods={paymentMethods}
        onSave={(_id, payout, shouldSyncCash) => {
          setData((d) => addStaffPayout(d, payout, shouldSyncCash));
          toast.success(
            shouldSyncCash
              ? "Pagamento registrado e lançado no Fluxo de Caixa."
              : "Pagamento registrado no histórico da equipe.",
          );
        }}
      />

      <StaffDialog
        member={editingMember}
        open={staffDialogOpen}
        onOpenChange={setStaffDialogOpen}
        existingStaff={data.staff}
        onSave={(originalName, member) => {
          if (originalName) {
            setData((d) => updateStaff(d, originalName, member));
            if (f.staff === originalName) setF((prev) => ({ ...prev, staff: member.name }));
            if (staffFilter === originalName) setStaffFilter(member.name);
            toast.success("Funcionário atualizado.");
          } else {
            setData((d) => addStaff(d, member));
            if (!f.staff) setF((prev) => ({ ...prev, staff: member.name }));
            toast.success("Funcionário adicionado.");
          }
        }}
      />
      <ServiceEditDialog
        service={editingService?.service ?? null}
        index={editingService?.index ?? -1}
        open={Boolean(editingService)}
        onOpenChange={(open) => !open && setEditingService(null)}
        staffList={data.staff}
        onSave={(idx, updated) => {
          setData((d) => updateService(d, idx, updated));
          toast.success("Atendimento atualizado.");
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingService)}
        onOpenChange={(open) => !open && setDeletingService(null)}
        title="Excluir atendimento?"
        description={deletingService ? `Remover "${deletingService.service.service}" (${brl(deletingService.service.amount)}) da lista de atendimentos?` : ""}
        onConfirm={() => {
          if (!deletingService) return;
          const idxToRemove = deletingService.index;
          setData((d) => ({ ...d, services: d.services.filter((_, j) => j !== idxToRemove) }));
          setDeletingService(null);
          toast.success("Atendimento excluído.");
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingMember)}
        onOpenChange={(open) => !open && setDeletingMember(null)}
        title={`Excluir "${deletingMember?.name ?? ""}"?`}
        description={
          deletingServiceCount > 0
            ? `Este funcionário possui ${deletingServiceCount} atendimento(s) registrado(s). Os atendimentos serão mantidos no histórico, mas o funcionário sairá da folha.`
            : "O funcionário será removido permanentemente da equipe."
        }
        onConfirm={() => {
          if (!deletingMember) return;
          setData((d) => deleteStaff(d, deletingMember.name));
          if (staffFilter === deletingMember.name) setStaffFilter("Todos");
          setDeletingMember(null);
          toast.success("Funcionário excluído.");
        }}
      />
    </>
  );
}

function ProLabore({ data, setData, selectedMonth }: Props & { selectedMonth: string }) {
  const scoped = scopeDataByMonth(data, selectedMonth);
  const s = summary(scoped);
  const paymentMethods = getPaymentMethods(data);
  const defaultPayment = paymentMethods.includes("PIX Transferência")
    ? "PIX Transferência"
    : (paymentMethods[0] ?? "");
  const [f, setF] = useState({ date: todayLocal(), description: "", amount: "", payment: defaultPayment });
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(Math.round(data.safeRate * 100)));
  const [editingWd, setEditingWd] = useState<Withdrawal | null>(null);
  const [deletingWd, setDeletingWd] = useState<Withdrawal | null>(null);

  const effectivePayment = paymentMethods.includes(f.payment) ? f.payment : defaultPayment;

  const saveRate = () => {
    const parsed = Number(rateInput);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed > 100) {
      toast.error("Informe um percentual entre 1% e 100%.");
      return;
    }
    setData((d) => ({ ...d, safeRate: parsed / 100 }));
    setEditingRate(false);
    toast.success("Teto seguro atualizado.");
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    if (!effectivePayment) { toast.error("Cadastre e selecione uma forma de pagamento."); return; }
    setData((d) => ({
      ...d,
      withdrawals: [
        ...d.withdrawals,
        {
          date: f.date,
          description: f.description.trim() || "Retirada de pró-labore",
          amount: Number(f.amount),
          payment: effectivePayment,
          id: `PL-${Date.now()}`,
        },
      ],
    }));
    setF({ ...f, description: "", amount: "", payment: effectivePayment });
    toast.success("Retirada registrada.");
  };

  const visibleWithdrawals = [...scoped.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
  const over = s.withdrawn > s.ceiling;

  return (
    <>
      <Grid>
        <Kpi label="Lucro líquido" value={brl(s.profit)} />
        <Kpi label={`Teto seguro (${pct(data.safeRate)})`} value={brl(s.ceiling)} />
        <Kpi label="Retirado no período" value={brl(s.withdrawn)} tone={over ? "bad" : "good"} hint={over ? "Acima do teto seguro" : "Retirada saudável"} />
        <Kpi label="Disponível no teto" value={brl(s.ceiling - s.withdrawn)} hint={`Reserva do estúdio: ${brl(s.profit * (1 - data.safeRate))}`} />
      </Grid>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="text-sm text-muted-foreground">
          {editingRate ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>Teto seguro (% do lucro):</span>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                className="w-20 rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRate();
                  if (e.key === "Escape") setEditingRate(false);
                }}
                autoFocus
              />
              <button type="button" onClick={saveRate} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer">
                <Check className="h-3.5 w-3.5" />Salvar
              </button>
              <button type="button" onClick={() => setEditingRate(false)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline cursor-pointer">
                <X className="h-3.5 w-3.5" />Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Teto configurado em <strong className="text-foreground">{pct(data.safeRate)}</strong> do lucro</span>
              <button
                type="button"
                onClick={() => {
                  setRateInput(String(Math.round(data.safeRate * 100)));
                  setEditingRate(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
                Alterar %
              </button>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setPaymentsOpen(true)} className={secondaryBtn}>
          <CreditCard className="h-4 w-4" />
          Gerenciar formas de pagamento
        </button>
      </div>
      <form onSubmit={add} className="rounded-xl border bg-card p-4 mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input className={input} placeholder="Finalidade" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={input} type="number" step="0.01" min="0.01" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={input} aria-label="Forma de pagamento" value={effectivePayment} onChange={(e) => setF({ ...f, payment: e.target.value })}>
          {paymentMethods.length === 0 && <option value="">Cadastre uma forma...</option>}
          {paymentMethods.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="submit" className={btn}>Registrar retirada</button>
      </form>
      {visibleWithdrawals.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma retirada registrada neste período.
        </div>
      ) : (
        <Table
          stickyLast
          head={["Data", "Finalidade", "Valor", "Pagamento", "Ações"]}
          rows={visibleWithdrawals.map((w) => [
            fdate(w.date),
            <div className="min-w-40 max-w-xs whitespace-normal leading-snug">{w.description}</div>,
            brl(w.amount),
            w.payment,
            <span className="inline-flex items-center gap-3">
              {editBtn(() => setEditingWd(w))}
              {del(() => setDeletingWd(w))}
            </span>,
          ])}
        />
      )}
      <WithdrawalEditDialog
        withdrawal={editingWd}
        open={Boolean(editingWd)}
        onOpenChange={(open) => !open && setEditingWd(null)}
        paymentMethods={paymentMethods}
        onSave={(id, updated) => {
          setData((d) => updateWithdrawal(d, id, updated));
          toast.success("Retirada atualizada.");
        }}
      />
      <ConfirmDeleteDialog
        open={Boolean(deletingWd)}
        onOpenChange={(open) => !open && setDeletingWd(null)}
        title="Excluir retirada?"
        description={deletingWd ? `Remover "${deletingWd.description}" (${brl(deletingWd.amount)}) do pró-labore?` : ""}
        onConfirm={() => {
          if (!deletingWd) return;
          setData((d) => ({ ...d, withdrawals: d.withdrawals.filter((x) => x.id !== deletingWd.id) }));
          setDeletingWd(null);
          toast.success("Retirada excluída.");
        }}
      />
      <PaymentMethodsDialog open={paymentsOpen} onOpenChange={setPaymentsOpen} data={data} setData={setData} />
    </>
  );
}

function PaymentMethodsTab({ data, setData }: Props) {
  const methods = getPaymentMethods(data);
  const s = summary(data);
  const activeTransactions = data.transactions.filter((t) => t.status !== "Cancelado");
  const counts = methods.map((m) => ({
    name: m,
    count:
      activeTransactions.filter((t) => t.payment === m).length +
      data.withdrawals.filter((w) => w.payment === m).length,
  }));
  const top = [...counts].sort((a, b) => b.count - a.count)[0];
  return (
    <>
      <Grid>
        <Kpi label="Formas cadastradas" value={String(methods.length)} />
        <Kpi label="Mais utilizada" value={top && top.count > 0 ? top.name : "—"} hint={top && top.count > 0 ? `${top.count} lançamentos` : "Sem registros ainda"} />
        <Kpi label="Total em entradas" value={brl(s.revenue)} tone="good" />
        <Kpi label="Total em saídas" value={brl(s.expenses + s.withdrawn)} tone="bad" hint="Despesas + pró-labore" />
      </Grid>
      <PaymentMethodsManager data={data} setData={setData} showStats />
    </>
  );
}

function Annual({ data }: { data: Data }) {
  const years = availableYears(data);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const effectiveYear =
    selectedYear === "all" || (selectedYear && years.includes(selectedYear))
      ? selectedYear
      : (years[0] ?? "all");
  const m = monthly(data, effectiveYear);
  const max = Math.max(1, ...m.map((x) => x.inc));
  const tot = m.reduce((a, x) => ({ inc: a.inc + x.inc, out: a.out + x.out, pl: a.pl + x.pl, profit: a.profit + x.profit }), { inc: 0, out: 0, pl: 0, profit: 0 });
  return (
    <>
      <div className="flex justify-end mb-4">
        <label className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Ano:</span>
          <select
            aria-label="Selecionar ano"
            className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            value={effectiveYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="all">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </div>
      <Grid>
        <Kpi label="Receita anual" value={brl(tot.inc)} />
        <Kpi label="Despesas" value={brl(tot.out)} />
        <Kpi label="Pró-labore" value={brl(tot.pl)} />
        <Kpi label="Lucro acumulado" value={brl(tot.profit)} tone={tot.profit >= 0 ? "good" : "bad"} />
      </Grid>
      <div className="rounded-xl border bg-card p-6 mb-6 flex items-end gap-2 h-56">
        {m.map((x) => (
          <div key={x.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="w-full rounded-t bg-primary" style={{ height: `${(x.inc / max) * 85}%` }} title={brl(x.inc)} />
            <span className="text-xs text-muted-foreground">{x.month.slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <Table head={["Mês", "Entradas", "Despesas", "Pró-labore", "Lucro", "Acumulado", "Margem"]} rows={m.map((x) => [x.month, brl(x.inc), brl(x.out), brl(x.pl), brl(x.profit), brl(x.acc), pct(x.margin)])} />
    </>
  );
}
