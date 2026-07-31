"use client";

import { useState, useRef, useCallback } from "react";
import { createTextCapture, getUploadUrl, finalizeMediaCapture } from "@/lib/api";
import { toast } from "sonner";
import {
  Send,
  Mic,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  FileImage,
  File,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab = "text" | "voice" | "file";
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

interface SelectedFile {
  file: File;
  preview: string | null;
  type: "IMAGE" | "PDF";
}

export default function CapturePage() {
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("text");

  // File upload state
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Text Submit ────────────────────────────────────────────────────────────

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setIsSubmitting(true);
    try {
      await createTextCapture(text);
      toast.success("Captured!", {
        description: "Your thought has been saved and is being processed.",
      });
      setText("");
    } catch (err) {
      toast.error("Failed to capture", {
        description: err instanceof Error ? err.message : "An unknown error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── File Selection ─────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";

    if (!isImage && !isPDF) {
      toast.error("Unsupported file type", {
        description: "Please upload a JPG, PNG, WebP, or PDF file.",
      });
      return;
    }

    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      toast.error("File too large", {
        description: "Maximum file size is 20 MB.",
      });
      return;
    }

    const captureType: "IMAGE" | "PDF" = isImage ? "IMAGE" : "PDF";
    let preview: string | null = null;

    if (isImage) {
      preview = URL.createObjectURL(file);
    }

    setSelectedFile({ file, preview, type: captureType });
    setUploadState("idle");
    setUploadProgress(0);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const clearFile = () => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
  };

  // ── File Upload ────────────────────────────────────────────────────────────

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploadState("uploading");
    setUploadProgress(0);

    try {
      // 1. Get presigned URL from our API
      const { url, s3Key } = await getUploadUrl(
        selectedFile.file.name,
        selectedFile.file.type
      );

      // 2. Upload directly to S3 with XHR to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status}`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", selectedFile.file.type);
        xhr.send(selectedFile.file);
      });

      // 3. Notify our API to kick off processing
      setUploadState("processing");
      await finalizeMediaCapture(selectedFile.type, s3Key);

      setUploadState("done");
      toast.success("File captured!", {
        description: "Your file has been uploaded and is being analysed.",
      });
    } catch (err) {
      setUploadState("error");
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "An unknown error occurred",
      });
    }
  };

  const resetUpload = () => {
    clearFile();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 flex flex-col p-8">
      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
          <p className="text-muted-foreground mt-2">
            Dump your thoughts, meeting notes, or ideas here. We'll organize them automatically.
          </p>
        </header>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col max-h-[650px]">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["text", "voice", "file"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  activeTab === tab
                    ? "text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                )}
              >
                {tab === "text" && <FileText className="w-4 h-4" />}
                {tab === "voice" && <Mic className="w-4 h-4" />}
                {tab === "file" && <ImageIcon className="w-4 h-4" />}
                {tab === "text" ? "Text" : tab === "voice" ? "Voice" : "Image / PDF"}
              </button>
            ))}
          </div>

          <div className="p-6 flex-1 flex flex-col">
            {/* ── Text Tab ── */}
            {activeTab === "text" && (
              <form onSubmit={handleTextSubmit} className="flex-1 flex flex-col">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type anything here... e.g. 'Meeting with Sarah tomorrow at 2pm about the new design system. Need to follow up with John regarding the budget.'"
                  className="flex-1 w-full resize-none border-none outline-none text-lg bg-transparent placeholder:text-zinc-400 focus:ring-0 p-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleTextSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded border font-mono">⌘ + Enter</kbd> to submit
                  </p>
                  <button
                    type="submit"
                    disabled={!text.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Capture
                  </button>
                </div>
              </form>
            )}

            {/* ── Voice Tab ── */}
            {activeTab === "voice" && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center mb-6 border border-zinc-200">
                  <Mic className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Record Audio</h3>
                <p className="text-muted-foreground mb-8 max-w-sm">
                  Record your thoughts, meetings, or interviews. We'll transcribe and extract actionable insights.
                </p>
                <button className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-medium px-6 py-2.5 rounded-full flex items-center gap-2 transition-colors">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  Start Recording
                </button>
                <p className="text-xs text-zinc-400 mt-6">(Voice recording coming soon)</p>
              </div>
            )}

            {/* ── File Tab ── */}
            {activeTab === "file" && (
              <div className="flex-1 flex flex-col">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* No file selected: dropzone */}
                {!selectedFile && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all select-none",
                      isDragOver
                        ? "border-zinc-400 bg-zinc-100 scale-[0.99]"
                        : "border-border bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-16 h-16 rounded-full shadow-sm flex items-center justify-center mb-4 transition-transform",
                        isDragOver ? "bg-zinc-200 scale-110" : "bg-white group-hover:scale-105"
                      )}
                    >
                      <Upload className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="font-semibold mb-1">
                      {isDragOver ? "Drop to upload" : "Upload a File"}
                    </h3>
                    <p className="text-sm text-muted-foreground">Drag and drop, or click to select</p>
                    <p className="text-xs text-zinc-400 mt-2">JPG, PNG, WebP, PDF · Max 20 MB</p>
                  </div>
                )}

                {/* File selected */}
                {selectedFile && uploadState !== "done" && (
                  <div className="flex-1 flex flex-col gap-5">
                    {/* Preview / file info */}
                    <div className="flex items-start gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                      {/* Thumbnail or icon */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                        {selectedFile.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedFile.preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <File className="w-7 h-7 text-zinc-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedFile.file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {selectedFile.type} · {formatBytes(selectedFile.file.size)}
                        </p>

                        {/* Progress bar */}
                        {(uploadState === "uploading" || uploadState === "processing") && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-zinc-500">
                                {uploadState === "uploading"
                                  ? `Uploading… ${uploadProgress}%`
                                  : "Processing…"}
                              </span>
                            </div>
                            <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-300",
                                  uploadState === "processing"
                                    ? "w-full bg-zinc-400 animate-pulse"
                                    : "bg-zinc-900"
                                )}
                                style={
                                  uploadState === "uploading"
                                    ? { width: `${uploadProgress}%` }
                                    : undefined
                                }
                              />
                            </div>
                          </div>
                        )}

                        {uploadState === "error" && (
                          <p className="text-xs text-red-600 mt-2">
                            Upload failed. Please try again.
                          </p>
                        )}
                      </div>

                      {/* Remove button */}
                      {uploadState === "idle" || uploadState === "error" ? (
                        <button
                          onClick={clearFile}
                          className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    {/* Image large preview */}
                    {selectedFile.preview && (
                      <div className="flex-1 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center max-h-64">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selectedFile.preview}
                          alt="Preview"
                          className="max-w-full max-h-64 object-contain"
                        />
                      </div>
                    )}

                    {/* Action row */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <button
                        onClick={clearFile}
                        disabled={uploadState === "uploading" || uploadState === "processing"}
                        className="text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 transition-colors"
                      >
                        Choose different file
                      </button>
                      <button
                        onClick={handleFileUpload}
                        disabled={
                          uploadState === "uploading" || uploadState === "processing"
                        }
                        className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors"
                      >
                        {uploadState === "uploading" || uploadState === "processing" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {uploadState === "uploading" ? "Uploading…" : "Processing…"}
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            {uploadState === "error" ? "Retry Upload" : "Upload & Analyse"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Done state */}
                {uploadState === "done" && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">File captured!</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your file is being processed in the background. Check the Inbox shortly.
                      </p>
                    </div>
                    <button
                      onClick={resetUpload}
                      className="mt-2 inline-flex items-center gap-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-zinc-900 h-10 px-5 rounded-md text-sm font-medium transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload another file
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
