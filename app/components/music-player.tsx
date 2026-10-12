
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function MusicPlayer() {
  const pathname = usePathname();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const startedRef = useRef(false);

  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  // Music changes depending on the page
  const musicSrc = pathname.startsWith("/games")
    ? "/music/dark.mp3"
    : "/music/romantic.mp3";

  // Restore mute preference
  useEffect(() => {
    let savedMuted = false;

    try {
      savedMuted =
        localStorage.getItem("just-us-muted") === "true";
    } catch {
      // Local storage may be unavailable
    }

    mutedRef.current = savedMuted;
    setMuted(savedMuted);
    setReady(true);
  }, []);

  // Keep mute preference synchronized
  useEffect(() => {
    if (!ready) return;

    mutedRef.current = muted;

    const audio = audioRef.current;

    if (audio) {
      audio.muted = muted;
      audio.volume = 0.3;
    }

    try {
      localStorage.setItem(
        "just-us-muted",
        String(muted)
      );
    } catch {
      // Local storage may be unavailable
    }
  }, [muted, ready]);

  // Switch music when navigating between pages
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.3;
    audio.loop = true;
    audio.muted = mutedRef.current;

    if (startedRef.current && !mutedRef.current) {
      void audio.play().catch(() => {
        // Browser may block playback
      });
    }
  }, [musicSrc]);

  // Background music and button sound effects
  useEffect(() => {
    function startMusic() {
      const currentAudio = audioRef.current;

      if (!currentAudio) return;
      if (mutedRef.current) return;

      if (currentAudio.paused) {
        void currentAudio
          .play()
          .then(() => {
            startedRef.current = true;
          })
          .catch(() => {
            // Autoplay may be blocked
          });
      }
    }

    function playClickSound(
      target: EventTarget | null
    ) {
      if (mutedRef.current) return;
      if (!(target instanceof Element)) return;

      const button = target.closest(
        "button, a, [role='button']"
      );

      if (!button) return;

      if (
        button instanceof HTMLButtonElement &&
        button.disabled
      ) {
        return;
      }

      try {
        let ctx = contextRef.current;

        if (!ctx) {
          ctx = new AudioContext();
          contextRef.current = ctx;
        }

        if (ctx.state === "suspended") {
          void ctx.resume();
        }

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
          650,
          ctx.currentTime
        );

        oscillator.frequency.exponentialRampToValueAtTime(
          450,
          ctx.currentTime + 0.07
        );

        gain.gain.setValueAtTime(
          0.025,
          ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + 0.08
        );

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start();
        oscillator.stop(
          ctx.currentTime + 0.08
        );
      } catch {
        // Sound effects are optional
      }
    }

    function handlePointerDown(
      event: PointerEvent
    ) {
      startMusic();
      playClickSound(event.target);
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        startMusic();
        playClickSound(event.target);
      }
    }

    // Try to start music automatically
    startMusic();

    // Start after first interaction if autoplay is blocked
    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      const ctx = contextRef.current;

      if (ctx) {
        void ctx.close();
        contextRef.current = null;
      }
    };
  }, []);

  // Personal mute / unmute
  function toggleMute() {
    const nextMuted = !mutedRef.current;

    mutedRef.current = nextMuted;
    setMuted(nextMuted);

    const currentAudio = audioRef.current;

    if (!currentAudio) return;

    currentAudio.muted = nextMuted;

    if (nextMuted) {
      currentAudio.pause();
    } else {
      void currentAudio
        .play()
        .then(() => {
          startedRef.current = true;
        })
        .catch(() => {
          // Browser may block playback
        });
    }
  }

  return (
    <>
      {/* Background music */}
      <audio
        ref={audioRef}
        src={musicSrc}
        loop
        preload="auto"
        playsInline
        aria-hidden="true"
        style={{ display: "none" }}
      />

      {/* Small mute button */}
      {ready && (
        <button
          type="button"
          onClick={toggleMute}
          aria-label={
            muted
              ? "Enable sound"
              : "Mute sound"
          }
          aria-pressed={muted}
          title={
            muted
              ? "Enable sound"
              : "Silence"
          }
          className="
            fixed bottom-5 right-5 z-[9999]
            flex h-12 w-12
            items-center justify-center
            rounded-full
            border border-pink-400/40
            bg-[#160b1d]/90
            text-xl text-white
            shadow-lg shadow-pink-500/20
            backdrop-blur-xl
            transition-all duration-200
            hover:scale-110
            hover:border-pink-400
            hover:shadow-pink-500/40
            active:scale-95
          "
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}
    </>
  );
}
