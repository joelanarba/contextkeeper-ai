"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createTextCapture, getUploadUrl, finalizeMediaCapture } from "@/lib/api";
import { toast } from "sonner";
import {
  Send,
  Mic,
  MicOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
  File,
  CheckCircle2,
  Square,
  Play,
  Pause,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type ActiveTab = "text" | "voice" | "file";
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";
type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped";

interface SelectedFile {
  file: File;
  preview: string | null;
  type: "IMAGE" | "PDF";
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Waveform bars ──────────────────────────────────────────────────────────────

function WaveformBars({ isActive }: { isActive: boolean }) {
  const bars = 20;
  return (
    <div className="flex items-center gap-[3px] h-12">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all",
            isActive ? "bg-red-500" : "bg-zinc-300"
          )}
          style={
            isActive
              ? {
                  height: `${20 + Math.random() * 60}%`,
                  animation: `waveBar 0.${4 + (i % 5)}s ease-in-out infinite alternate`,
                  animationDelay: `${(i * 50) % 400}ms`,
                }
              : { height: "20%" }
          }
        />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CapturePage() {
  // ── Text state ──
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("text");

  // ── File upload state ──
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Voice recorder state ──
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUploadState, setAudioUploadState] = useState<UploadState>("idle");
  const [audioUploadProgress, setAudioUploadProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

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

  // ── Voice Recording ────────────────────────────────────────────────────────

  const startRecording = async () => {
    setRecordingState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm/opus, fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setRecordingState("stopped");
        // Stop all microphone tracks
        stream.getTracks().forEach((t) => t.stop());
      });

      recorder.start(100); // collect data every 100ms
      setRecordingState("recording");
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setRecordingState("idle");
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access and try again."
          : err instanceof Error
          ? err.message
          : "Could not access microphone.";
      toast.error("Microphone error", { description: msg });
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setRecordingState("paused");
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setRecordingState("recording");
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const discardRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingState("idle");
    setRecordingDuration(0);
    setAudioUploadState("idle");
    setAudioUploadProgress(0);
    setIsAudioPlaying(false);
  };

  // Audio playback
  const toggleAudioPlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  // Upload the recording
  const uploadRecording = async () => {
    if (!audioBlob) return;
    setAudioUploadState("uploading");
    setAudioUploadProgress(0);

    try {
      const ext = audioBlob.type.includes("webm") ? "webm" : "ogg";
      const filename = `recording-${Date.now()}.${ext}`;
      const { url, s3Key } = await getUploadUrl(filename, audioBlob.type);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setAudioUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 error: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", audioBlob.type);
        xhr.send(audioBlob);
      });

      setAudioUploadState("processing");
      await finalizeMediaCapture("AUDIO", s3Key);
      setAudioUploadState("done");
      toast.success("Voice note captured!", {
        description: "Your recording is being transcribed and processed.",
      });
    } catch (err) {
      setAudioUploadState("error");
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : "An unknown error occurred",
      });
    }
  };

  // ── File Handling ──────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    if (!isImage && !isPDF) {
      toast.error("Unsupported file type", { description: "Please upload a JPG, PNG, WebP, or PDF file." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum file size is 20 MB." });
      return;
    }
    setSelectedFile({
      file,
      preview: isImage ? URL.createObjectURL(file) : null,
      type: isImage ? "IMAGE" : "PDF",
    });
    setUploadState("idle");
    setUploadProgress(0);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
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

  const clearFile = () => {
    if (selectedFile?.preview) URL.revokeObjectURL(selectedFile.preview);
    setSelectedFile(null);
    setUploadState("idle");
    setUploadProgress(0);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setUploadState("uploading");
    setUploadProgress(0);
    try {
      const { url, s3Key } = await getUploadUrl(selectedFile.file.name, selectedFile.file.type);
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        });
        xhr.addEventListener("load", () => {
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", selectedFile.file.type);
        xhr.send(selectedFile.file);
      });
      setUploadState("processing");
      await finalizeMediaCapture(selectedFile.type, s3Key);
      setUploadState("done");
      toast.success("File captured!", { description: "Your file has been uploaded and is being analysed." });
    } catch (err) {
      setUploadState("error");
      toast.error("Upload failed", { description: err instanceof Error ? err.message : "An unknown error occurred" });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8">
      {/* Global CSS for waveform animation */}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col">
        <header className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Capture</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
            Dump your thoughts, meeting notes, or ideas here. We'll organize them automatically.
          </p>
        </header>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[480px] max-h-[700px]">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["text", "voice", "file"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 py-3 sm:py-4 px-2 sm:px-4 text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors",
                  activeTab === tab
                    ? "text-zinc-900 bg-zinc-50 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                )}
              >
                {tab === "text" && <FileText className="w-4 h-4 shrink-0" />}
                {tab === "voice" && <Mic className="w-4 h-4 shrink-0" />}
                {tab === "file" && <ImageIcon className="w-4 h-4 shrink-0" />}
                <span>{tab === "text" ? "Text" : tab === "voice" ? "Voice" : "Image / PDF"}</span>
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            {/* ── Text Tab ── */}
            {activeTab === "text" && (
              <form onSubmit={handleTextSubmit} className="flex-1 flex flex-col">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type anything here… e.g. 'Meeting with Sarah tomorrow at 2pm about the new design system. Need to follow up with John regarding the budget.'"
                  className="flex-1 w-full resize-none border-none outline-none text-base sm:text-lg bg-transparent placeholder:text-zinc-400 focus:ring-0 p-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleTextSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <div className="mt-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    Press <kbd className="px-1.5 py-0.5 bg-muted rounded border font-mono">⌘ + Enter</kbd> to submit
                  </p>
                  <button
                    type="submit"
                    disabled={!text.trim() || isSubmitting}
                    className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors w-full sm:w-auto"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Capture
                  </button>
                </div>
              </form>
            )}

            {/* ── Voice Tab ── */}
            {activeTab === "voice" && (
              <div className="flex-1 flex flex-col">
                {/* Hidden audio element for playback */}
                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsAudioPlaying(false)}
                    onPause={() => setIsAudioPlaying(false)}
                  />
                )}

                {/* ── Idle / Requesting ── */}
                {(recordingState === "idle" || recordingState === "requesting") && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
                    <div className="relative">
                      <div className="w-24 h-24 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200">
                        <Mic className="w-10 h-10 text-zinc-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Record a Voice Note</h3>
                      <p className="text-muted-foreground text-sm max-w-sm">
                        Record meetings, ideas, or anything you want transcribed and organized automatically.
                      </p>
                    </div>
                    <button
                      onClick={startRecording}
                      disabled={recordingState === "requesting"}
                      className={cn(
                        "flex items-center gap-2.5 font-medium px-8 py-3 rounded-full transition-all",
                        recordingState === "requesting"
                          ? "bg-zinc-100 text-zinc-400 cursor-wait"
                          : "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 hover:shadow-red-300 hover:scale-105"
                      )}
                    >
                      {recordingState === "requesting" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Requesting microphone…
                        </>
                      ) : (
                        <>
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                          Start Recording
                        </>
                      )}
                    </button>
                    <p className="text-xs text-zinc-400">Your browser will ask for microphone permission</p>
                  </div>
                )}

                {/* ── Recording / Paused ── */}
                {(recordingState === "recording" || recordingState === "paused") && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-8">
                    {/* Timer + Status */}
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            recordingState === "recording"
                              ? "bg-red-500 animate-pulse"
                              : "bg-zinc-400"
                          )}
                        />
                        <span className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                          {recordingState === "recording" ? "Recording" : "Paused"}
                        </span>
                      </div>
                      <p className="text-5xl font-mono font-light tabular-nums text-zinc-900">
                        {formatDuration(recordingDuration)}
                      </p>
                    </div>

                    {/* Waveform */}
                    <WaveformBars isActive={recordingState === "recording"} />

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                      {/* Discard */}
                      <button
                        onClick={discardRecording}
                        className="w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                        title="Discard"
                      >
                        <Trash2 className="w-4 h-4 text-zinc-500" />
                      </button>

                      {/* Pause / Resume */}
                      <button
                        onClick={recordingState === "recording" ? pauseRecording : resumeRecording}
                        className="w-11 h-11 rounded-full bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                        title={recordingState === "recording" ? "Pause" : "Resume"}
                      >
                        {recordingState === "recording" ? (
                          <Pause className="w-4 h-4 text-zinc-700" />
                        ) : (
                          <Mic className="w-4 h-4 text-zinc-700" />
                        )}
                      </button>

                      {/* Stop */}
                      <button
                        onClick={stopRecording}
                        className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-200 transition-all hover:scale-105"
                        title="Stop"
                      >
                        <Square className="w-6 h-6 text-white fill-white" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Stopped — Review & Upload ── */}
                {recordingState === "stopped" && audioUploadState !== "done" && (
                  <div className="flex-1 flex flex-col gap-5">
                    {/* Review card */}
                    <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-semibold text-sm">Voice Recording</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {formatDuration(recordingDuration)} ·{" "}
                            {audioBlob ? formatBytes(audioBlob.size) : ""}
                          </p>
                        </div>
                        <button
                          onClick={discardRecording}
                          disabled={audioUploadState === "uploading" || audioUploadState === "processing"}
                          className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Native audio player */}
                      {audioUrl && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={toggleAudioPlayback}
                            className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-700 flex items-center justify-center shrink-0 transition-colors"
                          >
                            {isAudioPlaying ? (
                              <Pause className="w-4 h-4 text-white" />
                            ) : (
                              <Play className="w-4 h-4 text-white ml-0.5" />
                            )}
                          </button>
                          <audio
                            controls
                            src={audioUrl}
                            className="flex-1 h-8"
                            style={{ colorScheme: "light" }}
                            onPlay={() => setIsAudioPlaying(true)}
                            onPause={() => setIsAudioPlaying(false)}
                            onEnded={() => setIsAudioPlaying(false)}
                          />
                        </div>
                      )}

                      {/* Upload progress */}
                      {(audioUploadState === "uploading" || audioUploadState === "processing") && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-zinc-500">
                              {audioUploadState === "uploading"
                                ? `Uploading… ${audioUploadProgress}%`
                                : "Processing…"}
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                audioUploadState === "processing"
                                  ? "w-full bg-zinc-400 animate-pulse"
                                  : "bg-zinc-900"
                              )}
                              style={
                                audioUploadState === "uploading"
                                  ? { width: `${audioUploadProgress}%` }
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                      )}

                      {audioUploadState === "error" && (
                        <p className="text-xs text-red-600 mt-3">Upload failed. Please try again.</p>
                      )}
                    </div>

                    {/* Tip */}
                    <p className="text-xs text-zinc-400 text-center">
                      Your recording will be transcribed and key items will be extracted automatically.
                    </p>

                    {/* Action row */}
                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 mt-auto pt-4 border-t border-border">
                      <button
                        onClick={discardRecording}
                        disabled={audioUploadState === "uploading" || audioUploadState === "processing"}
                        className="flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-40 transition-colors py-2 sm:py-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Record again
                      </button>
                      <button
                        onClick={uploadRecording}
                        disabled={audioUploadState === "uploading" || audioUploadState === "processing"}
                        className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors w-full sm:w-auto"
                      >
                        {audioUploadState === "uploading" || audioUploadState === "processing" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {audioUploadState === "uploading" ? "Uploading…" : "Processing…"}
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            {audioUploadState === "error" ? "Retry Upload" : "Upload & Transcribe"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Done ── */}
                {audioUploadState === "done" && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Voice note captured!</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your recording is being transcribed. Check the Inbox shortly.
                      </p>
                    </div>
                    <button
                      onClick={discardRecording}
                      className="mt-2 inline-flex items-center gap-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-zinc-900 h-10 px-5 rounded-md text-sm font-medium transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Record another note
                    </button>
                  </div>
                )}
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

                {!selectedFile && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all select-none",
                      isDragOver
                        ? "border-zinc-400 bg-zinc-100 scale-[0.99]"
                        : "border-border bg-zinc-50/50 hover:bg-zinc-50 hover:border-zinc-300"
                    )}
                  >
                    <div className={cn("w-16 h-16 rounded-full shadow-sm flex items-center justify-center mb-4 transition-transform", isDragOver ? "bg-zinc-200 scale-110" : "bg-white")}>
                      <Upload className="w-6 h-6 text-zinc-400" />
                    </div>
                    <h3 className="font-semibold mb-1">{isDragOver ? "Drop to upload" : "Upload a File"}</h3>
                    <p className="text-sm text-muted-foreground">Drag and drop, or click to select</p>
                    <p className="text-xs text-zinc-400 mt-2">JPG, PNG, WebP, PDF · Max 20 MB</p>
                  </div>
                )}

                {selectedFile && uploadState !== "done" && (
                  <div className="flex-1 flex flex-col gap-5">
                    <div className="flex items-start gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-zinc-200 flex items-center justify-center shrink-0">
                        {selectedFile.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selectedFile.preview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <File className="w-7 h-7 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{selectedFile.file.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{selectedFile.type} · {formatBytes(selectedFile.file.size)}</p>
                        {(uploadState === "uploading" || uploadState === "processing") && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-zinc-500">
                                {uploadState === "uploading" ? `Uploading… ${uploadProgress}%` : "Processing…"}
                              </span>
                            </div>
                            <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-300", uploadState === "processing" ? "w-full bg-zinc-400 animate-pulse" : "bg-zinc-900")}
                                style={uploadState === "uploading" ? { width: `${uploadProgress}%` } : undefined}
                              />
                            </div>
                          </div>
                        )}
                        {uploadState === "error" && <p className="text-xs text-red-600 mt-2">Upload failed. Please try again.</p>}
                      </div>
                      {(uploadState === "idle" || uploadState === "error") && (
                        <button onClick={clearFile} className="p-1.5 rounded-md hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {selectedFile.preview && (
                      <div className="flex-1 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100 flex items-center justify-center max-h-64">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedFile.preview} alt="Preview" className="max-w-full max-h-64 object-contain" />
                      </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 pt-3 border-t border-border">
                      <button onClick={clearFile} disabled={uploadState === "uploading" || uploadState === "processing"} className="text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 transition-colors py-2 sm:py-0 text-center">
                        Choose different file
                      </button>
                      <button
                        onClick={handleFileUpload}
                        disabled={uploadState === "uploading" || uploadState === "processing"}
                        className="inline-flex items-center justify-center gap-2 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-6 rounded-md font-medium transition-colors w-full sm:w-auto"
                      >
                        {uploadState === "uploading" || uploadState === "processing" ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />{uploadState === "uploading" ? "Uploading…" : "Processing…"}</>
                        ) : (
                          <><Upload className="w-4 h-4" />{uploadState === "error" ? "Retry Upload" : "Upload & Analyse"}</>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {uploadState === "done" && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">File captured!</h3>
                      <p className="text-sm text-muted-foreground mt-1">Your file is being processed. Check the Inbox shortly.</p>
                    </div>
                    <button onClick={() => { clearFile(); }} className="mt-2 inline-flex items-center gap-2 border border-zinc-300 hover:border-zinc-400 text-zinc-700 hover:text-zinc-900 h-10 px-5 rounded-md text-sm font-medium transition-colors">
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
