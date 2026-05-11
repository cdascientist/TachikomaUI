import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const vaultDir = path.join(rootDir, "src");

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
    // Keep original name but prevent path traversal attacks by getting strictly the basename
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

  // JSON parser for explicit API requests
  app.use(express.json());

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
    // VERY IMPORTANT: Prevent Path Traversal
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

startServer();
