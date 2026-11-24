import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TX_CATEGORIES } from "@/components/studio/dialogs";
import {
  brl,
  fdate,
  parseBatchTransactions,
  todayLocal,
  type ParsedBatchTx,
  type Tx,
} from "@/lib/store";

const fieldClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
const primaryBtn =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50";
const secondaryBtn =
  "rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer";

export function BatchImportDialog({
  open,
  onOpenChange,
  paymentMethods,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: string[];
  onImport: (items: ParsedBatchTx[]) => void;
}) {
  const [date, setDate] = useState(() => todayLocal());
  const [type, setType] = useState<Tx["type"]>("Entrada");
  const [category, setCategory] = useState("Serviços");
  const [payment, setPayment] = useState(() => paymentMethods[0] ?? "PIX");
  const [status, setStatus] = useState("Concluído");
  const [rawText, setRawText] = useState("");
  const [removedIndices, setRemovedIndices] = useState<number[]>([]);

  const effectivePayment = paymentMethods.includes(payment) ? payment : (paymentMethods[0] ?? "PIX");

  const parsed = useMemo(
    () =>
      parseBatchTransactions(rawText, {
        date,
        type,
        category,
        payment: effectivePayment,
        status,
        categories: TX_CATEGORIES,
        paymentMethods,
      }),
    [rawText, date, type, category, effectivePayment, status, paymentMethods],
  );

  const activeItems = parsed.filter((_, idx) => !removedIndices.includes(idx));
  const totalAmount = activeItems.reduce((acc, item) => acc + item.amount, 0);

  const handleTextChange = (next: string) => {
    setRawText(next);
    setRemovedIndices([]);
  };

  const handleImport = () => {
    if (activeItems.length === 0) {
      toast.error("Nenhum lançamento válido encontrado no texto colado.");
      return;
    }
    onImport(activeItems);
    setRawText("");
    setRemovedIndices([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lançamentos em lote</DialogTitle>
          <DialogDescription>
            Cole vários atendimentos ou despesas (separados por linha em branco ou <code>---</code>, ou no formato{" "}
            <code>Descrição; valor; forma</code>). Revise a prévia antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className={labelClass} htmlFor="batch-date">Data padrão</label>
              <input
                id="batch-date"
                type="date"
                className={fieldClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="batch-type">Tipo padrão</label>
              <select
                id="batch-type"
                className={fieldClass}
                value={type}
                onChange={(e) => setType(e.target.value as Tx["type"])}
              >
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="batch-cat">Categoria</label>
              <select
                id="batch-cat"
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {TX_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="batch-pay">Pagamento</label>
              <select
                id="batch-pay"
                className={fieldClass}
                value={effectivePayment}
                onChange={(e) => setPayment(e.target.value)}
              >
                {paymentMethods.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="batch-status">Status</label>
              <select
                id="batch-status"
                className={fieldClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Concluído">Pago / Concluído</option>
                <option value="Pendente">Pendente</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="batch-text">Texto dos lançamentos</label>
            <textarea
              id="batch-text"
              rows={6}
              className={`${fieldClass} font-mono text-xs`}
              placeholder={`Exemplo:\nDescrição Atendimento: Escova Médio - Maria\nServiços\nvia PIX\n+ R$ 60,00\n---\nEscova e Hidratação - Ana; 150,00; Cartão Crédito`}
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
            />
          </div>

          {parsed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Prévia: <strong className="text-foreground">{activeItems.length}</strong> lançamento(s) identificado(s)
                </span>
                <span>
                  Total: <strong className="text-foreground">{brl(totalAmount)}</strong>
                </span>
              </div>
              <div className="rounded-lg border bg-card max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground sticky top-0">
                    <tr>
                      <th className="px-2.5 py-1.5 text-left font-medium">Data</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Tipo</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Descrição</th>
                      <th className="px-2.5 py-1.5 text-left font-medium">Pagamento</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Valor</th>
                      <th className="px-2.5 py-1.5 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((item, idx) => {
                      if (removedIndices.includes(idx)) return null;
                      return (
                        <tr key={idx} className="border-t">
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{fdate(item.date)}</td>
                          <td className={`px-2.5 py-1.5 whitespace-nowrap ${item.type === "Entrada" ? "text-success" : "text-destructive"}`}>
                            {item.type}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="font-medium">{item.description}</div>
                            <div className="text-muted-foreground">{item.category}</div>
                          </td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{item.payment}</td>
                          <td className="px-2.5 py-1.5 text-right whitespace-nowrap font-medium">{brl(item.amount)}</td>
                          <td className="px-2.5 py-1.5 text-right">
                            <button
                              type="button"
                              aria-label="Remover item da prévia"
                              className="text-destructive hover:opacity-80 cursor-pointer"
                              onClick={() => setRemovedIndices((prev) => [...prev, idx])}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button type="button" className={secondaryBtn} onClick={() => onOpenChange(false)}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={activeItems.length === 0}
            className={primaryBtn}
            onClick={handleImport}
          >
            <Upload className="h-4 w-4" />
            Importar {activeItems.length > 0 ? `${activeItems.length} lançamento(s)` : ""}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
