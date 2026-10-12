"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";

export default function RoomTools({ roomId, waiting }: { roomId: string; waiting: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(id);
  }, [waiting, router]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // The code remains selectable even if clipboard permissions are denied.
    }
  }

  return (
    <div className="tod-room-tools">
      <div className="tod-room-code" title={roomId}>{roomId}</div>
      <div className="tod-room-actions">
        <button className="tod-btn tod-btn-primary" type="button" onClick={copyCode}>
          {copied ? <Check size={17} /> : <Copy size={17} />}
          {copied ? "تنسخ الكود" : "نسخ كود الغرفة"}
        </button>
        <button className="tod-btn tod-btn-outline" type="button" onClick={() => router.refresh()}>
          <RefreshCw size={17} /> تحديث
        </button>
      </div>
    </div>
  );
}
