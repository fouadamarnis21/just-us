export type WheelKind = "question" | "task" | "swap_turn" | "free_choice";
export type WheelLevel = "normal" | "personal" | "bold" | "mix";
export type RoundStatus = "ready_to_spin" | "challenge" | "reveal" | "ready" | "completed";

export type WheelSegment = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  kind: WheelKind;
  weight: number;
  sort_order: number;
};

export type WheelRound = {
  id: string;
  round_no: number;
  turn_user_id: string;
  status: RoundStatus;
  result_kind: WheelKind | null;
  wheel_segment_id: string | null;
  chosen_segment_id: string | null;
  prompt: string | null;
  answer: { text: string | null; skipped: boolean } | null;
  ready_player_one: boolean;
  ready_player_two: boolean;
  spun_at: string | null;
  revealed_at: string | null;
};

export type WheelRoomState = {
  room_id: string;
  room_code: string;
  status: "waiting" | "active" | "finished";
  level: WheelLevel;
  player_number: 1 | 2;
  player_one: string;
  player_two: string | null;
  players_connected: number;
  current_round_no: number;
  segments: WheelSegment[];
  round: WheelRound | null;
};

export function isWheelRoomState(value: unknown): value is WheelRoomState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<WheelRoomState>;
  return (
    typeof v.room_code === "string" &&
    typeof v.room_id === "string" &&
    typeof v.player_one === "string" &&
    (v.player_two === null || typeof v.player_two === "string") &&
    Array.isArray(v.segments) &&
    typeof v.players_connected === "number" &&
    (v.round === null || typeof v.round === "object")
  );
}
