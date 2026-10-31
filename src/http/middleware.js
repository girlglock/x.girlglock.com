const BOT_AGENTS = ["Discordbot", "Twitterbot", "facebookexternalhit", "LinkedInBot"];

export function isBot(userAgent) {
  return !!userAgent && BOT_AGENTS.some(a => userAgent.includes(a));
}

export function hostAllowlist(allowedHosts) {
  return (req, res, next) => {
    if (!allowedHosts.length) return next();
    const host = (req.get("Host") ?? "").split(":")[0];
    if (allowedHosts.includes(host)) return next();
    res.status(403).json({ error: "access denied" });
  };
}

const mediaExt = /\.(gif|png|jpe?g|mp4)$/i;

export function normalizeMediaExtension() {
  return (req, res, next) => {
    const [path, query = ""] = req.url.split("?");
    const ext = (path.match(mediaExt) ?? query.match(mediaExt))?.[1];
    const base = path.replace(mediaExt, "");
    if (ext && /^\/[^/]+\/status\/\d+(?:\/(?:photo|video)\/\d+)?$/.test(base)) {
      req.url = `${base}.${ext.toLowerCase()}`;
    }
    next();
  };
}
