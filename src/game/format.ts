export function formatMoney(pounds: number): string {
  const sign = pounds < 0 ? "-" : "";
  const abs = Math.abs(pounds);
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1000)}K`;
  return `${sign}£${Math.round(abs)}`;
}

export function formatWage(pounds: number): string {
  return `£${Math.round(pounds).toLocaleString("en-GB")}/wk`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function ageLabel(age: number): string {
  return `${age}`;
}
