import express from "express";
import config from "./config.js";

const app = express();

app.use((req, res, next) => {
  if (!config.allowedHosts.length) return next();
  const host = (req.get("Host") ?? "").split(":")[0];
  if (config.allowedHosts.includes(host)) return next();
  res.status(403).json({ error: "access denied" });
});

//strip params and lcase the fileextension
app.use((req, res, next) => {
  const match = req.originalUrl.match(/^(\/[^/?]+\/status\/\d+)(?:\?[^#]*)?\.(gif|png|jpe?g|mp4)$/i);
  if (match) {
    req.url = `${match[1]}.${match[2].toLowerCase()}`;
  }
  next();
});

function isBot(userAgent) {
  return userAgent && ['Discordbot', 'Twitterbot', 'facebookexternalhit', 'LinkedInBot'].some(a => userAgent.includes(a));
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatNumber(n) {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function buildDescription(status) {
  const parts = [];
  if (status.text) parts.push(status.text);

  if (status.quote) {
    const q = status.quote;
    const qHandle = q.author?.screen_name ? `@${q.author.screen_name}` : "quoted tweet";
    const qLine = q.text ? `${qHandle}: ${q.text}` : qHandle;
    parts.push(`↩️ ${qLine}`);
  }

  /* const footerParts = [config.siteDescription];
  if (status.created_timestamp) footerParts.push(formatDate(status.created_timestamp));
  parts.push(footerParts.join(" • ")); */

  return parts.join("\n\n");
}

function gifWebpUrl(mp4Url) {
  return mp4Url.replace("https://video.twimg.com", "https://gif.fxtwitter.com").replace(/\.mp4(\?.*)?$/, ".gif");
}

function getMediaItems(status) {
  const media = status.media;
  if (!media) return [];

  const items = [];

  for (const vid of media.videos ?? []) {
    if (vid.type === "gif") {
      items.push({ type: "gif", url: vid.url, thumbnail: vid.thumbnail_url, width: vid.width, height: vid.height });
    } else {
      items.push({ type: "video", url: vid.url, thumbnail: vid.thumbnail_url, width: vid.width, height: vid.height });
    }
  }

  for (const p of media.photos ?? []) {
    items.push({ type: "photo", url: p.url, width: p.width, height: p.height });
  }

  if (items.length === 0 && media.mosaic) {
    items.push({ type: "photo", url: media.mosaic.formats?.jpeg ?? media.mosaic.url, width: null, height: null });
  }

  return items;
}

function buildSiteName(status) {
  const stats = [];
  if (status.likes) stats.push(`❤️ ${formatNumber(status.likes)}`);
  const reposts = status.reposts ?? status.retweets;
  if (reposts) stats.push(`🔁 ${formatNumber(reposts)}`);
  if (status.replies) stats.push(`💬 ${formatNumber(status.replies)}`);
  if (status.views) stats.push(`👁 ${formatNumber(status.views)}`);

  const parts = [];
  if (stats.length) parts.push(stats.join("  "));
  if (status.created_timestamp) parts.push(formatDate(status.created_timestamp));
  return parts.join(" · ");
}

function buildHtml({ status, author, originalUrl, embedUrl, statusUrl }) {
  const verified = author.verification?.verified || author.verified;
  const title = verified
    ? `${escapeHtml(author.name)} ✓ (@${escapeHtml(author.screen_name)})`
    : `${escapeHtml(author.name)} (@${escapeHtml(author.screen_name)})`;

  const description = escapeHtml(buildDescription(status));
  const avatar = escapeHtml(author.avatar_url ?? "");
  const siteName = escapeHtml(buildSiteName(status));

  const ownItems = getMediaItems(status);
  const items = ownItems.length > 0 ? ownItems : (status.quote ? getMediaItems(status.quote) : []);

  const firstVideo = items.find(i => i.type === "video") ?? null;
  const firstGif = items.find(i => i.type === "gif") ?? null;
  const photos = items.filter(i => i.type === "photo");

  const imageUrls = [];
  if (firstGif) {
    imageUrls.push(`${statusUrl}.gif`);
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
  <meta property="og:url" content="${escapeHtml(embedUrl)}" />
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
  <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
  <title>${title}</title>
</head>
<body></body>
</html>`;
}

async function fetchTweet(username, statusId) {
  const res = await fetch(`${config.fxApiBase}/${username}/status/${statusId}`, {
    headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
  });
  return res.json();
}

function withTweet(handler) {
  return async (req, res) => {
    const { username, id: statusId } = req.params;
    if (!/^\d+$/.test(statusId)) return res.status(400).json({ error: "invalid status id" });
    try {
      const data = await fetchTweet(username, statusId);
      return handler(req, res, data);
    } catch {
      return res.status(502).json({ error: "fxtwitter api error" });
    }
  };
}

const translateEndpoints = [
  {
    url: (text, tl) => `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${tl}&q=${encodeURIComponent(text)}`,
    parse: data => {
      const first = data?.[0];
      return Array.isArray(first) ? first[0] : first;
    },
  },
  {
    url: (text, tl) => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`,
    parse: data => (data?.[0] ?? []).map(chunk => chunk[0]).join(""),
  },
];

async function translateText(text, targetLang = "en") {
  if (!text) return text;
  for (const endpoint of translateEndpoints) {
    try {
      const res = await fetch(endpoint.url(text, targetLang));
      if (!res.ok) {
        console.error(`[translate] ${new URL(res.url).host} http status=${res.status}`);
        continue;
      }
      const translated = endpoint.parse(await res.json());
      if (typeof translated === "string" && translated) return translated;
    } catch (err) {
      console.error(`[translate] error:`, err.message);
    }
  }
  return text;
}

function unavailableHtml(embedUrl) {
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

async function renderEmbed({ req, res, username, statusId, translate = false, data }) {
  const originalUrl = `https://x.com/${username}/status/${statusId}`;
  const statusUrl = `https://${req.get("Host")}/${username}/status/${statusId}`;
  const embedUrl = `${statusUrl}${translate ? "/translate" : ""}`;

  const ua = req.get("User-Agent") ?? "";
  console.log(`[embed] ${username}/${statusId} ua="${ua}" translate=${translate}`);

  if (!isBot(ua)) {
    console.log(`[embed] not a bot, redirecting`);
    return res.redirect(originalUrl);
  }

  if (!data) {
    try {
      const apiUrl = `${config.fxApiBase}/${username}/status/${statusId}`;
      console.log(`[embed] fetching ${apiUrl}`);
      const apiRes = await fetch(apiUrl, {
        headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
      });
      console.log(`[embed] api http status=${apiRes.status}`);
      data = await apiRes.json();
    } catch (err) {
      console.error(`[embed] api fetch error:`, err.message);
      return res.status(502).send("Failed to reach FxTwitter API");
    }
  }

  if (!data?.tweet?.id) {
    console.log(`[embed] no tweet data, serving unavailable embed`);
    return res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(unavailableHtml(embedUrl));
  }

  const status = data.tweet;
  const author = data.tweet.author;

  if (translate) {
    status.text = await translateText(status.text);
    if (status.quote?.text) status.quote.text = await translateText(status.quote.text);
  }

  const html = buildHtml({ status, author, originalUrl, embedUrl, statusUrl });

  return res
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
    .set("X-Robots-Tag", "noindex")
    .set("X-Content-Type-Options", "nosniff")
    .send(html);
}

app.get("/", (req, res) => {
  if (config.rootRedirectUrl) {
    return res.redirect(config.rootRedirectUrl);
  }
  res.json({
    status: "ok",
    service: `${config.siteDescription} embed service :3c`,
    usage: `https://${req.get("Host")}/:username/status/:id`,
  });
});

const servePhoto = withTweet((req, res, data) => {
  const photo = data.tweet?.media?.photos?.[0] ?? data.tweet?.media?.mosaic;
  if (!photo?.url) {
    const { username, id: statusId } = req.params;
    return renderEmbed({ req, res, username, statusId, data });
  }
  return res.redirect(photo.url);
});

app.get("/:username/status/:id/photo", servePhoto);
for (const ext of ["png", "jpg", "jpeg"]) {
  app.get(`/:username/status/:id.${ext}`, servePhoto);
}

app.get("/:username/status/:id.mp4", withTweet((req, res, data) => {
  const vid = data.tweet?.media?.videos?.find(v => v.type !== "gif");
  if (!vid?.url) {
    const { username, id: statusId } = req.params;
    return renderEmbed({ req, res, username, statusId, data });
  }
  return res.redirect(vid.url);
}));

app.get("/:username/status/:id.gif", withTweet((req, res, data) => {
  const videos = data.tweet?.media?.videos ?? [];
  const media = videos.find(v => v.type === "gif" && v.url)
    ?? videos.find(v => v.type !== "gif" && v.url && (v.duration == null || v.duration <= 20));

  if (media) return res.redirect(gifWebpUrl(media.url));

  const { username, id: statusId } = req.params;
  return renderEmbed({ req, res, username, statusId, data });
}));

app.get("/:username/status/:id/video/:num.mp4", withTweet((req, res, data) => {
  const idx = (parseInt(req.params.num, 10) || 1) - 1;
  const videos = (data.tweet?.media?.videos ?? []).filter(v => v.type !== "gif");
  const vid = videos[idx] ?? videos[0];
  if (!vid?.url) return res.status(404).json({ error: "no video" });
  return res.redirect(vid.url);
}));

app.get("/:username/status/:id/:mediaType(video|photo)/:num", (req, res) => {
  const { username, id } = req.params;
  res.redirect(`https://${req.get("Host")}/${username}/status/${id}`);
});

app.get(["/:username/status/:id/translate", "/:username/status/:id/:mediaType(video|photo)/:num/translate"], (req, res) => {
  const { username, id: statusId } = req.params;
  return renderEmbed({ req, res, username, statusId, translate: true });
});

app.get("/:username/status/:id", (req, res) => {
  const { username, id: statusId } = req.params;
  return renderEmbed({ req, res, username, statusId });
});

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

export default app;
