import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Heart, LockKeyhole, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import AdminPanel, { type AdminData } from "./admin-panel";
import "./admin.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Control Center",
  description: "JUST US — Private content management",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !isAllowedUser(user.id)) redirect("/");

  // Server-side role gate. The RPC functions independently check the same role.
  const { data: isAdmin, error: roleError } = await supabase.rpc("just_us_is_admin");

  if (roleError || isAdmin !== true) {
    return (
      <main className="ja-root ja-denied-root" dir="rtl">
        <div className="ja-denied">
          <span className="ja-denied-icon"><ShieldAlert size={31} /></span>
          <span className="ja-eyebrow">JUST US · RESTRICTED ACCESS</span>
          <h1>هاد الصفحة خاصة بالـAdmin</h1>
          <p>
            {roleError
              ? "تعذّر التحقق من صلاحيات Admin. تأكد من إعدادات Supabase والـSQL ديال الأعضاء."
              : "هاد الحساب ما عندوش صلاحية إدارة المحتوى. تقدر ترجع للألعاب بشكل عادي."}
          </p>
          <Link href="/dashboard" className="ja-button ja-button-primary">
            <ArrowLeft size={17} /> الرجوع للـDashboard
          </Link>
          <div className="ja-denied-brand"><Heart size={14} fill="currentColor" /> JUST US <LockKeyhole size={13} /></div>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("just_us_admin_get_content");

  return (
    <AdminPanel
      initialData={data as AdminData | null}
      initialError={error ? "تعذّر تحميل المحتوى. تأكد من تشغيل SQL ديال just_us_admin_get_content." : null}
    />
  );
}
