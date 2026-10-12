"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clipboard,
  Heart,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Wheel, getWheelRotation } from "./wheel";
import { isWheelRoomState, type WheelRoomState } from "./types";

type Props = {
  initialState: WheelRoomState;
  userId: string;
};

const levelLabels: Record<string, string> = {
  normal: "Normal 🌸",
  personal: "Personal 💗",
  bold: "Bold 🔥",
  mix: "Mix ✨",
};

function errorText(message: string) {
  if (/not your turn/i.test(message)) return "دابا الدور ديال الطرف الآخر 💗";
  if (/already been spun/i.test(message)) return "العجلة دارت فهاد الجولة من قبل.";
  if (/both players must be ready/i.test(message)) return "خاص بجوج تكونو واجدين.";
  if (/free choice is not available/i.test(message)) return "الاختيار الحر ما بقاش متاح.";
  if (/room not found|access denied|not authorized/i.test(message)) return "ما عندكش صلاحية لهاد الغرفة.";
  if (/written answer is required/i.test(message)) return "كتب الجواب ديالك قبل الإرسال.";
  if (/failed to fetch|network|fetch/i.test(message)) return "مشكل فالإنترنت. تأكد من الاتصال وعاود المحاولة.";
  return "وقع مشكل فتنفيذ العملية. حاول مرة أخرى.";
}

function playChime(enabled: boolean, high = false) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(high ? 740 : 490, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(high ? 1040 : 680, context.currentTime + 0.15);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.21);
    window.setTimeout(() => { void context.close().catch(() => {}); }, 350);
  } catch {
    // Browsers may block autoplay/audio; gameplay must continue without sound.
  }
}

export default function WheelGame({ initialState, userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState("");
  const [rotation, setRotation] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [sound, setSound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(true);
  const polling = useRef(false);
  const spinKey = useRef("");
  const rotationRef = useRef(0);
  const soundRef = useRef(sound);
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { soundRef.current = sound; }, [sound]);

  const refresh = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const { data, error: rpcError } = await supabase.rpc("just_us_wheel_get_state", {
        p_code: initialState.room_code,
      });
      if (rpcError) throw rpcError;
      if (!isWheelRoomState(data)) throw new Error("Invalid room state");
      setState(data);
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      polling.current = false;
    }
  }, [supabase, initialState.room_code]);

  useEffect(() => {
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const round = state.round;
    if (!round?.spun_at || !round.wheel_segment_id) return;
    const key = `${round.round_no}:${round.spun_at}`;
    if (spinKey.current === key) return;
    spinKey.current = key;
    const index = state.segments.findIndex((s) => s.id === round.wheel_segment_id);
    if (index < 0) return;

    const elapsed = Date.now() - new Date(round.spun_at).getTime();
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    if (elapsed > 5500) {
      const next = getWheelRotation(index, state.segments.length, rotationRef.current);
      rotationRef.current = next;
      setAnimate(false);
      setRotation(next);
      setSpinning(false);
      setShowResult(true);
      return;
    }

    const next = getWheelRotation(index, state.segments.length, rotationRef.current);
    rotationRef.current = next;
    setShowResult(false);
    setAnimate(true);
    setSpinning(true);
    setRotation(next);
    spinTimer.current = window.setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
      playChime(soundRef.current, true);
    }, 4800);
  }, [state.round, state.segments]);

  useEffect(() => () => {
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  const run = useCallback(async (name: string, args: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc(name, args);
      if (rpcError) throw rpcError;
      await refresh();
      if (name === "just_us_wheel_submit") setAnswer("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      setError(errorText(message));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [busy, refresh, supabase]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.room_code);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("ما قدرناش ننسخو الكود. تقدر تنسخو يدوياً.");
    }
  };

  const round = state.round;
  const isMyTurn = state.status === "active" && (
    round ? round.turn_user_id === userId : state.player_one === userId
  );
  const canSpin = state.status === "active" &&
    (round === null || round.status === "ready_to_spin") && isMyTurn;
  const chosenSegment = state.segments.find((s) => s.id === round?.chosen_segment_id);
  const landedSegment = state.segments.find((s) => s.id === round?.wheel_segment_id);
  const actualKind = chosenSegment?.kind ?? round?.result_kind;
  const awaitingChoice = round?.status === "challenge" && round.result_kind === "free_choice" && !round.chosen_segment_id;
  const canSubmit = round?.status === "challenge" && isMyTurn && !awaitingChoice && !!round.prompt;
  const reveal = !!round && (round.status === "reveal" || round.status === "ready");
  const myReady = state.player_number === 1 ? round?.ready_player_one : round?.ready_player_two;
  const otherReady = state.player_number === 1 ? round?.ready_player_two : round?.ready_player_one;
  const bothReady = !!round?.ready_player_one && !!round?.ready_player_two;
  const otherPlayer = state.player_number === 1 ? "Player 2" : "Player 1";

  return (
    <>
      <div className="lw-room-bar lw-glass">
        <div className="lw-room-code-group">
          <div className="lw-room-code-label"><ShieldCheck size={14} /> PRIVATE ROOM</div>
          <button type="button" className="lw-room-code" onClick={() => { void copyCode(); }} title="نسخ كود الغرفة">
            <span dir="ltr">{state.room_code}</span>
            {copied ? <Check size={18} /> : <Clipboard size={17} />}
          </button>
          <span className="lw-room-hint">{copied ? "تنسخ الكود ✓" : "ضغط باش تنسخ الكود"}</span>
        </div>
        <div className="lw-room-stats">
          <span><Users size={15} /> {state.players_connected}/2</span>
          <span><Sparkles size={15} /> {levelLabels[state.level] ?? state.level}</span>
          <span><RotateCcw size={15} /> Round {Math.max(1, state.current_round_no)}</span>
          <span className={connected ? "lw-online" : "lw-offline"}><i /> {connected ? "LIVE" : "RECONNECTING"}</span>
        </div>
      </div>

      {error && <div className="lw-alert" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="إغلاق">×</button></div>}

      <div className="lw-game-grid">
        <section className="lw-wheel-card lw-glass" aria-label="عجلة الحظ">
          <div className="lw-card-head">
            <span className="lw-overline"><Sparkles size={14} /> YOUR MAGIC MOMENT</span>
            <button type="button" className="lw-sound-btn" onClick={() => setSound((value) => !value)} aria-label={sound ? "إيقاف الصوت" : "تشغيل الصوت"} title={sound ? "إيقاف الصوت" : "تشغيل الصوت"}>
              {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </div>
          <Wheel
            segments={state.segments}
            rotation={rotation}
            spinning={spinning}
            animate={animate}
            canSpin={canSpin}
            busy={busy}
            onSpin={() => {
              playChime(sound);
              void run("just_us_wheel_spin", { p_code: state.room_code });
            }}
          />
          <div className="lw-spin-zone">
            {state.status === "waiting" ? (
              <div className="lw-waiting"><LoaderCircle className="lw-spin-icon" size={18} /> كنتسناو الطرف الثاني يدخل بالكود...</div>
            ) : canSpin ? (
              <button
                className="lw-primary-btn lw-spin-btn"
                type="button"
                disabled={busy || spinning}
                onClick={() => {
                  playChime(sound);
                  void run("just_us_wheel_spin", { p_code: state.room_code });
                }}
              >
                {busy || spinning ? <LoaderCircle className="lw-spin-icon" size={20} /> : <Sparkles size={20} />}
                {busy ? "لحظة..." : spinning ? "العجلة كتدور..." : "دَوّر العجلة"}
                {!busy && !spinning && <ArrowRight size={19} />}
              </button>
            ) : (
              <div className="lw-spin-note">
                {spinning ? <><LoaderCircle className="lw-spin-icon" size={18} /> العجلة كتدور... ✨</> :
                  round?.status === "ready_to_spin" ? `الدور ديال ${otherPlayer} 💗` :
                  "كل دورة عندها مفاجأة جديدة ✨"}
              </div>
            )}
            <p className="lw-wheel-footnote">النتيجة كتتحدد فالسيرفر وكتبقى نفسها عند بجوج</p>
          </div>
        </section>

        <section className="lw-action-card lw-glass" aria-live="polite">
          <div className="lw-action-heading">
            <span className="lw-overline">THE GAME IS ON</span>
            <span className="lw-round-pill">ROUND {Math.max(1, state.current_round_no)}</span>
          </div>

          {state.status === "waiting" ? (
            <div className="lw-stage lw-stage-waiting">
              <div className="lw-stage-emoji">💌</div>
              <h2>الغرفة واجدة!</h2>
              <p>صيفط الكود للطرف الآخر، وملي يدخل غادي تبداو تلعبو بجوج.</p>
              <div className="lw-status-pill"><LoaderCircle className="lw-spin-icon" size={15} /> كنستناو اللاعب الثاني</div>
            </div>
          ) : !round || round.status === "ready_to_spin" ? (
            <div className="lw-stage lw-stage-idle">
              <div className="lw-stage-emoji">🎡</div>
              <span className="lw-mini-label">NEXT UP</span>
              <h2>{isMyTurn ? "دابا الدور ديالك!" : "كنستناو الدور الآخر"}</h2>
              <p>{isMyTurn ? "دَوّر العجلة وشوف شنو مخبية ليك من مفاجأة." : "الطرف الآخر غادي يدور العجلة، ونتوما بجوج غادي تشوفو نفس النتيجة."}</p>
              <div className="lw-turn-tag"><Heart size={15} fill="currentColor" /> {isMyTurn ? "YOUR TURN" : "PARTNER'S TURN"}</div>
            </div>
          ) : spinning || !showResult ? (
            <div className="lw-stage lw-stage-idle">
              <div className="lw-stage-emoji lw-emoji-pulse">✨</div>
              <h2>شنو غادي يخرج؟</h2>
              <p>شوية ديال التشويق... العجلة كتختار المفاجأة!</p>
              <div className="lw-status-pill"><LoaderCircle className="lw-spin-icon" size={15} /> SPINNING</div>
            </div>
          ) : (
            <div className="lw-stage lw-stage-result">
              <div className="lw-result-badge">{landedSegment?.emoji ?? "✨"} {landedSegment?.title ?? "النتيجة"}</div>

              {awaitingChoice ? (
                <>
                  <h2>الاختيار الحر ديالك ✨</h2>
                  <p>اختار شنو بغيتي: سؤال ولا تحدي.</p>
                  <div className="lw-choices">
                    {state.segments.filter((s) => s.kind === "question" || s.kind === "task").map((segment) => (
                      <button
                        type="button"
                        key={segment.id}
                        disabled={!isMyTurn || busy}
                        className="lw-choice"
                        onClick={() => { void run("just_us_wheel_choose_free", { p_code: state.room_code, p_segment_id: segment.id }); }}
                      >
                        <span>{segment.emoji}</span>{segment.title}<ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                  {!isMyTurn && <p className="lw-muted">الطرف الآخر كيختار دابا...</p>}
                </>
              ) : round.result_kind === "swap_turn" ? (
                <>
                  <div className="lw-stage-emoji">🔄</div>
                  <h2>تبديل الدور!</h2>
                  <p>هاد الجولة دازت بلا تحدي. من بعد التأكيد، الدور غادي يمشي للطرف الآخر.</p>
                </>
              ) : (
                <>
                  {chosenSegment && <div className="lw-chosen">اختيارك: {chosenSegment.emoji} {chosenSegment.title}</div>}
                  <span className="lw-mini-label">{actualKind === "task" ? "YOUR CHALLENGE" : "YOUR QUESTION"}</span>
                  <h2 className="lw-prompt">{round.prompt ?? "كنوجدو السؤال..."}</h2>
                  {canSubmit && (
                    <div className="lw-answer-form">
                      {actualKind === "question" ? (
                        <>
                          <label htmlFor="lw-answer">الجواب ديالك</label>
                          <textarea id="lw-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={2000} rows={4} placeholder="كتب جوابك هنا من القلب... 💗" />
                          <button type="button" className="lw-primary-btn" disabled={busy || !answer.trim()} onClick={() => { void run("just_us_wheel_submit", { p_code: state.room_code, p_answer: answer, p_skip: false }); }}>
                            {busy ? <LoaderCircle className="lw-spin-icon" size={18} /> : <Send size={18} />} صيفط الجواب
                          </button>
                        </>
                      ) : (
                        <button type="button" className="lw-primary-btn" disabled={busy} onClick={() => { void run("just_us_wheel_submit", { p_code: state.room_code, p_answer: null, p_skip: false }); }}>
                          <CheckCircleIcon /> كملت التحدي
                        </button>
                      )}
                      <button type="button" className="lw-text-btn" disabled={busy} onClick={() => { void run("just_us_wheel_submit", { p_code: state.room_code, p_answer: null, p_skip: true }); }}>
                        Skip هاد المرة — بلا عقوبة
                      </button>
                    </div>
                  )}
                  {round.status === "challenge" && !isMyTurn && <div className="lw-status-pill"><LoaderCircle className="lw-spin-icon" size={16} /> الطرف الآخر كيجاوب دابا...</div>}
                </>
              )}

              {reveal && (
                <div className="lw-reveal">
                  <div className="lw-reveal-title"><Heart size={17} fill="currentColor" /> REVEAL TIME</div>
                  {round.result_kind !== "swap_turn" && (
                    <div className="lw-answer-reveal">
                      {round.answer?.skipped ? "تجاوزنا هاد التحدي هاد المرة 💗" :
                        round.answer?.text ? round.answer.text :
                        actualKind === "task" ? "التحدي تكمل بنجاح! ✨" : "الجواب تسجل 💗"}
                    </div>
                  )}
                  <div className="lw-ready-row">
                    <span className={state.player_number === 1 ? "lw-you" : ""}>{round.ready_player_one ? "✓" : "○"} Player 1</span>
                    <span className={state.player_number === 2 ? "lw-you" : ""}>{round.ready_player_two ? "✓" : "○"} Player 2</span>
                  </div>
                  {bothReady ? (
                    <button type="button" className="lw-primary-btn" disabled={busy} onClick={() => { void run("just_us_wheel_next_round", { p_code: state.room_code }); }}>
                      {busy ? <LoaderCircle className="lw-spin-icon" size={18} /> : <ArrowRight size={18} />} الجولة الموالية
                    </button>
                  ) : !myReady ? (
                    <button type="button" className="lw-primary-btn" disabled={busy} onClick={() => { void run("just_us_wheel_mark_ready", { p_code: state.room_code }); }}>
                      {busy ? <LoaderCircle className="lw-spin-icon" size={18} /> : <CheckCheck size={18} />} أنا واجد للجولة الجاية
                    </button>
                  ) : (
                    <div className="lw-status-pill"><LoaderCircle className="lw-spin-icon" size={15} /> {otherReady ? "بجوج واجدين" : "كنستناو الطرف الآخر يأكد..."}</div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="lw-action-footer"><ShieldCheck size={15} /> PRIVATE · JUST FOR TWO</div>
        </section>
      </div>
    </>
  );
}

function CheckCircleIcon() {
  return <CheckCheck size={18} />;
}
