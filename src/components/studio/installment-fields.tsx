import { Checkbox } from "@/components/ui/checkbox";

export function InstallmentFields({ id, parcelled, months, onParcelledChange, onMonthsChange }: {
  id: string;
  parcelled: boolean;
  months: string;
  onParcelledChange: (value: boolean) => void;
  onMonthsChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:col-span-2 lg:col-span-full">
      <div className="flex items-center gap-2 min-h-10">
        <Checkbox id={`${id}-parcelled`} checked={parcelled} onCheckedChange={(checked) => onParcelledChange(checked === true)} />
        <label htmlFor={`${id}-parcelled`} className="text-sm font-medium cursor-pointer">Conta parcelada</label>
      </div>
      {parcelled && (
        <div className="min-w-0">
          <label htmlFor={`${id}-months`} className="block text-xs font-medium text-muted-foreground mb-1">Meses restantes (incluindo esta parcela)</label>
          <input id={`${id}-months`} type="number" min="1" step="1" required value={months}
            onChange={(event) => onMonthsChange(event.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
      )}
    </div>
  );
}