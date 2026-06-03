import express from "express";
import config from "./config.js";

const app = express();

app.use((req, res, next) => {
  if (!config.allowedHosts.length) return next();
  const host = (req.get("Host") ?? "").split(":")[0];
  if (config.allowedHosts.includes(host)) return next();
  res.status(403).json({ error: "access denied" });
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

function buildHtml({ status, author, originalUrl, embedUrl }) {
  const verified = author.verification?.verified || author.verified;
  const title = verified
    ? `${escapeHtml(author.name)} ✓ (@${escapeHtml(author.screen_name)})`
    : `${escapeHtml(author.name)} (@${escapeHtml(author.screen_name)})`;

  const description = escapeHtml(buildDescription(status));
  const avatar = escapeHtml(author.avatar_url ?? "");
  const siteName = escapeHtml(buildSiteName(status));

  const quotedItems = status.quote ? getMediaItems(status.quote) : [];
  const items = quotedItems.length > 0 ? quotedItems : getMediaItems(status);

  const firstVideo = items.find(i => i.type === "video") ?? null;
  const firstGif = items.find(i => i.type === "gif") ?? null;
  const photos = items.filter(i => i.type === "photo");

  const imageUrls = [];
  if (firstGif) {
    imageUrls.push(`${embedUrl}.gif`);
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

app.get("/:username/status/:id/photo", servePhoto);


async function servePhoto(req, res) {
  const { username, id: statusId } = req.params;
  if (!/^\d+$/.test(statusId)) return res.status(400).json({ error: "invalid status id" });

  try {
    const apiRes = await fetch(`${config.fxApiBase}/${username}/status/${statusId}`, {
      headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
    });
    const data = await apiRes.json();
    const photo = data.tweet?.media?.photos?.[0] ?? data.tweet?.media?.mosaic;
    if (!photo?.url) return res.status(404).json({ error: "no photo" });
    return res.redirect(photo.url);
  } catch {
    return res.status(502).json({ error: "fxtwitter api error" });
  }
}

for (const ext of ["png", "jpg", "jpeg"]) {
  app.get(`/:username/status/:id.${ext}`, servePhoto);
}

app.get("/:username/status/:id.mp4", async (req, res) => {
  const { username, id: statusId } = req.params;
  if (!/^\d+$/.test(statusId)) return res.status(400).json({ error: "invalid status id" });

  try {
    const apiRes = await fetch(`${config.fxApiBase}/${username}/status/${statusId}`, {
      headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
    });
    const data = await apiRes.json();
    const vid = data.tweet?.media?.videos?.find(v => v.type !== "gif");
    if (!vid?.url) return res.status(404).json({ error: "no video" });
    return res.redirect(vid.url);
  } catch {
    return res.status(502).json({ error: "failed to fetch video" });
  }
});

app.get("/:username/status/:id.gif", async (req, res) => {
  const { username, id: statusId } = req.params;

  if (!/^\d+$/.test(statusId)) {
    return res.status(400).json({ error: "invalid status id" });
  }

  try {
    const apiRes = await fetch(`${config.fxApiBase}/${username}/status/${statusId}`, {
      headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
    });
    const data = await apiRes.json();
    const gif = data.tweet?.media?.videos?.find(v => v.type === "gif");
    if (!gif?.url) return res.status(404).json({ error: "no gif" });
    return res.redirect(gifWebpUrl(gif.url));
  } catch {
    return res.status(502).json({ error: "fxtwitter api error" });
  }
});

app.get("/:username/status/:id", async (req, res) => {
  const { username, id: statusId } = req.params;
  const originalUrl = `https://x.com/${username}/status/${statusId}`;

  const ua = req.get("User-Agent") ?? "";
  console.log(`[embed] ${username}/${statusId} ua="${ua}"`);

  if (!isBot(ua)) {
    console.log(`[embed] not a bot, redirecting`);
    return res.redirect(originalUrl);
  }

  let data;
  try {
    const apiUrl = `${config.fxApiBase}/${username}/status/${statusId}`;
    console.log(`[embed] fetching ${apiUrl}`);
    const apiRes = await fetch(apiUrl, {
      headers: { "User-Agent": `${config.siteDescription}/1.0 (embed proxy)` },
    });
    console.log(`[embed] api http status=${apiRes.status}`);
    data = await apiRes.json();
    console.log(`[embed] api code=${data?.code} keys=${Object.keys(data ?? {}).join(",")} raw=${JSON.stringify(data).slice(0, 800)}`);
  } catch (err) {
    console.error(`[embed] api fetch error:`, err.message);
    return res.status(502).send("Failed to reach FxTwitter API");
  }

  const embedUrl = `https://${req.get("Host")}/${username}/status/${statusId}`;

  if (!data?.tweet?.id) {
    console.log(`[embed] no tweet data, serving unavailable embed`);
    return res
      .set("Content-Type", "text/html; charset=utf-8")
      .send(`<!DOCTYPE html>
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
</html>`);
  }

  const status = data.tweet;
  const author = data.tweet.author;

  const html = buildHtml({ status, author, originalUrl, embedUrl });

  res
    .set("Content-Type", "text/html; charset=utf-8")
    .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
    .set("X-Robots-Tag", "noindex")
    .set("X-Content-Type-Options", "nosniff")
    .send(html);
});

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

export default app;
