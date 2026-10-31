export default class FxTwitterClient {
  constructor({ apiBase, userAgent }) {
    this.apiBase = apiBase;
    this.userAgent = userAgent;
  }

  statusUrl(username, statusId) {
    return `${this.apiBase}/${username}/status/${statusId}`;
  }

  async getStatus(username, statusId) {
    const res = await fetch(this.statusUrl(username, statusId), {
      headers: { "User-Agent": this.userAgent },
    });
    console.log(`[fxtwitter] ${username}/${statusId} http status=${res.status}`);
    return res.json();
  }
}
