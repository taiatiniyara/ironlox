import { Hono } from "hono";
import type { Env, Variables } from "../index.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.post("/mfa/enable", async (c) => {
  return c.json({ message: "MFA enable not yet implemented" }, 501);
});

app.post("/mfa/verify", async (c) => {
  return c.json({ message: "MFA verify not yet implemented" }, 501);
});

app.post("/mfa/webauthn/register", async (c) => {
  return c.json({ message: "WebAuthn register not yet implemented" }, 501);
});

app.post("/mfa/webauthn/verify", async (c) => {
  return c.json({ message: "WebAuthn verify not yet implemented" }, 501);
});

app.post("/recover", async (c) => {
  return c.json({ message: "Recovery key login not yet implemented" }, 501);
});

export const mfaRoutes = app;
