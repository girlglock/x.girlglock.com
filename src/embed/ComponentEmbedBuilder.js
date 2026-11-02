import Tweet from "../twitter/Tweet.js";
import { escapeMarkdown, truncate, wrapText } from "../util/format.js";

const MAX_BYTES = 3000;
const MAX_MEDIA = 10;
const ACCENT_COLOR = 0x1D9BF0;

const MEDIA_MAX_HEIGHT_PX = 350;
const CONTENT_MAX_WIDTH_PX = 480;
const TEXT_CHAR_PX = 7.5;
const SUBTEXT_CHAR_PX = 6;
const QUOTE_INDENT_PX = 16;
const MIN_WRAP_WIDTH = 20;

export default class ComponentEmbedBuilder {
  constructor({ tweet, originalUrl }) {
    this.tweet = tweet;
    this.originalUrl = originalUrl;
    this.mediaWidth = this.#narrowMediaWidth();
  }

  build() {
    let text = this.tweet.text;
    let quoteText = this.tweet.quote?.text ?? "";

    for (let i = 0; i < 20; i++) {
      const json = this.#serialize(this.#components(text, quoteText));
      const over = Buffer.byteLength(json) - MAX_BYTES;
      if (over <= 0) return json;
      const cut = Math.ceil(over / 2) + 8;
      if (quoteText) quoteText = truncate(quoteText, quoteText.length - cut);
      else if (text) text = truncate(text, text.length - cut);
      else return null;
    }
    return null;
  }

  #narrowMediaWidth() {
    const media = this.tweet.displayMedia;
    if (media.length !== 1) return null;
    const { width, height } = media[0];
    if (!width || !height) return null;
    const shown = Math.min(width, CONTENT_MAX_WIDTH_PX, MEDIA_MAX_HEIGHT_PX * width / height);
    return shown < CONTENT_MAX_WIDTH_PX ? shown : null;
  }

  #wrap(text, charPx, indentPx = 0) {
    if (!this.mediaWidth) return text;
    return wrapText(text, Math.max(MIN_WRAP_WIDTH, Math.floor((this.mediaWidth - indentPx) / charPx)));
  }

  #quoteBlock(text) {
    return `> ${text}`.replace(/\n/g, "\n> ");
  }

  #components(text, quoteText) {
    const { tweet } = this;
    const author = tweet.author;
    const profileUrl = `https://x.com/${author.screen_name}`;
    const name = escapeMarkdown(author.name).replace(/[[\]]/g, "\\$&");

    const components = [{
      type: 9,
      components: [{ type: 10, content: `### ${name}${tweet.verified ? " ✓" : ""}\n-# [@${escapeMarkdown(author.screen_name)}](${profileUrl})` }],
      accessory: { type: 2, style: 5, label: "Open", url: this.originalUrl },
    }];
    if (text) components.push({ type: 10, content: escapeMarkdown(this.#wrap(text, TEXT_CHAR_PX)) });

    const quote = tweet.quote;
    if (quote) {
      const qHandle = quote.author?.screen_name ? `**@${escapeMarkdown(quote.author.screen_name)}**` : "quoted tweet";
      const qBody = quoteText ? `\n${escapeMarkdown(this.#wrap(quoteText, TEXT_CHAR_PX, QUOTE_INDENT_PX))}` : "";
      components.push({ type: 10, content: this.#quoteBlock(`↩️ ${qHandle}${qBody}`) });
    }

    const items = tweet.displayMedia
      .slice(0, MAX_MEDIA)
      .map(i => ({ media: { url: i.type === "gif" ? Tweet.gifUrl(i.url) : i.url } }));
    if (items.length) components.push({ type: 12, items });

    const stats = tweet.statsLine;
    if (stats) {
      components.push({ type: 14, divider: true, spacing: 1 });
      components.push({ type: 10, content: this.#wrap(stats, SUBTEXT_CHAR_PX).split("\n").map(l => `-# ${l}`).join("\n") });
    }

    const note = tweet.communityNote;
    if (note) {
      const body = note.map(s => s.url ?? s.text).join("").trim();
      components.push({ type: 10, content: this.#quoteBlock(`ⓘ **Readers added context**\n${escapeMarkdown(this.#wrap(body, TEXT_CHAR_PX, QUOTE_INDENT_PX))}`) });
    }
    return components;
  }

  #serialize(components) {
    return JSON.stringify({ component: { type: 17, accent_color: ACCENT_COLOR, components } }).replace(/</g, "\\u003c");
  }
}
