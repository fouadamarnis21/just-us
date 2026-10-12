import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Heart,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { createWheelRoom, joinWheelRoom } from "./actions";
import WheelGame from "./wheel-game";
import SubmitButton from "./submit-button";
import { isWheelRoomState, type WheelRoomState } from "./types";
import "./lucky-wheel.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lucky Wheel",
  description: "عجلة الحظ الخاصة بجوج — JUST US",
};

type PageProps = {
  searchParams: Promise<{ room?: string; error?: string }>;
};

const messages: Record<string, string> = {
  create: "ما قدرناش ننشئو الغرفة. تأكد أن إعدادات العجلة والأسئلة صحيحة وأن الحساب مسموح ليه.",
  join: "ما قدرناش ندخلوك للغرفة. تأكد من الكود وأن الغرفة ما عامراش.",
  "invalid-room": "كود الغرفة خاصو يكون 6 حروف أو أرقام صحيحة.",
  "invalid-level": "اختار مستوى اللعب الصحيح.",
};

const levels = [
  { id: "mix", emoji: "✨", name: "Mix", desc: "شوية من كلشي" },
  { id: "normal", emoji: "🌸", name: "Normal", desc: "خفيف وزوين" },
  { id: "personal", emoji: "💗", name: "Personal", desc: "أسئلة من القلب" },
  { id: "bold", emoji: "🔥", name: "Bold", desc: "شوية ديال الجرأة" },
];

export default async function LuckyWheelPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || !isAllowedUser(user.id)) redirect("/");

  const params = await searchParams;
  const code = typeof params.room === "string" ? params.room.trim().toUpperCase() : "";
  let room: WheelRoomState | null = null;
  let roomError = false;

  if (code) {
    if (!/^[A-F0-9]{6}$/.test(code)) {
      roomError = true;
    } else {
      const { data, error } = await supabase.rpc("just_us_wheel_get_state", { p_code: code });
      if (error || !isWheelRoomState(data)) roomError = true;
      else room = data;
    }
  }

  return (
    <main className="lw-root" dir="rtl">
      <div className="lw-aurora lw-aurora-one" aria-hidden="true" />
      <div className="lw-aurora lw-aurora-two" aria-hidden="true" />
      <div className="lw-stars" aria-hidden="true" />

      <div className="lw-shell">
        <header className="lw-header">
          <Link href="/dashboard" className="lw-brand" aria-label="JUST US Dashboard">
            <span className="lw-brand-heart"><Heart size={19} fill="currentColor" /></span>
            <span dir="ltr">JUST <strong>US</strong></span>
          </Link>
          <span className="lw-header-label"><LockKeyhole size={14} /> OUR PRIVATE UNIVERSE</span>
          <Link href="/dashboard" className="lw-back"><ArrowLeft size={17} /> Dashboard</Link>
        </header>

        <section className={`lw-hero${room ? " lw-hero-small" : ""}`}>
          <div className="lw-eyebrow"><Sparkles size={14} /> SPIN THE MAGIC <Sparkles size={14} /></div>
          <div className="lw-hero-symbol" aria-hidden="true">🎡<span>✦</span></div>
          <h1>Lucky <span>Wheel</span><i>♥</i></h1>
          <p>دورة وحدة، ألف مفاجأة... أسئلة، تحديات ولحظات زوينة غير ديالكم بجوج.</p>
          <div className="lw-hero-pills">
            <span><ShieldCheck size={14} /> PRIVATE</span>
            <span><Users size={14} /> TWO PLAYERS</span>
            <span><WandSparkles size={14} /> REAL-TIME MAGIC</span>
          </div>
        </section>

        {params.error && messages[params.error] && (
          <div className="lw-alert" role="alert">{messages[params.error]}</div>
        )}

        {code ? (
          roomError || !room ? (
            <section className="lw-error-card lw-glass">
              <div className="lw-lobby-icon">🔐</div>
              <h2>ما لقيناش هاد الغرفة</h2>
              <p>يمكن الكود غير صحيح، أو الحساب ديالك ما عندوش صلاحية الدخول.</p>
              <Link href="/games/lucky-wheel" className="lw-primary-btn">رجع للعبة <ArrowRight size={18} /></Link>
            </section>
          ) : (
            <WheelGame initialState={room} userId={user.id} />
          )
        ) : (
          <>
            <div className="lw-divider-heading"><span /> CHOOSE YOUR EXPERIENCE <span /></div>
            <div className="lw-lobby-grid">
              <section className="lw-create-card lw-glass">
                <div className="lw-card-corner">01 / CREATE</div>
                <div className="lw-lobby-icon">💗</div>
                <div className="lw-lobby-tag"><Crown size={15} /> YOUR OWN SPACE</div>
                <h2>صايب غرفة جديدة</h2>
                <p>اختار مستوى الأسئلة، صايب غرفة خاصة وشارك الكود مع الطرف الآخر.</p>
                <form action={createWheelRoom}>
                  <div className="lw-level-heading">اختار مستوى اللعب</div>
                  <div className="lw-level-grid">
                    {levels.map((level) => (
                      <label className="lw-level-option" key={level.id}>
                        <input type="radio" name="level" value={level.id} defaultChecked={level.id === "mix"} />
                        <span className="lw-level-content">
                          <span className="lw-level-emoji">{level.emoji}</span>
                          <strong>{level.name}</strong>
                          <small>{level.desc}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <SubmitButton>إنشاء الغرفة</SubmitButton>
                </form>
              </section>

              <section className="lw-join-card lw-glass">
                <div className="lw-card-corner">02 / JOIN</div>
                <div className="lw-lobby-icon">✨</div>
                <div className="lw-lobby-tag"><Users size={15} /> BETTER TOGETHER</div>
                <h2>دخل عند الطرف الآخر</h2>
                <p>إلا توصّلتي بكود الغرفة، دخلو هنا باش تلعبو بجوج فنفس الوقت.</p>
                <form action={joinWheelRoom} className="lw-join-form">
                  <label htmlFor="lw-room-code">ROOM CODE</label>
                  <input
                    id="lw-room-code"
                    name="room_code"
                    type="text"
                    minLength={6}
                    maxLength={6}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    dir="ltr"
                    placeholder="A1B2C3"
                    pattern="[a-fA-F0-9]{6}"
                    aria-describedby="lw-code-hint"
                  />
                  <span id="lw-code-hint" className="lw-input-help">6 حروف وأرقام · الكود كيبقى خاص بيكم</span>
                  <SubmitButton variant="secondary">دخول الغرفة</SubmitButton>
                </form>
                <div className="lw-join-decoration" aria-hidden="true">♥</div>
              </section>
            </div>
          </>
        )}

        <footer className="lw-footer"><span>JUST US <Heart size={12} fill="currentColor" /> ONLY US</span><span>Made with love, just for two.</span></footer>
      </div>
    </main>
  );
}
