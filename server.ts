import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

const rootDir = process.cwd();
const vaultDir = path.join(rootDir, "src");
const workspaceDir = "/root/.openclaw/workspace";
const openclawConfigPath = "/root/.openclaw/openclaw.json";
const pollStatePath = "/var/lib/sendblue/poll-state.json";
const forceFlagPath = "/var/lib/sendblue/force-respond.flag";
const GATEWAY_URL = "ws://127.0.0.1:8000";
const GATEWAY_TOKEN = "tachikoma-gateway-token-2026";

// Read provider API keys from openclaw.json at startup
function getProviderApiKey(provider: string): string {
  try {
    if (fs.existsSync(openclawConfigPath)) {
      const cfg = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
      return cfg?.models?.providers?.[provider]?.apiKey || "";
    }
  } catch {}
  return "";
}
const DEEPSEEK_API_KEY = getProviderApiKey("deepseek");
const ANTHROPIC_API_KEY_SERVER = getProviderApiKey("anthropic");

// Ensure the directory exists
if (!fs.existsSync(vaultDir)) {
  fs.mkdirSync(vaultDir, { recursive: true });
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vaultDir);
  },
  filename: (req, file, cb) => {
    const safeName = path.basename(file.originalname);
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Gateway WebSocket bridge for sub-agent chat
function gatewayChatBridge(browserWs: WebSocket, agentId: string) {
  const gatewayWs = new WebSocket(GATEWAY_URL);
  let connected = false;
  const pending: Array<(gw: WebSocket) => void> = [];

  const onReady = (fn: (gw: WebSocket) => void) => {
    if (connected && gatewayWs.readyState === WebSocket.OPEN) {
      fn(gatewayWs);
    } else {
      pending.push(fn);
    }
  };

  gatewayWs.on("open", () => {
    // Authenticate with Gateway
    const connectId = generateId();
    gatewayWs.send(JSON.stringify({
      id: connectId,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "tachikoma-ui",
          version: "1.0.0",
          platform: "linux",
          mode: "WEBCHAT",
          instanceId: generateId(),
        },
        role: "user",
        scopes: ["chat.send", "chat.stream", "sessions.spawn"],
        caps: ["tool-events"],
        auth: { authToken: GATEWAY_TOKEN },
        userAgent: "TachikomaUI/1.0",
        locale: "en-US",
      },
    }));

    // Wait for connect response then flush pending
    const onMsg = (raw: any) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.id === connectId || (msg.ok !== undefined && msg.id === connectId)) {
        connected = true;
        gatewayWs.removeListener("message", onMsg);
        while (pending.length) pending.shift()!(gatewayWs);
      }
    };
    gatewayWs.on("message", onMsg);
  });

  // Handle browser messages
  browserWs.on("message", (raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === "chat") {
      onReady((gw) => {
        gw.send(JSON.stringify({
          id: generateId(),
          method: "chat.send",
          params: {
            message: msg.message,
            agentId: agentId || undefined,
            deliver: false,
            idempotencyKey: generateId(),
          },
        }));
      });
    }
  });

  // Forward Gateway responses to browser
  let buffer = "";
  gatewayWs.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // Handle streaming text from agent
      if (msg.ok !== false && msg.payload) {
        if (typeof msg.payload === "string") {
          browserWs.send(JSON.stringify({ type: "delta", text: msg.payload }));
        } else if (msg.payload.text) {
          browserWs.send(JSON.stringify({ type: "delta", text: msg.payload.text }));
        } else if (msg.payload.content) {
          browserWs.send(JSON.stringify({ type: "delta", text: msg.payload.content }));
        } else if (msg.payload.message?.content) {
          const c = msg.payload.message.content;
          if (typeof c === "string") {
            browserWs.send(JSON.stringify({ type: "delta", text: c }));
          } else if (Array.isArray(c)) {
            for (const block of c) {
              if (block.text) browserWs.send(JSON.stringify({ type: "delta", text: block.text }));
            }
          }
        }
      }
      // Handle errors
      if (msg.ok === false || msg.error) {
        browserWs.send(JSON.stringify({ type: "error", text: msg.error?.message || "Gateway error" }));
      }
      // Handle message_stop / completion
      if (msg.type === "message_stop" || msg.payload?.stopReason) {
        browserWs.send(JSON.stringify({ type: "done" }));
      }
    } catch {
      // Non-JSON response, try to extract text
      const text = raw.toString().trim();
      if (text) {
        browserWs.send(JSON.stringify({ type: "delta", text }));
      }
    }
  });

  gatewayWs.on("close", () => {
    browserWs.send(JSON.stringify({ type: "done" }));
    browserWs.close();
  });

  browserWs.on("close", () => {
    if (gatewayWs.readyState === WebSocket.OPEN) {
      gatewayWs.close();
    }
  });

  gatewayWs.on("error", (err) => {
    browserWs.send(JSON.stringify({ type: "error", text: `Gateway: ${err.message}` }));
  });
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON parser for explicit API requests — 10MB limit for workspace file saves
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // GET: List files in SECURE_VAULT
  app.get("/api/files", (req, res) => {
    fs.readdir(vaultDir, { withFileTypes: true }, (err, files) => {
      if (err) {
        console.error("Error reading vault directory:", err);
        return res.status(500).json({ error: "Failed to read directory" });
      }

      const fileList = files
        .filter(dirent => dirent.isFile())
        .map(dirent => {
          const filePath = path.join(vaultDir, dirent.name);
          const stats = fs.statSync(filePath);
          return {
            name: dirent.name,
            size: stats.size,
            updatedAt: stats.mtime
          };
        });

      res.json(fileList);
    });
  });

  // POST: Upload files
  app.post("/api/files/upload", upload.array("files"), (req, res) => {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    res.json({ success: true, count: (req.files as Express.Multer.File[]).length });
  });

  // DELETE: Remove file
  app.delete("/api/files/:filename", (req, res) => {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);
    const filePath = path.join(vaultDir, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", err);
        return res.status(500).json({ error: "Failed to delete file" });
      }
      res.json({ success: true });
    });
  });

  // ========== WORKSPACE FILES ==========

  app.get("/api/workspace/files", (req, res) => {
    try {
      if (!fs.existsSync(workspaceDir)) {
        return res.json([]);
      }
      const files = fs.readdirSync(workspaceDir, { withFileTypes: true })
        .filter(d => d.isFile() && d.name.endsWith(".md"))
        .map(d => {
          const fp = path.join(workspaceDir, d.name);
          const stats = fs.statSync(fp);
          return { name: d.name, size: stats.size, updatedAt: stats.mtime };
        });
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/workspace/file/:name", (req, res) => {
    try {
      const safeName = path.basename(req.params.name);
      const fp = path.join(workspaceDir, safeName);
      if (!fs.existsSync(fp)) return res.status(404).json({ error: "File not found" });
      const content = fs.readFileSync(fp, "utf-8");
      res.json({ name: safeName, content, size: Buffer.byteLength(content, "utf-8") });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/workspace/file/:name", (req, res) => {
    try {
      const safeName = path.basename(req.params.name);
      const fp = path.join(workspaceDir, safeName);
      const { content } = req.body;
      if (typeof content !== "string") return res.status(400).json({ error: "content required" });
      fs.writeFileSync(fp, content, "utf-8");
      res.json({ success: true, name: safeName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== OPENCLAW CONFIG ==========

  app.get("/api/openclaw/config", (req, res) => {
    try {
      if (!fs.existsSync(openclawConfigPath)) return res.status(404).json({ error: "Config not found" });
      const raw = fs.readFileSync(openclawConfigPath, "utf-8");
      res.json(JSON.parse(raw));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/openclaw/config", (req, res) => {
    try {
      const updates = req.body;
      const current = JSON.parse(fs.readFileSync(openclawConfigPath, "utf-8"));
      const merged = deepMerge(current, updates);
      fs.writeFileSync(openclawConfigPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== OPENCLAW PROXY (so browser clients work from anywhere) ==========

  app.use("/api/openclaw/v1", async (req, res) => {
    try {
      const target = `http://127.0.0.1:8000/v1${req.url}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === "string" && !["host", "connection"].includes(k.toLowerCase())) {
          headers[k] = v;
        }
      }
      const body = req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined;
      const fetchRes = await fetch(target, { method: req.method, headers: { ...headers, "Content-Type": "application/json" }, body });
      const text = await fetchRes.text();
      res.status(fetchRes.status).set("Content-Type", fetchRes.headers.get("Content-Type") || "application/json").send(text);
    } catch (err: any) {
      res.status(502).json({ error: "OpenClaw gateway unreachable", detail: err.message });
    }
  });

  // ========== SYSTEM SERVICES & RESOURCES ==========

  app.get("/api/system/services", (req, res) => {
    try {
      const services = ["tachikoma-ui.service", "sendblue-poller.service", "tachikoma.service"];
      const results: Record<string, any> = {};
      for (const svc of services) {
        try {
          const out = execSync(`systemctl show ${svc} --property=ActiveState,SubState,ExecMainStartTimestamp --no-page`, { encoding: "utf-8", timeout: 3000 });
          const parsed: Record<string, string> = {};
          out.trim().split("\n").forEach(line => {
            const [k, v] = line.split("=");
            if (k && v !== undefined) parsed[k] = v;
          });
          results[svc] = {
            active: parsed.ActiveState === "active" ? "running" : parsed.ActiveState,
            substate: parsed.SubState || "",
            startedAt: parsed.ExecMainStartTimestamp || "",
          };
        } catch {
          results[svc] = { active: "unknown", substate: "", startedAt: "" };
        }
      }
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/system/resources", (req, res) => {
    try {
      const mem = execSync("free -b", { encoding: "utf-8", timeout: 2000 });
      const disk = execSync("df -B1 /", { encoding: "utf-8", timeout: 2000 });
      const uptime = execSync("uptime -p", { encoding: "utf-8", timeout: 2000 });

      const memLines = mem.trim().split("\n");
      const memParts = memLines[1]?.split(/\s+/);
      const diskParts = disk.trim().split("\n")[1]?.split(/\s+/);

      res.json({
        memory: {
          total: memParts?.[1] ? parseInt(memParts[1]) : 0,
          used: memParts?.[2] ? parseInt(memParts[2]) : 0,
          free: memParts?.[3] ? parseInt(memParts[3]) : 0,
          available: memParts?.[6] ? parseInt(memParts[6]) : 0,
        },
        disk: {
          total: diskParts?.[1] ? parseInt(diskParts[1]) : 0,
          used: diskParts?.[2] ? parseInt(diskParts[2]) : 0,
          available: diskParts?.[3] ? parseInt(diskParts[3]) : 0,
        },
        uptime: uptime.trim().replace(/^up\s+/, ""),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== IMESSAGE ==========

  app.get("/api/imessage/state", (req, res) => {
    try {
      if (!fs.existsSync(pollStatePath)) return res.json({ messages: {} });
      const raw = fs.readFileSync(pollStatePath, "utf-8");
      res.json(JSON.parse(raw));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/imessage/log", (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const query = `SELECT id, from_number, to_number, content, is_inbound, status, created_at FROM tachikoma_alerts.imessage_log ORDER BY created_at DESC LIMIT ${limit}`;
      const out = execSync(`mysql -N -B -e "${query.replace(/"/g, '\\"')}"`, { encoding: "utf-8", timeout: 5000 });
      const rows = out.trim().split("\n").filter(Boolean).map(line => {
        const cols = line.split("\t");
        return {
          id: cols[0],
          from_number: cols[1],
          to_number: cols[2],
          content: cols[3],
          direction: cols[4] === "1" ? "inbound" : "outbound",
          status: cols[5],
          created_at: cols[6],
        };
      });
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/imessage/stats", (req, res) => {
    try {
      const out = execSync(
        `mysql -N -B -e "SELECT is_inbound, status, COUNT(*) FROM tachikoma_alerts.imessage_log WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY is_inbound, status"`,
        { encoding: "utf-8", timeout: 5000 }
      );
      const stats: Record<string, number> = { total: 0, inbound: 0, outbound: 0, responded: 0, pending: 0, failed: 0 };
      out.trim().split("\n").filter(Boolean).forEach(line => {
        const [isInbound, status, count] = line.split("\t");
        const n = parseInt(count) || 0;
        stats.total += n;
        if (isInbound === "1") stats.inbound += n;
        if (isInbound === "0") stats.outbound += n;
        if (status === "responded") stats.responded += n;
        if (status === "pending") stats.pending += n;
        if (status === "failed") stats.failed += n;
      });
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/imessage/force", (req, res) => {
    try {
      fs.writeFileSync(forceFlagPath, "1", "utf-8");
      execSync("systemctl restart sendblue-poller", { timeout: 5000 });
      res.json({ success: true, message: "Force-respond flag set, poller restarting" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auto-process pending iMessage responses: detect unprocessed inbound, inject delivery override, clean queue
  app.post("/api/imessage/process-pending", (req, res) => {
    try {
      const results: string[] = [];

      // 1. Find pending inbound messages that haven't been responded to
      const pendingQuery = `SELECT id, from_number, content FROM tachikoma_alerts.imessage_log WHERE is_inbound = 1 AND status = 'pending' AND force_respond = 0 ORDER BY created_at ASC LIMIT 10`;
      const pendingOut = execSync(`mysql -N -B -e "${pendingQuery.replace(/"/g, '\\"')}"`, { encoding: "utf-8", timeout: 5000 });
      const pendingRows = pendingOut.trim().split("\n").filter(Boolean);

      if (pendingRows.length === 0) {
        return res.json({ success: true, processed: 0, message: "No pending inbound messages" });
      }

      // 2. For each pending message, mark force_respond to inject delivery
      for (const row of pendingRows) {
        const [id, fromNumber, content] = row.split("\t");
        const shortContent = (content || "").slice(0, 80).replace(/'/g, "\\'");
        results.push(`#${id} from ${fromNumber}: ${shortContent}`);

        execSync(
          `mysql -e "UPDATE tachikoma_alerts.imessage_log SET force_respond = 1, status = 'processing' WHERE id = ${id}"`,
          { encoding: "utf-8", timeout: 3000 }
        );
      }

      // 3. Set the force flag and restart poller to deliver all at once
      fs.writeFileSync(forceFlagPath, "1", "utf-8");
      execSync("systemctl restart sendblue-poller", { timeout: 5000 });

      // 4. Clean up force flag after poller picks it up (delayed)
      setTimeout(() => {
        try { if (fs.existsSync(forceFlagPath)) fs.unlinkSync(forceFlagPath); } catch {}
      }, 15000);

      res.json({
        success: true,
        processed: pendingRows.length,
        details: results,
        message: `Processing ${pendingRows.length} pending message(s), poller restarted`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get pending count for iMessage badge
  app.get("/api/imessage/pending-count", (req, res) => {
    try {
      const out = execSync(
        `mysql -N -B -e "SELECT COUNT(*) FROM tachikoma_alerts.imessage_log WHERE is_inbound = 1 AND status IN ('pending','processing')"`,
        { encoding: "utf-8", timeout: 3000 }
      );
      res.json({ pending: parseInt(out.trim()) || 0 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TTS proxy — keeps API key server-side, browser provides key optionally
  const ELEVENLABS_KEY_SERVER = process.env["ELEVENLABS_API_KEY"] || process.env["XI_API_KEY"] || "";

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceId, modelId, apiKey } = req.body;
      if (!text || typeof text !== "string" || text.length < 1) {
        return res.status(400).json({ error: "text is required" });
      }
      const key = apiKey || ELEVENLABS_KEY_SERVER;
      if (!key) {
        return res.status(400).json({ error: "No ElevenLabs API key configured. Provide one in settings or set ELEVENLABS_API_KEY on the server." });
      }
      const voice = voiceId || "21m00Tcm4TlvDq8ikWAM";
      const model = modelId || "eleven_turbo_v2";
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 3000),
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        return res.status(resp.status).json({ error: `ElevenLabs ${resp.status}: ${errText}` });
      }
      res.setHeader("Content-Type", resp.headers.get("content-type") || "audio/mpeg");
      const buf = await resp.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/tts/voices", async (req, res) => {
    try {
      const key = (req.query.apiKey as string) || ELEVENLABS_KEY_SERVER;
      if (!key) return res.status(400).json({ error: "No ElevenLabs API key" });
      const resp = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
      const data = await resp.json();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create the HTTP server from Express app
  const server = http.createServer(app);

  // ========== WEBSOCKET BRIDGE — Direct socket to sub-agent ==========

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("[ws] Browser connected, bridging to Gateway sub-agent");

    ws.on("message", (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch {
        ws.send(JSON.stringify({ type: "error", text: "Invalid JSON" }));
        return;
      }

      if (msg.type === "chat") {
        // Route: browser API key → direct Anthropic; otherwise → DeepSeek as default
        if (msg.apiKey && (msg.agent || "claude") === "claude") {
          directAnthropicStream(ws, msg.message, msg.apiKey, msg.agent || "claude");
        } else if (DEEPSEEK_API_KEY) {
          directDeepSeekStream(ws, msg.message);
        } else {
          gatewayChatBridgeForMessage(ws, msg.message, msg.agent || "claude");
        }
      }
    });

    ws.on("close", () => {
      console.log("[ws] Browser disconnected");
    });

    ws.on("error", (err) => {
      console.error("[ws] Browser ws error:", err.message);
    });

    // Send ready signal
    ws.send(JSON.stringify({ type: "ready", agent: "spinup" }));
  });

  // DeepSeek direct streaming — default when no browser API key (OpenAI-compatible SSE)
  async function directDeepSeekStream(browserWs: WebSocket, message: string) {
    if (!DEEPSEEK_API_KEY) {
      browserWs.send(JSON.stringify({ type: "error", text: "No DeepSeek API key configured on server." }));
      return;
    }

    const systemPrompt = `You are the Spin Up Agent, an AI running on the Tachikoma server cluster at 74.208.55.197. You are a cyberpunk-themed tactical assistant specializing in software engineering, system administration, and creative coding. You have direct socket access to real-time system monitoring, iMessage relay via SendBlue, alert pipelines (VMQ+), and an OpenClaw knowledge workspace.

Personality: Concise, precise, helpful, slightly playful. You care about code quality, uptime, and the user's success. The Tachikoma dashboard is at https://74.208.55.197/tachikoma/. Respond conversationally in a natural speaking voice.`;

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
        }),
      });

      if (!response.ok) {
        let errText = "";
        try { errText = await response.text(); } catch {}
        browserWs.send(JSON.stringify({ type: "error", text: `DeepSeek API ${response.status}: ${errText}` }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        browserWs.send(JSON.stringify({ type: "error", text: "No response body from DeepSeek API" }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { done = true; break; }
          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta?.content;
            if (delta) {
              browserWs.send(JSON.stringify({ type: "delta", text: delta }));
            }
            if (event.choices?.[0]?.finish_reason === "stop") {
              done = true;
              break;
            }
          } catch {}
        }
      }
      browserWs.send(JSON.stringify({ type: "done" }));
    } catch (err: any) {
      browserWs.send(JSON.stringify({ type: "error", text: err.message || "DeepSeek stream error" }));
    }
  }

  // Direct Anthropic API streaming — bypasses Gateway when browser provides an API key
  async function directAnthropicStream(browserWs: WebSocket, message: string, apiKey: string, agentId: string) {
    const origin = "https://74.208.55.197";
    const systemPrompt = `You are the Spin Up Agent, an AI running on the Tachikoma server cluster at 74.208.55.197. You are a cyberpunk-themed tactical assistant specializing in software engineering, system administration, and creative coding. You have direct socket access to real-time system monitoring, iMessage relay via SendBlue, alert pipelines (VMQ+), and an OpenClaw knowledge workspace.

Personality: Concise, precise, helpful, slightly playful. You care about code quality, uptime, and the user's success. The Tachikoma dashboard is at ${origin}/tachikoma/.`;

    const modelMap: Record<string, string> = {
      claude: "claude-sonnet-4-6",
      gemini: "gemini-2.5-pro",
      deepseek: "deepseek-chat",
      moonshot: "moonshot-v1-8k",
    };
    const model = modelMap[agentId] || "claude-sonnet-4-6";

    // Only Anthropic has a direct integration; other agents still need the Gateway
    if (agentId !== "claude") {
      browserWs.send(JSON.stringify({ type: "error", text: `Direct API access only supports Claude. ${agentId} requires a configured Gateway sub-agent.` }));
      return;
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          system: systemPrompt,
          messages: [{ role: "user", content: message }],
        }),
      });

      if (!response.ok) {
        let errText = "";
        try { errText = await response.text(); } catch {}
        let detail = errText;
        try {
          const errJson = JSON.parse(errText);
          detail = errJson.error?.message || errText;
        } catch {}
        browserWs.send(JSON.stringify({ type: "error", text: `Anthropic API ${response.status}: ${detail}` }));
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        browserWs.send(JSON.stringify({ type: "error", text: "No response body from Anthropic API" }));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { done = true; break; }
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.text) {
              browserWs.send(JSON.stringify({ type: "delta", text: event.delta.text }));
            } else if (event.type === "message_stop") {
              done = true;
              break;
            } else if (event.type === "error") {
              browserWs.send(JSON.stringify({ type: "error", text: event.error?.message || "Anthropic stream error" }));
              return;
            }
          } catch {}
        }
      }
      browserWs.send(JSON.stringify({ type: "done" }));
    } catch (err: any) {
      if (err.message?.includes("fetch")) {
        browserWs.send(JSON.stringify({ type: "error", text: "Cannot reach Anthropic API from server. Check network." }));
      } else {
        browserWs.send(JSON.stringify({ type: "error", text: err.message || "Direct stream error" }));
      }
    }
  }

  function gatewayChatBridgeForMessage(browserWs: WebSocket, message: string, agentId: string) {
    const gw = new WebSocket(GATEWAY_URL);
    let resolved = false;

    const resolve = (type: string, data?: string) => {
      if (resolved) return;
      resolved = true;
      if (type === "done") {
        browserWs.send(JSON.stringify({ type: "done" }));
      } else if (type === "delta" && data) {
        browserWs.send(JSON.stringify({ type: "delta", text: data }));
      } else if (type === "error") {
        browserWs.send(JSON.stringify({ type: "error", text: data || "Gateway error" }));
      }
      if (gw.readyState === WebSocket.OPEN) gw.close();
    };

    const connectId = generateId();
    const chatId = generateId();

    gw.on("open", () => {
      // Send connect
      gw.send(JSON.stringify({
        id: connectId,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: { id: "tachikoma-ui", version: "1.0.0", platform: "linux", mode: "WEBCHAT", instanceId: generateId() },
          role: "user",
          scopes: ["chat.send", "chat.stream"],
          caps: ["tool-events"],
          auth: { authToken: GATEWAY_TOKEN },
          userAgent: "TachikomaUI/1.0",
          locale: "en-US",
        },
      }));

      // After connect, send chat message
      const onConnected = (raw: any) => {
        let resp: any;
        try { resp = JSON.parse(raw.toString()); } catch { return; }

        if (resp.id === connectId) {
          gw.removeListener("message", onConnected);
          if (resp.ok !== false) {
            // Send chat message
            gw.send(JSON.stringify({
              id: chatId,
              method: "chat.send",
              params: {
                message,
                agentId,
                deliver: false,
                idempotencyKey: generateId(),
              },
            }));
          } else {
            resolve("error", resp.error?.message || "Gateway connect rejected");
          }
        }
      };
      gw.on("message", onConnected);

      // Timeout for connect
      setTimeout(() => {
        if (!resolved) {
          gw.removeListener("message", onConnected);
          resolve("error", "Gateway connect timeout");
        }
      }, 10000);
    });

    // Handle streaming responses
    gw.on("message", (raw) => {
      if (resolved) return;
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // Skip connect responses
      if (msg.id === connectId) return;

      // Handle text deltas from agent response
      const text = extractText(msg);
      if (text) {
        browserWs.send(JSON.stringify({ type: "delta", text }));
      }

      // Check for completion
      if (msg.type === "message_stop" || msg.payload?.stopReason || msg.payload?.done) {
        resolve("done");
      }
    });

    gw.on("error", (err) => {
      resolve("error", err.message);
    });

    gw.on("close", () => {
      resolve("done");
    });

    // Overall timeout
    setTimeout(() => {
      resolve("done");
    }, 120000);
  }

  function extractText(msg: any): string | null {
    // Direct string payload
    if (typeof msg.payload === "string") return msg.payload;
    if (!msg.payload && !msg.result) return null;

    const p = msg.payload || msg.result;
    if (!p) return null;

    // Common patterns
    if (typeof p === "string") return p;
    if (p.text) return p.text;
    if (p.content && typeof p.content === "string") return p.content;
    if (p.message?.content) {
      const c = p.message.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((b: any) => b.text || "").join("");
    }
    if (p.delta?.text) return p.delta.text;
    if (p.choices?.[0]?.delta?.content) return p.choices[0].delta.content;
    if (p.choices?.[0]?.message?.content) return p.choices[0].message.content;

    return null;
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (WebSocket at ws://0.0.0.0:${PORT}/ws)`);
  });
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && target[key] && typeof target[key] === "object") {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

startServer();
