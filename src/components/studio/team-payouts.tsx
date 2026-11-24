import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Pencil, Plus, Search, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/studio/dialogs";
import {
  addStaffPayout,
  brl,
  deleteStaffPayout,
  fdate,
  formatYearMonth,
  getPaymentMethods,
  getStaffPayouts,
  getWeekBounds,
  payoutsInPeriod,
  todayLocal,
  updateStaffPayout,
  weeklyCommissionBreakdown,
  type Data,
  type PayoutKind,
  type PayoutPeriodType,
  type StaffPayout,
} from "@/lib/store";

export const PAYOUT_KINDS: PayoutKind[] = [
  "Comissão",
  "Salário",
  "Comissão + Salário",
  "Adiantamento",
];

export type PayoutPrefill = {
  staff?: string | undefined;
  kind?: PayoutKind | undefined;
  periodType?: PayoutPeriodType | undefined;
  periodDate?: string | undefined;
  periodLabel?: string | undefined;
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  amount?: number | undefined;
};

const fieldClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer";
const secondaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted cursor-pointer";

function monthBounds(ym: string): { start: string; end: string; label: string } {
  const parts = ym.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? 1;
  const lastDay = new Date(year, month, 0).getDate();
  const mStr = String(month).padStart(2, "0");
  return {
    start: `${year}-${mStr}-01`,
    end: `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    label: formatYearMonth(`${year}-${mStr}`),
  };
}

export function StaffPayoutDialog({
  open,
  onOpenChange,
  editing,
  prefill,
  staffNames,
  paymentMethods,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StaffPayout | null;
  prefill: PayoutPrefill | null;
  staffNames: string[];
  paymentMethods: string[];
  onSave: (editingId: string | null, payout: Omit<StaffPayout, "id">, syncCash: boolean) => void;
}) {
  const [date, setDate] = useState(() => todayLocal());
  const [staff, setStaff] = useState("");
  const [kind, setKind] = useState<PayoutKind>("Comissão");
  const [periodType, setPeriodType] = useState<PayoutPeriodType>("Semana");
  const [weekRefDate, setWeekRefDate] = useState(() => todayLocal());
  const [monthRef, setMonthRef] = useState(() => todayLocal().slice(0, 7));
  const [periodLabel, setPeriodLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState(() => paymentMethods[0] ?? "PIX");
  const [notes, setNotes] = useState("");
  const [syncCash, setSyncCash] = useState(true);

  useEffect(() => {
    if (!open) return;
    const today = todayLocal();
    if (editing) {
      setDate(editing.date);
      setStaff(editing.staff);
      setKind(editing.kind);
      setPeriodType(editing.periodType);
      setWeekRefDate(editing.periodStart ?? editing.date);
      setMonthRef((editing.periodStart ?? editing.date).slice(0, 7));
      setPeriodLabel(editing.periodLabel);
      setAmount(String(editing.amount));
      setPayment(editing.payment);
      setNotes(editing.notes ?? "");
      setSyncCash(false);
    } else {
      const pType: PayoutPeriodType = prefill?.periodType ?? "Semana";
      const refDate = prefill?.periodStart ?? prefill?.periodDate ?? today;
      setDate(today);
      setStaff(prefill?.staff ?? staffNames[0] ?? "");
      setKind(prefill?.kind ?? "Comissão");
      setPeriodType(pType);
      setWeekRefDate(refDate);
      setMonthRef(refDate.slice(0, 7));
      if (prefill?.periodLabel) {
        setPeriodLabel(prefill.periodLabel);
      } else if (pType === "Semana") {
        setPeriodLabel(getWeekBounds(refDate).label);
      } else {
        setPeriodLabel(monthBounds(refDate.slice(0, 7)).label);
      }
      setAmount(prefill?.amount && prefill.amount > 0 ? String(Number(prefill.amount.toFixed(2))) : "");
      setPayment(paymentMethods[0] ?? "PIX");
      setNotes("");
      setSyncCash(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, prefill]);

  const handlePeriodTypeChange = (nextType: PayoutPeriodType) => {
    setPeriodType(nextType);
    if (nextType === "Semana") {
      setPeriodLabel(getWeekBounds(weekRefDate).label);
    } else {
      setPeriodLabel(monthBounds(monthRef).label);
    }
  };

  const staffOptions = Array.from(new Set([...(staff ? [staff] : []), ...staffNames]));
  const paymentOptions = Array.from(new Set([...(payment ? [payment] : []), ...paymentMethods]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!staff.trim()) {
      toast.error("Escolha a profissional.");
      return;
    }
    const parsedAmount = Number(amount);
    if (!(parsedAmount > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (!payment.trim()) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    const bounds = periodType === "Semana" ? getWeekBounds(weekRefDate) : monthBounds(monthRef);
    onSave(
      editing ? editing.id : null,
      {
        date,
        staff,
        kind,
        periodType,
        periodLabel: periodLabel.trim() || bounds.label,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        amount: parsedAmount,
        payment,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      editing ? false : syncCash,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar pagamento da profissional" : "Registrar pagamento / repasse"}</DialogTitle>
          <DialogDescription>
            Informe o mês ou a semana referente ao pagamento de comissão ou salário para manter o histórico exato de repasses.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="payout-staff">Profissional</label>
              <select id="payout-staff" className={fieldClass} value={staff} onChange={(e) => setStaff(e.target.value)}>
                {staffOptions.length === 0 && <option value="">Cadastre uma profissional</option>}
                {staffOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="payout-kind">Tipo de pagamento</label>
              <select
                id="payout-kind"
                className={fieldClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as PayoutKind)}
              >
                {PAYOUT_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="payout-ptype">Referência</label>
              <select
                id="payout-ptype"
                className={fieldClass}
                value={periodType}
                onChange={(e) => handlePeriodTypeChange(e.target.value as PayoutPeriodType)}
              >
                <option value="Semana">Semana</option>
                <option value="Mês">Mês</option>
              </select>
            </div>
            {periodType === "Semana" ? (
              <div>
                <label className={labelClass} htmlFor="payout-week-date">Dia dentro da semana</label>
                <input
                  id="payout-week-date"
                  type="date"
                  className={fieldClass}
                  value={weekRefDate}
                  onChange={(e) => {
                    const next = e.target.value;
                    setWeekRefDate(next);
                    if (next) setPeriodLabel(getWeekBounds(next).label);
                  }}
                />
              </div>
            ) : (
              <div>
                <label className={labelClass} htmlFor="payout-month-ref">Mês de referência</label>
                <input
                  id="payout-month-ref"
                  type="month"
                  className={fieldClass}
                  value={monthRef}
                  onChange={(e) => {
                    const next = e.target.value;
                    setMonthRef(next);
                    if (next) setPeriodLabel(monthBounds(next).label);
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass} htmlFor="payout-label">Descrição do período pago</label>
            <input
              id="payout-label"
              className={fieldClass}
              placeholder="Ex.: 16/11 a 22/11/2026 ou Novembro/2026"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="payout-date">Data do pagamento</label>
              <input id="payout-date" type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="payout-amount">Valor pago (R$)</label>
              <input id="payout-amount" type="number" step="0.01" min="0.01" className={fieldClass} placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="payout-payment">Forma de pagamento</label>
              <select id="payout-payment" className={fieldClass} value={payment} onChange={(e) => setPayment(e.target.value)}>
                {paymentOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="payout-notes">Observações (opcional)</label>
            <input
              id="payout-notes"
              className={fieldClass}
              placeholder="Ex.: Transferido via PIX, comprovante no WhatsApp..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {!editing && (
            <div className="flex items-center gap-2">
              <Checkbox id="payout-sync-cash" checked={syncCash} onCheckedChange={(c) => setSyncCash(c === true)} />
              <label htmlFor="payout-sync-cash" className="text-sm cursor-pointer">
                Lançar saída automaticamente no Fluxo de Caixa
              </label>
            </div>
          )}

          <DialogFooter className="gap-2">
            <button type="button" className={secondaryBtn} onClick={() => onOpenChange(false)}>
              Cancelar
            </button>
            <button type="submit" className={primaryBtn}>
              {editing ? "Salvar alterações" : "Confirmar pagamento"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamPayoutsSection({
  data,
  setData,
  selectedMonth,
  selectedStaff,
  onOpenPay,
}: {
  data: Data;
  setData: (f: (d: Data) => Data) => void;
  selectedMonth: string;
  selectedStaff: string;
  onOpenPay: (prefill: PayoutPrefill) => void;
}) {
  const [kindFilter, setKindFilter] = useState<string>("Todos");
  const [periodTypeFilter, setPeriodTypeFilter] = useState<string>("Todos");
  const [search, setSearch] = useState("");
  const [editingPayout, setEditingPayout] = useState<StaffPayout | null>(null);
  const [deletingPayout, setDeletingPayout] = useState<StaffPayout | null>(null);

  const paymentMethods = getPaymentMethods(data);
  const allPayouts = getStaffPayouts(data);
  const scopedServices =
    selectedMonth === "all"
      ? data.services
      : data.services.filter((v) => v.date.startsWith(selectedMonth));
  const scopedPayouts = payoutsInPeriod(allPayouts, selectedMonth);

  const weeklyRows = weeklyCommissionBreakdown(scopedServices, allPayouts, selectedStaff);

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredPayouts = [...scopedPayouts]
    .filter((p) => {
      if (selectedStaff !== "Todos" && p.staff !== selectedStaff) return false;
      if (kindFilter !== "Todos" && p.kind !== kindFilter) return false;
      if (periodTypeFilter !== "Todos" && p.periodType !== periodTypeFilter) return false;
      if (search.trim()) {
        const q = norm(search.trim());
        const hay = norm(`${p.staff} ${p.kind} ${p.periodType} ${p.periodLabel} ${p.payment} ${p.notes ?? ""} ${fdate(p.date)} ${brl(p.amount)}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalPaidFiltered = filteredPayouts.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-8 mt-10">
      {/* 1. Resumo semanal de comissões */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-2xl font-semibold">Repasse semanal de comissões</h3>
            <p className="text-sm text-muted-foreground">
              Veja exatamente quanto cada profissional gerou por semana, quanto já foi repassado e o saldo pendente.
            </p>
          </div>
        </div>
        {weeklyRows.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum atendimento no período para calcular comissões semanais.
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Semana</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Profissional</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Atend.</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Faturado</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Comissão</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Já pago</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">A repassar</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Status</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap sticky right-0 bg-muted">Ação</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map((row) => (
                  <tr key={row.key} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{row.label}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.staff}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.count}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{brl(row.billed)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{brl(row.commission)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-success">{brl(row.paid)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap font-semibold ${row.remaining > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {brl(row.remaining)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.status === "Pago" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" />
                          Pago
                        </span>
                      ) : row.status === "Parcial" ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 text-xs font-medium">
                          Parcial
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-destructive/15 text-destructive px-2.5 py-0.5 text-xs font-medium">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right sticky right-0 bg-card">
                      {row.remaining > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPay({
                              staff: row.staff,
                              kind: "Comissão",
                              periodType: "Semana",
                              periodStart: row.weekStart,
                              periodEnd: row.weekEnd,
                              periodLabel: row.label,
                              amount: row.remaining,
                            })
                          }
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          Pagar semana
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Quitado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Histórico de pagamentos (Comissões e Salários por Mês ou Semana) */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-2xl font-semibold">Pagamentos realizados (Comissões e Salários)</h3>
            <p className="text-sm text-muted-foreground">
              Histórico do mês ou semana em que cada comissão, salário ou adiantamento foi pago.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenPay({
                staff: selectedStaff !== "Todos" ? selectedStaff : data.staff[0]?.name,
                kind: "Comissão",
                periodType: selectedMonth === "all" ? "Semana" : "Mês",
                periodDate: selectedMonth === "all" ? todayLocal() : `${selectedMonth}-01`,
              })
            }
            className={primaryBtn}
          >
            <Plus className="h-4 w-4" />
            Registrar pagamento
          </button>
        </div>

        <div className="rounded-xl border bg-card p-4 mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-52">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Pesquisar pagamentos da equipe"
              className="w-full rounded-md border bg-background pl-9 pr-8 py-2 text-sm"
              placeholder="Pesquisar por profissional, semana/mês, forma ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                aria-label="Limpar pesquisa de pagamentos"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <select
            aria-label="Filtrar por tipo de pagamento"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
          >
            <option value="Todos">Todos os tipos</option>
            {PAYOUT_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <select
            aria-label="Filtrar por referência semanal ou mensal"
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={periodTypeFilter}
            onChange={(e) => setPeriodTypeFilter(e.target.value)}
          >
            <option value="Todos">Semana e Mês</option>
            <option value="Semana">Somente Semana</option>
            <option value="Mês">Somente Mês</option>
          </select>
          <span className="text-xs text-muted-foreground ml-auto">
            Total pago: <strong className="text-foreground">{brl(totalPaidFiltered)}</strong>
          </span>
        </div>

        {filteredPayouts.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum pagamento registrado para os filtros atuais. Clique em &quot;Registrar pagamento&quot; ou &quot;Pagar semana&quot; acima.
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Data pgto.</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Profissional</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Período pago</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Valor</th>
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Pagamento</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap sticky right-0 bg-muted">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{fdate(p.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{p.staff}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.kind}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
                          {p.periodType}
                        </span>
                        <span className="whitespace-nowrap">{p.periodLabel}</span>
                      </div>
                      {p.notes && <div className="text-xs text-muted-foreground mt-0.5">{p.notes}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-success">{brl(p.amount)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.payment}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right sticky right-0 bg-card">
                      <span className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingPayout(p)}
                          className="inline-flex items-center gap-1 text-primary text-xs hover:underline cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPayout(p)}
                          className="inline-flex items-center gap-1 text-destructive text-xs hover:underline cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <StaffPayoutDialog
        open={Boolean(editingPayout)}
        onOpenChange={(open) => !open && setEditingPayout(null)}
        editing={editingPayout}
        prefill={null}
        staffNames={data.staff.map((s) => s.name)}
        paymentMethods={paymentMethods}
        onSave={(editingId, payout, syncCash) => {
          if (editingId) {
            setData((d) => updateStaffPayout(d, editingId, payout));
            toast.success("Pagamento atualizado.");
          } else {
            setData((d) => addStaffPayout(d, payout, syncCash));
            toast.success("Pagamento registrado.");
          }
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingPayout)}
        onOpenChange={(open) => !open && setDeletingPayout(null)}
        title="Excluir pagamento registrado?"
        description={
          deletingPayout
            ? `Remover o pagamento de ${deletingPayout.kind} para ${deletingPayout.staff} (${brl(deletingPayout.amount)} — ${deletingPayout.periodLabel})?`
            : ""
        }
        onConfirm={() => {
          if (!deletingPayout) return;
          setData((d) => deleteStaffPayout(d, deletingPayout.id));
          setDeletingPayout(null);
          toast.success("Pagamento excluído.");
        }}
      />
    </div>
  );
}
