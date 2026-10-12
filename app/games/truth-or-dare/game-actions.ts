"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

const GAME_PATH = "/games/truth-or-dare";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorizedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAllowedUser(user.id)) redirect("/");
  return supabase;
}

function roomFromForm(formData: FormData) {
  const roomId = String(formData.get("room_id") ?? "").trim();
  if (!UUID_RE.test(roomId)) redirect(`${GAME_PATH}?error=invalid-room`);
  return roomId;
}

function go(roomId: string, error?: string): never {
  revalidatePath(GAME_PATH);
  redirect(`${GAME_PATH}?room=${encodeURIComponent(roomId)}${error ? `&game_error=${encodeURIComponent(error)}` : ""}`);
}

export async function chooseTodPrompt(formData: FormData) {
  const roomId = roomFromForm(formData);
  const kind = String(formData.get("kind") ?? "");
  const level = String(formData.get("level") ?? "");
  if (!["truth", "dare"].includes(kind) || !["normal", "personal", "bold"].includes(level)) {
    go(roomId, "invalid-choice");
  }
  const supabase = await authorizedClient();
  const { error } = await supabase.rpc("just_us_tod_choose_prompt", {
    p_room_id: roomId,
    p_kind: kind,
    p_level: level,
  });
  if (error) {
    console.error("Truth or Dare choose error:", error.message);
    go(roomId, "choose");
  }
  go(roomId);
}

export async function submitTodAnswer(formData: FormData) {
  const roomId = roomFromForm(formData);
  const answer = String(formData.get("answer") ?? "").trim();
  if (!answer || answer.length > 2000) go(roomId, "invalid-answer");
  const supabase = await authorizedClient();
  const { error } = await supabase.rpc("just_us_tod_submit_answer", {
    p_room_id: roomId,
    p_answer: answer,
  });
  if (error) {
    console.error("Truth or Dare answer error:", error.message);
    go(roomId, "answer");
  }
  go(roomId);
}

export async function nextTodRound(formData: FormData) {
  const roomId = roomFromForm(formData);
  const supabase = await authorizedClient();
  const { error } = await supabase.rpc("just_us_tod_next_round", {
    p_room_id: roomId,
  });
  if (error) {
    console.error("Truth or Dare next round error:", error.message);
    go(roomId, "next");
  }
  go(roomId);
}
