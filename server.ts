import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const vaultDir = path.join(rootDir, "src");
const workspaceDir = "/root/.openclaw/workspace";
const openclawConfigPath = "/root/.openclaw/openclaw.json";
const pollStatePath = "/var/lib/sendblue/poll-state.json";
const forceFlagPath = "/var/lib/sendblue/force-respond.flag";

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
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