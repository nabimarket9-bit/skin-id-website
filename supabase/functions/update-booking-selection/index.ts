import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BookingSelectionPayload = {
  leadId?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  timezone?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

const isValidTimeZone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Booking update is not configured" }, 500);
    }

    let payload: BookingSelectionPayload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const leadId = cleanText(payload.leadId, 80);
    const startTime = cleanText(payload.startTime, 80);
    const endTime = cleanText(payload.endTime, 80);
    const timezone = cleanText(payload.timezone, 80);
    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);

    if (
      !uuidPattern.test(leadId) ||
      !startTime ||
      !endTime ||
      !timezone ||
      !isValidTimeZone(timezone) ||
      Number.isNaN(startMs) ||
      Number.isNaN(endMs) ||
      endMs <= startMs
    ) {
      return jsonResponse({ error: "Invalid booking selection" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("skin_id_leads")
      .update({
        selected_start_time: new Date(startMs).toISOString(),
        selected_end_time: new Date(endMs).toISOString(),
        timezone,
        booking_status: "slot_selected",
      })
      .eq("id", leadId)
      .select("id")
      .single();

    if (error || !data?.id) {
      return jsonResponse({ error: "Booking selection could not be saved" }, 500);
    }

    return jsonResponse({ success: true });
  } catch {
    return jsonResponse({ error: "Booking selection could not be saved" }, 500);
  }
});
