import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { useStore, summary, monthly, brl, pct, fdate, type Data, type Tx } from "@/lib/store";

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

const TABS = ["Painel", "Fluxo de Caixa", "Estoque", "Equipe", "Pró-Labore", "Anual"] as const;
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
    if (error) return setMsg(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
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

function Studio({ userId }: { userId: string }) {
  const { data, setData, reset, ready } = useStore(userId);
  const [tab, setTab] = useState<Tab>("Painel");
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-sidebar text-sidebar-foreground md:w-60 md:min-h-screen p-5 flex md:flex-col gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sidebar-primary">Estúdio</p>
          <h1 className="text-3xl font-semibold leading-none">Geisa Lorena</h1>
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:mt-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-left whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${tab === t ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent"}`}>
              {t}
            </button>
          ))}
        </nav>
        <div className="hidden md:flex mt-auto flex-col gap-2 items-start">
          <button onClick={() => confirm("Restaurar dados originais das planilhas?") && reset()} className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground text-left">Restaurar dados da planilha</button>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground text-left">Sair</button>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="md:hidden ml-auto text-xs whitespace-nowrap">Sair</button>
      </aside>
      <main className="flex-1 min-w-0 p-5 md:p-10 max-w-6xl">
        <h2 className="text-4xl font-semibold mb-6">{tab}</h2>
        {!ready && <p className="text-muted-foreground">Carregando seus dados…</p>}
        {ready && <>
        {tab === "Painel" && <Dashboard data={data} />}
        {tab === "Fluxo de Caixa" && <Cash data={data} setData={setData} />}
        {tab === "Estoque" && <Stock data={data} setData={setData} />}
        {tab === "Equipe" && <Team data={data} setData={setData} />}
        {tab === "Pró-Labore" && <ProLabore data={data} setData={setData} />}
        {tab === "Anual" && <Annual data={data} />}
        </>}
      </main>
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" | undefined }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-primary"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">{children}</div>;
function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Bar({ value, max }: { value: number; max: number }) {
  return <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} /></div>;
}
const input = "rounded-md border bg-background px-3 py-2 text-sm";
const btn = "rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90";
const del = (onClick: () => void) => <button onClick={onClick} className="text-destructive text-xs hover:underline">remover</button>;

function Dashboard({ data }: { data: Data }) {
  const s = summary(data);
  const lines = [["Serviços de beleza", s.services], ["Venda de produtos", s.products], ["Insumos e produtos", s.supplies], ["Despesas fixas e variáveis", s.other]] as const;
  return (
    <>
      <Grid>
        <Kpi label="Receita total" value={brl(s.revenue)} hint="Faturamento bruto" />
        <Kpi label="Despesas operacionais" value={brl(s.expenses)} hint="Custos e saídas" />
        <Kpi label="Lucro líquido" value={brl(s.profit)} tone={s.profit >= 0 ? "good" : "bad"} hint="Receita − despesas" />
        <Kpi label="Margem líquida" value={pct(s.margin)} />
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
        <p className="text-sm text-muted-foreground">Meta de serviços: R$ 12.000,00 — {pct(s.services / 12000)} atingido</p>
      </div>
    </>
  );
}

const CATS = ["Serviços", "Venda Produtos", "Insumos/Produtos", "Despesas Fixas", "Infraestrutura", "Marketing"];
function Cash({ data, setData }: Props) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), type: "Entrada" as Tx["type"], category: "Serviços", description: "", amount: "", payment: "PIX" });
  const [filter, setFilter] = useState("Todos");
  const add = () => {
    if (!f.description.trim()) { toast.error("Preencha a descrição do lançamento."); return; }
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    setData((d) => ({ ...d, transactions: [...d.transactions, { ...f, amount: Number(f.amount), id: `TR-${String(d.transactions.length + 1).padStart(3, "0")}-${Date.now() % 1000}`, status: "Concluído" }] }));
    setF({ ...f, description: "", amount: "" });
    toast.success("Lançamento registrado.");
  };
  const s = summary(data);
  const list = [...data.transactions].filter((t) => filter === "Todos" || t.type === filter).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <Grid>
        <Kpi label="Entradas" value={brl(s.revenue)} tone="good" />
        <Kpi label="Saídas" value={brl(s.expenses)} tone="bad" />
        <Kpi label="Saldo" value={brl(s.profit)} />
        <Kpi label="Movimentações" value={String(data.transactions.length)} />
      </Grid>
      <div className="rounded-xl border bg-card p-4 mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className={input} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Tx["type"] })}><option>Entrada</option><option>Saída</option></select>
        <select className={input} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <input className={`${input} sm:col-span-2`} placeholder="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={input} type="number" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className={btn} onClick={add}>Lançar</button>
      </div>
      <div className="flex gap-2 mb-3">{["Todos", "Entrada", "Saída"].map((x) => <button key={x} onClick={() => setFilter(x)} className={`rounded-full px-3 py-1 text-sm border ${filter === x ? "bg-secondary font-medium" : ""}`}>{x}</button>)}</div>
      <Table head={["Data", "Tipo", "Categoria", "Descrição", "Valor", "Pagamento", ""]} rows={list.map((t) => [
        fdate(t.date), <span className={t.type === "Entrada" ? "text-success" : "text-destructive"}>{t.type}</span>, t.category, t.description, brl(t.amount), t.payment,
        del(() => setData((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== t.id) }))),
      ])} />
    </>
  );
}

function Stock({ data, setData }: Props) {
  const upd = (code: string, qty: number) => setData((d) => ({ ...d, stock: d.stock.map((i) => (i.code === code ? { ...i, qty: Math.max(0, qty) } : i)) }));
  const s = summary(data);
  return (
    <>
      <Grid>
        <Kpi label="Valor em estoque" value={brl(s.stockValue)} />
        <Kpi label="Itens cadastrados" value={String(data.stock.length)} />
        <Kpi label="Repor urgente" value={String(s.critical)} tone={s.critical ? "bad" : "good"} />
        <Kpi label="Custo médio unitário" value={brl(data.stock.reduce((a, i) => a + i.cost, 0) / (data.stock.length || 1))} />
      </Grid>
      <Table head={["Item", "Categoria", "Mín.", "Atual", "Custo un.", "Total", "Status", "Comprar"]} rows={data.stock.map((i) => [
        i.name, i.category, i.min,
        <span className="inline-flex items-center gap-2"><button className="px-2 rounded border" onClick={() => upd(i.code, i.qty - 1)}>−</button>{i.qty}<button className="px-2 rounded border" onClick={() => upd(i.code, i.qty + 1)}>+</button></span>,
        brl(i.cost), brl(i.qty * i.cost),
        i.qty <= i.min ? <span className="text-destructive font-medium">Repor urgente</span> : <span className="text-success">Regular</span>,
        Math.max(0, i.min * 2 - i.qty),
      ])} />
    </>
  );
}

function Team({ data, setData }: Props) {
  const s = summary(data);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), staff: data.staff[0]?.name ?? "", client: "", service: "", amount: "" });
  const add = () => {
    const st = data.staff.find((x) => x.name === f.staff);
    if (!st) { toast.error("Escolha a profissional."); return; }
    if (!f.service.trim()) { toast.error("Preencha o serviço realizado."); return; }
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    setData((d) => ({ ...d, services: [...d.services, { ...f, amount: Number(f.amount), rate: st.rate }] }));
    setF({ ...f, client: "", service: "", amount: "" });
    toast.success("Atendimento registrado.");
  };
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {s.team.map((t) => (
          <div key={t.name} className="rounded-xl border bg-card p-5">
            <h3 className="text-2xl font-semibold">{t.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{t.role} · comissão {pct(t.rate)}</p>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt>Salário base</dt><dd className="text-right">{brl(t.salary)}</dd>
              <dt>Serviços realizados</dt><dd className="text-right">{brl(t.billed)}</dd>
              <dt>Comissão devida</dt><dd className="text-right">{brl(t.commission)}</dd>
              <dt>Adiantamentos</dt><dd className="text-right">− {brl(t.advance)}</dd>
              <dt className="font-semibold pt-2 border-t">Líquido a pagar</dt><dd className="text-right font-semibold text-primary pt-2 border-t">{brl(t.net)}</dd>
            </dl>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4 mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <select className={input} value={f.staff} onChange={(e) => setF({ ...f, staff: e.target.value })}>{data.staff.map((x) => <option key={x.name}>{x.name}</option>)}</select>
        <input className={input} placeholder="Cliente" value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} />
        <input className={input} placeholder="Serviço" value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} />
        <input className={input} type="number" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className={btn} onClick={add}>Registrar</button>
      </div>
      <Table head={["Data", "Profissional", "Cliente", "Serviço", "Valor", "Comissão", ""]} rows={data.services.map((v, i) => [
        fdate(v.date), v.staff, v.client, v.service, brl(v.amount), brl(v.amount * v.rate),
        del(() => setData((d) => ({ ...d, services: d.services.filter((_, j) => j !== i) }))),
      ])} />
    </>
  );
}

function ProLabore({ data, setData }: Props) {
  const s = summary(data);
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), description: "", amount: "", payment: "PIX Transferência" });
  const add = () => {
    if (!(Number(f.amount) > 0)) { toast.error("Informe um valor maior que zero."); return; }
    setData((d) => ({ ...d, withdrawals: [...d.withdrawals, { ...f, description: f.description || "Retirada de pró-labore", amount: Number(f.amount), id: `PL-${Date.now()}` }] }));
    setF({ ...f, description: "", amount: "" });
    toast.success("Retirada registrada.");
  };
  const over = s.withdrawn > s.ceiling;
  return (
    <>
      <Grid>
        <Kpi label="Lucro líquido" value={brl(s.profit)} />
        <Kpi label={`Teto seguro (${pct(data.safeRate)})`} value={brl(s.ceiling)} />
        <Kpi label="Retirado no mês" value={brl(s.withdrawn)} tone={over ? "bad" : "good"} hint={over ? "Acima do teto seguro" : "Retirada saudável"} />
        <Kpi label="Disponível no teto" value={brl(s.ceiling - s.withdrawn)} hint={`Reserva do estúdio: ${brl(s.profit * (1 - data.safeRate))}`} />
      </Grid>
      <div className="rounded-xl border bg-card p-4 mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input type="date" className={input} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <input className={`${input} sm:col-span-2`} placeholder="Finalidade" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className={input} type="number" placeholder="Valor" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <button className={btn} onClick={add}>Registrar retirada</button>
      </div>
      <Table head={["Data", "Finalidade", "Valor", "Pagamento", ""]} rows={data.withdrawals.map((w) => [
        fdate(w.date), w.description, brl(w.amount), w.payment,
        del(() => setData((d) => ({ ...d, withdrawals: d.withdrawals.filter((x) => x.id !== w.id) }))),
      ])} />
    </>
  );
}

function Annual({ data }: { data: Data }) {
  const m = monthly(data);
  const max = Math.max(1, ...m.map((x) => x.inc));
  const tot = m.reduce((a, x) => ({ inc: a.inc + x.inc, out: a.out + x.out, pl: a.pl + x.pl, profit: a.profit + x.profit }), { inc: 0, out: 0, pl: 0, profit: 0 });
  return (
    <>
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
