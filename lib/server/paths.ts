import path from "path";

/**
 * Directory for runtime state (users.json, config.json). It holds the admin
 * account + server config and MUST live outside the repo/image — it's
 * gitignored and mounted as a volume in Docker.
 *
 * Override with OPENCHATBOX_DATA_DIR to place it anywhere (e.g. /var/lib/openchatbox
 * or a network mount). Defaults to ./data next to the running process.
 */
export const DATA_DIR = process.env.OPENCHATBOX_DATA_DIR
  ? path.resolve(process.env.OPENCHATBOX_DATA_DIR)
  : path.join(process.cwd(), "data");
