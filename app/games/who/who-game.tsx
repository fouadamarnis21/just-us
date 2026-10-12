"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Check, Copy, Heart, LoaderCircle, LockKeyhole,
  Plus, RefreshCw, Sparkles, UsersRound, Trophy,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
type Member = { user_id: string; seat: "first" | "second"; nickname: string };
type Question = { round_no: number; question: string };
type Room = {
  id: string;
  first_user: string;
  second_user: string;
  status: "waiting" | "playing" | "finished";
  round_no: number;
  first_score: number;
  second_score: number;
};
type Result = {
  room_id: string;
  round_no: number;
  first_choice: string;
  second_choice: string;
  matched: boolean;
};
function friendlyError(error: { message?: string } | null) {
  return error?.message ?? "وقع مشكل. عاود جرب.";
}
export default function WhoGame({ initialRoomId }: { initialRoomId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [myId, setMyId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [roomId, setRoomId] = useState(initialRoomId);
  const [roomCode, setRoomCode] = useState(initialRoomId);
  const [room, setRoom] = useState<Room | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [submittedRound, setSubmittedRound] = useState<number | null>(null);
  const [readyRound, setReadyRound] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  // Each player sees "أنا" for themselves and "هي"/"هو" for the partner.
  // Database choices remain the actual user IDs, never translated labels.
  const me = members.find((member) => member.user_id === myId);
  const partner = myId ? members.find((member) => member.user_id !== myId) : undefined;
  const currentQuestion = questions.find((q) => q.round_no === room?.round_no);
 const currentQuestionIndex = questions.findIndex((q) => q.round_no === room?.round_no);
 const currentPosition = currentQuestionIndex < 0 ? 0 : currentQuestionIndex + 1;
 const maxQuestions = questions.length;
  const loadRoom = useCallback(async (id: string, quiet = false) => {
    if (!id) return;
    const { data, error } = await supabase
      .from("just_us_rooms")
      .select("id,first_user,second_user,status,round_no,first_score,second_score")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      if (!quiet) setErrorMessage("الغرفة ما تلقاتش، أو ما عندكش صلاحية تدخل ليها.");
      return;
    }
    const roomData = data as Room;
    setRoom(roomData);
    setRoomId(roomData.id);
    // Read the immutable question snapshot for this room, not the global admin list.
    const [questionsResponse, resultResponse] = await Promise.all([
      supabase.rpc("just_us_who_room_questions", { p_room: id }),
      supabase
        .from("just_us_results")
        .select("room_id,round_no,first_choice,second_choice,matched")
        .eq("room_id", id)
        .eq("round_no", roomData.round_no)
        .maybeSingle(),
    ]);

    if (questionsResponse.error) {
      setErrorMessage("ما قدرناش نحمّلو أسئلة الغرفة: " + friendlyError(questionsResponse.error));
    } else {
      setQuestions((questionsResponse.data ?? []) as Question[]);
    }
    if (resultResponse.error && !quiet) {
      setErrorMessage(friendlyError(resultResponse.error));
    }
    setResult((resultResponse.data as Result | null) ?? null);
    if (!quiet && !questionsResponse.error && !resultResponse.error) setErrorMessage("");
  }, [supabase]);
  useEffect(() => {
    let active = true;
    async function start() {
      const [userResponse, membersResponse] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("just_us_members").select("user_id,seat,nickname"),
      ]);
      if (!active) return;
      if (userResponse.data.user) setMyId(userResponse.data.user.id);
      if (membersResponse.data) setMembers(membersResponse.data as Member[]);
      if (initialRoomId) await loadRoom(initialRoomId, true);
    }
    void start();
    return () => { active = false; };
  }, [supabase, initialRoomId, loadRoom]);
  useEffect(() => {
    if (!roomId) return;
    // Realtime events are a fast path; periodic refresh also recovers from missed events.
    const channel = supabase.channel(`just-us-room-${roomId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "just_us_rooms", filter: `id=eq.${roomId}`,
      }, () => { void loadRoom(roomId, true); })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "just_us_results", filter: `room_id=eq.${roomId}`,
      }, () => { void loadRoom(roomId, true); })
      .subscribe();
    const interval = window.setInterval(() => void loadRoom(roomId, true), 4000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [roomId, loadRoom, supabase]);
  useEffect(() => {
    setSubmittedRound(null);
    setReadyRound(null);
  }, [room?.round_no]);
  async function createRoom() {
    setBusy(true); setErrorMessage(""); setInfoMessage("");
    const { data, error } = await supabase.rpc("just_us_create_room");
    if (error || typeof data !== "string") {
      setErrorMessage(friendlyError(error));
    } else {
      setRoomCode(data);
      await loadRoom(data);
      window.history.replaceState(null, "", `/games/who?room=${encodeURIComponent(data)}`);
      setInfoMessage("الغرفة واجدة. صيفط الرمز للطرف الآخر.");
    }
    setBusy(false);
  }
  async function joinRoom() {
    const code = roomCode.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
      setErrorMessage("دخل رمز الغرفة كامل كما وصلك.");
      return;
    }
    setBusy(true); setErrorMessage(""); setInfoMessage("");
    // The creating player can reopen their own room without calling join_room.
    const { data: existing } = await supabase.from("just_us_rooms")
      .select("first_user").eq("id", code).maybeSingle();
    if (existing?.first_user !== myId) {
      const { error } = await supabase.rpc("just_us_join_room", { p_room: code });
      if (error) {
        setErrorMessage("ما قدرناش ندخلوك للغرفة: " + friendlyError(error));
        setBusy(false);
        return;
      }
    }
    await loadRoom(code);
    window.history.replaceState(null, "", `/games/who?room=${encodeURIComponent(code)}`);
    setBusy(false);
  }
  async function submitAnswer(choiceId: string) {
    if (!room || !choiceId || submittedRound === room.round_no) return;
    setBusy(true); setErrorMessage("");
    const { error } = await supabase.rpc("just_us_submit_answer", {
      p_room: room.id, p_choice: choiceId,
    });
    if (error) setErrorMessage(friendlyError(error));
    else {
      setSubmittedRound(room.round_no);
      await loadRoom(room.id, true);
    }
    setBusy(false);
  }
  async function nextRound() {
    if (!room || !result || readyRound === room.round_no) return;
    setBusy(true); setErrorMessage("");
    const { data, error } = await supabase.rpc("just_us_next_round", { p_room: room.id });
    if (error) setErrorMessage(friendlyError(error));
    else {
      if (data === "waiting") setReadyRound(room.round_no);
      await loadRoom(room.id, true);
    }
    setBusy(false);
  }
  async function copyInvite() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setInfoMessage("تم نسخ رمز الغرفة. صيفطو للطرف الآخر.");
    } catch {
      setInfoMessage("حدد رمز الغرفة ونسخو باستعمال Ctrl + C.");
    }
  }
  function personLabel(id: string): string {
    if (!id) return "لاعب";
    if (id === myId) return "أنا";
    const person = members.find((member) => member.user_id === id);
    if (person?.seat === "first") return "هو";
    if (person?.seat === "second") return "هي";
    return "الطرف الآخر";
  }
  function pointsFor(id: string): number {
    if (!room || !id) return 0;
    if (id === room.first_user) return room.first_score;
    if (id === room.second_user) return room.second_score;
    return 0;
  }
  const iCreatedRoom = room?.first_user === myId;
  return (
    <main className="who-page" dir="rtl">
      <div className="who-glow who-glow-1" /><div className="who-glow who-glow-2" />
      <div className="who-wrap">
        <header className="who-topbar">
          <Link href="/dashboard" className="who-back"><ArrowRight size={18} /> رجوع للألعاب</Link>
          <div className="who-brand" dir="ltr"><Heart size={17} fill="currentColor" /> JUST <span>US.</span></div>
        </header>
        <section className="who-hero">
          <div className="who-eyebrow"><Sparkles size={14} /> ONLINE COUPLE GAME</div>
          <h1>شكون <span>فينا؟</span> <span className="who-heart">♥</span></h1>
          <p>نفس السؤال، جوج أجوبة، ومفاجآت كتجمعكم حتى من بعيد.</p>
          <div className="who-secure"><LockKeyhole size={13} /> غرفة خاصة بحساباتكم بجوج فقط</div>
        </section>
        {errorMessage && <p className="who-alert" role="alert">{errorMessage}</p>}
        {infoMessage && <p className="who-info" role="status">{infoMessage}</p>}
        {!room ? (
          <section className="who-start-grid">
            <article className="who-panel">
              <div className="who-panel-icon"><Plus size={24} /></div>
              <h2>إنشاء غرفة جديدة</h2>
              <p>فتح الغرفة وشارك الرمز مع الطرف الآخر.</p>
              <button className="who-primary" onClick={createRoom} disabled={busy}>
                {busy ? <LoaderCircle size={18} className="who-spin" /> : <Plus size={18} />}
                إنشاء غرفة
              </button>
            </article>
            <article className="who-panel">
              <div className="who-panel-icon"><UsersRound size={24} /></div>
              <h2>الدخول لغرفة</h2>
              <p>دخل هنا رمز الغرفة اللي وصلك من الطرف الآخر.</p>
              <input aria-label="رمز الغرفة" dir="ltr" value={roomCode} onChange={e => setRoomCode(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="who-input" />
              <button className="who-secondary" onClick={joinRoom} disabled={busy || !roomCode.trim()}>دخول للغرفة</button>
            </article>
          </section>
        ) : (
          <>
            <section className="who-room-banner">
              <div><span className="who-subtitle">PRIVATE ROOM</span><h2>{room.status === "waiting" ? "كنسناو الطرف الآخر..." : room.status === "playing" ? "اللعبة بدات!" : "سالينا اللعبة!"}</h2></div>
              <button type="button" className="who-copy" onClick={copyInvite}><Copy size={16} /> نسخ رمز الغرفة</button>
              <code dir="ltr" className="who-room-code">{room.id}</code>
            </section>
            <section className="who-score-row">
              <div className="who-score"><span>أنا</span><b>{pointsFor(myId)}</b></div>
              <div className="who-score-center"><Trophy size={21} /><span>+10 لكل واحد ملي تتافقو</span></div>
              <div className="who-score"><span>{partner ? personLabel(partner.user_id) : "الطرف الآخر"}</span><b>{pointsFor(partner?.user_id ?? "")}</b></div>
            </section>
            {room.status === "waiting" ? (
              <div className="who-play-card who-wait"><LoaderCircle size={32} className="who-spin" />
                <h2>{iCreatedRoom ? "الغرفة واجدة!" : "كنسناو دخول الطرف الآخر"}</h2>
                <p>{iCreatedRoom ? "نسخ الرمز وصيفطو للطرف الآخر. ملي يدخل غادي تبدأ اللعبة عندكم بجوج." : "اضغط دخول باش تبداو تلعبو بجوج."}</p>
                {!iCreatedRoom && myId && (
                  <button className="who-primary" onClick={joinRoom} disabled={busy} style={{maxWidth:240,marginTop:15}}>
                    دخول للغرفة
                  </button>
                )}
              </div>
            ) : room.status === "finished" ? (
              <div className="who-play-card who-finish"><Trophy size={38} /><h2>كملتو الأسئلة! 🏆</h2>
                <p>النتيجة النهائية باينة فوق. تقدرو تنشئو غرفة جديدة باش تعاودو اللعب.</p>
                <button className="who-primary" onClick={createRoom} disabled={busy}><RefreshCw size={17} /> عاودو اللعبة</button>
              </div>
            ) : (
              <section className="who-play-card">
                <div className="who-progress"><span>السؤال {currentPosition || "..."} / {maxQuestions || "..."}</span><span>شكون فينا؟</span></div>
                <div className="who-progress-track"><div style={{ width: `${maxQuestions ? Math.min(100, currentPosition / maxQuestions * 100) : 0}%` }} /></div>
                <h2>{currentQuestion?.question ?? "جاري تحميل السؤال..."}</h2>
                {result ? (
                  <div className="who-reveal">
                    <div className="who-reveal-title">{result.matched ? "❤️ متافقين! +10 نقاط لكل واحد" : "😂 أجوبة مختلفة!"}</div>
                    <div className="who-reveal-choices">
                      <div><small>اختيارك</small><b>{personLabel(room.first_user === myId ? result.first_choice : result.second_choice)}</b></div>
                      <div><small>اختيار الطرف الآخر</small><b>{personLabel(room.first_user === myId ? result.second_choice : result.first_choice)}</b></div>
                    </div>
                    <button className="who-primary" onClick={nextRound} disabled={busy || readyRound === room.round_no}>
                      {readyRound === room.round_no ? "كنسناو الآخر يضغط التالي..." : "السؤال التالي ←"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="who-options">
                      {[me, partner].map((member) => member && (
                        <button key={member.user_id} type="button" className="who-option" disabled={busy || submittedRound === room.round_no} onClick={() => submitAnswer(member.user_id)}>
                          <span className="who-option-emoji">{member.seat === "first" ? "👨" : "👩"}</span><b>{personLabel(member.user_id)}</b>
                          <span className="who-option-click"><Check size={16} /></span>
                        </button>
                      ))}
                    </div>
                    <p className="who-hint">{submittedRound === room.round_no ? "✅ تسجل جوابك، كنسناو الطرف الآخر يجاوب..." : "🔒 جوابك غادي يبقى مخبي حتى تجاوبو بجوج."}</p>
                  </>
                )}
              </section>
            )}
          </>
        )}
        <footer className="who-footer">JUST US — ONLY FOR TWO ♥</footer>
      </div>
    </main>
  );
}
