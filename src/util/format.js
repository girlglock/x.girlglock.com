export function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeMarkdown(str) {
  if (!str) return "";
  return str
    .replace(/([\\*_~`|])/g, "\\$1")
    .replace(/^(\s*)([>#-])/gm, "$1\\$2");
}

export function formatNumber(n) {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return max <= 1 ? "" : `${str.slice(0, max - 1).trimEnd()}…`;
}
