
"use client";

import { useEffect, useState } from "react";
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
  // AUTOMATIC SYNC — EVERY 2 SECONDS
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

  // Unlock controls when server state changes.
  useEffect(() => {
    setBusy(false);
  }, [
    room.phase,
    room.round_no,
    room.prompt_id,
    gameError,
  ]);

  // Clear the previous answer when a new round starts.
  useEffect(() => {
    setAnswer("");
  }, [room.id, room.round_no]);

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

      {/* =====================================
          WAITING FOR SECOND PLAYER
         ===================================== */}

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

        /* =====================================
           CHOOSE TRUTH OR DARE
           PREMIUM ANIMATED PANEL
           ===================================== */

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
                  onClick={() =>
                    setKind("truth")
                  }
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
                    onClick={() =>
                      setKind("dare")
                    }
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

        /* =====================================
           QUESTION + ANSWER + REVEAL
           KEY CHANGES ON EACH PHASE
           ===================================== */

        <div
          key={`${room.phase}-${room.round_no}`}
          className="tod-game-panel"
        >
          <div className="tod-game-eyebrow">
            {room.phase === "reveal"
              ? "03 / THE REVEAL"
              : "02 / YOUR MOMENT"}
          </div>

          {/* QUESTION TYPE */}

          <span className="tod-game-type">
            {prompt?.kind === "dare"
              ? "🔥 DARE"
              : "💗 TRUTH"}
            {" · "}
            {prompt?.level?.toUpperCase() ?? ""}
          </span>

          {/* ANIMATED QUESTION */}

          <h3 className="tod-game-question">
            {prompt?.content ??
              "السؤال ما قدرش يتحمّل. راجع صلاحيات قراءة الأسئلة فـSupabase."}
          </h3>

          {room.phase === "answer" ? (

            /* =================================
               ANSWER PHASE
               ================================= */

            canAnswer && !alreadyAnswered ? (
              <form
                action={submitTodAnswer}
                onSubmit={() => setBusy(true)}
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

            /* =================================
               REVEAL PHASE
               ================================= */

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

              {/* READY SYSTEM — UNCHANGED */}

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

        /* =====================================
           UNKNOWN GAME STATE
           ===================================== */

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

      {/* SYNC FOOTNOTE */}

      <div className="tod-game-footnote">
        <RefreshCw size={14} />

        المزامنة الحالية كتستعمل تحديث
        تلقائي كل جوج ثواني
      </div>
    </section>
  );
}
