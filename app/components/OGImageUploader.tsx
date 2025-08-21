'use client'

import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, UploadCloud, ImageIcon, Trash2, Link as LinkIcon } from "lucide-react";

interface OGImageUploaderProps {
  onImageUploaded?: (cid: string, file: File) => void;
  className?: string;
}

export default function OGImageUploader({ onImageUploaded, className = "" }: OGImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploads, setUploads] = useState<Array<{ cid: string; name: string; type: string }>>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const API_BASE = useMemo(() => (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:4000` : "http://localhost:4000"), []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSelect(f);
  }, []);

  const handleSelect = (f: File) => {
    setFile(f);
    setError(null);
    setSuccess(null);
    setProgress(0);
    setCopied(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress(5);

    const fallbackDirectUpload = async () => {
      try {
        const directForm = new FormData();
        directForm.append('file', file);
        const resp = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/upload`, {
          method: 'POST',
          body: directForm
        });
        if (!resp.ok) throw new Error(`direct upload failed: ${resp.status}`);
        const json = await resp.json();
        const returned = json.rootHash || json.cid;
        if (returned) {
          setProgress(100);
          setSuccess(returned);
          setUploads((u) => [{ cid: returned, name: file.name, type: file.type }, ...u]);
          onImageUploaded?.(returned, file);
          return true;
        }
      } catch (e: any) {
        console.error('Direct 0G kit upload failed:', e);
      }
      return false;
    };

    try {
      const form = new FormData();
      form.append("file", file);

      // Use XMLHttpRequest to report progress for multipart/form-data
      await new Promise<void>(async (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload`);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.min(95, Math.round((evt.loaded / evt.total) * 100));
            setProgress(pct);
          }
        };
        xhr.onreadystatechange = async () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                const returned = json.rootHash || json.cid; // prefer rootHash from 0G kit proxy
                if (returned) {
                  setProgress(100);
                  setSuccess(returned);
                  setUploads((u) => [{ cid: returned, name: file.name, type: file.type }, ...u]);
                  
                  // Call the callback if provided
                  if (onImageUploaded) {
                    onImageUploaded(returned, file);
                  }
                } else {
                  setError("Upload succeeded but no rootHash returned");
                }
                resolve();
              } catch (e) {
                setError("Invalid server response");
                reject(e);
              }
            } else {
              // Backend failed; try direct 0G kit upload as fallback
              const ok = await fallbackDirectUpload();
              if (ok) resolve(); else {
                setError(`Upload failed (${xhr.status})`);
                reject(new Error(`Upload failed ${xhr.status}`));
              }
            }
          }
        };
        xhr.onerror = async () => {
          // Network error to backend; try direct 0G kit upload
          const ok = await fallbackDirectUpload();
          if (ok) resolve(); else {
            setError("Network error while uploading");
            reject(new Error("network"));
          }
        };
        xhr.send(form);
      });
    } catch (e: any) {
      console.error(e);
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setError(null);
    setSuccess(null);
    setCopied(false);
    setProgress(0);
  };

  const copyCid = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop,
  } as const;

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl p-6 bg-slate-800/90 backdrop-blur border border-slate-700/50 shadow-2xl"
      >
        <div
          {...dragProps}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer grid place-items-center rounded-2xl border-2 border-dashed p-8 transition relative overflow-hidden ${
            isDragging ? "border-purple-400 bg-purple-500/10" : "border-slate-600/50 hover:border-purple-500/50"
          }`}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 blur-2xl" />
          </div>
          <div className="flex flex-col items-center gap-3 z-10 text-center">
            <UploadCloud className="w-10 h-10 text-purple-400" />
            <div className="text-lg font-semibold text-slate-200">Drop image here or click to choose</div>
            <div className="text-sm text-slate-400">PNG, JPG, GIF, or WebP. 10MB max</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelect(f);
              }}
            />
          </div>
        </div>

        {file && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview */}
            <div className="rounded-xl overflow-hidden bg-slate-700/40 border border-slate-600/50">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-64 object-contain bg-slate-800" />
              ) : (
                <div className="h-64 grid place-items-center text-slate-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-400">Selected</div>
                  <div className="font-semibold break-all text-slate-200">{file.name}</div>
                  <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · {file.type || "image"}</div>
                </div>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
              </div>

              <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={uploading}
                  onClick={onUpload}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg text-white font-semibold"
                >
                  {uploading ? "Uploading…" : "Upload to 0G Storage"}
                </button>

                {success && (
                  <>
                    <button
                      onClick={copyCid}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/80 text-slate-200"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy CID"}
                    </button>
                    <a
                      href={`${API_BASE}/download/${success}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/80 text-slate-200"
                    >
                      <LinkIcon className="w-4 h-4" /> Open Image
                    </a>
                  </>
                )}
              </div>

              {error && (
                <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 break-all">
                  Uploaded! CID: {success}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Recent Uploads */}
      {uploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <h3 className="text-lg font-bold mb-3 text-slate-200">Recent uploads</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {uploads.map((u) => (
              <div key={u.cid} className="rounded-xl overflow-hidden bg-slate-700/40 border border-slate-600/50">
                <div className="aspect-video bg-slate-800 grid place-items-center overflow-hidden">
                  <img
                    src={`${API_BASE}/download/${u.cid}`}
                    alt={u.name}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="p-3 text-xs">
                  <div className="font-semibold truncate text-slate-200" title={u.name}>{u.name}</div>
                  <div className="text-slate-400 truncate" title={u.cid}>{u.cid}</div>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={`${API_BASE}/download/${u.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-600/60 border border-slate-500/50 hover:bg-slate-600/80 text-slate-200"
                    >
                      <LinkIcon className="w-3 h-3" /> View
                    </a>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(u.cid); } catch {}
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-600/60 border border-slate-500/50 hover:bg-slate-600/80 text-slate-200"
                    >
                      <Copy className="w-3 h-3" /> Copy CID
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="mt-4 text-center text-xs text-slate-500">
        Backend: <span className="font-mono">{API_BASE}</span>
      </div>
    </div>
  );
}


