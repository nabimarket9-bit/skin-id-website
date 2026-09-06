import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type LeadPayload = {
  storeName?: unknown;
  businessType?: unknown;
  platform?: unknown;
  catalogSize?: unknown;
  primaryGoal?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  timezone?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

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

    console.log("create-lead env", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Lead capture is not configured" }, 500);
    }

    let payload: LeadPayload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const lead = {
      store_name: cleanText(payload.storeName, 160),
      business_type: cleanText(payload.businessType, 80),
      platform: cleanText(payload.platform, 80),
      catalog_size: cleanText(payload.catalogSize, 40),
      primary_goal: cleanText(payload.primaryGoal, 120),
      first_name: cleanText(payload.firstName, 80),
      last_name: cleanText(payload.lastName, 80),
      email: cleanText(payload.email, 254).toLowerCase(),
      timezone: cleanText(payload.timezone, 80) || null,
      lead_status: "qualified",
      booking_status: "not_started",
      source: "ask_nabi",
    };

    const missingFields = Object.entries(lead)
      .filter(([key, value]) => {
        if (key === "timezone") {
          return false;
        }
        return typeof value === "string" && value.length === 0;
      })
      .map(([key]) => key);

    if (missingFields.length > 0 || !emailPattern.test(lead.email)) {
      return jsonResponse({ error: "Invalid lead details" }, 400);
    }

    console.log("create-lead initializing Supabase client", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    console.log("create-lead inserting lead", {
      table: "skin_id_leads",
      source: lead.source,
    });

    const { data, error } = await supabase
      .from("skin_id_leads")
      .insert(lead)
      .select("id")
      .single();

    if (error || !data?.id) {
      if (error) {
        console.error("create-lead insert failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
      } else {
        console.error("create-lead insert failed", {
          code: null,
          message: "Insert returned no lead id",
          details: null,
          hint: null,
        });
      }

      return jsonResponse({ error: "Lead could not be created" }, 500);
    }

    return jsonResponse({ leadId: data.id });
  } catch (error) {
    console.error("create-lead unexpected error", error);
    return jsonResponse({ error: "Lead could not be created" }, 500);
  }
});
