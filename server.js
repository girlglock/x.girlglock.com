import { pathToFileURL } from "node:url";
import config from "./config.js";
import { createApp } from "./src/createApp.js";

const app = createApp();

export default app;
