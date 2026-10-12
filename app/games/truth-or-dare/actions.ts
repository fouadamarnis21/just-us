"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

const BASE = "/games/truth-or-dare";

async function getAuthorizedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAllowedUser(user.id)) redirect("/");
  return supabase;
}

export async function createTodRoom(formData: FormData) {
  const supabase = await getAuthorizedClient();
  const mode = formData.get("mode");
  if (mode !== "classic" && mode !== "couple") {
    redirect(`${BASE}?error=invalid-mode`);
  }
  const { data, error } = await supabase.rpc("just_us_tod_create_room", {
    p_mode: mode,
  });
  if (error || typeof data !== "string") {
    console.error("Truth or Dare: create room failed", error?.message);
    redirect(`${BASE}?error=create`);
  }
  redirect(`${BASE}?room=${encodeURIComponent(data)}`);
}

export async function joinTodRoom(formData: FormData) {
  const supabase = await getAuthorizedClient();
  const raw = formData.get("room_id");
  const roomId = typeof raw === "string" ? raw.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) {
    redirect(`${BASE}?error=invalid-room`);
  }
  const { data, error } = await supabase.rpc("just_us_tod_join_room", {
    p_room_id: roomId,
  });
  if (error || typeof data !== "string") {
    console.error("Truth or Dare: join room failed", error?.message);
    redirect(`${BASE}?error=join`);
  }
  redirect(`${BASE}?room=${encodeURIComponent(data)}`);
}
