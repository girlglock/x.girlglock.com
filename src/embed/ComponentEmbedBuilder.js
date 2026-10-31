import Tweet from "../twitter/Tweet.js";
import { escapeMarkdown, truncate } from "../util/format.js";

const MAX_BYTES = 3000;
const MAX_MEDIA = 10;
const ACCENT_COLOR = 0x1D9BF0;

export default class ComponentEmbedBuilder {
  constructor({ tweet, originalUrl }) {
    this.tweet = tweet;
    this.originalUrl = originalUrl;
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

  #components(text, quoteText) {
    const { tweet } = this;
    const author = tweet.author;
    const profileUrl = `https://x.com/${author.screen_name}`;
    const name = escapeMarkdown(author.name).replace(/[[\]]/g, "\\$&");

    const components = [{
      type: 9,
      components: [{ type: 10, content: `### [${name}](${profileUrl})${tweet.verified ? " ✓" : ""}\n-# @${escapeMarkdown(author.screen_name)}` }],
      accessory: { type: 2, style: 5, label: "Open", url: this.originalUrl },
    }];
    if (text) components.push({ type: 10, content: escapeMarkdown(text) });

    const quote = tweet.quote;
    if (quote) {
      const qHandle = quote.author?.screen_name ? `**@${escapeMarkdown(quote.author.screen_name)}**` : "quoted tweet";
      const qBody = quoteText ? `\n${escapeMarkdown(quoteText)}` : "";
      components.push({ type: 10, content: `> ↩️ ${qHandle}${qBody}`.replace(/\n/g, "\n> ") });
    }

    const items = tweet.displayMedia
      .slice(0, MAX_MEDIA)
      .map(i => ({ media: { url: i.type === "gif" ? Tweet.gifUrl(i.url) : i.url } }));
    if (items.length) components.push({ type: 12, items });

    const stats = tweet.statsLine;
    if (stats) {
      components.push({ type: 14, divider: true, spacing: 1 });
      components.push({ type: 10, content: `-# ${stats}` });
    }
    return components;
  }

  #serialize(components) {
    return JSON.stringify({ component: { type: 17, accent_color: ACCENT_COLOR, components } }).replace(/</g, "\\u003c");
  }
}
