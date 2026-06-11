import { Hono } from "hono";
import type { Env } from "../index.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

export const healthRoute = app;
