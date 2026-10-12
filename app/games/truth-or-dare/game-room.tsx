
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Check,
  Copy,
  Flame,
  Heart,
  LockKeyhole,
  RefreshCw,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

import {
  chooseTodPrompt,
  submitTodAnswer,
} from "./game-actions";

import ReadyPanel from "./ready-panel";
import "./game-room.css";

type Room = {
  id: string;
  first_user: string;
  second_user: string | null;
  mode: string;
  status: string;
  round_no: number;
  current_turn: string | null;
  prompt_id: number | null;
  phase: string;
};

type Prompt = {
  id: number;
  kind: string;
  level: string;
  content: string;
} | null;

type Answer = {
  user_id: string;
  answer: string;
};

type GameRoomProps = {
  room: Room;
  userId: string;
  prompt: Prompt;
  answers: Answer[];
  hasAnswered: boolean;
  loadError?: string;
  gameError?: string;
};

type TodSound =
  | "truth"
  | "dare"
  | "question"
  | "answer"
  | "reveal";

const errorMessages: Record<string, string> = {
  choose:
    "ما قدرناش نختارو السؤال. تأكد من الدور ديالك ومن وجود أسئلة مناسبة.",
  answer:
    "ما قدرناش نسجلو الجواب. تأكد ما جاوبتيش من قبل.",
  next:
    "ما قدرناش ندوزو للجولة التالية.",
  "invalid-choice":
    "اختار نوع ومستوى صحيحين.",
  "invalid-answer":
    "كتب جواب بين 1 و2000 حرف.",
};

// JUST US — Truth or Dare sound effects
function playTodSound(type: TodSound) {
  if (typeof window === "undefined") return;

  try {
    if (
      localStorage.getItem("just-us-muted") === "true"
    ) {
      return;
    }

    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;

    const context = new AudioCtor();

    const sounds: Record<
      TodSound,
      {
        notes: number[];
        duration: number;
        volume: number;
        wave: OscillatorType;
      }
    > = {
      truth: {
        notes: [523, 659, 784],
        duration: 0.13,
        volume: 0.035,
        wave: "sine",
      },

      dare: {
        notes: [220, 330, 440],
        duration: 0.13,
        volume: 0.035,
        wave: "triangle",
      },

      question: {
        notes: [440, 554, 659, 880],
        duration: 0.14,
        volume: 0.04,
        wave: "sine",
      },

      answer: {
        notes: [620, 830],
        duration: 0.1,
        volume: 0.035,
        wave: "sine",
      },

      reveal: {
        notes: [523, 659, 784, 1047],
        duration: 0.15,
        volume: 0.045,
        wave: "sine",
      },
    };

    const config = sounds[type];
    const startTime = context.currentTime;

    config.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      const start =
        startTime + index * config.duration;

      oscillator.type = config.wave;

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
    // Sounds must never interrupt the game
  }
}

export default function GameRoom({
  room,
  userId,
  prompt,
  answers,
  hasAnswered,
  loadError,
  gameError,
}: GameRoomProps) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [kind, setKind] = useState("truth");
  const [level, setLevel] = useState("normal");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  // Prevent sounds repeating on automatic refresh
  const lastSoundKey = useRef("");

  // =========================================
  // GAME LOGIC
  // =========================================

  const isClassic = room.mode === "classic";
  const isMyTurn = room.current_turn === userId;

  const otherName =
    room.first_user === userId ? "هي" : "هو";

  const canChoose =
    room.phase === "choose" &&
    (isClassic
      ? isMyTurn
      : room.first_user === userId);

  const canAnswer =
    room.phase === "answer" &&
    (!isClassic || isMyTurn);

  const alreadyAnswered =
    hasAnswered ||
    answers.some((a) => a.user_id === userId);

  // =========================================
  // AUTOMATIC SYNC
  // =========================================

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        router.refresh();
      }
    }, 2000);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  // Unlock controls when server state changes
  useEffect(() => {
    setBusy(false);
  }, [
    room.phase,
    room.round_no,
    room.prompt_id,
    gameError,
  ]);

  // Clear answer when a new round starts
  useEffect(() => {
    setAnswer("");
  }, [room.id, room.round_no]);

  // Play sounds when the game changes phase
  useEffect(() => {
    const soundKey =
      `${room.id}:${room.round_no}:` +
      `${room.phase}:${room.prompt_id ?? "none"}`;

    if (lastSoundKey.current === soundKey) {
      return;
    }

    lastSoundKey.current = soundKey;

    if (room.status !== "playing") {
      return;
    }

    if (room.phase === "answer" && prompt) {
      playTodSound("question");
    }

    if (room.phase === "reveal") {
      playTodSound("reveal");
    }
  }, [
    room.id,
    room.round_no,
    room.phase,
    room.prompt_id,
    room.status,
    prompt,
  ]);

  // =========================================
  // COPY ROOM CODE
  // =========================================

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  // =========================================
  // RENDER
  // =========================================

  return (
    <section
      className="tod-game"
      aria-label="Truth or Dare game"
      dir="rtl"
    >
      {/* PREMIUM GAME HEADER */}

      <div className="tod-game-head">
        <div className="tod-game-brand">
          <span className="tod-game-brand-icon">
            <Heart
              size={19}
              fill="currentColor"
            />
          </span>

          <div>
            <small>JUST US / GAME ROOM</small>

            <h2>
              Our little universe{" "}
              <span>♥</span>
            </h2>
          </div>
        </div>

        <span className="tod-game-live">
          <i />

          {room.status === "playing"
            ? "CONNECTED"
            : "WAITING"}
        </span>
      </div>

      {/* GAME STATISTICS */}

      <div className="tod-game-stats">
        <span>
          <Flame size={16} />
          ROUND <strong>{room.round_no}</strong>
        </span>

        <span>
          <Users size={16} />
          {room.second_user ? "2 / 2" : "1 / 2"}
        </span>

        <span>
          <Sparkles size={16} />
          {isClassic ? "CLASSIC" : "COUPLE"}
        </span>
      </div>

      {/* ROOM CODE */}

      <div className="tod-game-code">
        <span>ROOM CODE</span>

        <code dir="ltr">
          {room.id}
        </code>

        <button
          type="button"
          onClick={copyCode}
        >
          {copied ? (
            <Check size={17} />
          ) : (
            <Copy size={17} />
          )}

          {copied ? "تنسخ" : "نسخ"}
        </button>
      </div>

      {/* ERRORS */}

      {gameError && (
        <div
          className="tod-game-error"
          role="alert"
        >
          {errorMessages[gameError] ??
            "وقع خطأ. عاود جرّب."}
        </div>
      )}

      {loadError && (
        <div
          className="tod-game-error"
          role="alert"
        >
          {loadError}
        </div>
      )}

      {/* WAITING FOR SECOND PLAYER */}

      {room.status !== "playing" ? (
        <div
          key={`waiting-${room.id}`}
          className="tod-game-panel tod-game-center"
        >
          <div className="tod-game-emoji">
            💌
          </div>

          <h3>كنتسناو الطرف الآخر</h3>

          <p>
            صيفط كود الغرفة وخلي الصفحة
            مفتوحة، غادي تتحدث تلقائياً.
          </p>
        </div>
      ) : room.phase === "choose" ? (

        /* CHOOSE TRUTH OR DARE */

        <div
          key={`choose-${room.round_no}`}
          className="tod-game-panel"
        >
          <div className="tod-game-eyebrow">
            01 / CHOOSE YOUR ADVENTURE
          </div>

          <h3>
            {canChoose
              ? "شنو غادي تختار؟"
              : "كنتسناو الاختيار..."}
          </h3>

          <p>
            {canChoose
              ? "اختار النوع والمستوى باش نجيبو ليكم سؤال جديد."
              : isClassic
                ? `الدور دابا ديال ${otherName}. السؤال غادي يبان عندكم بجوج.`
                : "منشئ الغرفة غادي يختار السؤال المشترك."}
          </p>

          {canChoose ? (
            <form
              action={chooseTodPrompt}
              onSubmit={() => setBusy(true)}
              className="tod-game-form"
            >
              <input
                type="hidden"
                name="room_id"
                value={room.id}
              />

              <input
                type="hidden"
                name="kind"
                value={
                  isClassic ? kind : "truth"
                }
              />

              {/* TRUTH / DARE CARDS */}

              <div className="tod-game-choices">
                <button
                  type="button"
                  className={`tod-game-choice ${
                    kind === "truth" || !isClassic
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => {
                    setKind("truth");
                    playTodSound("truth");
                  }}
                >
                  <span>💗</span>
                  <strong>TRUTH</strong>
                  <small>حقيقة من القلب</small>
                </button>

                {isClassic && (
                  <button
                    type="button"
                    className={`tod-game-choice ${
                      kind === "dare"
                        ? "selected"
                        : ""
                    }`}
                    onClick={() => {
                      setKind("dare");
                      playTodSound("dare");
                    }}
                  >
                    <span>🔥</span>
                    <strong>DARE</strong>
                    <small>تحدي ممتع</small>
                  </button>
                )}
              </div>

              {/* LEVEL SELECTION */}

              <label
                className="tod-game-label"
                htmlFor="tod-level"
              >
                مستوى السؤال
              </label>

              <select
                id="tod-level"
                name="level"
                value={level}
                onChange={(e) =>
                  setLevel(e.target.value)
                }
                className="tod-game-select"
              >
                <option value="normal">
                  🌸 Normal — عادي
                </option>

                <option value="personal">
                  💞 Personal — شخصي
                </option>

                <option value="bold">
                  🔥 Bold — جريء
                </option>
              </select>

              <button
                className="tod-game-primary"
                type="submit"
                disabled={busy}
                onClick={() => {
                  playTodSound(
                    isClassic ? (kind as "truth" | "dare") : "truth"
                  );
                }}
              >
                {busy
                  ? "كنختارو..."
                  : "كشف السؤال"}

                <ArrowRight size={19} />
              </button>
            </form>
          ) : (
            <div className="tod-game-wait">
              <span className="tod-game-spinner" />
              تحديث تلقائي كل جوج ثواني
            </div>
          )}
        </div>
      ) : room.phase === "answer" ||
        room.phase === "reveal" ? (

        /* QUESTION / ANSWER / REVEAL */

        <div
          key={`${room.phase}-${room.round_no}`}
          className="tod-game-panel"
        >
          <div className="tod-game-eyebrow">
            {room.phase === "reveal"
              ? "03 / THE REVEAL"
              : "02 / YOUR MOMENT"}
          </div>

          <span className="tod-game-type">
            {prompt?.kind === "dare"
              ? "🔥 DARE"
              : "💗 TRUTH"}
            {" · "}
            {prompt?.level?.toUpperCase() ?? ""}
          </span>

          <h3 className="tod-game-question">
            {prompt?.content ??
              "السؤال ما قدرش يتحمّل. راجع صلاحيات قراءة الأسئلة فـSupabase."}
          </h3>

          {room.phase === "answer" ? (
            canAnswer && !alreadyAnswered ? (
              <form
                action={submitTodAnswer}
                onSubmit={() => {
                  setBusy(true);
                  playTodSound("answer");
                }}
                className="tod-game-form"
              >
                <input
                  type="hidden"
                  name="room_id"
                  value={room.id}
                />

                <label
                  className="tod-game-label"
                  htmlFor="tod-answer"
                >
                  {prompt?.kind === "dare"
                    ? "كتب «كملت التحدي» من بعد ما تكملو"
                    : "جوابك"}
                </label>

                <textarea
                  id="tod-answer"
                  name="answer"
                  required
                  minLength={1}
                  maxLength={2000}
                  value={answer}
                  onChange={(e) =>
                    setAnswer(e.target.value)
                  }
                  placeholder="كتب الجواب ديالك هنا..."
                  rows={4}
                  className="tod-game-textarea"
                />

                <button
                  className="tod-game-primary"
                  type="submit"
                  disabled={
                    busy || !answer.trim()
                  }
                >
                  {busy
                    ? "كنصيفطو..."
                    : "إرسال الجواب"}

                  <Send size={18} />
                </button>
              </form>
            ) : (
              <div className="tod-game-wait">
                <LockKeyhole size={18} />

                {isClassic
                  ? `الدور ديال ${otherName}.`
                  : alreadyAnswered
                    ? "الجواب ديالك تسجل، كنتسناو الجواب الثاني."
                    : "كنتسناو الجواب الآخر."}
              </div>
            )
          ) : (
            <>
              <div className="tod-game-answers">
                {answers.length ? (
                  answers.map((a) => (
                    <div
                      key={a.user_id}
                      className="tod-game-answer"
                    >
                      <small>
                        {a.user_id === userId
                          ? "جوابك"
                          : `جواب ${otherName}`}
                      </small>

                      <p>{a.answer}</p>
                    </div>
                  ))
                ) : (
                  <p>
                    ما قدرناش نحمّلو الأجوبة.
                    خاصنا نراجعو RLS ديال
                    جدول الأجوبة.
                  </p>
                )}
              </div>

              {/* READY SYSTEM UNCHANGED */}

              <ReadyPanel
                key={`${room.id}:${room.round_no}`}
                roomId={room.id}
                roundNo={room.round_no}
                userId={userId}
                firstUser={room.first_user}
                isClassic={isClassic}
                currentTurn={room.current_turn}
              />
            </>
          )}
        </div>
      ) : (
        <div
          key={`state-${room.phase}-${room.round_no}`}
          className="tod-game-panel tod-game-center"
        >
          <h3>
            حالة الغرفة: {room.phase}
          </h3>

          <p>
            حدّث الصفحة باش نشوفو
            آخر حالة.
          </p>
        </div>
      )}

      <div className="tod-game-footnote">
        <RefreshCw size={14} />
        المزامنة الحالية كتستعمل تحديث
        تلقائي كل جوج ثواني
      </div>
    </section>
  );
}
