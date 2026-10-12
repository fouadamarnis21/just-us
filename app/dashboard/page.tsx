import Link from "next/link";

import { redirect } from "next/navigation";

import {

  ArrowLeft,

  ArrowUpLeft,

  Brain,

  Check,

  Clock3,

  Dices,

  Gift,

  Heart,

  Images,

  LockKeyhole,

  LogOut,

  MousePointer2,

  ShieldCheck,

  Sparkles,

  Target,

  UsersRound,

  WandSparkles,

} from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { isAllowedUser } from "@/lib/auth";

import { logout } from "../actions";

import "./dashboard.css";

export const dynamic = "force-dynamic";

const games = [
  {
    number: "01",
    icon: UsersRound,
    title: "شكون فينا؟",
    description: "جاوبو على نفس السؤال، وشوفو واش كتفكرو بنفس الطريقة. كل توافق كيزيد النقاط!",
    href: "/games/who",
    color: "cyan",
    category: "توافق",
  },
  {
    number: "02",
    icon: Dices,
    title: "حقيقة أو تحدي",
    description: "Truth or Dare: أسئلة شخصية وتحديات بجوج Modes — Classic وCouple.",
    href: "/games/truth-or-dare",
    color: "violet",
    category: "تحديات",
  },
  {
    number: "03",
    icon: WandSparkles,
    title: "عجلة الحظ",
    description: "دوّر العجلة وخلي الحظ يختار سؤال، تحدي أو مفاجأة جديدة ليكم بجوج.",
    href: "/games/lucky-wheel",
    color: "orange",
    category: "مفاجآت",
  },
  {
    number: "04",
    icon: Brain,
    title: "شحال كتعرفني؟",
    description: "أسئلة شخصية باش تعرفو شكون فيكم كيعرف الآخر أكثر.",
    href: null,
    color: "pink",
    category: "معرفة",
  },
  {
    number: "05",
    icon: Target,
    title: "خمن جوابي",
    description: "حاول تتوقع شنو غادي يختار الطرف الآخر.",
    href: null,
    color: "rose",
    category: "تخمين",
  },
  {
    number: "06",
    icon: Gift,
    title: "صندوق الأسرار",
    description: "رسائل ومفاجآت خاصة كتتحل مع الوقت أو التحديات.",
    href: null,
    color: "gold",
    category: "أسرار",
  },
] as const;

const availableGames = games.filter((game) => game.href !== null).length;
const upcomingGames = games.length - availableGames;

export default async function Dashboard() {

  const supabase = await createClient();

  const {

    data: { user },

    error,

  } = await supabase.auth.getUser();

  if (error || !user || !isAllowedUser(user.id)) {

    redirect("/");

  }

  return (

    <main dir="rtl" className="ju-page min-h-screen overflow-hidden text-white">

      <div className="ju-dots pointer-events-none fixed inset-0" aria-hidden="true" />

      <div className="ju-light ju-light-one" aria-hidden="true" />

      <div className="ju-light ju-light-two" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-[1420px] px-4 pb-12 pt-5 sm:px-7 lg:px-10 lg:pt-8">

        {/* Navigation */}

        <header className="ju-topbar flex flex-wrap items-center justify-between gap-3 rounded-[22px] px-4 py-4 sm:px-6">

          <div className="flex items-center gap-3" dir="ltr">

            <span className="ju-logo flex h-11 w-11 items-center justify-center rounded-2xl">

              <Heart className="h-6 w-6 fill-white text-white" strokeWidth={1.5} />

            </span>

            <div className="leading-none">

              <p className="text-[22px] font-black tracking-[-.065em] sm:text-[25px]">

                JUST <span className="text-pink-400">US.</span>

              </p>

              <p className="mt-1.5 text-[9px] font-bold tracking-[.24em] text-white/40">

                OUR LITTLE UNIVERSE

              </p>

            </div>

          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-xs text-white/60 md:flex">

            <LockKeyhole className="h-3.5 w-3.5 text-pink-300" />

            عالم خاص غير بجوج

          </div>

          <form action={logout}>

            <button

              type="submit"

              className="ju-logout inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-white/75 transition hover:border-pink-400/40 hover:bg-pink-500/10 hover:text-white sm:text-sm"

            >

              <LogOut className="h-4 w-4" />

              تسجيل الخروج

            </button>

          </form>

        </header>

        {/* Hero */}

        <section className="ju-hero relative mt-6 grid items-center overflow-hidden rounded-[32px] border border-pink-400/15 px-6 py-9 sm:px-10 sm:py-12 lg:mt-8 lg:grid-cols-[1.05fr_.95fr] lg:px-14 lg:py-16">

          <div className="ju-hero-pattern pointer-events-none absolute inset-0" aria-hidden="true" />

          <div className="relative z-10 max-w-[620px]">

            <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-4 py-2 text-[11px] font-semibold text-pink-200 sm:text-xs">

              <Sparkles className="h-3.5 w-3.5" />

              مرحباً بك في عالمكم الخاص

            </div>

            <h1 className="mt-6 text-[clamp(2.4rem,5vw,4.9rem)] font-black leading-[1.22] tracking-tight">

              عالم صغير،

              <span className="ju-gradient-text mt-1 block">حكاية كبيرة.</span>

            </h1>

            <p className="mt-6 max-w-[480px] text-sm leading-8 text-white/55 sm:text-base">

              هنا كيتلاقاو الضحك، الأسئلة والمفاجآت. مساحة خاصة بيكم بجوج، حتى إلا كنتو بعيدين على بعضياتكم.

            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">

              <a

                href="#games"

                className="ju-primary-button inline-flex items-center gap-3 rounded-2xl px-6 py-3.5 text-sm font-bold text-white sm:px-7"

              >

                اكتشف الألعاب

                <ArrowLeft className="h-4 w-4" />

              </a>

              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.035] px-4 py-3.5 text-xs font-medium text-white/55">

                <Clock3 className="h-4 w-4 text-pink-300" />

                {availableGames} ألعاب واجدين للعب بجوج

              </span>

            </div>

            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-6 text-xs text-white/50">

              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300" /> دخول خاص</span>

              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300" /> جوج حسابات فقط</span>

              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-pink-300" /> تصميم للهواتف</span>

            </div>

          </div>

          {/* Decorative 3D-like illustration, no external image needed */}

          <div className="ju-art relative z-10 mx-auto mt-10 flex h-[280px] w-full max-w-[450px] items-center justify-center sm:h-[350px] lg:mt-0" aria-hidden="true">

            <div className="ju-orbit ju-orbit-back" />

            <div className="ju-orbit ju-orbit-front" />

            <div className="ju-center-glow" />

            <div className="ju-heart-shell">

              <Heart className="ju-big-heart h-28 w-28 fill-pink-500 stroke-pink-200 sm:h-36 sm:w-36" strokeWidth={1.1} />

            </div>

            <div className="ju-mini ju-mini-one"><Sparkles className="h-5 w-5 text-pink-200" /></div>

            <div className="ju-mini ju-mini-two"><Heart className="h-4 w-4 fill-pink-300 text-pink-300" /></div>

            <div className="ju-mini ju-mini-three"><Sparkles className="h-4 w-4 text-fuchsia-200" /></div>

            <div className="ju-art-caption">YOU <span>✦</span> ME</div>

          </div>

        </section>

        {/* Feature strip */}

        <section className="mt-5 grid gap-3 sm:grid-cols-3 lg:gap-4" aria-label="مميزات الموقع">

          <div className="ju-stat flex items-center gap-4 rounded-2xl p-4 sm:p-5">

            <div className="ju-stat-icon"><ShieldCheck className="h-5 w-5 text-pink-300" /></div>

            <div><p className="text-sm font-bold">الخصوصية أولاً</p><p className="mt-1 text-xs text-white/40">الدخول للحسابين المسموح ليهم</p></div>

          </div>

          <div className="ju-stat flex items-center gap-4 rounded-2xl p-4 sm:p-5">

            <div className="ju-stat-icon"><Sparkles className="h-5 w-5 text-pink-300" /></div>

            <div><p className="text-sm font-bold">{availableGames} ألعاب خدامين</p><p className="mt-1 text-xs text-white/40">و{upcomingGames} ألعاب أخرى قريباً</p></div>

          </div>

          <div className="ju-stat flex items-center gap-4 rounded-2xl p-4 sm:p-5">

            <div className="ju-stat-icon"><UsersRound className="h-5 w-5 text-pink-300" /></div>

            <div><p className="text-sm font-bold">مع بعض ولو من بعيد</p><p className="mt-1 text-xs text-white/40">مزامنة تلقائية بين الحسابين</p></div>

          </div>

        </section>

        {/* Games */}

        <section id="games" className="scroll-mt-8 pt-16 sm:pt-20">

          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">

            <div>

              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-pink-400">

                <span className="ju-pink-line" /> OUR GAMES

              </div>

              <h2 className="mt-3 text-3xl font-black sm:text-4xl">الألعاب ديالنا <span className="text-pink-400">✦</span></h2>

              <p className="mt-3 text-sm leading-7 text-white/45">بداو اللعب دابا فالألعاب الجاهزة، والباقي غادي نزيدوه من بعد.</p>

            </div>

            <span className="rounded-full border border-white/10 bg-white/[.035] px-4 py-2 text-xs text-white/45">{availableGames} جاهزين / {upcomingGames} قريباً</span>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

            {games.map((game) => {

              const Icon = game.icon;

              const isAvailable = game.href !== null;

              const cardClass = `ju-game ju-game-${game.color} group relative block min-h-[272px] overflow-hidden rounded-[26px] p-6 sm:p-7 ${

                isAvailable

                  ? "cursor-pointer transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink-400"

                  : ""

              }`;

              const cardContent = (

                <>

                  <div className="flex items-start justify-between gap-3">

                    <div className="ju-game-icon flex h-16 w-16 items-center justify-center rounded-[20px]">

                      <Icon className="h-8 w-8" strokeWidth={1.7} />

                    </div>

                    <span className="text-[11px] font-bold tracking-[.2em] text-white/30">

                      {game.number} / 06

                    </span>

                  </div>

                  <div className="mt-8">

                    <p className="text-[11px] font-semibold text-white/45">{game.category}</p>

                    <h3 className="mt-2 text-xl font-extrabold tracking-tight text-white">

                      {game.title}

                    </h3>

                    <p className="mt-3 max-w-[340px] text-[13px] leading-7 text-white/55">

                      {game.description}

                    </p>

                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-white/[.07] pt-4">

                    {isAvailable ? (

                      <span className="inline-flex items-center gap-2 text-xs font-bold text-pink-300">

                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />

                        العب دابا

                      </span>

                    ) : (

                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/45">

                        <Clock3 className="h-3.5 w-3.5" /> قريباً

                      </span>

                    )}

                    {isAvailable ? (

                      <ArrowUpLeft className="h-4 w-4 text-pink-300 transition-transform group-hover:-translate-x-1 group-hover:-translate-y-1" />

                    ) : (

                      <LockKeyhole className="h-4 w-4 text-white/25" />

                    )}

                  </div>

                </>

              );

              return game.href ? (

                <Link

                  key={game.number}

                  href={game.href}

                  className={cardClass}

                  aria-label={`العب ${game.title}`}

                >

                  {cardContent}

                </Link>

              ) : (

                <article key={game.number} className={cardClass}>

                  {cardContent}

                </article>

              );

            })}

          </div>

        </section>

        {/* Roadmap / special area */}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">

          <div className="ju-bottom-panel relative overflow-hidden rounded-[28px] p-7 sm:p-9">

            <div className="absolute -left-12 -top-16 h-56 w-56 rounded-full bg-pink-500/10 blur-[75px]" aria-hidden="true" />

            <div className="relative">

              <span className="inline-flex items-center gap-2 text-xs font-semibold text-pink-300"><MousePointer2 className="h-4 w-4" /> NEXT CHAPTER</span>

              <h2 className="mt-4 text-2xl font-black">القادم أحلى... <span className="text-pink-400">♥</span></h2>

              <p className="mt-3 max-w-lg text-sm leading-7 text-white/45">

                دابا {availableGames} ألعاب خدامين بغرف خاصة ومزامنة تلقائية. المرحلة الجاية نزيدو ألعاب جديدة ونطورو التجربة ديالكم.

              </p>

              <div className="mt-7 flex flex-wrap gap-2">

                <span className="ju-road-chip"><Check className="h-3.5 w-3.5" /> تسجيل الدخول</span>

                <span className="ju-road-chip"><Check className="h-3.5 w-3.5" /> غرف اللعب</span>

                <span className="ju-road-chip"><Check className="h-3.5 w-3.5" /> مزامنة الأجوبة</span>

              </div>

            </div>

          </div>

          <div className="ju-bottom-panel relative flex min-h-[250px] flex-col justify-between overflow-hidden rounded-[28px] p-7 sm:p-9">

            <div className="absolute -left-7 bottom-0 opacity-[.07]" aria-hidden="true"><Heart className="h-48 w-48 fill-pink-400 text-pink-400" /></div>

            <div className="relative flex items-center gap-3">

              <div className="ju-stat-icon"><Images className="h-5 w-5 text-pink-300" /></div>

              <span className="text-[11px] font-semibold tracking-[.16em] text-white/40">OUR MEMORIES</span>

            </div>

            <div className="relative">

              <h3 className="text-2xl font-black">ذكرياتنا الخاصة</h3>

              <p className="mt-3 max-w-xs text-sm leading-7 text-white/45">من بعد نزيدو الصور والرسائل، مع تخزين خاص وصلاحيات آمنة.</p>

              <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-pink-300"><Clock3 className="h-3.5 w-3.5" /> قريباً</span>

            </div>

          </div>

        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-6 text-[11px] text-white/30">

          <span dir="ltr">JUST US © • MADE FOR TWO</span>

          <span className="flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> مساحة خاصة، ماشي موقع عمومي</span>

        </footer>

      </div>

    </main>

  );

}
