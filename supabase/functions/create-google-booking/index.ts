import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BookingPayload = {
  leadId?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  timezone?: unknown;
};

type LeadRow = {
  id: string;
  store_name: string;
  business_type: string;
  platform: string;
  catalog_size: string;
  primary_goal: string;
  first_name: string;
  last_name: string;
  email: string;
  booking_status: string;
  selected_start_time: string | null;
  selected_end_time: string | null;
  timezone: string | null;
  google_calendar_event_id: string | null;
  google_meet_url: string | null;
};

type BusyPeriod = {
  start: string;
  end: string;
};

type GoogleEventResult = {
  event: Record<string, unknown>;
  created: boolean;
};

type WeekdayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type TimeRange = readonly [string, string];

const schedulingConfig = {
  ownerTimezone: "Europe/Paris",
  meetingDurationMinutes: 30,
  minimumNoticeHours: 12,
  bookingWindowDays: 60,
  ownerAvailability: {
    monday: [["09:00", "24:00"]],
    tuesday: [["09:00", "24:00"]],
    wednesday: [["09:00", "24:00"]],
    thursday: [["09:00", "24:00"]],
    friday: [["09:00", "24:00"]],
    saturday: [["09:00", "24:00"]],
    sunday: [],
  } satisfies Record<WeekdayKey, TimeRange[]>,
  prospectLocalWindow: {
    start: "08:00",
    end: "22:00",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const weekdayKeys: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const cleanText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const displayValue = (value: unknown) => {
  const cleaned = cleanText(value, 500);
  return cleaned || "Not provided";
};

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

const parseTimeToMinutes = (time: string) => {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
};

const getZonedParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
};

const getZonedDateKey = (date: Date, timezone: string) => {
  const parts = getZonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

const getZonedMinuteOfDay = (date: Date, timezone: string) => {
  const parts = getZonedParts(date, timezone);
  return parts.hour * 60 + parts.minute;
};

const isValidTimeZone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const isInsideProspectLocalWindow = (start: Date, end: Date, timezone: string) => {
  const startDateKey = getZonedDateKey(start, timezone);
  const endDateKey = getZonedDateKey(end, timezone);
  if (startDateKey !== endDateKey) {
    return false;
  }

  const startMinutes = getZonedMinuteOfDay(start, timezone);
  const endMinutes = getZonedMinuteOfDay(end, timezone);
  return (
    startMinutes >= parseTimeToMinutes(schedulingConfig.prospectLocalWindow.start) &&
    endMinutes <= parseTimeToMinutes(schedulingConfig.prospectLocalWindow.end)
  );
};

const isInsideOwnerAvailability = (start: Date, end: Date) => {
  const startParts = getZonedParts(start, schedulingConfig.ownerTimezone);
  const endParts = getZonedParts(end, schedulingConfig.ownerTimezone);
  const ownerDate = new Date(startParts.year, startParts.month - 1, startParts.day, 12, 0, 0, 0);
  const ownerDay = weekdayKeys[ownerDate.getDay()];
  const ownerStartMinutes = startParts.hour * 60 + startParts.minute;
  const ownerEndMinutes = endParts.hour * 60 + endParts.minute;
  const ownerStartDateKey = getZonedDateKey(start, schedulingConfig.ownerTimezone);
  const ownerEndDateKey = getZonedDateKey(end, schedulingConfig.ownerTimezone);

  return schedulingConfig.ownerAvailability[ownerDay].some(([rangeStart, rangeEnd]) => {
    const rangeStartMinutes = parseTimeToMinutes(rangeStart);
    const rangeEndMinutes = parseTimeToMinutes(rangeEnd);
    if (rangeEndMinutes === 1440) {
      return (
        ownerStartMinutes >= rangeStartMinutes &&
        ((ownerEndDateKey === ownerStartDateKey && ownerEndMinutes <= rangeEndMinutes) ||
          (ownerEndDateKey !== ownerStartDateKey && ownerEndMinutes === 0))
      );
    }
    return ownerStartDateKey === ownerEndDateKey && ownerStartMinutes >= rangeStartMinutes && ownerEndMinutes <= rangeEndMinutes;
  });
};

const overlapsBusyPeriod = (start: Date, end: Date, busyPeriods: BusyPeriod[]) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return busyPeriods.some((busy) => {
    const busyStartMs = Date.parse(busy.start);
    const busyEndMs = Date.parse(busy.end);
    return startMs < busyEndMs && endMs > busyStartMs;
  });
};

const googleEventIdPattern = /^[a-v0-9]{5,1024}$/;

const createGoogleEventId = (leadId: string, startMs: number) => `skinid${leadId.replace(/-/g, "")}${startMs.toString(16)}`;

const readGoogleErrorBody = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const extractMeetUrl = (event: Record<string, unknown>) => {
  if (typeof event.hangoutLink === "string" && event.hangoutLink) {
    return event.hangoutLink;
  }

  const conferenceData = event.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
  const videoEntry = conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video" && entry.uri);
  return videoEntry?.uri ?? null;
};

const formatInternalBookingTime = (timestamp: string, timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(timestamp))
    .replace(" at ", " · ");

const buildInternalBookingEmailHtml = (params: {
  lead: LeadRow;
  startIso: string;
  endIso: string;
  timezone: string;
  meetUrl: string;
}) => {
  const prospectStart = formatInternalBookingTime(params.startIso, params.timezone);
  const prospectEnd = new Intl.DateTimeFormat("en-US", {
    timeZone: params.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(params.endIso));
  const nabiStart = formatInternalBookingTime(params.startIso, schedulingConfig.ownerTimezone);
  const nabiEnd = new Intl.DateTimeFormat("en-US", {
    timeZone: schedulingConfig.ownerTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(params.endIso));

  const row = (label: string, value: unknown) =>
    `<tr><td style="padding:6px 0;color:#8f8f8f;font-size:13px;line-height:1.4;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#111111;font-size:13px;line-height:1.4;font-weight:700;text-align:right;">${escapeHtml(displayValue(value))}</td></tr>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1ea;padding:28px 14px;font-family:Inter,Arial,sans-serif;color:#111111;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4dac6;border-radius:24px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.08);">
      <div style="background:#050506;padding:26px 24px;border-bottom:3px solid #d4af37;">
        <p style="margin:0 0 8px;color:#d4af37;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;">New Skin ID demo booked</p>
        <h1 style="margin:0;color:#ffffff;font-size:25px;line-height:1.12;letter-spacing:-.03em;">${escapeHtml(displayValue(params.lead.store_name))}</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 10px;color:#111111;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Prospect</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${row("First name", params.lead.first_name)}${row("Last name", params.lead.last_name)}${row("Email", params.lead.email)}</table>

        <h2 style="margin:0 0 10px;color:#111111;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Company</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${row("Store", params.lead.store_name)}${row("Business type", params.lead.business_type)}${row("Platform", params.lead.platform)}${row("Catalog size", params.lead.catalog_size)}</table>

        <h2 style="margin:0 0 10px;color:#111111;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Qualification</h2>
        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">${row("Primary goal", params.lead.primary_goal)}</table>

        <div style="border:1px solid #eadfca;border-radius:18px;background:#fbf8f1;padding:18px;margin-bottom:22px;">
          <h2 style="margin:0 0 14px;color:#111111;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Meeting</h2>
          <p style="margin:0 0 12px;color:#6e6557;font-size:12px;font-weight:800;text-transform:uppercase;">Prospect time</p>
          <p style="margin:0 0 2px;color:#111111;font-size:18px;line-height:1.35;font-weight:800;">${escapeHtml(prospectStart)}-${escapeHtml(prospectEnd)}</p>
          <p style="margin:0 0 18px;color:#6e6557;font-size:13px;">${escapeHtml(params.timezone)}</p>
          <p style="margin:0 0 12px;color:#6e6557;font-size:12px;font-weight:800;text-transform:uppercase;">Nabi time</p>
          <p style="margin:0 0 2px;color:#111111;font-size:18px;line-height:1.35;font-weight:800;">${escapeHtml(nabiStart)}-${escapeHtml(nabiEnd)}</p>
          <p style="margin:0;color:#6e6557;font-size:13px;">${escapeHtml(schedulingConfig.ownerTimezone)}</p>
        </div>

        <h2 style="margin:0 0 14px;color:#111111;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">Google Meet</h2>
        <a href="${escapeHtml(params.meetUrl)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;border-radius:999px;padding:13px 18px;font-size:13px;font-weight:900;border:1px solid #d4af37;">Join Google Meet</a>
      </div>
    </div>
  </body>
</html>`;
};

const getAccessToken = async (credentials: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) => {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("create-google-booking token refresh failed", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error("Google token refresh failed");
  }

  const data = await response.json();
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("Google token response missing access token");
  }

  return data.access_token;
};

const getBusyPeriods = async (params: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}) => {
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: params.timeMin,
      timeMax: params.timeMax,
      items: [{ id: params.calendarId }],
    }),
  });

  if (!response.ok) {
    console.error("create-google-booking freebusy failed", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error("Google FreeBusy failed");
  }

  const data = await response.json();
  const busy = data.calendars?.[params.calendarId]?.busy;
  return Array.isArray(busy)
    ? busy
        .filter((period) => typeof period?.start === "string" && typeof period?.end === "string")
        .map((period) => ({ start: period.start, end: period.end }))
    : [];
};

const getExistingGoogleEvent = async (params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}) => {
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events/${encodeURIComponent(params.eventId)}`;
  const method = "GET";
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await readGoogleErrorBody(response);
    console.error("Existing Google event lookup failed", {
      status: response.status,
      googleCode: body?.error?.code,
      googleStatus: body?.error?.status,
      googleMessage: body?.error?.message,
      endpoint,
      method,
      eventId: params.eventId,
      isEventIdFormatValid: googleEventIdPattern.test(params.eventId),
    });
    throw new Error("Existing Google event lookup failed");
  }

  return await response.json();
};

const createGoogleEvent = async (params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  lead: LeadRow;
  startIso: string;
  endIso: string;
}): Promise<GoogleEventResult> => {
  const prospectName = `${params.lead.first_name} ${params.lead.last_name}`.trim();
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(params.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: params.eventId,
        summary: `Skin ID Demo - ${params.lead.store_name}`,
        description: `Name: ${prospectName}`,
        start: {
          dateTime: params.startIso,
          timeZone: "UTC",
        },
        end: {
          dateTime: params.endIso,
          timeZone: "UTC",
        },
        attendees: [
          {
            email: params.lead.email,
            displayName: prospectName,
          },
        ],
        conferenceData: {
          createRequest: {
            requestId: params.eventId,
          },
        },
      }),
    },
  );

  if (response.status === 409) {
    const event = await getExistingGoogleEvent({
      accessToken: params.accessToken,
      calendarId: params.calendarId,
      eventId: params.eventId,
    });
    if (!event) {
      throw new Error("Google event conflict lookup failed");
    }
    return { event, created: false };
  }

  if (!response.ok) {
    console.error("create-google-booking events.insert failed", {
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error("Google event creation failed");
  }

  return {
    event: await response.json(),
    created: true,
  };
};

const sendInternalBookingNotification = async (params: {
  lead: LeadRow;
  eventId: string;
  startIso: string;
  endIso: string;
  timezone: string;
  meetUrl: string;
}) => {
  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const notificationEmail = Deno.env.get("NABI_BOOKING_NOTIFICATION_EMAIL");
    const emailFrom = Deno.env.get("NABI_EMAIL_FROM");
    const missingSecrets = [
      !resendApiKey ? "RESEND_API_KEY" : null,
      !notificationEmail ? "NABI_BOOKING_NOTIFICATION_EMAIL" : null,
      !emailFrom ? "NABI_EMAIL_FROM" : null,
    ].filter(Boolean);

    if (missingSecrets.length > 0) {
      console.warn("create-google-booking internal notification skipped; missing configuration", {
        missingSecrets,
      });
      return;
    }

    const subjectStoreName = cleanText(params.lead.store_name, 140);
    const subject = subjectStoreName ? `New Skin ID demo booked — ${subjectStoreName}` : "New Skin ID demo booked";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `skin-id-booking-notification-${params.eventId}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: notificationEmail,
        subject,
        html: buildInternalBookingEmailHtml(params),
      }),
    });

    if (!response.ok) {
      let body: Record<string, unknown> | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      console.error("create-google-booking internal notification failed", {
        status: response.status,
        statusText: response.statusText,
        resendName: body?.name,
        resendMessage: body?.message,
      });
      return;
    }

    const body = await response.json().catch(() => null);
    console.log("create-google-booking internal notification sent", {
      leadId: params.lead.id,
      eventId: params.eventId,
      resendEmailId: body?.id,
    });
  } catch (error) {
    console.error("create-google-booking internal notification unexpected error", error);
  }
};

const bookingResponse = (params: {
  eventId: string;
  startTime: string;
  endTime: string;
  meetUrl: string;
}) =>
  jsonResponse({
    success: true,
    eventId: params.eventId,
    startTime: params.startTime,
    endTime: params.endTime,
    meetUrl: params.meetUrl,
    attendeeEmailSent: true,
  });

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let payload: BookingPayload;
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
      endMs - startMs !== schedulingConfig.meetingDurationMinutes * 60_000
    ) {
      return jsonResponse({ error: "Invalid booking request" }, 400);
    }

    const start = new Date(startMs);
    const end = new Date(endMs);
    const now = new Date();
    const horizon = addMinutes(now, schedulingConfig.bookingWindowDays * 24 * 60);

    if (
      start < addMinutes(now, schedulingConfig.minimumNoticeHours * 60) ||
      end > horizon ||
      !isInsideOwnerAvailability(start, end) ||
      !isInsideProspectLocalWindow(start, end, timezone)
    ) {
      return jsonResponse({ error: "Invalid booking request" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const googleCalendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    console.log("create-google-booking env", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasGoogleClientId: Boolean(googleClientId),
      hasGoogleClientSecret: Boolean(googleClientSecret),
      hasGoogleRefreshToken: Boolean(googleRefreshToken),
      hasGoogleCalendarId: Boolean(Deno.env.get("GOOGLE_CALENDAR_ID")),
    });

    if (!supabaseUrl || !serviceRoleKey || !googleClientId || !googleClientSecret || !googleRefreshToken) {
      return jsonResponse({ error: "Google booking is not configured" }, 500);
    }

    console.log("create-google-booking attempt", {
      leadId,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      timezone,
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: leadData, error: leadError } = await supabase
      .from("skin_id_leads")
      .select(
        "id,store_name,business_type,platform,catalog_size,primary_goal,first_name,last_name,email,booking_status,selected_start_time,selected_end_time,timezone,google_calendar_event_id,google_meet_url",
      )
      .eq("id", leadId)
      .single();
    const lead = leadData as LeadRow | null;

    if (leadError || !lead?.id || !lead.email) {
      console.error("create-google-booking lead lookup failed", {
        code: leadError?.code,
        message: leadError?.message,
      });
      return jsonResponse({ error: "Booking could not be created" }, 500);
    }

    if (lead.booking_status === "booked" && lead.google_calendar_event_id && lead.google_meet_url && lead.selected_start_time && lead.selected_end_time) {
      console.log("create-google-booking returning existing booked lead", {
        leadId,
        eventId: lead.google_calendar_event_id,
      });
      return bookingResponse({
        eventId: lead.google_calendar_event_id,
        startTime: lead.selected_start_time,
        endTime: lead.selected_end_time,
        meetUrl: lead.google_meet_url,
      });
    }

    const accessToken = await getAccessToken({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      refreshToken: googleRefreshToken,
    });
    const eventId = createGoogleEventId(leadId, startMs);
    if (!googleEventIdPattern.test(eventId)) {
      console.error("create-google-booking invalid deterministic event ID", {
        eventId,
        length: eventId.length,
      });
      return jsonResponse({ error: "Booking could not be created" }, 500);
    }
    const existingEvent = await getExistingGoogleEvent({
      accessToken,
      calendarId: googleCalendarId,
      eventId,
    });

    if (existingEvent) {
      const meetUrl = extractMeetUrl(existingEvent);
      if (!meetUrl) {
        return jsonResponse({ error: "Booking could not be created" }, 500);
      }

      const { error: updateError } = await supabase
        .from("skin_id_leads")
        .update({
          booking_status: "booked",
          selected_start_time: new Date(startMs).toISOString(),
          selected_end_time: new Date(endMs).toISOString(),
          timezone,
          google_calendar_event_id: eventId,
          google_meet_url: meetUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (updateError) {
        console.error("create-google-booking existing event Supabase update failed", {
          code: updateError.code,
          message: updateError.message,
        });
        return jsonResponse({ error: "Booking could not be created" }, 500);
      }

      return bookingResponse({
        eventId,
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        meetUrl,
      });
    }

    const busyPeriods = await getBusyPeriods({
      accessToken,
      calendarId: googleCalendarId,
      timeMin: new Date(startMs).toISOString(),
      timeMax: new Date(endMs).toISOString(),
    });

    if (overlapsBusyPeriod(start, end, busyPeriods)) {
      console.log("create-google-booking availability conflict", {
        leadId,
        busyPeriodCount: busyPeriods.length,
      });
      return jsonResponse({ success: false, code: "SLOT_UNAVAILABLE" });
    }

    const googleEventResult = await createGoogleEvent({
      accessToken,
      calendarId: googleCalendarId,
      eventId,
      lead,
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
    });
    const event = googleEventResult.event;
    const meetUrl = extractMeetUrl(event);

    if (!event?.id || !meetUrl) {
      console.error("create-google-booking event missing confirmation data", {
        hasEventId: Boolean(event?.id),
        hasMeetUrl: Boolean(meetUrl),
      });
      return jsonResponse({ error: "Booking could not be created" }, 500);
    }

    console.log("create-google-booking Google event created", {
      leadId,
      eventId: event.id,
    });

    const confirmedEventId = String(event.id);

    const { error: updateError } = await supabase
      .from("skin_id_leads")
      .update({
        booking_status: "booked",
        selected_start_time: new Date(startMs).toISOString(),
        selected_end_time: new Date(endMs).toISOString(),
        timezone,
        google_calendar_event_id: confirmedEventId,
        google_meet_url: meetUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (updateError) {
      console.error("create-google-booking Supabase update failed after Google event creation", {
        code: updateError.code,
        message: updateError.message,
        eventId: confirmedEventId,
      });
      return jsonResponse({ error: "Booking could not be created" }, 500);
    }

    console.log("create-google-booking Supabase update success", {
      leadId,
      eventId: confirmedEventId,
    });

    if (googleEventResult.created) {
      await sendInternalBookingNotification({
        lead,
        eventId: confirmedEventId,
        startIso: new Date(startMs).toISOString(),
        endIso: new Date(endMs).toISOString(),
        timezone,
        meetUrl,
      });
    }

    return bookingResponse({
      eventId: confirmedEventId,
      startTime: new Date(startMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      meetUrl,
    });
  } catch (error) {
    console.error("create-google-booking unexpected error", error);
    return jsonResponse({ error: "Booking could not be created" }, 500);
  }
});
