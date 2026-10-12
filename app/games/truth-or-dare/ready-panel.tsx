"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Heart } from "lucide-react";
import { getTodReadyStatus, markTodReady } from "./game-ready-actions";
import "./ready-panel.css";

type Status = {
  round_no: number;
  phase: string;
  first_ready: boolean;
  second_ready: boolean;
};

export default function ReadyPanel({
  roomId, roundNo, userId, firstUser, isClassic, currentTurn,
}: {
  roomId: string;
  roundNo: number;
  userId: string;
  firstUser: string;
  isClassic: boolean;
  currentTurn: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAuthor = isClassic && currentTurn === userId;
  const mine = firstUser === userId ? status?.first_ready : status?.second_ready;
  const other = firstUser === userId ? status?.second_ready : status?.first_ready;

  useEffect(() => {
    let active = true;
    let inFlight = false;
    async function sync() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const next = await getTodReadyStatus(roomId);
        if (!active) return;
        if (next) {
          setStatus(next);
          if (next.round_no !== roundNo || next.phase !== "reveal") router.refresh();
        }
      } finally {
        inFlight = false;
      }
    }
    void sync();
    const timer = window.setInterval(() => void sync(), 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [roomId, roundNo, router]);

  async function confirm() {
    if (busy || mine) return;
    setBusy(true);
    setError("");
    try {
      const result = await markTodReady(roomId);
      if (!result.ok) { setError(result.error ?? "وقع خطأ."); return; }
      const next = await getTodReadyStatus(roomId);
      if (next) setStatus(next);
      router.refresh();
    } catch {
      setError("وقع مشكل فالاتصال. عاود جرّب.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tod-ready-panel" dir="rtl">
      <div className="tod-ready-heading"><Heart size={19} fill="currentColor"/> {isAuthor ? "الجواب ديالك تصيفط ❤️" : "قريتو الجواب؟"}</div>
      <p className="tod-ready-description">{isAuthor ? "نتا واجد تلقائياً حيث نتا اللي جاوبتي. كنتسناو الطرف الآخر يقرا الجواب." : isClassic ? "قرا الجواب براحتك، ومن بعد أكد باش نبداو الجولة التالية." : "كل واحد يقرا جواب الآخر براحتو. الجولة ما كتبدلش حتى تأكدو بجوج."}</p>
      <div className="tod-ready-players">
        <div className={`tod-ready-person ${mine ? "is-ready" : ""}`}>
          {mine ? <CheckCircle2 size={21}/> : <Clock3 size={21}/>}
          <strong>نتا</strong><small>{mine ? "واجد ✓" : "باقي"}</small>
        </div>
        <div className={`tod-ready-person ${other ? "is-ready" : ""}`}>
          {other ? <CheckCircle2 size={21}/> : <Clock3 size={21}/>}
          <strong>الطرف الآخر</strong><small>{other ? "واجد ✓" : "باقي"}</small>
        </div>
      </div>
      {error && <p className="tod-ready-error" role="alert">{error}</p>}
      {isAuthor ? (
        <div className="tod-ready-wait"><Clock3 size={18}/>{other ? "الطرف الآخر أكد، كنبدلو الجولة..." : "جوابك تسجل، كنتسناو الطرف الآخر يقراه..."}</div>
      ) : mine ? (
        <div className="tod-ready-wait"><Clock3 size={18}/>{other ? "بجوج واجدين، كنبدلو الجولة..." : "تسجل التأكيد ديالك. كنتسناو الطرف الآخر..."}</div>
      ) : (
        <button className="tod-game-primary tod-ready-button" type="button" onClick={confirm} disabled={busy}>
          {busy ? "كنسجلو التأكيد..." : isClassic ? "قريت الجواب، نكملو ❤️" : "قريت جواب الطرف الآخر، أنا واجد ❤️"}
          <CheckCircle2 size={20}/>
        </button>
      )}
    </div>
  );
}
