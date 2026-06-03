export default {
  allowedHosts: process.env.ALLOWED_HOSTS
    ? process.env.ALLOWED_HOSTS.split(',').map(h => h.trim()).filter(Boolean)
    : [],
  port: process.env.PORT || 3000,
  fxApiBase: 'https://api.fxtwitter.com',
  siteDescription: process.env.SITE_DESCRIPTION || 'girlglock.com',
  rootRedirectUrl: process.env.ROOT_REDIRECT_URL || null,
};
