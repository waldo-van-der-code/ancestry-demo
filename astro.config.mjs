import { defineConfig } from "astro/config";
import { demoBase } from "./scripts/demo-base.mjs";

// DEMO_BASE=/some/folder builds the site for hosting in a subfolder; unset it hosts at the domain root.
export default defineConfig({
  output: "static",
  base: demoBase(process.env.DEMO_BASE) || "/",
  trailingSlash: "always",
  build: { format: "directory" },
});
