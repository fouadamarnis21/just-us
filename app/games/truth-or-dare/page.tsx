import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Crown, Flame, Heart,
  LockKeyhole, MoonStar, ShieldCheck, Sparkles, Users, WandSparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { createTodRoom, joinTodRoom } from "./actions";
import RoomTools from "./room-tools";
import GameRoom from "./game-room";
import "./truth-or-dare.css";
import "./game-room.css";

type PageProps = {
  searchParams: Promise<{ room?: string; error?: string; game_error?: string }>;
};

type TodRoom = {
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

type TodPrompt = { id: number; kind: string; level: string; content: string };
type TodAnswer = { user_id: string; answer: string };

const errorMessages: Record<string, string> = {
  "invalid-mode": "اختار نمط اللعب الصحيح.",
  "invalid-room": "كود الغرفة غير صحيح. تأكد أنك نسختو كامل.",
  create: "ما قدرناش ننشئو الغرفة. تأكد من الاتصال وعاود جرّب.",
  join: "ما قدرناش ندخلوك للغرفة. يمكن الكود غلط، الغرفة عامرة أو سالات.",
};

export default async function TruthOrDarePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !isAllowedUser(user.id)) redirect("/");

  const params = await searchParams;
  const roomId = params.room;
  let room: TodRoom | null = null;
  let roomError = false;
  let prompt: TodPrompt | null = null;
  let answers: TodAnswer[] = [];
  let loadError: string | undefined;
  let hasAnswered = false;

  if (roomId) {
    const { data, error } = await supabase
      .from("just_us_tod_rooms")
      .select("id,first_user,second_user,mode,status,round_no,current_turn,prompt_id,phase")
      .eq("id", roomId)
      .maybeSingle();
    // Defense in depth: only actual participants can see the room.
    room = data && (data.first_user === user.id || data.second_user === user.id)
      ? (data as TodRoom) : null;
    roomError = !!error || !room;

    if (room && room.status === "playing" && room.prompt_id !== null && (room.phase === "answer" || room.phase === "reveal")) {
      const { data: question, error: promptError } = await supabase
        .from("just_us_tod_prompts")
        .select("id,kind,level,content")
        .eq("id", room.prompt_id)
        .maybeSingle();
      prompt = question as TodPrompt | null;
      if (promptError || !prompt) loadError = "تعذّر تحميل السؤال. خاصنا نراجعو صلاحيات قراءة الأسئلة (RLS).";
    }

    // Read only the current user's own submission status before reveal.
    // If RLS disallows this SELECT, the server still enforces duplicate prevention.
    if (room && room.status === "playing" && room.phase === "answer") {
      const { data: ownAnswer } = await supabase
        .from("just_us_tod_answers")
        .select("id")
        .eq("room_id", room.id)
        .eq("round_no", room.round_no)
        .eq("user_id", user.id)
        .limit(1);
      hasAnswered = !!ownAnswer?.length;
    }

    // The UI never requests other players' answers before reveal.
    // IMPORTANT: database RLS must ALSO block direct early reads.
    if (room && room.status === "playing" && room.phase === "reveal") {
      const { data: revealed, error: answersError } = await supabase
        .from("just_us_tod_answers")
        .select("user_id,answer")
        .eq("room_id", room.id)
        .eq("round_no", room.round_no);
      answers = (revealed ?? []) as TodAnswer[];
      if (answersError) loadError = "تعذّر تحميل الأجوبة. خاصنا نراجعو صلاحيات RLS ديال الأجوبة.";
    }
  }

  const playing = !!room && room.status === "playing";

  return (
    <main className="tod-root" dir="rtl">
      <div className="tod-aura tod-aura-one" aria-hidden="true" />
      <div className="tod-aura tod-aura-two" aria-hidden="true" />
      <div className="tod-grid-pattern" aria-hidden="true" />

      <div className="tod-shell">
        <header className="tod-topbar">
          <Link className="tod-brand" href="/dashboard" aria-label="JUST US dashboard">
            <span className="tod-brand-icon"><Heart size={18} fill="currentColor" /></span>
            <span>JUST <strong>US</strong></span>
          </Link>
          <span className="tod-top-label"><LockKeyhole size={14} /> OUR PRIVATE SPACE</span>
          <Link className="tod-back" href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>
        </header>

        <section className={playing ? "tod-hero tod-hero-compact" : "tod-hero"}>
          <div className="tod-eyebrow"><Sparkles size={15} /> THE COUPLE&apos;S GAME NIGHT <Sparkles size={15} /></div>
          <div className="tod-symbol" aria-hidden="true"><span>🎭</span><i /></div>
          <h1>Truth <span>or</span> Dare<span className="tod-title-heart">♥</span></h1>
          <p className="tod-lead">أسئلة من القلب، تحديات ممتعة، ولحظات غير ديالكم بجوج.</p>
          <div className="tod-pills">
            <span><ShieldCheck size={14} /> PRIVATE</span>
            <span><Users size={14} /> 2 PLAYERS</span>
            <span><WandSparkles size={14} /> MADE FOR US</span>
          </div>
        </section>

        {params.error && errorMessages[params.error] && (
          <div className="tod-alert" role="alert">{errorMessages[params.error]}</div>
        )}

        {roomId ? (
          roomError || !room ? (
            <section className="tod-lobby tod-glass">
              <div className="tod-section-icon"><LockKeyhole size={25} /></div>
              <h2>الغرفة ما لقايناهاش</h2>
              <p>يمكن الكود غير صحيح أو ما عندكش الصلاحية تشوف هاد الغرفة.</p>
              <Link href="/games/truth-or-dare" className="tod-btn tod-btn-primary">رجع لاختيار اللعبة <ArrowRight size={17}/></Link>
            </section>
          ) : playing ? (
            <GameRoom
              room={room}
              userId={user.id}
              prompt={prompt}
              answers={answers}
              hasAnswered={hasAnswered}
              loadError={loadError}
              gameError={params.game_error}
            />
          ) : (
            <section className="tod-lobby tod-glass">
              <div className="tod-status"><span className={room.status === "waiting" ? "tod-status-dot" : "tod-status-dot tod-status-online"} />{room.status === "waiting" ? "WAITING FOR YOUR PERSON" : "ROOM STATUS"}</div>
              <div className="tod-section-icon"><Heart size={25} fill="currentColor" /></div>
              <h2>{room.status === "waiting" ? "الغرفة واجدة... باقي غير الطرف الآخر 💌" : "الغرفة موجودة ❤️"}</h2>
              <p>{room.status === "waiting" ? "نسخ كود الغرفة وصيفطو للطرف الآخر باش يدخل من حسابو." : "حالة الغرفة دابا: " + room.status}</p>
              <div className="tod-lobby-meta">
                <span><Crown size={16}/> {room.mode === "classic" ? "Classic Mode" : "Couple Mode"}</span>
                <span><Users size={16}/> {room.second_user ? "2 / 2" : "1 / 2"}</span>
                <span><Flame size={16}/> Round {room.round_no}</span>
              </div>
              <RoomTools roomId={room.id} waiting={room.status === "waiting"} />
              {room.status === "waiting" && <div className="tod-waiting-note"><span className="tod-loader"/> الحالة كتتحدّث تلقائياً كل 4 ثواني</div>}
              <Link className="tod-lobby-back" href="/games/truth-or-dare">← رجع لصفحة الأنماط</Link>
            </section>
          )
        ) : (
          <>
            <div className="tod-section-heading">
              <span className="tod-small-line" />
              <span>CHOOSE YOUR VIBE</span>
              <span className="tod-small-line" />
            </div>
            <section className="tod-modes" aria-label="اختار نمط اللعب">
              <article className="tod-mode tod-classic">
                <div className="tod-card-glow" aria-hidden="true" />
                <div className="tod-mode-top"><span className="tod-card-tag">TURN BY TURN</span><MoonStar size={21}/></div>
                <div className="tod-mode-icon">🎭</div>
                <h2>Classic <span>Mode</span></h2>
                <p>مرة نتا، مرة هي. كل واحد كيختار حقيقة ولا تحدي، والضحك مضمون.</p>
                <div className="tod-mode-features"><span><CheckCircle2 size={15}/> أدوار بالتناوب</span><span><CheckCircle2 size={15}/> Truth & Dare</span></div>
                <form action={createTodRoom}>
                  <input type="hidden" name="mode" value="classic" />
                  <button type="submit" className="tod-btn tod-btn-primary tod-btn-full">إنشاء غرفة Classic <ArrowRight size={18}/></button>
                </form>
              </article>

              <article className="tod-mode tod-couple">
                <div className="tod-card-glow" aria-hidden="true" />
                <div className="tod-mode-top"><span className="tod-card-tag tod-tag-pink">ANSWER TOGETHER</span><Heart size={21}/></div>
                <div className="tod-mode-icon">💞</div>
                <h2>Couple <span>Mode</span></h2>
                <p>نفس السؤال ليكم بجوج، والأجوبة كتبان غير من بعد ما تجاوبو بجوج.</p>
                <div className="tod-mode-features"><span><CheckCircle2 size={15}/> نفس السؤال</span><span><CheckCircle2 size={15}/> أجوبة مخبية</span></div>
                <form action={createTodRoom}>
                  <input type="hidden" name="mode" value="couple" />
                  <button type="submit" className="tod-btn tod-btn-pink tod-btn-full">إنشاء غرفة Couple <ArrowRight size={18}/></button>
                </form>
              </article>
            </section>

            <section className="tod-join tod-glass">
              <div className="tod-join-copy"><div className="tod-join-icon"><Users size={23}/></div><div><h3>عندك كود الغرفة؟</h3><p>إلا الطرف الآخر سبق وأنشأ الغرفة، دخل الكود هنا.</p></div></div>
              <form action={joinTodRoom} className="tod-join-form">
                <label className="tod-sr-only" htmlFor="tod-room-id">كود الغرفة</label>
                <input id="tod-room-id" name="room_id" type="text" required autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                <button type="submit" className="tod-btn tod-btn-outline">دخول الغرفة <ArrowRight size={17}/></button>
              </form>
            </section>
          </>
        )}

        <footer className="tod-footer"><span>JUST US <Heart size={12} fill="currentColor" /> ONLY US</span><span>Made with love, just for two.</span></footer>
      </div>
    </main>
  );
}
