import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

interface LocalConfig {
  server: {
    host: string;
    port: number;
  };
}

function readLocalConfig(): LocalConfig {
  const configPath = resolve(import.meta.dirname, "../../config/local.json");
  const configSource = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(configSource) as Partial<LocalConfig>;

  if (!parsed.server || typeof parsed.server.host !== "string") {
    throw new Error("config/local.json is missing server.host");
  }

  if (
    typeof parsed.server.port !== "number" ||
    !Number.isInteger(parsed.server.port) ||
    parsed.server.port < 1 ||
    parsed.server.port > 65535
  ) {
    throw new Error("config/local.json has an invalid server.port");
  }

  return {
    server: {
      host: parsed.server.host,
      port: parsed.server.port
    }
  };
}

const { server } = readLocalConfig();

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: `http://${server.host}:${server.port}`,
        changeOrigin: false
      }
    }
  }
});
