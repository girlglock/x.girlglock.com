import express from "express";
import { pathToFileURL } from "node:url";
import config from "./config.js";
import { setupApp } from "./src/setupApp.js";

const app = setupApp(express());

export default app;
