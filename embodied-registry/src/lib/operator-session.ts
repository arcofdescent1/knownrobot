import "server-only";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export async function requireOperator(){
  const {user}=await requireIdentity();
  const allowed=(process.env.KNOWNROBOT_OPERATOR_EMAILS||"").split(",").map(item=>item.trim().toLowerCase()).filter(Boolean);
  if(!user.email||!allowed.includes(user.email.toLowerCase()))redirect("/dashboard");
  const service=getServiceSupabaseClient();
  if(!service)throw new Error("Operator service unavailable.");
  return{user,service};
}
