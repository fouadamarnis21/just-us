
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  CheckCircle2,
  Clock3,
  Heart,
} from "lucide-react";

import {
  getTodReadyStatus,
  markTodReady,
} from "./game-ready-actions";

import "./ready-panel.css";

type Status = {
  round_no: number;
  phase: string;
  first_ready: boolean;
  second_ready: boolean;
};

type ReadySound = "confirm" | "partner" | "complete";

// JUST US — Ready Panel Sound Effects
function playReadySound(type: ReadySound) {
  if (typeof window === "undefined") return;

  try {
    // Respect the global Silence button
    if (
      localStorage.getItem("just-us-muted") === "true"
    ) {
      return;
    }

    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;

    const context = new AudioCtor();

    const sounds: Record<
      ReadySound,
      {
        notes: number[];
        duration: number;
        volume: number;
      }
    > = {
      confirm: {
        notes: [520, 700],
        duration: 0.12,
        volume: 0.035,
      },

      partner: {
        notes: [650, 850],
        duration: 0.13,
        volume: 0.035,
      },

      complete: {
        notes: [523, 659, 784, 1047],
        duration: 0.14,
        volume: 0.045,
      },
    };

    const config = sounds[type];
    const startTime = context.currentTime;

    config.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      const start =
        startTime + index * config.duration;

      oscillator.type = "sine";

      oscillator.frequency.setValueAtTime(
        frequency,
        start
      );

      gain.gain.setValueAtTime(0.0001, start);

      gain.gain.exponentialRampToValueAtTime(
        config.volume,
        start + 0.02
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        start + config.duration
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(start);
      oscillator.stop(start + config.duration);
    });

    window.setTimeout(() => {
      void context.close().catch(() => {});
    }, 1500);
  } catch {
    // Audio must never interrupt the game
  }
}

export default function ReadyPanel({
  roomId,
  roundNo,
  userId,
  firstUser,
  isClassic,
  currentTurn,
}: {
  roomId: string;
  roundNo: number;
  userId: string;
  firstUser: string;
  isClassic: boolean;
  currentTurn: string | null;
}) {
  const router = useRouter();

  const [status, setStatus] = useState<Status | null>(
    null
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Prevent repeated sounds during polling
  const previousStatus = useRef<Status | null>(null);

  const isAuthor =
    isClassic && currentTurn === userId;

  const mine =
    firstUser === userId
      ? status?.first_ready
      : status?.second_ready;

  const other =
    firstUser === userId
      ? status?.second_ready
      : status?.first_ready;

  // Detect when partner confirms or both are ready
  function updateReadyStatus(next: Status) {
    const previous = previousStatus.current;

    const nextMine =
      firstUser === userId
        ? next.first_ready
        : next.second_ready;

    const nextOther =
      firstUser === userId
        ? next.second_ready
        : next.first_ready;

    if (
      previous &&
      previous.round_no === next.round_no
    ) {
      const previousOther =
        firstUser === userId
          ? previous.second_ready
          : previous.first_ready;

      const previouslyComplete =
        previous.first_ready &&
        previous.second_ready;

      const nowComplete =
        next.first_ready &&
        next.second_ready;

      if (
        nowComplete &&
        !previouslyComplete
      ) {
        playReadySound("complete");
      } else if (
        nextOther &&
        !previousOther &&
        !nextMine
      ) {
        playReadySound("partner");
      }
    }

    previousStatus.current = next;
    setStatus(next);
  }

  // Automatic sync every 2 seconds
  useEffect(() => {
    let active = true;
    let inFlight = false;

    async function sync() {
      if (inFlight || document.hidden) return;

      inFlight = true;

      try {
        const next = await getTodReadyStatus(roomId);

        if (!active) return;

        if (next) {
          // Compare status without repeating sounds
          const previous = previousStatus.current;

          const nextMine =
            firstUser === userId
              ? next.first_ready
              : next.second_ready;

          const nextOther =
            firstUser === userId
              ? next.second_ready
              : next.first_ready;

          if (
            previous &&
            previous.round_no === next.round_no
          ) {
            const previousOther =
              firstUser === userId
                ? previous.second_ready
                : previous.first_ready;

            const previouslyComplete =
              previous.first_ready &&
              previous.second_ready;

            const nowComplete =
              next.first_ready &&
              next.second_ready;

            if (
              nowComplete &&
              !previouslyComplete
            ) {
              playReadySound("complete");
            } else if (
              nextOther &&
              !previousOther &&
              !nextMine
            ) {
              playReadySound("partner");
            }
          }

          previousStatus.current = next;
          setStatus(next);

          if (
            next.round_no !== roundNo ||
            next.phase !== "reveal"
          ) {
            router.refresh();
          }
        }
      } finally {
        inFlight = false;
      }
    }

    void sync();

    const timer = window.setInterval(() => {
      void sync();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [roomId, roundNo, router, firstUser, userId]);

  // Confirm that this player is ready
  async function confirm() {
    if (busy || mine) return;

    setBusy(true);
    setError("");

    try {
      const result = await markTodReady(roomId);

      if (!result.ok) {
        setError(
          result.error ?? "وقع خطأ."
        );
        return;
      }

      // Confirmation sound
      playReadySound("confirm");

      const next = await getTodReadyStatus(roomId);

      if (next) {
        updateReadyStatus(next);
      }

      router.refresh();
    } catch {
      setError(
        "وقع مشكل فالاتصال. عاود جرّب."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="tod-ready-panel"
      dir="rtl"
    >
      <div className="tod-ready-heading">
        <Heart
          size={19}
          fill="currentColor"
        />

        {isAuthor
          ? "الجواب ديالك تصيفط ❤️"
          : "قريتو الجواب؟"}
      </div>

      <p className="tod-ready-description">
        {isAuthor
          ? "نتا واجد تلقائياً حيث نتا اللي جاوبتي. كنتسناو الطرف الآخر يقرا الجواب."
          : isClassic
            ? "قرا الجواب براحتك، ومن بعد أكد باش نبداو الجولة التالية."
            : "كل واحد يقرا جواب الآخر براحتو. الجولة ما كتبدلش حتى تأكدو بجوج."}
      </p>

      <div className="tod-ready-players">
        <div
          className={`tod-ready-person ${
            mine ? "is-ready" : ""
          }`}
        >
          {mine ? (
            <CheckCircle2 size={21} />
          ) : (
            <Clock3 size={21} />
          )}

          <strong>نتا</strong>

          <small>
            {mine ? "واجد ✓" : "باقي"}
          </small>
        </div>

        <div
          className={`tod-ready-person ${
            other ? "is-ready" : ""
          }`}
        >
          {other ? (
            <CheckCircle2 size={21} />
          ) : (
            <Clock3 size={21} />
          )}

          <strong>الطرف الآخر</strong>

          <small>
            {other ? "واجد ✓" : "باقي"}
          </small>
        </div>
      </div>

      {error && (
        <p
          className="tod-ready-error"
          role="alert"
        >
          {error}
        </p>
      )}

      {isAuthor ? (
        <div className="tod-ready-wait">
          <Clock3 size={18} />

          {other
            ? "الطرف الآخر أكد، كنبدلو الجولة..."
            : "جوابك تسجل، كنتسناو الطرف الآخر يقراه..."}
        </div>
      ) : mine ? (
        <div className="tod-ready-wait">
          <Clock3 size={18} />

          {other
            ? "بجوج واجدين، كنبدلو الجولة..."
            : "تسجل التأكيد ديالك. كنتسناو الطرف الآخر..."}
        </div>
      ) : (
        <button
          className="tod-game-primary tod-ready-button"
          type="button"
          onClick={confirm}
          disabled={busy}
        >
          {busy
            ? "كنسجلو التأكيد..."
            : isClassic
              ? "قريت الجواب، نكملو ❤️"
              : "قريت جواب الطرف الآخر، أنا واجد ❤️"}

          <CheckCircle2 size={20} />
        </button>
      )}
    </div>
  );
}
