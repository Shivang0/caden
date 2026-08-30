"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { VoiceNoteButtonProps } from "@/lib/types";

// ---- Minimal typings for the (prefixed) Web Speech API ----
interface SpeechAlternativeLike {
  transcript: string;
}
interface SpeechResultLike {
  0: SpeechAlternativeLike;
  isFinal: boolean;
  length: number;
}
interface SpeechResultListLike {
  length: number;
  [index: number]: SpeechResultLike;
}
interface SpeechEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Support = "unknown" | "recorder" | "speech" | "none";
type Status = "idle" | "recording" | "dictating" | "transcribing";

const emptySubscribe = () => () => undefined;

function detectSupport(): Support {
  const hasRecorder =
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;
  if (hasRecorder) return "recorder";
  return getSpeechCtor() ? "speech" : "none";
}

const serverSupport = (): Support => "unknown";

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

/**
 * Mic button: records audio → POSTs to /api/transcribe (Aqua Voice).
 * On 501 (no key) it falls back to the browser's live SpeechRecognition.
 * If neither is available, it disables itself with a tooltip.
 */
export function VoiceNoteButton({ onTranscript, disabled }: VoiceNoteButtonProps) {
  const support = useSyncExternalStore(
    emptySubscribe,
    detectSupport,
    serverSupport,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationFinalsRef = useRef<string[]>([]);
  const serverUnavailableRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* already inactive */
      }
      try {
        recognitionRef.current?.abort();
      } catch {
        /* not started */
      }
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const flashNotice = useCallback((message: string, ms = 4000) => {
    if (!mountedRef.current) return;
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setNotice(null);
    }, ms);
  }, []);

  // ---- Fallback: live browser dictation ----
  const startDictation = useCallback(
    (reason?: string) => {
      const Ctor = getSpeechCtor();
      if (!Ctor) {
        setStatus("idle");
        flashNotice("Voice input unavailable in this browser");
        return;
      }
      if (reason) flashNotice(reason, 3000);
      const recognition = new Ctor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      dictationFinalsRef.current = [];

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result?.isFinal) {
            const text = result[0]?.transcript?.trim();
            if (text) dictationFinalsRef.current.push(text);
          }
        }
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          flashNotice("Microphone access denied. Enable it in browser settings");
        }
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        const text = dictationFinalsRef.current.join(" ").trim();
        dictationFinalsRef.current = [];
        if (!mountedRef.current) return;
        setStatus("idle");
        if (text) onTranscript(text);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setStatus("dictating");
      } catch {
        recognitionRef.current = null;
        setStatus("idle");
        flashNotice("Voice input unavailable in this browser");
      }
    },
    [flashNotice, onTranscript],
  );

  // ---- Primary path: MediaRecorder → /api/transcribe ----
  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setStatus("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "note.webm");
        const res = await fetch("/portal/api/transcribe", { method: "POST", body: form });
        if (res.ok) {
          const data = (await res.json()) as { text?: string };
          if (!mountedRef.current) return;
          setStatus("idle");
          if (data.text?.trim()) onTranscript(data.text.trim());
          else flashNotice("Didn't catch that. Try again");
          return;
        }
        // 501 (no key) or upstream failure (502) → live dictation fallback.
        // Only a missing key is permanent for the session; upstream outages
        // may recover, so let the next attempt retry the server.
        if (res.status === 501) serverUnavailableRef.current = true;
        if (!mountedRef.current) return;
        if (getSpeechCtor()) {
          startDictation(
            res.status === 501
              ? "Server transcription not configured. Dictating live, speak now"
              : "Server transcription failed. Dictating live, speak now",
          );
        } else {
          setStatus("idle");
          flashNotice("Voice input unavailable in this browser");
        }
      } catch {
        if (!mountedRef.current) return;
        setStatus("idle");
        flashNotice("Transcription failed. Try again");
      }
    },
    [flashNotice, onTranscript, startDictation],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = RECORDER_MIME_CANDIDATES.find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) void transcribeBlob(blob);
        else if (mountedRef.current) setStatus("idle");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setStatus("idle");
      flashNotice(
        denied
          ? "Microphone access denied. Enable it in browser settings"
          : "Could not access microphone",
      );
    }
  }, [flashNotice, transcribeBlob]);

  const handleClick = useCallback(() => {
    if (disabled || support === "none" || support === "unknown") return;
    if (status === "transcribing") return;
    if (status === "recording") {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        setStatus("idle");
      }
      mediaRecorderRef.current = null;
      return;
    }
    if (status === "dictating") {
      try {
        recognitionRef.current?.stop();
      } catch {
        setStatus("idle");
      }
      return;
    }
    // idle → start
    if (support === "speech" || serverUnavailableRef.current) {
      if (getSpeechCtor()) startDictation();
      else void startRecording();
    } else {
      void startRecording();
    }
  }, [disabled, status, support, startDictation, startRecording]);

  const unavailable = support === "none";
  const busy = status === "transcribing";
  const active = status === "recording" || status === "dictating";
  const isDisabled = Boolean(disabled) || unavailable || busy;

  const label = unavailable
    ? "Voice input unavailable in this browser"
    : status === "recording"
      ? "Stop recording"
      : status === "dictating"
        ? "Stop dictation"
        : busy
          ? "Transcribing…"
          : "Dictate with your voice";

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-label={label}
        title={label}
        className={[
          "caden-pill group relative inline-flex h-9 items-center gap-2 border px-3 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
          active
            ? "border-[#f9fe2e]/60 bg-[#f9fe2e]/10 text-[#f9fe2e]"
            : "border-[#363636] bg-[#212121] text-[#8f8f8f] hover:border-[#676767] hover:text-[#f1f1f1]",
          isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        {active ? (
          <span className="caden-blink relative inline-flex h-2.5 w-2.5 bg-[#f9fe2e]" />
        ) : busy ? (
          <svg
            className="h-3.5 w-3.5 animate-spin text-[#f9fe2e]"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 17v4" />
          </svg>
        )}
        <span>
          {status === "recording"
            ? "Recording… tap to stop"
            : status === "dictating"
              ? "Listening… tap to stop"
              : busy
                ? "Transcribing…"
                : "Voice note"}
        </span>
      </button>
      {notice && (
        <span
          role="status"
          className="absolute left-0 top-full z-10 mt-1.5 w-max max-w-[16rem] rounded-lg border border-[#363636] bg-[#212121] px-2.5 py-1.5 text-[11px] text-[#b5b5b5]"
        >
          {notice}
        </span>
      )}
    </div>
  );
}
