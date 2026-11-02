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

const WIDE_CHAR = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const ZERO_WIDTH = /\p{Mark}|‍/u;

export function displayWidth(str) {
  let width = 0;
  for (const ch of str) {
    if (ZERO_WIDTH.test(ch)) continue;
    width += WIDE_CHAR.test(ch) ? 2 : 1;
  }
  return width;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function truncateToWidth(str, maxWidth) {
  if (displayWidth(str) <= maxWidth) return str;
  let out = "";
  for (const { segment } of graphemes.segment(str)) {
    if (displayWidth(out + segment) + 1 > maxWidth) break;
    out += segment;
  }
  return `${out.trimEnd()}…`;
}

export function wrapText(text, maxWidth) {
  if (!text || !maxWidth) return text;
  return text.split("\n").map(line => {
    const lines = [];
    let current = "";
    let gap = "";
    for (const part of line.split(/( +)/)) {
      if (!part) continue;
      if (part.trim() === "") { gap = part; continue; }
      const candidate = current ? current + gap + part : gap + part;
      if (current && displayWidth(candidate) > maxWidth) {
        lines.push(current);
        current = part;
      } else {
        current = candidate;
      }
      gap = "";
    }
    lines.push(current);
    return lines.join("\n");
  }).join("\n");
}

export function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return max <= 1 ? "" : `${str.slice(0, max - 1).trimEnd()}…`;
}
