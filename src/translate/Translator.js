const ENDPOINTS = [
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

export default class Translator {
  constructor({ targetLang = "en", endpoints = ENDPOINTS } = {}) {
    this.targetLang = targetLang;
    this.endpoints = endpoints;
  }

  async translate(text, targetLang = this.targetLang) {
    if (!text) return text;
    for (const endpoint of this.endpoints) {
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

  async translateTweet(tweet) {
    tweet.text = await this.translate(tweet.text);
    if (tweet.data.quote?.text) tweet.data.quote.text = await this.translate(tweet.data.quote.text);
  }
}
