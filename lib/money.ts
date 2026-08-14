/** Money is integer cents everywhere (CLAUDE.md convention). */

export function formatCents(cents: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = String(abs % 100).padStart(2, "0");
  const body = `$${dollars.toLocaleString("en-CA")}.${rem}`;
  if (cents < 0) return `−${body}`;
  return opts.sign ? `+${body}` : body;
}

/** Whole-dollar display for caps and summaries: $1,200 */
export function formatCentsWhole(cents: number): string {
  const neg = cents < 0;
  const dollars = Math.round(Math.abs(cents) / 100);
  return `${neg ? "−" : ""}$${dollars.toLocaleString("en-CA")}`;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function monthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "short",
    timeZone: "UTC",
  });
}

export function dayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
