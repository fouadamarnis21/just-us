"use server";

import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReadyStatus = {
  round_no: number;
  phase: string;
  first_ready: boolean;
  second_ready: boolean;
};

async function clientForAllowedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !isAllowedUser(user.id)) return null;
  return supabase;
}

export async function getTodReadyStatus(roomId: string): Promise<ReadyStatus | null> {
  if (!UUID_RE.test(roomId)) return null;
  const supabase = await clientForAllowedUser();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("just_us_tod_ready_status", { p_room_id: roomId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (typeof value.round_no !== "number" || typeof value.phase !== "string") return null;
  return {
    round_no: value.round_no,
    phase: value.phase,
    first_ready: value.first_ready === true,
    second_ready: value.second_ready === true,
  };
}

export async function markTodReady(roomId: string): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_RE.test(roomId)) return { ok: false, error: "كود الغرفة غير صحيح." };
  const supabase = await clientForAllowedUser();
  if (!supabase) return { ok: false, error: "خاصك تدخل بحسابك باش تكمل." };
  const { error } = await supabase.rpc("just_us_tod_mark_ready", { p_room_id: roomId });
  if (error) {
    console.error("Ready confirmation error:", error.message);
    return { ok: false, error: "ما قدرناش نسجلو التأكيد. عاود جرّب." };
  }
  return { ok: true };
}
