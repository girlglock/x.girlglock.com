import express from "express";
import config from "../config.js";
import FxTwitterClient from "./twitter/FxTwitterClient.js";
import Translator from "./translate/Translator.js";
import StatusController from "./http/StatusController.js";
import { hostAllowlist, normalizeMediaExtension } from "./http/middleware.js";

export function createApp() {
  const app = express();
  app.use(hostAllowlist(config.allowedHosts));
  app.use(normalizeMediaExtension());

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

  const client = new FxTwitterClient({
    apiBase: config.fxApiBase,
    userAgent: `${config.siteDescription}/1.0 (embed proxy)`,
  });
  new StatusController({ client, translator: new Translator() }).register(app);

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}
