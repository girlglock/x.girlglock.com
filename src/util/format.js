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

export function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return `${date} UTC`;
}

export function discordTimestamp(timestamp) {
  return `<t:${timestamp}:f>`;
}

const WIDE_CHAR = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const ZERO_WIDTH = /\p{Mark}|\u200d/u;

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
