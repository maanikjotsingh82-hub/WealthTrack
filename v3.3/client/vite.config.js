import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(clientDir, "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectDir, "");
  const apiKey = (env.OPENROUTER_API_KEY || "").trim();
  const model = (env.OPENROUTER_MODEL || "openrouter/free").trim();

  return {
    root: clientDir,
    envDir: projectDir,
    plugins: [
      react(),
      {
        name: "wealthbot-openrouter-api",
        configureServer(server) {
          server.middlewares.use("/api/wealthbot/health", (_req, res) => {
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({
              ok: true,
              configured: Boolean(apiKey),
              provider: "OpenRouter",
              model,
              hint: apiKey ? "OpenRouter key loaded from project-root .env" : "Add OPENROUTER_API_KEY to project-root .env"
            }));
          });

          server.middlewares.use("/api/wealthbot/chat", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "POST required" }));
              return;
            }
            if (!apiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: "WealthBot is not configured. Add OPENROUTER_API_KEY to the .env file beside package.json, then restart Vite." }));
              return;
            }
            try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
              const userMessage = String(body.message || "").trim();
              if (!userMessage) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json; charset=utf-8");
                res.end(JSON.stringify({ error: "Message is required" }));
                return;
              }
              const systemInstruction = String(body.instructions ||
                "You are WealthBot, a helpful personal-finance and small-business assistant. Use provided WealthTrack data carefully. Do not invent facts, prices, or sources. Explain uncertainty and risks; do not present financial information as guaranteed advice.");
              const messages = [
                { role: "system", content: systemInstruction },
                { role: "user", content: userMessage }
              ];
              const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "http://localhost:5173",
                  "X-Title": "WealthTrack"
                },
                body: JSON.stringify({
                  model,
                  messages,
                  ...(body.useWeb ? { plugins: [{ id: "web" }] } : {})
                })
              });
              const responseText = await response.text();
              if (!response.ok) {
                let message = responseText;
                try { message = JSON.parse(responseText)?.error?.message || message; } catch {}
                throw new Error(`OpenRouter request failed (${response.status}): ${message}`);
              }
              const result = JSON.parse(responseText);
              const outputText = result.choices?.[0]?.message?.content;
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({
                output_text: typeof outputText === "string" ? outputText : JSON.stringify(outputText || ""),
                groundingMetadata: result.citations || null
              }));
            } catch (error) {
              res.statusCode = 502;
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify({ error: error?.message || "WealthBot OpenRouter request failed" }));
            }
          });
        }
      }
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/market": {
          target: "https://query1.finance.yahoo.com",
          changeOrigin: true,
          secure: true,
          rewrite: (reqPath) => reqPath.replace(/^\/market/, "")
        }
      }
    }
  };
});
