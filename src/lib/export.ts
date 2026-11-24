function escapeCsvCell(value: string | number): string {
  const s = String(value ?? "");
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(";");
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(";"));
  return `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}`;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const csv = toCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string | number): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function printReport({
  title,
  subtitle,
  kpis,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string | undefined;
  kpis?: { label: string; value: string }[] | undefined;
  headers: string[];
  rows: (string | number)[][];
}): boolean {
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return false;
  const generatedAt = new Date().toLocaleString("pt-BR");
  const kpiHtml = kpis?.length
    ? `<div class="kpis">${kpis
        .map(
          (k) =>
            `<div class="kpi"><div class="kpi-label">${escapeHtml(k.label)}</div><div class="kpi-value">${escapeHtml(k.value)}</div></div>`,
        )
        .join("")}</div>`
    : "";
  const headHtml = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const bodyHtml = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} — Estúdio Geisa Lorena</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #2b211f; margin: 28px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    .sub { color: #6b5b55; font-size: 13px; margin-bottom: 18px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 18px; }
    .kpi { border: 1px solid #e4dad4; border-radius: 8px; padding: 10px 12px; background: #fcf9f6; }
    .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #7a6861; }
    .kpi-value { font-size: 18px; font-weight: 600; margin-top: 4px; color: #7f4338; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px solid #e7dfd9; padding: 7px 8px; text-align: left; }
    th { background: #f4eee8; font-weight: 600; }
    .footer { margin-top: 18px; font-size: 11px; color: #7a6861; }
    @media print { body { margin: 14px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)} — Estúdio Geisa Lorena</h1>
  <div class="sub">${escapeHtml(subtitle ?? "")}${subtitle ? " · " : ""}Gerado em ${escapeHtml(generatedAt)}</div>
  ${kpiHtml}
  <table>
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  <div class="footer">Total de registros: ${rows.length}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
  win.document.close();
  return true;
}
