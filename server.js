import express from "express";
import { pathToFileURL } from "node:url";
import config from "./config.js";
import { setupApp } from "./src/setupApp.js";

const app = setupApp(express());

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(config.port, () => console.log(`listening on http://localhost:${config.port}`));
}
