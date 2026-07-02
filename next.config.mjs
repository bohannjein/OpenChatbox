import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker (node server.js). Copies only the
  // files the server needs into .next/standalone.
  output: "standalone",
  // Never bake the runtime data dir (users.json / config.json — admin account
  // + secrets) into the standalone bundle or image. It's a mounted volume.
  outputFileTracingExcludes: {
    "*": ["data/**", "./data/**"],
  },
  // Pin the workspace root to this project (a stray lockfile lives in the home dir).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
