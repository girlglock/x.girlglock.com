import { formatDate, formatNumber } from "../util/format.js";

export default class Tweet {
  constructor(data) {
    this.data = data;
  }

  static gifUrl(mp4Url) {
    return mp4Url.replace("https://video.twimg.com", "https://gif.fxtwitter.com").replace(/\.mp4(\?.*)?$/, ".gif");
  }

  get text() { return this.data.text ?? ""; }
  set text(value) { this.data.text = value; }
  get author() { return this.data.author; }
  get quote() { return this.data.quote ? new Tweet(this.data.quote) : null; }
  get verified() { return !!(this.author?.verification?.verified || this.author?.verified); }
  get photos() { return this.data.media?.photos ?? []; }
  get videos() { return this.data.media?.videos ?? []; }
  get mosaic() { return this.data.media?.mosaic ?? null; }

  get mediaItems() {
    const items = [];
    for (const vid of this.videos) {
      items.push({ type: vid.type === "gif" ? "gif" : "video", url: vid.url, thumbnail: vid.thumbnail_url, width: vid.width, height: vid.height });
    }
    for (const p of this.photos) {
      items.push({ type: "photo", url: p.url, width: p.width, height: p.height });
    }
    if (items.length === 0 && this.mosaic) {
      items.push({ type: "photo", url: this.mosaic.formats?.jpeg ?? this.mosaic.url, width: null, height: null });
    }
    return items;
  }

  get displayMedia() {
    const own = this.mediaItems;
    return own.length > 0 ? own : (this.quote?.mediaItems ?? []);
  }

  get statsLine() {
    const nbsp = String.fromCharCode(160);
    const stats = [];
    if (this.data.likes) stats.push(`❤️${nbsp}${formatNumber(this.data.likes)}`);
    const reposts = this.data.reposts ?? this.data.retweets;
    if (reposts) stats.push(`🔁${nbsp}${formatNumber(reposts)}`);
    if (this.data.replies) stats.push(`💬${nbsp}${formatNumber(this.data.replies)}`);
    if (this.data.views) stats.push(`👁${nbsp}${formatNumber(this.data.views)}`);

    const parts = [];
    if (stats.length) parts.push(stats.join("  "));
    if (this.data.created_timestamp) parts.push(formatDate(this.data.created_timestamp).replace(/ /g, nbsp));
    return parts.join(` ·${nbsp}`);
  }

  get description() {
    const parts = [];
    if (this.text) parts.push(this.text);
    const q = this.quote;
    if (q) {
      const qHandle = q.author?.screen_name ? `@${q.author.screen_name}` : "quoted tweet";
      parts.push(`↩️ ${q.text ? `${qHandle}: ${q.text}` : qHandle}`);
    }
    return parts.join("\n\n");
  }

  get communityNote() {
    const note = this.data.community_note;
    if (!note?.text) return null;

    const chars = [...note.text];
    const links = (note.entities ?? [])
      .filter(e => e.ref?.url && Number.isInteger(e.fromIndex) && e.toIndex > e.fromIndex)
      .sort((a, b) => a.fromIndex - b.fromIndex);

    const segments = [];
    let pos = 0;
    for (const link of links) {
      if (link.fromIndex < pos || link.toIndex > chars.length) continue;
      if (link.fromIndex > pos) segments.push({ text: chars.slice(pos, link.fromIndex).join("") });
      segments.push({ text: chars.slice(link.fromIndex, link.toIndex).join(""), url: link.ref.url });
      pos = link.toIndex;
    }
    if (pos < chars.length) segments.push({ text: chars.slice(pos).join("") });
    return segments;
  }
}
