type AvailabilitySlot = {
  start: string;
  end: string;
};

type AvailabilityDate = {
  date: string;
  slots: AvailabilitySlot[];
};

type AvailabilityPayload = {
  startDate?: unknown;
  endDate?: unknown;
  prospectTimezone?: unknown;
};

type BusyPeriod = {
  start: string;
  end: string;
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

const weekdayKeys: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

const parseTimeToMinutes = (time: string) => {
  const [hour = "0", minute = "0"] = time.split(":");
  return Number(hour) * 60 + Number(minute);
};

const dateKeyToUtcNoon = (dateKey: string) => {
  const [year = "0", month = "1", day = "1"] = dateKey.split("-");
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0));
};

const shiftDateKey = (dateKey: string, dayOffset: number) => {
  const date = dateKeyToUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const createFloatingDateTime = (dateKey: string, hour: number, minute: number) => {
  const [year = "0", month = "1", day = "1"] = dateKey.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute, 0, 0);
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

const getTimezoneOffsetMs = (date: Date, timezone: string) => {
  const parts = getZonedParts(date, timezone);
  const zonedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return zonedAsUtc - date.getTime();
};

const createZonedDateTime = (dateKey: string, minutesFromMidnight: number, timezone: string) => {
  const normalizedDateKey = shiftDateKey(dateKey, Math.floor(minutesFromMidnight / 1440));
  const minuteOfDay = ((minutesFromMidnight % 1440) + 1440) % 1440;
  const [year = "0", month = "1", day = "1"] = normalizedDateKey.split("-");
  const utcGuess = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0));
  const firstPass = new Date(utcGuess.getTime() - getTimezoneOffsetMs(utcGuess, timezone));
  return new Date(utcGuess.getTime() - getTimezoneOffsetMs(firstPass, timezone));
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

const overlapsBusyPeriod = (start: Date, end: Date, busyPeriods: BusyPeriod[]) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return busyPeriods.some((busy) => {
    const busyStartMs = Date.parse(busy.start);
    const busyEndMs = Date.parse(busy.end);
    return startMs < busyEndMs && endMs > busyStartMs;
  });
};

const generateAvailability = (params: {
  startDate: string;
  endDate: string;
  prospectTimezone: string;
  busyPeriods: BusyPeriod[];
  now?: Date;
}): AvailabilityDate[] => {
  const minimumStart = addMinutes(params.now ?? new Date(), schedulingConfig.minimumNoticeHours * 60);
  const slotsByDate = new Map<string, AvailabilitySlot[]>();
  const startUtcNoon = dateKeyToUtcNoon(params.startDate);
  const endUtcNoon = dateKeyToUtcNoon(params.endDate);
  const scanDays = Math.max(1, Math.ceil((endUtcNoon.getTime() - startUtcNoon.getTime()) / 86_400_000) + 1);

  for (let dayOffset = -1; dayOffset <= scanDays + 1; dayOffset += 1) {
    const ownerDateKey = shiftDateKey(params.startDate, dayOffset);
    const ownerDay = createFloatingDateTime(ownerDateKey, 12, 0).getDay();
    const ranges = schedulingConfig.ownerAvailability[weekdayKeys[ownerDay]];

    ranges.forEach(([rangeStart, rangeEnd]) => {
      const rangeStartMinutes = parseTimeToMinutes(rangeStart);
      const rangeEndMinutes = parseTimeToMinutes(rangeEnd);

      for (
        let startMinutes = rangeStartMinutes;
        startMinutes + schedulingConfig.meetingDurationMinutes <= rangeEndMinutes;
        startMinutes += schedulingConfig.meetingDurationMinutes
      ) {
        const start = createZonedDateTime(ownerDateKey, startMinutes, schedulingConfig.ownerTimezone);
        const end = addMinutes(start, schedulingConfig.meetingDurationMinutes);

        if (
          start < minimumStart ||
          overlapsBusyPeriod(start, end, params.busyPeriods) ||
          !isInsideProspectLocalWindow(start, end, params.prospectTimezone)
        ) {
          continue;
        }

        const prospectDateKey = getZonedDateKey(start, params.prospectTimezone);
        if (prospectDateKey < params.startDate || prospectDateKey > params.endDate) {
          continue;
        }

        const slots = slotsByDate.get(prospectDateKey) ?? [];
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
        });
        slotsByDate.set(prospectDateKey, slots);
      }
    });
  }

  return [...slotsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, slots]) => ({
      date,
      slots: slots.sort((left, right) => left.start.localeCompare(right.start)),
    }));
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
    console.error("calendar-availability token refresh failed", {
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
    console.error("calendar-availability freebusy failed", {
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

const getFreeBusyRange = (startDate: string, endDate: string) => {
  const start = dateKeyToUtcNoon(startDate);
  start.setUTCDate(start.getUTCDate() - 3);
  start.setUTCHours(0, 0, 0, 0);

  const end = dateKeyToUtcNoon(endDate);
  end.setUTCDate(end.getUTCDate() + 3);
  end.setUTCHours(23, 59, 59, 999);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
};

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let payload: AvailabilityPayload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const startDate = cleanText(payload.startDate, 10);
    const endDate = cleanText(payload.endDate, 10);
    const prospectTimezone = cleanText(payload.prospectTimezone, 80);
    const startNoon = dateKeyToUtcNoon(startDate);
    const endNoon = dateKeyToUtcNoon(endDate);
    const rangeDays = Math.ceil((endNoon.getTime() - startNoon.getTime()) / 86_400_000);

    if (
      !datePattern.test(startDate) ||
      !datePattern.test(endDate) ||
      Number.isNaN(startNoon.getTime()) ||
      Number.isNaN(endNoon.getTime()) ||
      endNoon < startNoon ||
      rangeDays > schedulingConfig.bookingWindowDays + 2 ||
      !prospectTimezone ||
      !isValidTimeZone(prospectTimezone)
    ) {
      return jsonResponse({ error: "Invalid availability request" }, 400);
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const googleRefreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
    const googleCalendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    console.log("calendar-availability env", {
      hasGoogleClientId: Boolean(googleClientId),
      hasGoogleClientSecret: Boolean(googleClientSecret),
      hasGoogleRefreshToken: Boolean(googleRefreshToken),
      hasGoogleCalendarId: Boolean(Deno.env.get("GOOGLE_CALENDAR_ID")),
    });

    if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
      return jsonResponse({ error: "Calendar availability is not configured" }, 500);
    }

    const { timeMin, timeMax } = getFreeBusyRange(startDate, endDate);
    console.log("calendar-availability query", {
      startDate,
      endDate,
      prospectTimezone,
      timeMin,
      timeMax,
    });

    const accessToken = await getAccessToken({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      refreshToken: googleRefreshToken,
    });
    const busyPeriods = await getBusyPeriods({
      accessToken,
      calendarId: googleCalendarId,
      timeMin,
      timeMax,
    });
    const dates = generateAvailability({
      startDate,
      endDate,
      prospectTimezone,
      busyPeriods,
    });

    console.log("calendar-availability result", {
      busyPeriodCount: busyPeriods.length,
      availableDateCount: dates.length,
      availableSlotCount: dates.reduce((total, date) => total + date.slots.length, 0),
    });

    return jsonResponse({ dates });
  } catch (error) {
    console.error("calendar-availability unexpected error", error);
    return jsonResponse({ error: "Calendar availability could not be loaded" }, 500);
  }
});
