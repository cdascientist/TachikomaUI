import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemButton from "@mui/joy/ListItemButton";
import ListItemContent from "@mui/joy/ListItemContent";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import Snackbar from "@mui/joy/Snackbar";
import { ConfigPageShell } from "./ConfigPageShell";
import { useApi } from "../hooks/useApi";
import { Save, FileText, FileWarning } from "lucide-react";

interface WsFile { name: string; size: number; updatedAt: string }
interface FileContent { name: string; content: string; size: number }

export const MemoryEditorPage: React.FC = () => {
  const { data: files, loading, error, refetch: refetchFiles } = useApi<WsFile[]>("/api/workspace/files");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    fetch(`/api/workspace/file/${encodeURIComponent(selectedFile)}`)
      .then(r => r.json())
      .then((d: FileContent) => {
        if (!cancelled) { setContent(d.content); setOriginalContent(d.content); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedFile]);

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await fetch(`/api/workspace/file/${encodeURIComponent(selectedFile)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setOriginalContent(content);
      setSaveMsg(`Saved ${selectedFile}`);
      setTimeout(() => setSaveMsg(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = content !== originalContent;
  const fileList = files || [];

  return (
    <ConfigPageShell title="Memory Editor" description="Workspace soul files — edit markdown memories, identity, and skill definitions" accentColor="fuchsia" loading={loading} error={error} onRetry={refetchFiles}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: "flex-start" }}>
        <motion.div style={{ width: "100%", maxWidth: 280, flexShrink: 0 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          <Typography level="title-sm" fontFamily="monospace" startDecorator={<FileText size={16} />} sx={{ color: "#e2e8f0", mb: 1 }}>
            Workspace Files
          </Typography>
          <List variant="outlined" sx={{ borderRadius: 12, borderColor: "rgba(192,38,211,0.2)", bg: "rgba(192,38,211,0.03)", maxHeight: 420, overflow: "auto" }}>
            {fileList.map(f => (
              <ListItem key={f.name}>
                <ListItemButton
                  selected={selectedFile === f.name}
                  onClick={() => setSelectedFile(f.name)}
                  sx={{ borderRadius: 8, fontFamily: "monospace", fontSize: 13 }}
                >
                  <ListItemContent>{f.name}</ListItemContent>
                  <Chip size="sm" variant="soft" sx={{ fontFamily: "monospace", fontSize: 10 }}>
                    {(f.size / 1024).toFixed(1)} KB
                  </Chip>
                </ListItemButton>
              </ListItem>
            ))}
            {fileList.length === 0 && (
              <ListItem><Typography level="body-sm" fontFamily="monospace" sx={{ color: "#6b7280" }}>No files found</Typography></ListItem>
            )}
          </List>
        </motion.div>

        <motion.div style={{ flex: 1, width: "100%" }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
          {selectedFile ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip variant="solid" size="sm" sx={{ fontFamily: "monospace", bg: "#c026d340", color: "#e879f9" }}>{selectedFile}</Chip>
                {isDirty && <Chip size="sm" variant="soft" color="warning" startDecorator={<FileWarning size={12} />} sx={{ fontFamily: "monospace" }}>Modified</Chip>}
              </Stack>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                minRows={14}
                maxRows={22}
                sx={{
                  fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
                  bg: "rgba(0,0,0,0.6)", borderColor: "rgba(192,38,211,0.2)",
                  color: "#e2e8f0", borderRadius: 12, mb: 1.5,
                  "&:focus-within": { borderColor: "#c026d3" },
                }}
              />
              <Button
                onClick={handleSave}
                loading={saving}
                startDecorator={<Save size={16} />}
                disabled={!isDirty}
                sx={{
                  fontFamily: "monospace", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em",
                  bg: isDirty ? "#c026d3" : "#374151", "&:hover": { bg: isDirty ? "#a21caf" : "#4b5563" },
                }}
              >
                Save {selectedFile}
              </Button>
            </>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ height: 300 }}>
              <FileText size={48} style={{ color: "#6b7280", marginBottom: 12 }} />
              <Typography level="body-md" fontFamily="monospace" sx={{ color: "#6b7280" }}>
                Select a file from the list to edit
              </Typography>
            </Stack>
          )}
        </motion.div>
      </Stack>
      <Snackbar open={!!saveMsg} color="success" variant="solid" autoHideDuration={2500} onClose={() => setSaveMsg("")} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {saveMsg}
      </Snackbar>
    </ConfigPageShell>
  );
};
