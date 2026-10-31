import { pathToFileURL } from "node:url";
import config from "./config.js";
import { createApp } from "./src/app.js";

const app = createApp();

export default app;
