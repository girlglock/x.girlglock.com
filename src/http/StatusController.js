import EmbedPage from "../embed/EmbedPage.js";
import Tweet from "../twitter/Tweet.js";
import { isBot } from "./middleware.js";

const MAX_GIF_VIDEO_SECONDS = 20;

export default class StatusController {
  constructor({ client, translator }) {
    this.client = client;
    this.translator = translator;
  }

  register(app) {
    const servePhoto = this.#withTweet(this.servePhoto);
    app.get("/:username/status/:id/photo", servePhoto);
    for (const ext of ["png", "jpg", "jpeg"]) {
      app.get(`/:username/status/:id.${ext}`, servePhoto);
      app.get(`/:username/status/:id/photo/:num.${ext}`, servePhoto);
    }
    app.get("/:username/status/:id.mp4", this.#withTweet(this.serveVideo));
    app.get("/:username/status/:id.gif", this.#withTweet(this.serveGif));
    app.get("/:username/status/:id/video/:num.mp4", this.#withTweet(this.serveNumberedVideo));
    app.get("/:username/status/:id/:mediaType(video|photo)/:num", this.redirectToStatus);
    app.get(["/:username/status/:id/translate", "/:username/status/:id/:mediaType(video|photo)/:num/translate"],
      (req, res) => this.renderEmbed(req, res, { translate: true }));
    app.get("/:username/status/:id", (req, res) => this.renderEmbed(req, res));
  }

  #withTweet(handler) {
    return async (req, res) => {
      const { username, id: statusId } = req.params;
      if (!/^\d+$/.test(statusId)) return res.status(400).json({ error: "invalid status id" });
      let data;
      try {
        data = await this.client.getStatus(username, statusId);
      } catch {
        return res.status(502).json({ error: "fxtwitter api error" });
      }
      return handler.call(this, req, res, data);
    };
  }

  servePhoto(req, res, data) {
    const tweet = data.tweet ? new Tweet(data.tweet) : null;
    const photos = tweet?.photos ?? [];
    const idx = (parseInt(req.params.num, 10) || 1) - 1;
    const photo = photos[idx] ?? photos[0] ?? tweet?.mosaic;
    if (!photo?.url) return this.renderEmbed(req, res, { data });
    return res.redirect(photo.url);
  }

  serveVideo(req, res, data) {
    const vid = data.tweet?.media?.videos?.find(v => v.type !== "gif");
    if (!vid?.url) return this.renderEmbed(req, res, { data });
    return res.redirect(vid.url);
  }

  serveGif(req, res, data) {
    const videos = data.tweet?.media?.videos ?? [];
    const media = videos.find(v => v.type === "gif" && v.url)
      ?? videos.find(v => v.type !== "gif" && v.url && (v.duration == null || v.duration <= MAX_GIF_VIDEO_SECONDS));
    if (media) return res.redirect(Tweet.gifUrl(media.url));
    return this.renderEmbed(req, res, { data });
  }

  serveNumberedVideo(req, res, data) {
    const idx = (parseInt(req.params.num, 10) || 1) - 1;
    const videos = (data.tweet?.media?.videos ?? []).filter(v => v.type !== "gif");
    const vid = videos[idx] ?? videos[0];
    if (!vid?.url) return res.status(404).json({ error: "no video" });
    return res.redirect(vid.url);
  }

  redirectToStatus(req, res) {
    const { username, id } = req.params;
    res.redirect(`https://${req.get("Host")}/${username}/status/${id}`);
  }

  async renderEmbed(req, res, { translate = false, data = null } = {}) {
    const { username, id: statusId } = req.params;
    const originalUrl = `https://x.com/${username}/status/${statusId}`;
    const statusUrl = `https://${req.get("Host")}/${username}/status/${statusId}`;
    const embedUrl = `${statusUrl}${translate ? "/translate" : ""}`;

    const ua = req.get("User-Agent") ?? "";
    console.log(`[embed] ${username}/${statusId} url="${req.originalUrl}" ua="${ua}" translate=${translate}`);

    if (!isBot(ua)) {
      console.log(`[embed] not a bot, redirecting`);
      return res.redirect(originalUrl);
    }

    if (!data) {
      try {
        data = await this.client.getStatus(username, statusId);
      } catch (err) {
        console.error(`[embed] api fetch error:`, err.message);
        return res.status(502).send("Failed to reach FxTwitter API");
      }
    }

    if (!data?.tweet?.id) {
      console.log(`[embed] no tweet data, serving unavailable embed`);
      return res
        .set("Content-Type", "text/html; charset=utf-8")
        .send(EmbedPage.unavailable(embedUrl));
    }

    const tweet = new Tweet(data.tweet);
    if (translate) await this.translator.translateTweet(tweet);

    const html = new EmbedPage({ tweet, originalUrl, embedUrl, statusUrl }).render();

    return res
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "public, max-age=300, stale-while-revalidate=60")
      .set("X-Robots-Tag", "noindex")
      .set("X-Content-Type-Options", "nosniff")
      .send(html);
  }
}
