"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

const home = "/games/lucky-wheel";

async function requirePlayer() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAllowedUser(user.id)) redirect("/");
  return supabase;
}

export async function createWheelRoom(formData: FormData) {
  const supabase = await requirePlayer();
  const level = String(formData.get("level") ?? "mix");
  if (!["normal", "personal", "bold", "mix"].includes(level)) {
    redirect(`${home}?error=invalid-level`);
  }

  const { data, error } = await supabase.rpc("just_us_wheel_create_room", {
    p_level: level,
  });
  const code = (data as { room_code?: unknown } | null)?.room_code;
  if (error || typeof code !== "string" || !/^[A-F0-9]{6}$/.test(code)) {
    redirect(`${home}?error=create`);
  }
  redirect(`${home}?room=${encodeURIComponent(code)}`);
}

export async function joinWheelRoom(formData: FormData) {
  const supabase = await requirePlayer();
  const code = String(formData.get("room_code") ?? "").trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code)) {
    redirect(`${home}?error=invalid-room`);
  }

  const { data, error } = await supabase.rpc("just_us_wheel_join_room", {
    p_code: code,
  });
  const joined = (data as { room_code?: unknown } | null)?.room_code;
  if (error || joined !== code) {
    redirect(`${home}?error=join`);
  }
  redirect(`${home}?room=${encodeURIComponent(code)}`);
}
