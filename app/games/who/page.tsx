import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/auth";
import WhoGame from "./who-game";
import "./who.css";

// The private game is rendered for each authenticated request.
export const dynamic = "force-dynamic";

export default async function WhoPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user || !isAllowedUser(user.id)) {
    redirect("/");
  }

  const params = await searchParams;
  return <WhoGame initialRoomId={params.room ?? ""} />;
}
