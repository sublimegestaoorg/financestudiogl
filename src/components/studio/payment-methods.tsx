import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/studio/dialogs";
import {
  addPaymentMethod,
  brl,
  deletePaymentMethod,
  getPaymentMethods,
  updatePaymentMethod,
  type Data,
} from "@/lib/store";

type Props = {
  data: Data;
  setData: (f: (d: Data) => Data) => void;
  showStats?: boolean;
};

export function PaymentMethodsManager({ data, setData, showStats = false }: Props) {
  const methods = getPaymentMethods(data);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingName, setDeletingName] = useState<string | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("Informe o nome da forma de pagamento.");
      return;
    }
    if (methods.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Essa forma de pagamento já está cadastrada.");
      return;
    }
    setData((d) => addPaymentMethod(d, trimmed));
    setNewName("");
    toast.success("Forma de pagamento adicionada.");
  };

  const startEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
  };

  const saveEdit = (originalName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) {
      toast.error("Informe um nome válido.");
      return;
    }
    if (methods.some((m) => m !== originalName && m.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe outra forma de pagamento com esse nome.");
      return;
    }
    setData((d) => updatePaymentMethod(d, originalName, trimmed));
    setEditingName(null);
    setEditValue("");
    toast.success("Forma de pagamento atualizada.");
  };

  const usageFor = (name: string) => {
    const txs = data.transactions.filter((t) => t.payment === name);
    const wds = data.withdrawals.filter((w) => w.payment === name);
    const inc = txs.filter((t) => t.type === "Entrada").reduce((a, t) => a + t.amount, 0);
    const out =
      txs.filter((t) => t.type === "Saída").reduce((a, t) => a + t.amount, 0) +
      wds.reduce((a, w) => a + w.amount, 0);
    return { count: txs.length + wds.length, inc, out };
  };

  const deletingUsage = deletingName ? usageFor(deletingName).count : 0;

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Nova forma (ex.: Cartão Crédito 2x, Link de Pagamento, PicPay...)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      {methods.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma forma de pagamento cadastrada. Adicione uma opção acima.
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Forma de pagamento</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Uso</th>
                {showStats && (
                  <>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Entradas</th>
                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Saídas / Retiradas</th>
                  </>
                )}
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((method) => {
                const stats = usageFor(method);
                const isEditing = editingName === method;
                return (
                  <tr key={method} className="border-t">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          className="w-full min-w-40 rounded-md border bg-background px-2.5 py-1 text-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              saveEdit(method);
                            } else if (e.key === "Escape") {
                              setEditingName(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium">{method}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {stats.count === 1 ? "1 lançamento" : `${stats.count} lançamentos`}
                    </td>
                    {showStats && (
                      <>
                        <td className="px-3 py-2 text-success whitespace-nowrap">{brl(stats.inc)}</td>
                        <td className="px-3 py-2 text-destructive whitespace-nowrap">{brl(stats.out)}</td>
                      </>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {isEditing ? (
                        <span className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(method)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingName(null)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(method)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingName(method)}
                            className="inline-flex items-center gap-1 text-xs text-destructive hover:underline cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDeleteDialog
        open={Boolean(deletingName)}
        onOpenChange={(open) => !open && setDeletingName(null)}
        title={`Excluir "${deletingName ?? ""}"?`}
        description={
          deletingUsage > 0
            ? `Esta forma de pagamento aparece em ${deletingUsage} registro(s). Os lançamentos existentes continuarão no histórico, mas a opção sairá das novas seleções.`
            : "Esta forma de pagamento será removida da lista de opções disponíveis."
        }
        onConfirm={() => {
          if (!deletingName) return;
          setData((d) => deletePaymentMethod(d, deletingName));
          setDeletingName(null);
          toast.success("Forma de pagamento excluída.");
        }}
      />
    </div>
  );
}

export function PaymentMethodsDialog({
  open,
  onOpenChange,
  data,
  setData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Data;
  setData: (f: (d: Data) => Data) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Formas de pagamento</DialogTitle>
          <DialogDescription>
            Adicione, renomeie ou remova as formas de pagamento usadas nos lançamentos e retiradas.
          </DialogDescription>
        </DialogHeader>
        <PaymentMethodsManager data={data} setData={setData} />
      </DialogContent>
    </Dialog>
  );
}
