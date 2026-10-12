import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import { login } from "./actions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isAllowedUser(user.id)) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08060d] px-5 py-12 text-white">

      {/* Background Effects */}
      <div className="pointer-events-none absolute -left-32 top-0 h-[450px] w-[450px] rounded-full bg-pink-600/20 blur-[130px]" />

      <div className="pointer-events-none absolute -right-32 bottom-0 h-[450px] w-[450px] rounded-full bg-purple-600/20 blur-[130px]" />

      <div className="relative z-10 w-full max-w-[440px]">

        {/* Logo */}
        <div className="mb-10 text-center">

          <div className="floating-heart mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] border border-pink-400/30 bg-gradient-to-br from-pink-500/20 to-purple-600/20 shadow-[0_0_60px_rgba(236,72,153,0.3)]">

            <span className="text-5xl text-pink-400">
              ♥
            </span>

          </div>

          <p className="mb-4 text-xs font-bold tracking-[0.35em] text-pink-300">
            PRIVATE SPACE
          </p>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            PRIVATE{" "}
            <span className="bg-gradient-to-r from-pink-400 to-fuchsia-500 bg-clip-text text-transparent">
              ACCESS.
            </span>
          </h1>

          <p className="mt-5 text-sm text-gray-400" dir="rtl">
            فضاء خاص وآمن، الدخول للمستخدمين المسموح ليهم فقط 🔐
          </p>

        </div>

        {/* Login Card */}
        <section className="rounded-[32px] border border-pink-500/20 bg-white/[0.045] p-7 shadow-[0_25px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-500 hover:border-pink-500/30 sm:p-9">

          <div className="mb-8 text-center" dir="rtl">

            <h2 className="text-2xl font-bold">
              مرحباً بعودتك 💗
            </h2>

            <p className="mt-3 text-sm text-gray-400">
              سجل الدخول للمتابعة
            </p>

          </div>

          <form action={login} className="space-y-6">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-3 block text-sm text-gray-300"
              >
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="example@email.com"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none transition-all duration-300 placeholder:text-gray-600 focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-3 block text-sm text-gray-300"
              >
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-5 py-4 text-white outline-none transition-all duration-300 placeholder:text-gray-600 focus:border-pink-400 focus:ring-2 focus:ring-pink-500/20"
              />
            </div>

            {/* Error */}
            {params.error && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-center text-sm text-red-300"
              >
                معلومات الدخول غير صحيحة أو غير مسموح بها
              </p>
            )}

            {/* Login Button */}
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 py-4 text-base font-bold text-white shadow-[0_10px_35px_rgba(236,72,153,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_45px_rgba(236,72,153,0.5)] active:scale-95"
            >
              Sign In ♥
            </button>

          </form>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>🔒</span>
            <span>Secure Private Access</span>
          </div>

        </section>

        <p className="mt-8 text-center text-xs tracking-[0.2em] text-gray-600">
          AUTHORIZED USERS ONLY
        </p>

      </div>

    </main>
  );
}