import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nextStockCode, type Item, type Staff, type Tx } from "@/lib/store";

export const TX_CATEGORIES = [
  "Serviços",
  "Venda Produtos",
  "Insumos/Produtos",
  "Despesas Fixas",
  "Infraestrutura",
  "Marketing",
  "Comissão",
  "Pró-Labore",
];

export const TX_STATUSES = ["Concluído", "Pago", "Pendente", "Cancelado"];

export const DEFAULT_STOCK_CATEGORIES = [
  "Colorimetria",
  "Tratamento Capilar",
  "Nail Care",
  "Descartáveis",
  "Home Care",
];

const fieldClass = "w-full rounded-md border bg-background px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
const primaryBtn =
  "rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 cursor-pointer";
const secondaryBtn =
  "rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer";

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onOpenChange(false);
            }}
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TransactionEditDialog({
  tx,
  open,
  onOpenChange,
  paymentMethods,
  onSave,
}: {
  tx: Tx | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentMethods: string[];
  onSave: (id: string, updated: Omit<Tx, "id">) => void;
}) {
  const [date, setDate] = useState("");
  const [type, setType] = useState<Tx["type"]>("Entrada");
  const [category, setCategory] = useState("Serviços");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("");
  const [status, setStatus] = useState("Concluído");

  useEffect(() => {
    if (open && tx) {
      setDate(tx.date);
      setType(tx.type);
      setCategory(tx.category);
      setDescription(tx.description);
      setAmount(String(tx.amount));
      setPayment(tx.payment);
      setStatus(tx.status || "Concluído");
    }
  }, [open, tx]);

  const categories =
    category && !TX_CATEGORIES.includes(category) ? [category, ...TX_CATEGORIES] : TX_CATEGORIES;
  const payments =
    payment && !paymentMethods.includes(payment) ? [payment, ...paymentMethods] : paymentMethods;
  const statuses = status && !TX_STATUSES.includes(status) ? [status, ...TX_STATUSES] : TX_STATUSES;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!tx) return;
    if (!date) {
      toast.error("Informe a data do lançamento.");
      return;
    }
    if (!description.trim()) {
      toast.error("Preencha a descrição do lançamento.");
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
    onSave(tx.id, {
      date,
      type,
      category,
      description: description.trim(),
      amount: parsedAmount,
      payment,
      status,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>Atualize os dados da movimentação no fluxo de caixa.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="tx-edit-date">Data</label>
              <input
                id="tx-edit-date"
                type="date"
                className={fieldClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="tx-edit-type">Tipo</label>
              <select
                id="tx-edit-type"
                className={fieldClass}
                value={type}
                onChange={(e) => setType(e.target.value as Tx["type"])}
              >
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="tx-edit-category">Categoria</label>
              <select
                id="tx-edit-category"
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="tx-edit-payment">Forma de pagamento</label>
              <select
                id="tx-edit-payment"
                className={fieldClass}
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
              >
                {payments.length === 0 && <option value="">Sem formas cadastradas</option>}
                {payments.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="tx-edit-description">Descrição</label>
            <input
              id="tx-edit-description"
              className={fieldClass}
              placeholder="Descrição do lançamento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="tx-edit-amount">Valor (R$)</label>
              <input
                id="tx-edit-amount"
                type="number"
                step="0.01"
                min="0.01"
                className={fieldClass}
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="tx-edit-status">Status</label>
              <select
                id="tx-edit-status"
                className={fieldClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={secondaryBtn} onClick={() => onOpenChange(false)}>
              Cancelar
            </button>
            <button type="submit" className={primaryBtn}>
              Salvar alterações
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StockItemDialog({
  item,
  open,
  onOpenChange,
  existingStock,
  onSave,
  onDelete,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStock: Item[];
  onSave: (originalCode: string | null, item: Item) => void;
  onDelete?: (item: Item) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [min, setMin] = useState("0");
  const [qty, setQty] = useState("0");
  const [cost, setCost] = useState("0");

  useEffect(() => {
    if (open) {
      if (item) {
        setCode(item.code);
        setName(item.name);
        setCategory(item.category);
        setMin(String(item.min));
        setQty(String(item.qty));
        setCost(String(item.cost));
      } else {
        setCode(nextStockCode(existingStock));
        setName("");
        setCategory("");
        setMin("2");
        setQty("0");
        setCost("");
      }
    }
    // Only reset the form when the dialog opens or the edited item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  const categorySuggestions = Array.from(
    new Set([...DEFAULT_STOCK_CATEGORIES, ...existingStock.map((i) => i.category).filter(Boolean)]),
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do item.");
      return;
    }
    const finalCode = code.trim() || nextStockCode(existingStock);
    const duplicateCode = existingStock.some(
      (i) => i.code.toLowerCase() === finalCode.toLowerCase() && i.code !== item?.code,
    );
    if (duplicateCode) {
      toast.error("Já existe um item com esse código.");
      return;
    }
    const parsedMin = Number(min);
    const parsedQty = Number(qty);
    const parsedCost = Number(cost);
    if (Number.isNaN(parsedMin) || parsedMin < 0) {
      toast.error("A quantidade mínima não pode ser negativa.");
      return;
    }
    if (Number.isNaN(parsedQty) || parsedQty < 0) {
      toast.error("A quantidade atual não pode ser negativa.");
      return;
    }
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      toast.error("O custo unitário não pode ser negativo.");
      return;
    }
    onSave(item ? item.code : null, {
      code: finalCode,
      name: trimmedName,
      category: category.trim() || "Geral",
      min: parsedMin,
      qty: parsedQty,
      cost: parsedCost,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item do estoque" : "Novo item do estoque"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Atualize os detalhes, quantidades ou custo unitário do produto."
              : "Cadastre um novo produto ou insumo no estoque do estúdio."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="stock-code">Código</label>
              <input
                id="stock-code"
                className={fieldClass}
                placeholder="EST-019"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="stock-category">Categoria</label>
              <input
                id="stock-category"
                list="stock-category-options"
                className={fieldClass}
                placeholder="Ex.: Colorimetria, Nail Care..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="stock-category-options">
                {categorySuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className={labelClass} htmlFor="stock-name">Nome do item</label>
            <input
              id="stock-name"
              className={fieldClass}
              placeholder="Ex.: Máscara Hidratação 500g"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="stock-min">Estoque mínimo</label>
              <input
                id="stock-min"
                type="number"
                min="0"
                step="1"
                className={fieldClass}
                value={min}
                onChange={(e) => setMin(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="stock-qty">Quantidade atual</label>
              <input
                id="stock-qty"
                type="number"
                min="0"
                step="1"
                className={fieldClass}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="stock-cost">Custo un. (R$)</label>
              <input
                id="stock-cost"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                placeholder="0,00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {item && onDelete ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(item);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Excluir item
              </button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" className={secondaryBtn} onClick={() => onOpenChange(false)}>
                Cancelar
              </button>
              <button type="submit" className={primaryBtn}>
                {item ? "Salvar alterações" : "Adicionar item"}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function StaffDialog({
  member,
  open,
  onOpenChange,
  existingStaff,
  onSave,
}: {
  member: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingStaff: Staff[];
  onSave: (originalName: string | null, member: Staff) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [advance, setAdvance] = useState("0");

  useEffect(() => {
    if (open) {
      if (member) {
        setName(member.name);
        setRole(member.role);
        setSalary(String(member.salary));
        setRatePercent(String(Number((member.rate * 100).toFixed(2))));
        setAdvance(String(member.advance));
      } else {
        setName("");
        setRole("");
        setSalary("");
        setRatePercent("25");
        setAdvance("0");
      }
    }
  }, [open, member]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Informe o nome do funcionário.");
      return;
    }
    const duplicate = existingStaff.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.name !== member?.name,
    );
    if (duplicate) {
      toast.error("Já existe um funcionário cadastrado com esse nome.");
      return;
    }
    const parsedSalary = Number(salary || 0);
    const parsedRate = Number(ratePercent || 0);
    const parsedAdvance = Number(advance || 0);
    if (Number.isNaN(parsedSalary) || parsedSalary < 0) {
      toast.error("O salário base não pode ser negativo.");
      return;
    }
    if (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      toast.error("A comissão deve ficar entre 0% e 100%.");
      return;
    }
    if (Number.isNaN(parsedAdvance) || parsedAdvance < 0) {
      toast.error("Os adiantamentos não podem ser negativos.");
      return;
    }
    onSave(member ? member.name : null, {
      name: trimmedName,
      role: role.trim() || "Profissional",
      salary: parsedSalary,
      rate: parsedRate / 100,
      advance: parsedAdvance,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Atualize os dados cadastrais, salário, comissão e adiantamentos."
              : "Cadastre um novo membro da equipe para controle de folha e comissões."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="staff-name">Nome completo</label>
              <input
                id="staff-name"
                className={fieldClass}
                placeholder="Ex.: Juliana Costa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="staff-role">Cargo / Função</label>
              <input
                id="staff-role"
                className={fieldClass}
                placeholder="Ex.: Cabeleireira, Manicure..."
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="staff-salary">Salário base (R$)</label>
              <input
                id="staff-salary"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                placeholder="0,00"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="staff-rate">Comissão (%)</label>
              <input
                id="staff-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                className={fieldClass}
                placeholder="25"
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="staff-advance">Adiantamentos (R$)</label>
              <input
                id="staff-advance"
                type="number"
                min="0"
                step="0.01"
                className={fieldClass}
                placeholder="0,00"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <button type="button" className={secondaryBtn} onClick={() => onOpenChange(false)}>
              Cancelar
            </button>
            <button type="submit" className={primaryBtn}>
              {member ? "Salvar alterações" : "Adicionar funcionário"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
