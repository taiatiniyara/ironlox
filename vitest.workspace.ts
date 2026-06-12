import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/crypto",
  "packages/autofill",
  "apps/web",
  "apps/worker",
]);
