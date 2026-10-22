// One-time production setup for Kausa's Convex backend.
//
//   node scripts/setup-prod.mjs https://your-frontend-domain.com
//
// 1. Generates fresh sign-in keys for production (JWT_PRIVATE_KEY, JWKS).
// 2. Copies the LLM / Zetaris settings from the dev deployment to production.
// 3. Sets SITE_URL to your frontend's address.
// 4. Deploys the backend code to production.
// Secret values are never printed.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const siteUrl = process.argv[2];
if (!siteUrl || !/^https?:\/\//.test(siteUrl)) {
  console.error("Usage: node scripts/setup-prod.mjs https://your-frontend-domain.com");
  process.exit(1);
}

// Run the Convex CLI through node directly (no shell), so values containing
// spaces, like the private key, stay as one argument on every OS.
const cli = fileURLToPath(new URL("../node_modules/convex/bin/main.js", import.meta.url));
const convex = (args, opts = {}) =>
  execFileSync(process.execPath, [cli, ...args], { encoding: "utf8", ...opts });

const setProd = (name, value) => {
  try {
    convex(["env", "set", "--prod", "--", name, value], { stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    // Don't let the error message echo the secret value.
    console.error(`  FAILED to set ${name}`);
    process.exit(1);
  }
  console.log(`  set ${name}`);
};

console.log("Generating production sign-in keys…");
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = (await exportPKCS8(keys.privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }] });
setProd("JWT_PRIVATE_KEY", privateKey);
setProd("JWKS", jwks);

console.log("Copying settings from dev…");
const COPY = [
  "LLM_PROVIDER",
  "NVIDIA_API_KEY",
  "NVIDIA_BASE_URL",
  "NVIDIA_MODEL",
  "SPACEXAI_API_KEY",
  "SPACEXAI_BASE_URL",
  "SPACEXAI_MODEL",
  "METERLESS_API_KEY",
  "METERLESS_BASE_URL",
  "METERLESS_MODEL",
];
for (const name of COPY) {
  let value = "";
  try {
    value = convex(["env", "get", name], { stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    // not set on dev
  }
  if (value) setProd(name, value);
}

setProd("SITE_URL", siteUrl.replace(/\/$/, ""));

console.log("Deploying backend code to production…");
convex(["deploy", "-y"], { stdio: "inherit" });
console.log("\nDone. Production backend: https://hushed-oriole-906.convex.cloud");
