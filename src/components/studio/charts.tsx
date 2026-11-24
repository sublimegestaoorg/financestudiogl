import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { brl, monthly, summary, type Data } from "@/lib/store";

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { formatter: (v: number) => brl(v), contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 } };
const short = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v));

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4 min-w-0"><h3 className="text-xl font-semibold mb-3">{title}</h3><div className="h-64">{children}</div></div>;
}

function group<T>(arr: T[], key: (t: T) => string, val: (t: T) => number) {
  const m = new Map<string, number>();
  for (const t of arr) m.set(key(t) || "Outros", (m.get(key(t) || "Outros") ?? 0) + val(t));
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function DashboardCharts({ data, annualData, year }: { data: Data; annualData?: Data | undefined; year?: string | undefined }) {
  const months = monthly(annualData ?? data, year).map((m) => ({ ...m, month: m.month.slice(0, 3) }));
  const active = months.filter((m) => m.inc || m.out || m.pl);
  const series = active.length ? active : months;
  const nonCancelled = data.transactions.filter((t) => t.status !== "Cancelado");
  const out = nonCancelled.filter((t) => t.type === "Saída");
  const inc = nonCancelled.filter((t) => t.type === "Entrada");
  const expCat = group(out, (t) => t.category, (t) => t.amount);
  const pay = group(inc, (t) => t.payment, (t) => t.amount);
  const team = summary(data).team.map((t) => ({ name: t.name.split(" ")[0], Faturado: t.billed, Comissão: t.commission }));
  const ax = { stroke: "var(--muted-foreground)", fontSize: 12 };
  const empty = <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período</div>;
  return (
    <div className="grid gap-4 lg:grid-cols-2 mt-6">
      <Card title="Entradas x Saídas por mês">
        <ResponsiveContainer><BarChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" {...ax} /><YAxis tickFormatter={short} {...ax} /><Tooltip {...tip} /><Legend />
          <Bar dataKey="inc" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} /><Bar dataKey="out" name="Saídas" fill="var(--destructive)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Lucro mensal e acumulado">
        <ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" {...ax} /><YAxis tickFormatter={short} {...ax} /><Tooltip {...tip} /><Legend />
          <Line dataKey="profit" name="Lucro do mês" stroke="var(--chart-1)" strokeWidth={2} /><Line dataKey="acc" name="Acumulado" stroke="var(--chart-2)" strokeWidth={2} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="Despesas por categoria">
        {expCat.length === 0 ? empty : (
          <ResponsiveContainer><PieChart><Pie data={expCat} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>{expCat.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer>
        )}
      </Card>
      <Card title="Receita por forma de pagamento">
        {pay.length === 0 ? empty : (
          <ResponsiveContainer><PieChart><Pie data={pay} dataKey="value" nameKey="name" outerRadius={85}>{pay.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer>
        )}
      </Card>
      <Card title="Desempenho da equipe">
        {team.length === 0 ? empty : (
          <ResponsiveContainer><BarChart data={team}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" {...ax} /><YAxis tickFormatter={short} {...ax} /><Tooltip {...tip} /><Legend />
            <Bar dataKey="Faturado" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /><Bar dataKey="Comissão" fill="var(--chart-2)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
