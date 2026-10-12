"use client";



import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import Link from "next/link";

import {

  Activity, ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronDown,

  CircleHelp, ClipboardList, Disc3, Download, Edit3, Eye, FileUp, Filter,

  Heart, LayoutDashboard, Layers3, Loader2, LockKeyhole, Menu,

  MessageCircleQuestion, Plus, RefreshCw, Save, Search, ShieldCheck,

  SlidersHorizontal, Sparkles, ToggleLeft, ToggleRight, WandSparkles, X,

} from "lucide-react";

import { createClient } from "@/lib/supabase/browser";



export type WhoItem = { id: number; question: string; is_active: boolean };

export type TodItem = {

  id: number; kind: "truth" | "dare"; mode: "classic" | "couple" | "both";

  content: string; level: "normal" | "personal" | "bold"; is_active: boolean;

};

export type WheelPrompt = {

  id: string; segment_id: string; content: string;

  level: "normal" | "personal" | "bold"; is_active: boolean;

};

export type WheelSegment = {

  id: string; slug: string; title: string; emoji: string; color: string;

  kind: "question" | "task" | "swap_turn" | "free_choice";

  weight: number; sort_order: number; is_active: boolean;

};

export type AdminData = {

  who: WhoItem[];

  truth_or_dare: TodItem[];

  wheel_prompts: WheelPrompt[];

  wheel_segments: WheelSegment[];

};



type Tab = "overview" | "who" | "tod" | "wheel_prompt" | "wheel_segment";

type EditableTab = Exclude<Tab, "overview">;

type StatusFilter = "all" | "active" | "inactive";

type Editor = { game: EditableTab; id?: string };

type Draft = Record<string, string>;

type Toast = { text: string; tone: "ok" | "error" } | null;

type ImportGame = Exclude<EditableTab, "wheel_segment">;

type ImportEntry = { line: number; payload: Record<string, string>; text: string; fingerprint: string };

type ImportPreview = { filename: string; game: ImportGame; entries: ImportEntry[]; skipped: number; total: number };

type ImportResult = { imported: number; total: number; error?: string };

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function importFingerprint(game: ImportGame, payload: Record<string, string>) {
  if (game === "who") return normalizeKey(payload.question || "");
  if (game === "tod") return ["content", "kind", "mode", "level"].map((key) => normalizeKey(payload[key] || "")).join("|");
  return ["content", "level", "segment_id"].map((key) => normalizeKey(payload[key] || "")).join("|");
}

// Handles quoted commas/semicolons, escaped double quotes and multiline CSV cells.
function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("CSV فيه علامة اقتباس ما تسدّاتش.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function parseImportRows(text: string, extension: string, game: ImportGame): Array<{ line: number; item: Record<string, unknown> }> {
  if (extension === "json") {
    let parsed: unknown;
    try { parsed = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error("JSON غير صالح. تأكد من الفواصل وعلامات الاقتباس."); }
    if (!Array.isArray(parsed)) throw new Error("JSON خاصو يكون Array ديال الأسئلة [...].");
    return parsed.map((value, index) => {
      if (game === "who" && typeof value === "string") return { line: index + 1, item: { question: value } };
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`العنصر ${index + 1} خاصو يكون Object.`);
      return { line: index + 1, item: value as Record<string, unknown> };
    });
  }
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const known = ["question", "content", "kind", "mode", "level", "segment_id", "segment_slug"];
  const first = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = first.some((cell) => known.includes(cell));
  if (game !== "who" && !hasHeader) throw new Error("CSV خاصو يحتوي على Header بالأسماء المطلوبة. حمّل المثال من الزر.");
  if (game === "who" && !hasHeader && rows.some((row) => row.length !== 1)) {
    throw new Error("ملف شكون فينا؟ خاصو عمود واحد أو Header باسم question.");
  }
  const headers = hasHeader ? first : ["question"];
  const body = hasHeader ? rows.slice(1) : rows;
  return body.map((row, index) => {
    const item: Record<string, unknown> = {};
    headers.forEach((header, i) => { item[header] = row[i] ?? ""; });
    return { line: index + (hasHeader ? 2 : 1), item };
  });
}

function validateImportItem(game: ImportGame, item: Record<string, unknown>, line: number, segments: WheelSegment[]): Record<string, string> {
  const get = (key: string) => typeof item[key] === "string" ? (item[key] as string).trim() : "";
  const content = get(game === "who" ? "question" : "content");
  const limit = game === "who" ? 500 : 1000;
  if (!content || content.length > limit) throw new Error(`السطر ${line}: السؤال خاصو يكون بين 1 و${limit} حرف.`);
  if (game === "who") return { question: content };
  const level = get("level").toLowerCase();
  if (!["normal", "personal", "bold"].includes(level)) throw new Error(`السطر ${line}: level خاصو يكون normal أو personal أو bold.`);
  if (game === "tod") {
    const kind = get("kind").toLowerCase();
    const mode = get("mode").toLowerCase();
    if (!["truth", "dare"].includes(kind)) throw new Error(`السطر ${line}: kind خاصو يكون truth أو dare.`);
    if (!["classic", "couple", "both"].includes(mode)) throw new Error(`السطر ${line}: mode خاصو يكون classic أو couple أو both.`);
    if (kind === "dare" && mode !== "classic") throw new Error(`السطر ${line}: Dare خاصها mode=classic.`);
    return { content, kind, mode, level };
  }
  const segmentId = get("segment_id");
  const segmentSlug = get("segment_slug");
  const segment = segments.find((s) => s.id === segmentId || (!!segmentSlug && s.slug === segmentSlug));
  if (!segment || !["question", "task"].includes(segment.kind)) {
    throw new Error(`السطر ${line}: segment_slug أو segment_id ما كاينش فخانات الأسئلة/التحديات ديال العجلة.`);
  }
  return { content, level, segment_id: segment.id };
}

function csvEscape(value: string) { return '"' + value.replace(/"/g, '""') + '"'; }




const emptyData: AdminData = { who: [], truth_or_dare: [], wheel_prompts: [], wheel_segments: [] };

const tabs: { id: Tab; title: string; subtitle: string; icon: typeof LayoutDashboard }[] = [

  { id: "overview", title: "نظرة عامة", subtitle: "Overview", icon: LayoutDashboard },

  { id: "who", title: "شكون فينا؟", subtitle: "Who Game", icon: MessageCircleQuestion },

  { id: "tod", title: "حقيقة أو تحدي", subtitle: "Truth or Dare", icon: Heart },

  { id: "wheel_prompt", title: "أسئلة العجلة", subtitle: "Wheel Prompts", icon: Disc3 },

  { id: "wheel_segment", title: "خانات العجلة", subtitle: "Wheel Studio", icon: SlidersHorizontal },

];

const levelNames: Record<string, string> = { normal: "Normal", personal: "Personal", bold: "Bold" };

const kindNames: Record<string, string> = {

  truth: "حقيقة", dare: "تحدي", question: "سؤال", task: "تحدي",

  swap_turn: "تبديل الدور", free_choice: "اختيار حر",

};

const emptyDrafts: Record<EditableTab, Draft> = {

  who: { question: "" },

  tod: { content: "", kind: "truth", mode: "both", level: "normal" },

  wheel_prompt: { content: "", level: "normal", segment_id: "" },

  wheel_segment: {

    title: "", slug: "", emoji: "💗", color: "#ec4899",

    kind: "question", weight: "1", sort_order: "10",

  },

};



function normalize(raw: unknown): AdminData | null {

  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;

  if (!["who", "truth_or_dare", "wheel_prompts", "wheel_segments"].every((key) => Array.isArray(obj[key]))) return null;

  return {

    who: obj.who as WhoItem[],

    truth_or_dare: obj.truth_or_dare as TodItem[],

    wheel_prompts: obj.wheel_prompts as WheelPrompt[],

    wheel_segments: obj.wheel_segments as WheelSegment[],

  };

}



function makeDraft(game: EditableTab, item?: WhoItem | TodItem | WheelPrompt | WheelSegment): Draft {

  const initial = { ...emptyDrafts[game] };

  if (!item) return initial;

  for (const key of Object.keys(initial)) {

    const value = (item as unknown as Record<string, unknown>)[key];

    if (value !== undefined && value !== null) initial[key] = String(value);

  }

  return initial;

}



function countActive<T extends { is_active: boolean }>(items: T[]) {

  return items.filter((item) => item.is_active).length;

}



function buildWheelGradient(segments: WheelSegment[]) {

  const active = [...segments].filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const total = active.length;

  if (!active.length) return "conic-gradient(#ec4899, #a855f7, #ec4899)";

  let offset = 0;

  const stops = active.map((s) => {

    const from = (offset / total) * 100;

    offset += 1;

    const to = (offset / total) * 100;

    return `${s.color} ${from.toFixed(4)}% ${to.toFixed(4)}%`;

  });

  return `conic-gradient(from -90deg, ${stops.join(", ")})`;

}



export default function AdminPanel({ initialData, initialError }: { initialData: AdminData | null; initialError: string | null }) {

  const [data, setData] = useState<AdminData>(normalize(initialData) ?? emptyData);

  const [tab, setTab] = useState<Tab>("overview");

  const [query, setQuery] = useState("");

  const [status, setStatus] = useState<StatusFilter>("all");

  const [level, setLevel] = useState("all");

  const [showAll, setShowAll] = useState(false);

  const [editor, setEditor] = useState<Editor | null>(null);

  const [draft, setDraft] = useState<Draft>({});

  const [busy, setBusy] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(initialError || (!normalize(initialData) ? "تعذّر قراءة البيانات. جرب تحديث المحتوى." : ""));

  const [formError, setFormError] = useState("");

  const [toast, setToast] = useState<Toast>(null);

  const [mobileNav, setMobileNav] = useState(false);
  const [importGame, setImportGame] = useState<ImportGame | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [importProgress, setImportProgress] = useState(0);


  const supabase = useMemo(() => createClient(), []);



  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => setToast({ text, tone }), []);



  useEffect(() => {

    if (!toast) return;

    const id = window.setTimeout(() => setToast(null), 4500);

    return () => window.clearTimeout(id);

  }, [toast]);



  useEffect(() => {

    if (!editor) return;

    function onKeyDown(event: KeyboardEvent) {

      if (event.key === "Escape" && !busy) setEditor(null);

    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [editor, busy]);



  const refresh = useCallback(async (silent = false) => {

    if (!silent) setLoading(true);

    const { data: response, error: rpcError } = await supabase.rpc("just_us_admin_get_content");

    const parsed = normalize(response);

    if (rpcError || !parsed) {

      const message = rpcError?.message || "البيانات اللي رجعات من Supabase ماشي بالشكل المتوقع.";

      setError(message);

      notify("تعذّر تحديث المحتوى. " + message, "error");

    } else {

      setData(parsed);

      setError("");

      if (!silent) notify("المحتوى تحدّث بنجاح");

    }

    if (!silent) setLoading(false);

    return !rpcError && !!parsed;

  }, [notify, supabase]);



  function switchTab(next: Tab) {

    setTab(next);

    setQuery("");

    setStatus("all");

    setLevel("all");

    setShowAll(false);

    setMobileNav(false);

  }



  const segmentsById = useMemo(() => new Map(data.wheel_segments.map((s) => [s.id, s])), [data.wheel_segments]);

  const currentItems = useMemo(() => {

    if (tab === "who") return data.who;

    if (tab === "tod") return data.truth_or_dare;

    if (tab === "wheel_prompt") return data.wheel_prompts;

    if (tab === "wheel_segment") return [...data.wheel_segments].sort((a, b) => a.sort_order - b.sort_order);

    return [];

  }, [data, tab]);

  const filtered = useMemo(() => {

    const search = query.trim().toLocaleLowerCase();

    return currentItems.filter((item) => {

      if (status !== "all" && item.is_active !== (status === "active")) return false;

      if (level !== "all" && "level" in item && item.level !== level) return false;

      if (!search) return true;

      const searchable = "question" in item ? item.question

        : "content" in item ? item.content

        : `${item.title} ${item.slug} ${item.kind}`;

      return String(searchable).toLocaleLowerCase().includes(search);

    });

  }, [currentItems, query, status, level]);

  const shown = showAll ? filtered : filtered.slice(0, 12);



  function openEditor(game: EditableTab, item?: WhoItem | TodItem | WheelPrompt | WheelSegment) {

    const next = makeDraft(game, item);

    if (game === "wheel_prompt" && !next.segment_id) {

      next.segment_id = data.wheel_segments.find((s) => s.kind === "question" || s.kind === "task")?.id || "";

    }

    if (game === "wheel_segment" && !item) {

      next.sort_order = String(Math.max(0, ...data.wheel_segments.map((s) => s.sort_order)) + 1);

    }

    setDraft(next);

    setFormError("");

    setEditor({ game, id: item ? String(item.id) : undefined });

  }



  function setField(key: string, value: string) {

    setDraft((old) => {

      const next = { ...old, [key]: value };

      if (key === "kind" && next.kind === "dare" && next.mode !== "classic") next.mode = "classic";

      return next;

    });

  }



  async function saveItem(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!editor || busy) return;

    setFormError("");

    const { game, id } = editor;

    const payload: Record<string, string | number> = { ...draft };

    if (id) payload.id = id;

    if (game === "wheel_segment") {

      payload.weight = Number(draft.weight);

      payload.sort_order = Number(draft.sort_order);

      if (!Number.isFinite(payload.weight) || payload.weight <= 0 || payload.weight > 1000 ||

          !Number.isInteger(payload.sort_order) || payload.sort_order < 0) {

        setFormError("تأكد من Weight وSort Order.");

        return;

      }

      if (!id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug || "")) {

        setFormError("Slug خاصو يكون بالإنجليزية الصغيرة، أرقام و - فقط.");

        return;

      }

    }

    setBusy(true);

    const { error: rpcError } = await supabase.rpc("just_us_admin_save_content", {

      p_game: game,

      p_payload: payload,

    });

    if (rpcError) {

      setFormError(rpcError.message);

      setBusy(false);

      return;

    }

    const ok = await refresh(true);

    setBusy(false);

    if (ok) {

      setEditor(null);

      notify(id ? "تسجلات التعديلات بنجاح" : "تزاد المحتوى بنجاح");

    } else {

      setFormError("تسجّل التعديل، ولكن تعذّر تحديث اللائحة. عاود تحديث الصفحة.");

    }

  }



  async function toggleItem(game: EditableTab, item: WhoItem | TodItem | WheelPrompt | WheelSegment) {

    if (busy) return;

    // All games can be toggled; backend RPC enforces permissions and constraints.

    const next = !item.is_active;

    if (!next && !window.confirm("واش متأكد بغيتي تعطّل هاد العنصر؟ الغرف الجديدة ما غاديش تستعملو.")) return;

    setBusy(true);

    const { error: rpcError } = await supabase.rpc("just_us_admin_set_active", {

      p_game: game, p_id: String(item.id), p_active: next,

    });

    if (rpcError) {

      notify(rpcError.message, "error");

    } else {

      await refresh(true);

      notify(next ? "العنصر تفعّل" : "العنصر تعطّل");

    }

    setBusy(false);

  }



  function openImporter(game: ImportGame) {
    setImportGame(game);
    setImportPreview(null);
    setImportResult(null);
    setImportError("");
    setImportProgress(0);
  }

  function closeImporter() {
    if (busy) return;
    setImportGame(null);
    setImportPreview(null);
    setImportResult(null);
    setImportError("");
  }

  function downloadImportTemplate(game: ImportGame) {
    const segment = data.wheel_segments.find((s) => s.kind === "question" || s.kind === "task");
    const rows = game === "who"
      ? [["question"], ["شكون فينا كيبغي القهوة أكثر؟"], ["شكون فينا كيضحك بزاف؟"]]
      : game === "tod"
        ? [["content", "kind", "mode", "level"], ["شنو أكثر حاجة كتفرحك؟", "truth", "both", "normal"], ["قول كلمة زوينة للطرف الآخر", "dare", "classic", "normal"]]
        : [["content", "level", "segment_slug"], ["شنو أحلى ذكرى عندك؟", "normal", segment?.slug || "CHANGE_ME"], ["شنو كيعجبك فالعلاقة ديالنا؟", "personal", segment?.slug || "CHANGE_ME"]];
    const csv = "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `just-us-${game}-template.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    if (!importGame || busy) return;
    setImportPreview(null);
    setImportResult(null);
    setImportError("");
    setImportProgress(0);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension !== "csv" && extension !== "json") throw new Error("اختار ملف CSV أو JSON فقط.");
      if (file.size > MAX_IMPORT_BYTES) throw new Error("الملف كبير بزاف. الحد الأقصى 2 MB.");
      const raw = await file.text();
      const rows = parseImportRows(raw, extension, importGame);
      if (!rows.length) throw new Error("الملف خاوي وما فيه حتى سؤال.");
      if (rows.length > MAX_IMPORT_ROWS) throw new Error(`الحد الأقصى ${MAX_IMPORT_ROWS} سؤال فكل عملية.`);
      const existing = importGame === "who" ? data.who : importGame === "tod" ? data.truth_or_dare : data.wheel_prompts;
      const known = new Set(existing.map((item) => importFingerprint(importGame, item as unknown as Record<string, string>)));
      const entries: ImportEntry[] = [];
      let skipped = 0;
      for (const { line, item } of rows) {
        const payload = validateImportItem(importGame, item, line, data.wheel_segments);
        const fingerprint = importFingerprint(importGame, payload);
        if (known.has(fingerprint)) { skipped++; continue; }
        known.add(fingerprint);
        entries.push({ line, payload, fingerprint, text: payload.question || payload.content });
      }
      setImportPreview({ filename: file.name, game: importGame, entries, skipped, total: rows.length });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "تعذّر قراءة الملف.");
    }
  }

  async function runImport() {
    if (!importPreview || busy || !importPreview.entries.length) return;
    const { game, entries } = importPreview;
    setBusy(true);
    setImportError("");
    setImportProgress(0);
    let imported = 0;
    let failure = "";
    try {
      // Existing server-side admin RPC: each insertion checks authorization and validates content.
      // Sequential calls avoid overload and show exact progress; no extra SQL migration is needed.
      for (const entry of entries) {
        const { error: rpcError } = await supabase.rpc("just_us_admin_save_content", {
          p_game: game, p_payload: entry.payload,
        });
        if (rpcError) {
          failure = `توقفنا فالسطر ${entry.line}: ${rpcError.message}`;
          break;
        }
        imported++;
        setImportProgress(imported);
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : "وقع خطأ فالاتصال.";
    } finally {
      setImportPreview(null); // Prevent accidentally resubmitting already inserted rows.
      setImportResult({ imported, total: entries.length, error: failure || undefined });
      await refresh(true);
      setBusy(false);
      if (failure) notify(`تزاد ${imported} سؤال. ${failure}`, "error");
      else notify(`تزاد ${imported} سؤال بنجاح`);
    }
  }

  function exportJson() {

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });

    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");

    anchor.href = url;

    anchor.download = "just-us-admin-content.json";

    document.body.appendChild(anchor);

    anchor.click();

    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    notify("تصدّر المحتوى بصيغة JSON");

  }



  const activeSegments = data.wheel_segments.filter((s) => s.is_active);

  const activePromptCount = countActive(data.wheel_prompts);

  const activeTodCount = countActive(data.truth_or_dare);

  const activeWhoCount = countActive(data.who);

  const totalContent = data.who.length + data.truth_or_dare.length + data.wheel_prompts.length;

  const selectedTab = tabs.find((t) => t.id === tab) || tabs[0];



  return (

    <main className="ja-root" dir="rtl">

      <div className="ja-glow ja-glow-one" aria-hidden="true" />

      <div className="ja-glow ja-glow-two" aria-hidden="true" />

      <div className="ja-shell">

        <header className="ja-header">

          <Link className="ja-brand" href="/dashboard" aria-label="JUST US Dashboard">

            <span className="ja-brand-heart"><Heart size={18} fill="currentColor" /></span>

            <span dir="ltr">JUST <strong>US</strong></span>

            <span className="ja-brand-divider" />

            <span className="ja-brand-admin">CONTROL CENTER</span>

          </Link>

          <div className="ja-header-actions">

            <span className="ja-private-tag"><LockKeyhole size={13} /> PRIVATE ADMIN AREA</span>

            <Link className="ja-back" href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>

            <button className="ja-menu-button" onClick={() => setMobileNav((v) => !v)} aria-label="فتح القائمة" aria-expanded={mobileNav}>

              {mobileNav ? <X size={20} /> : <Menu size={20} />}

            </button>

          </div>

        </header>



        <div className="ja-layout">

          <aside className={`ja-sidebar ${mobileNav ? "ja-sidebar-open" : ""}`}>

            <div className="ja-sidebar-title"><span className="ja-sidebar-dot" /> WORKSPACE <span>01 / 01</span></div>

            <div className="ja-sidebar-caption">MANAGEMENT</div>

            <nav className="ja-nav" aria-label="Admin navigation">

              {tabs.map((item) => {

                const Icon = item.icon;

                return (

                  <button key={item.id} className={`ja-nav-item ${tab === item.id ? "ja-nav-active" : ""}`} onClick={() => switchTab(item.id)} aria-current={tab === item.id ? "page" : undefined}>

                    <span className="ja-nav-icon"><Icon size={18} /></span>

                    <span className="ja-nav-text"><strong>{item.title}</strong><small>{item.subtitle}</small></span>

                    <span className="ja-nav-count">{item.id === "who" ? data.who.length : item.id === "tod" ? data.truth_or_dare.length : item.id === "wheel_prompt" ? data.wheel_prompts.length : item.id === "wheel_segment" ? data.wheel_segments.length : <ArrowUpRight size={15} />}</span>

                  </button>

                );

              })}

            </nav>

            <div className="ja-sidebar-bottom">

              <div className="ja-admin-avatar"><ShieldCheck size={20} /></div>

              <div><strong>Administrator</strong><small>Full content access</small></div>

              <span className="ja-online-dot" />

            </div>

          </aside>



          <div className="ja-main">

            <div className="ja-breadcrumb"><span>JUST US</span><span className="ja-crumb-divider">/</span><span>ADMIN</span><span className="ja-crumb-divider">/</span><strong>{selectedTab.subtitle}</strong></div>

            <div className="ja-page-heading">

              <div>

                <div className="ja-eyebrow"><Sparkles size={13} /> YOUR PRIVATE UNIVERSE · MANAGEMENT</div>

                <h1>{tab === "overview" ? <>Admin <span>Dashboard</span></> : selectedTab.title}</h1>

                <p>{tab === "overview" ? "كلشي تحت السيطرة. سيّر الأسئلة والتحديات والعجلة من بلاصة وحدة." : `تسيير المحتوى ديال ${selectedTab.title} بطريقة منظمة وآمنة.`}</p>

              </div>

              <div className="ja-heading-actions">

                <button type="button" className="ja-button ja-button-ghost" onClick={() => void refresh()} disabled={loading || busy}>

                  <RefreshCw size={16} className={loading ? "ja-spin-icon" : ""} /> تحديث

                </button>

                {tab === "overview" ? (

                  <button type="button" className="ja-button ja-button-primary" onClick={exportJson}><Download size={16} /> Export JSON</button>

                ) : (
                  <>
                    {tab !== "wheel_segment" && <button type="button" className="ja-button ja-button-ghost" onClick={() => openImporter(tab as ImportGame)} disabled={busy}><FileUp size={17} /> Import CSV / JSON</button>}
                    <button type="button" className="ja-button ja-button-primary" onClick={() => openEditor(tab as EditableTab)} disabled={busy}><Plus size={18} /> إضافة جديد</button>
                  </>
                )}

              </div>

            </div>



            {error && <div className="ja-alert" role="alert"><CircleHelp size={19} /><span>{error}</span><button onClick={() => void refresh()}>إعادة المحاولة</button></div>}



            {tab === "overview" ? (

              <>

                <section className="ja-hero-card">

                  <div className="ja-hero-orb" aria-hidden="true"><Heart size={52} fill="currentColor" /></div>

                  <div className="ja-hero-copy">

                    <span className="ja-hero-kicker"><ShieldCheck size={15} /> ADMIN ACCESS VERIFIED</span>

                    <h2>كل تفاصيل عالمكم <span>بين يديك.</span></h2>

                    <p>زيد الأسئلة، بدّل التحديات، وتحكم فاحتمالات عجلة الحظ — بلا ما تبدّل الكود ديال الموقع.</p>

                    <button type="button" className="ja-hero-link" onClick={() => switchTab("wheel_segment")}>فتح Wheel Studio <ArrowUpRight size={17} /></button>

                  </div>

                  <div className="ja-hero-decoration" aria-hidden="true">✦</div>

                </section>



                <section className="ja-stats" aria-label="Content statistics">

                  <Stat icon={<ClipboardList size={19} />} label="مجموع الأسئلة" value={totalContent} detail="جميع الألعاب" tone="pink" />

                  <Stat icon={<MessageCircleQuestion size={19} />} label="شكون فينا؟" value={activeWhoCount} detail={`من أصل ${data.who.length} سؤال`} tone="purple" />

                  <Stat icon={<Heart size={19} />} label="Truth or Dare" value={activeTodCount} detail={`من أصل ${data.truth_or_dare.length} سؤال`} tone="orange" />

                  <Stat icon={<Disc3 size={19} />} label="Lucky Wheel" value={activeSegments.length} detail={`خانات نشيطة · ${activePromptCount} سؤال`} tone="cyan" />

                </section>



                <div className="ja-overview-grid">

                  <section className="ja-panel ja-management-panel">

                    <div className="ja-panel-heading"><div><span className="ja-panel-kicker">QUICK ACCESS</span><h2>إدارة الألعاب</h2></div><Layers3 size={19} /></div>

                    <div className="ja-game-cards">

                      <GameCard emoji="🎭" name="شكون فينا؟" subtitle="أسئلة الاختيارات" count={data.who.length} onClick={() => switchTab("who")} />

                      <GameCard emoji="💞" name="حقيقة أو تحدي" subtitle="Classic / Couple" count={data.truth_or_dare.length} onClick={() => switchTab("tod")} />

                      <GameCard emoji="🎡" name="Lucky Wheel" subtitle="أسئلة وتحديات" count={data.wheel_prompts.length} onClick={() => switchTab("wheel_prompt")} />

                    </div>

                  </section>

                  <section className="ja-panel ja-wheel-panel">

                    <div className="ja-panel-heading"><div><span className="ja-panel-kicker">LIVE CONFIGURATION</span><h2>Wheel Studio</h2></div><WandSparkles size={19} /></div>

                    <WheelPreview segments={data.wheel_segments} />

                    <div className="ja-wheel-footer"><span><span className="ja-live-dot" /> {activeSegments.length} Active Segments</span><button onClick={() => switchTab("wheel_segment")}>تخصيص العجلة <ArrowUpRight size={16} /></button></div>

                  </section>

                </div>

                <div className="ja-note"><ShieldCheck size={17} /><p><strong>الحماية مفعلة من جهة السيرفر.</strong> إضافة وتعديل المحتوى كيدوزو عبر Admin RPCs. التحكم فتفعيل أسئلة «شكون فينا؟» متاح للغرف الجديدة. أسئلة حقيقة أو تحدي كتختار غير المحتوى النشيط عبر `is_active`.</p></div>

              </>

            ) : (

              <>

                {tab === "wheel_segment" && (

                  <div className="ja-segments-intro ja-panel">

                    <WheelPreview segments={data.wheel_segments} compact />

                    <div className="ja-segments-intro-text">

                      <span className="ja-panel-kicker">WHEEL CONFIGURATION</span>

                      <h2>صمّم العجلة ديالك</h2>

                      <p>تحكم فالخانات، الألوان، الترتيب والاحتمالات. Weight كيتحسب نسبياً؛ ماشي ضروري يكون المجموع 100.</p>

                      <span className="ja-info-chip"><CheckCircle2 size={15} /> {activeSegments.length} / 8 خانات نشيطة</span>

                    </div>

                  </div>

                )}

                {tab === "who" && <div className="ja-info-banner"><CheckCircle2 size={18} /> تقدر تزيد، تعدّل، تفعّل وتعطّل الأسئلة. التغييرات كتطبق على الغرف الجديدة فقط.</div>}

                {tab === "tod" && <div className="ja-info-banner"><CircleHelp size={18} /> تقدر تزيد، تعدّل، تفعّل وتعطّل الأسئلة. اختيار الأسئلة الجديدة كيحترم حالة التفعيل.</div>}

                <section className="ja-panel ja-list-panel">

                  <div className="ja-list-heading"><div><span className="ja-panel-kicker">CONTENT LIBRARY</span><h2>{selectedTab.title} <span>({currentItems.length})</span></h2></div><span className="ja-content-count"><Eye size={14} /> {filtered.length} نتيجة</span></div>

                  <div className="ja-toolbar">

                    <label className="ja-search"><Search size={18} /><input type="search" placeholder="قلب على سؤال، تحدي أو خانة..." value={query} onChange={(e) => { setQuery(e.target.value); setShowAll(false); }} aria-label="بحث فالمحتوى" /></label>

                    <label className="ja-select-wrap"><Filter size={15} /><select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setShowAll(false); }} aria-label="فلتر الحالة"><option value="all">جميع الحالات</option><option value="active">نشط</option><option value="inactive">معطّل</option></select><ChevronDown size={14} /></label>

                    {(tab === "tod" || tab === "wheel_prompt") && <label className="ja-select-wrap"><Layers3 size={15} /><select value={level} onChange={(e) => { setLevel(e.target.value); setShowAll(false); }} aria-label="فلتر المستوى"><option value="all">جميع المستويات</option><option value="normal">Normal</option><option value="personal">Personal</option><option value="bold">Bold</option></select><ChevronDown size={14} /></label>}

                  </div>

                  <div className="ja-table-scroll">

                    <table className="ja-table"><thead><tr><th>المحتوى</th><th>التصنيف</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>

                      {shown.map((item) => {

                        const game = tab as EditableTab;

                        const title = "question" in item ? item.question : "content" in item ? item.content : `${item.emoji} ${item.title}`;

                        const kind = "kind" in item ? kindNames[item.kind] : "سؤال";

                        const itemLevel = "level" in item ? levelNames[item.level] : null;

                        const segment = "segment_id" in item ? segmentsById.get(item.segment_id) : null;

                        const subtitle = "slug" in item ? item.slug : `#${String(item.id).slice(0, 8)}`;

                        const canToggle = true;

                        return <tr key={String(item.id)}>

                          <td><div className="ja-table-primary">{title}</div><div className="ja-table-sub">{subtitle}</div></td>

                          <td><div className="ja-tags">{itemLevel && <span className="ja-tag">{itemLevel}</span>}{"mode" in item && <span className="ja-tag">{item.mode}</span>}{"kind" in item && <span className="ja-tag">{kind}</span>}{segment && <span className="ja-tag">{segment.emoji} {segment.title}</span>}{"weight" in item && <span className="ja-tag">Weight {item.weight}</span>}</div></td>

                          <td><span className={`ja-status ${item.is_active ? "ja-status-active" : "ja-status-inactive"}`}><span />{item.is_active ? "نشط" : "معطّل"}</span></td>

                          <td><div className="ja-table-actions"><button title="تعديل" aria-label={`تعديل ${title}`} onClick={() => openEditor(game, item)} disabled={busy}><Edit3 size={17} /></button><button title={canToggle ? (item.is_active ? "تعطيل" : "تفعيل") : "التعطيل مؤجل لهاد اللعبة"} aria-label={item.is_active ? `تعطيل ${title}` : `تفعيل ${title}`} onClick={() => void toggleItem(game, item)} disabled={busy || !canToggle} className={item.is_active ? "ja-toggle-on" : ""}>{item.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}</button></div></td>

                        </tr>;

                      })}

                    </tbody></table>

                    {filtered.length === 0 && <div className="ja-empty"><Search size={26} /><strong>ما لقاينا حتى نتيجة</strong><span>بدّل البحث أو الفلاتر وجرب مرة أخرى.</span></div>}

                  </div>

                  {filtered.length > 12 && <div className="ja-table-footer"><span>عرض {shown.length} من {filtered.length}</span><button onClick={() => setShowAll((v) => !v)}>{showAll ? "عرض أقل" : "عرض الكل"} <ChevronDown size={15} /></button></div>}

                </section>

              </>

            )}

            <footer className="ja-footer"><span>JUST US <Heart size={12} fill="currentColor" /> PRIVATE CONTROL CENTER</span><span>Made for our little universe · 2026</span></footer>

          </div>

        </div>

      </div>



      {toast && <div className={`ja-toast ${toast.tone === "error" ? "ja-toast-error" : ""}`} role="status"><span>{toast.tone === "ok" ? <Check size={17} /> : <CircleHelp size={17} />}</span>{toast.text}<button aria-label="إغلاق التنبيه" onClick={() => setToast(null)}><X size={15} /></button></div>}



      {importGame && <div className="ja-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeImporter(); }}>
        <section className="ja-modal" role="dialog" aria-modal="true" aria-labelledby="ja-import-title">
          <div className="ja-modal-head">
            <div><span className="ja-panel-kicker">BULK IMPORT</span><h2 id="ja-import-title">رفع الأسئلة دفعة وحدة</h2><p>{tabs.find((t) => t.id === importGame)?.title} · CSV / JSON</p></div>
            <button type="button" onClick={closeImporter} disabled={busy} aria-label="إغلاق"><X size={21} /></button>
          </div>
          <div className="ja-editor-form" style={{ display: "grid", gap: 16 }}>
            <div className="ja-form-hint"><CircleHelp size={17} /> حتى {MAX_IMPORT_ROWS} سؤال فكل مرة. الأسئلة الموجودة والمكررة غادي نتجاوزوها. الاستيراد كيزيد أسئلة جديدة وما كيمسح حتى سؤال قديم.</div>
            <button type="button" className="ja-button ja-button-ghost" disabled={busy} onClick={() => downloadImportTemplate(importGame)}><Download size={16} /> تحميل نموذج CSV جاهز</button>
            <label className="ja-field">
              <span>اختار ملف من الجهاز (CSV UTF-8 أو JSON)</span>
              <input type="file" accept=".csv,.json,text/csv,application/json" disabled={busy} onChange={(e) => { const file = e.currentTarget.files?.[0]; if (file) void handleImportFile(file); e.currentTarget.value = ""; }} />
            </label>
            {importGame === "who" && <p style={{ fontSize: 12, color: "#c8b6d2", lineHeight: 1.8 }}>فـ«شكون فينا؟» يكفي ملف CSV بعمود <code>question</code>، أو JSON فيه لائحة الأسئلة.</p>}
            {importGame === "tod" && <p style={{ fontSize: 12, color: "#c8b6d2", lineHeight: 1.8 }}>Truth or Dare: خاص الأعمدة <code>content,kind,mode,level</code>. التحديات <code>dare</code> كتستعمل <code>classic</code>.</p>}
            {importGame === "wheel_prompt" && <p style={{ fontSize: 12, color: "#c8b6d2", lineHeight: 1.8 }}>Lucky Wheel: خاص <code>content,level,segment_slug</code> أو <code>segment_id</code>. النموذج كيستعمل خانة موجودة عندك.</p>}
            {importError && <div className="ja-form-error" role="alert">{importError}</div>}
            {importPreview && <div style={{ border: "1px solid #ffffff25", borderRadius: 12, padding: 14, background: "#ffffff08", display: "grid", gap: 10 }}>
              <strong style={{ fontSize: 13 }}>{importPreview.filename}</strong>
              <span style={{ fontSize: 12, color: "#d9c5df" }}>المجموع: {importPreview.total} · غادي نزيدو: {importPreview.entries.length} · مكررة: {importPreview.skipped}</span>
              {importPreview.entries.slice(0, 4).map((entry) => <div key={entry.line} style={{ fontSize: 12, padding: "8px 10px", borderRadius: 8, background: "#ffffff0c", color: "#f2dcec", lineHeight: 1.7 }}><span style={{ color: "#ec9dca" }}>#{entry.line}</span> {entry.text}</div>)}
              {importPreview.entries.length > 4 && <span style={{ fontSize: 11, color: "#b9a6c2" }}>... وزيد {importPreview.entries.length - 4} سؤال</span>}
            </div>}
            {busy && importPreview && <div aria-live="polite" style={{ fontSize: 13, color: "#f5c4e0" }}><Loader2 className="ja-spin-icon" size={16} style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 7 }} />جاري الاستيراد: {importProgress} / {importPreview.entries.length}</div>}
            {importResult && <div className={importResult.error ? "ja-form-error" : "ja-form-hint"} role="status">
              {importResult.error ? `تزاد ${importResult.imported} من ${importResult.total}. ${importResult.error} صلح المشكل وعاود رفع نفس الملف؛ المكرر غادي يتجاوز.` : `نجح الاستيراد! تزادو ${importResult.imported} سؤال.`}
            </div>}
            <div className="ja-modal-footer">
              <button type="button" className="ja-button ja-button-ghost" onClick={closeImporter} disabled={busy}>إغلاق</button>
              <button type="button" className="ja-button ja-button-primary" disabled={busy || !importPreview || importPreview.entries.length === 0} onClick={() => void runImport()}>{busy ? <Loader2 size={17} className="ja-spin-icon" /> : <FileUp size={17} />} {busy ? "جاري الرفع..." : `إضافة ${importPreview?.entries.length || 0} سؤال`}</button>
            </div>
          </div>
        </section>
      </div>}

      {editor && <div className="ja-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setEditor(null); }}>

        <section className="ja-modal" role="dialog" aria-modal="true" aria-labelledby="ja-modal-title">

          <div className="ja-modal-head"><div><span className="ja-panel-kicker">CONTENT EDITOR</span><h2 id="ja-modal-title">{editor.id ? "تعديل المحتوى" : "إضافة محتوى جديد"}</h2><p>{tabs.find((t) => t.id === editor.game)?.title}</p></div><button type="button" onClick={() => setEditor(null)} disabled={busy} aria-label="إغلاق"><X size={21} /></button></div>

          <form onSubmit={(e) => void saveItem(e)} className="ja-editor-form">

            {editor.game === "who" && <Field label="السؤال" required><textarea value={draft.question || ""} maxLength={500} rows={4} onChange={(e) => setField("question", e.target.value)} placeholder="شكون فينا...؟" required /></Field>}

            {editor.game === "tod" && <>

              <Field label="السؤال أو التحدي" required><textarea value={draft.content || ""} maxLength={1000} rows={4} onChange={(e) => setField("content", e.target.value)} required placeholder="كتب السؤال أو التحدي هنا..." /></Field>

              <div className="ja-form-grid"><Field label="النوع"><select value={draft.kind || "truth"} onChange={(e) => setField("kind", e.target.value)}><option value="truth">Truth — حقيقة</option><option value="dare">Dare — تحدي</option></select></Field><Field label="Mode"><select value={draft.mode || "both"} onChange={(e) => setField("mode", e.target.value)}><option value="both" disabled={draft.kind === "dare"}>Both</option><option value="classic">Classic</option><option value="couple" disabled={draft.kind === "dare"}>Couple</option></select></Field></div>

              <Field label="المستوى"><select value={draft.level || "normal"} onChange={(e) => setField("level", e.target.value)}><option value="normal">Normal</option><option value="personal">Personal</option><option value="bold">Bold</option></select></Field>

            </>}

            {editor.game === "wheel_prompt" && <>

              <Field label="السؤال أو التحدي" required><textarea value={draft.content || ""} maxLength={1000} rows={4} onChange={(e) => setField("content", e.target.value)} required placeholder="كتب محتوى العجلة هنا..." /></Field>

              <Field label="الخانة" required><select value={draft.segment_id || ""} onChange={(e) => setField("segment_id", e.target.value)} required><option value="">اختار الخانة</option>{data.wheel_segments.filter((s) => s.kind === "question" || s.kind === "task").map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.title} {s.is_active ? "" : "(معطّلة)"}</option>)}</select></Field>

              <Field label="المستوى"><select value={draft.level || "normal"} onChange={(e) => setField("level", e.target.value)}><option value="normal">Normal</option><option value="personal">Personal</option><option value="bold">Bold</option></select></Field>

            </>}

            {editor.game === "wheel_segment" && <>

              <div className="ja-form-grid"><Field label="اسم الخانة" required><input value={draft.title || ""} maxLength={80} onChange={(e) => setField("title", e.target.value)} required placeholder="سؤال رومانسي" /></Field><Field label="Emoji" required><input value={draft.emoji || ""} maxLength={16} onChange={(e) => setField("emoji", e.target.value)} required placeholder="💗" /></Field></div>

              <Field label="Slug (إنجليزي، ما كيتبدلش من بعد)" required><input value={draft.slug || ""} maxLength={64} onChange={(e) => setField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} required disabled={!!editor.id} placeholder="romantic-question" dir="ltr" /></Field>

              <div className="ja-form-grid"><Field label="النوع"><select value={draft.kind || "question"} onChange={(e) => setField("kind", e.target.value)} disabled={!!editor.id}><option value="question">Question</option><option value="task">Task</option><option value="swap_turn">Swap Turn</option><option value="free_choice">Free Choice</option></select></Field><Field label="اللون"><div className="ja-color-field"><input type="color" value={draft.color || "#ec4899"} onChange={(e) => setField("color", e.target.value)} /><input value={draft.color || "#ec4899"} maxLength={7} pattern="#[a-fA-F0-9]{6}" onChange={(e) => setField("color", e.target.value)} dir="ltr" required /></div></Field></div>

              <div className="ja-form-grid"><Field label="Weight (احتمال نسبي)" required><input type="number" min="0.01" max="1000" step="0.01" value={draft.weight || "1"} onChange={(e) => setField("weight", e.target.value)} required /></Field><Field label="Sort Order" required><input type="number" min="0" max="10000" step="1" value={draft.sort_order || "0"} onChange={(e) => setField("sort_order", e.target.value)} required /></Field></div>

              {!editor.id && <div className="ja-form-hint"><CircleHelp size={16} /> الخانة الجديدة كتزاد معطّلة. زيد الأسئلة ديال Normal وPersonal وBold، ومن بعد فعّلها.</div>}

            </>}

            {formError && <div className="ja-form-error" role="alert">{formError}</div>}

            <div className="ja-modal-footer"><button type="button" className="ja-button ja-button-ghost" disabled={busy} onClick={() => setEditor(null)}>إلغاء</button><button type="submit" className="ja-button ja-button-primary" disabled={busy}>{busy ? <Loader2 className="ja-spin-icon" size={17} /> : <Save size={17} />}{busy ? "جاري الحفظ..." : "حفظ التغييرات"}</button></div>

          </form>

        </section>

      </div>}

    </main>

  );

}



function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {

  return <label className="ja-field"><span>{label} {required && <b>*</b>}</span>{children}</label>;

}



function Stat({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: number; detail: string; tone: string }) {

  return <div className={`ja-stat ja-stat-${tone}`}><div className="ja-stat-top"><span className="ja-stat-icon">{icon}</span><Activity size={15} /></div><span className="ja-stat-label">{label}</span><strong>{value.toLocaleString("en-US")}</strong><span className="ja-stat-detail">{detail}</span></div>;

}



function GameCard({ emoji, name, subtitle, count, onClick }: { emoji: string; name: string; subtitle: string; count: number; onClick: () => void }) {

  return <button className="ja-game-card" onClick={onClick}><span className="ja-game-emoji">{emoji}</span><span className="ja-game-copy"><strong>{name}</strong><small>{subtitle} · {count} عنصر</small></span><ArrowUpRight size={18} /></button>;

}



function WheelPreview({ segments, compact = false }: { segments: WheelSegment[]; compact?: boolean }) {

  const active = [...segments].filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order);

  const gradient = buildWheelGradient(segments);

  const style: CSSProperties = { background: gradient };

  return <div className={`ja-wheel-preview ${compact ? "ja-wheel-compact" : ""}`}>

    <div className="ja-wheel-halo"><div className="ja-wheel-face" style={style}><span className="ja-wheel-center"><Heart size={22} fill="currentColor" /></span></div><div className="ja-wheel-pointer" /></div>

    {!compact && <div className="ja-wheel-legend">{active.slice(0, 8).map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.emoji} {s.title}</span>)}</div>}

  </div>;

}
