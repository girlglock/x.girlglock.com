import ComponentEmbedBuilder from "./ComponentEmbedBuilder.js";
import { escapeHtml } from "../util/format.js";

export default class EmbedPage {
  constructor({ tweet, originalUrl, embedUrl, statusUrl }) {
    this.tweet = tweet;
    this.originalUrl = originalUrl;
    this.embedUrl = embedUrl;
    this.statusUrl = statusUrl;
  }

  static unavailable(embedUrl) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(embedUrl)}" />
  <meta property="og:title" content="Tweet unavailable" />
  <meta property="og:description" content="" />
  <meta name="twitter:card" content="summary" />
</head>
<body></body>
</html>`;
  }

  get title() {
    const { author } = this.tweet;
    return this.tweet.verified
      ? `${escapeHtml(author.name)} ✓ (@${escapeHtml(author.screen_name)})`
      : `${escapeHtml(author.name)} (@${escapeHtml(author.screen_name)})`;
  }

  render() {
    const { tweet } = this;
    const title = this.title;
    const description = escapeHtml(tweet.description);
    const avatar = escapeHtml(tweet.author.avatar_url ?? "");
    const siteName = escapeHtml(tweet.statsLine);

    const items = tweet.displayMedia;
    const firstVideo = items.find(i => i.type === "video") ?? null;
    const firstGif = items.find(i => i.type === "gif") ?? null;
    const photos = items.filter(i => i.type === "photo");

    const imageUrls = [];
    if (firstGif) {
      imageUrls.push(`${this.statusUrl}.gif`);
    } else if (firstVideo?.thumbnail) {
      imageUrls.push(firstVideo.thumbnail);
    } else {
      for (const p of photos) imageUrls.push(p.url);
    }
    if (imageUrls.length === 0 && avatar) imageUrls.push(avatar);

    const ogImageTags = imageUrls.map(url => `<meta property="og:image" content="${escapeHtml(url)}" />`).join("\n  ");

    const singlePhoto = !firstGif && !firstVideo && photos.length === 1 ? photos[0] : null;
    const ogImageDims = singlePhoto?.width && singlePhoto?.height
      ? `<meta property="og:image:width" content="${singlePhoto.width}" />\n  <meta property="og:image:height" content="${singlePhoto.height}" />`
      : "";

    const twitterCard = items.length > 0 ? "summary_large_image" : "summary";

    const componentEmbed = new ComponentEmbedBuilder({ tweet, originalUrl: this.originalUrl }).build();
    const componentEmbedTag = componentEmbed
      ? `<script id="discord:component-embed" type="application/json">${componentEmbed}</script>`
      : "";

    const videoTags = firstVideo
      ? `<meta property="og:video" content="${escapeHtml(firstVideo.url)}" />
          <meta property="og:video:secure_url" content="${escapeHtml(firstVideo.url)}" />
          <meta property="og:video:type" content="video/mp4" />
          ${firstVideo.width ? `<meta property="og:video:width" content="${firstVideo.width}" />` : ""}
          ${firstVideo.height ? `<meta property="og:video:height" content="${firstVideo.height}" />` : ""}
          <meta name="twitter:player:stream" content="${escapeHtml(firstVideo.url)}" />
          <meta name="twitter:player:stream:content_type" content="video/mp4" />`
      : "";

    return `<!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta property="og:type" content="article" />
              <meta property="og:url" content="${escapeHtml(this.embedUrl)}" />
              <meta property="og:title" content="${title}" />
              <meta property="og:description" content="${description}" />
              <meta property="og:site_name" content="${siteName}" />
              ${ogImageTags}
              ${ogImageDims}
              ${videoTags}
              <meta name="twitter:card" content="${twitterCard}" />
              <meta name="twitter:title" content="${title}" />
              <meta name="twitter:description" content="${description}" />
              ${imageUrls[0] ? `<meta name="twitter:image" content="${escapeHtml(imageUrls[0])}" />` : ""}
              <meta name="theme-color" content="#1D9BF0" />
              ${componentEmbedTag}
              <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
              <title>${title}</title>
            </head>
            <body></body>
            </html>`;
  }
}
