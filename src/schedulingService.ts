import {
  generateTimezoneAwareMockAvailability,
  schedulingConfig,
  type AvailabilityDate,
} from "./availabilityEngine";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

export type { AvailabilityDate } from "./availabilityEngine";
export { getZonedDateKey } from "./availabilityEngine";

export type SchedulingLeadData = {
  storeName: string;
  businessType: string;
  platform: string;
  catalogSize: string;
  primaryGoal: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type BookingStatus = "not_started" | "slot_selected" | "selecting" | "booking" | "booked" | "failed";

export type SchedulingBookingState = {
  leadId: string | null;
  bookingStatus: BookingStatus;
  selectedDate: string | null;
  selectedStartTime: string | null;
  timezone: string | null;
  googleEventId: string | null;
  googleMeetUrl: string | null;
};

export type AvailabilityResponse = {
  dates: AvailabilityDate[];
};

export type CreateLeadResponse = {
  leadId: string;
  mode: "supabase";
};

export type CreateBookingResponse = {
  success: boolean;
  eventId: string | null;
  startTime: string;
  endTime: string;
  meetUrl: string | null;
  attendeeEmailSent: boolean;
  mode: "google" | "mock";
};

export type FormattedBookingTime = {
  date: string;
  time: string;
  timeZoneName: string;
  label: string;
};

export type TimezoneOption = {
  timeZone: string;
  label: string;
  searchText: string;
};

export { schedulingConfig };

export const schedulingIntegration = {
  mode: isSupabaseConfigured ? "supabase" : "unconfigured",
  endpoints: {
    createLead: "create-lead",
    updateBookingSelection: "update-booking-selection",
    getAvailability: "calendar-availability",
    createBooking: "create-google-booking",
  },
} as const;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const availabilityCache = new Map<string, AvailabilityResponse>();

export const toUtcIsoTimestamp = (timestamp: string) => new Date(timestamp).toISOString();

export const detectVisitorTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const fallbackTimezones = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const timezoneSearchAliases: Record<string, string> = {
  "America/New_York": "nyc manhattan brooklyn united states usa",
  "America/Los_Angeles": "la california united states usa",
  "America/Chicago": "illinois united states usa",
  "America/Denver": "colorado united states usa",
  "America/Toronto": "canada ontario",
  "America/Mexico_City": "mexico cdmx",
  "America/Sao_Paulo": "sao paulo sao paolo brazil brasil",
  "Asia/Kolkata": "mumbai bombay delhi india",
  "Asia/Dubai": "uae united arab emirates",
  "Asia/Singapore": "sg",
  "Asia/Tokyo": "japan",
  "Asia/Seoul": "korea",
  "Australia/Sydney": "australia nsw",
  "Pacific/Auckland": "new zealand nz",
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getTimezoneCityLabel = (timezone: string) => {
  const city = timezone.split("/").at(-1) ?? timezone;
  return city.replace(/_/g, " ");
};

export const getTimezoneName = (timezone: string, referenceDate = new Date()) => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(referenceDate);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
  } catch {
    return timezone;
  }
};

export const formatTimezoneDisplay = (timezone: string, referenceDate = new Date()) =>
  `${getTimezoneCityLabel(timezone)} (${getTimezoneName(timezone, referenceDate)})`;

export const getSupportedTimezones = () => {
  try {
    const supportedValuesOf = Intl.supportedValuesOf?.bind(Intl);
    if (supportedValuesOf) {
      return supportedValuesOf("timeZone");
    }
  } catch {
    // Fall through to the curated fallback list.
  }
  return fallbackTimezones;
};

export const getTimezoneOptions = (referenceDate = new Date(), selectedTimezone = detectVisitorTimezone()): TimezoneOption[] => {
  const timezones = new Set([...getSupportedTimezones(), selectedTimezone]);
  return [...timezones]
    .filter(Boolean)
    .map((timeZone) => {
      const label = formatTimezoneDisplay(timeZone, referenceDate);
      return {
        timeZone,
        label,
        searchText: normalizeSearchText(`${label} ${timeZone.replace(/_/g, " ")} ${timezoneSearchAliases[timeZone] ?? ""}`),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const formatBookingTime = (utcTimestamp: string, timezone: string): FormattedBookingTime => {
  const parts = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(new Date(utcTimestamp));

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const date = `${getPart("month")} ${getPart("day")}, ${getPart("year")}`;
  const dayPeriod = getPart("dayPeriod");
  const time = `${getPart("hour")}:${getPart("minute")}${dayPeriod ? ` ${dayPeriod}` : ""}`;
  const timeZoneName = getPart("timeZoneName");

  return {
    date,
    time,
    timeZoneName,
    label: `${date} · ${time}${timeZoneName ? ` ${timeZoneName}` : ""}`,
  };
};

export const createEmptyBookingState = (): SchedulingBookingState => ({
  leadId: null,
  bookingStatus: "not_started",
  selectedDate: null,
  selectedStartTime: null,
  timezone: null,
  googleEventId: null,
  googleMeetUrl: null,
});

export const schedulingService = {
  async createLead(leadData: SchedulingLeadData): Promise<CreateLeadResponse> {
    if (!supabase) {
      throw new Error("Supabase lead capture is not configured.");
    }

    const { data, error } = await supabase.functions.invoke<{ leadId: string }>(
      schedulingIntegration.endpoints.createLead,
      {
        body: {
          ...leadData,
          timezone: detectVisitorTimezone(),
        },
      },
    );

    if (error || !data?.leadId) {
      throw new Error("Lead capture failed.");
    }

    return {
      leadId: data.leadId,
      mode: "supabase",
    };
  },

  async getAvailableSlots(params: {
    startDate: string;
    endDate: string;
    timezone: string;
  }): Promise<AvailabilityResponse> {
    const cacheKey = `${params.startDate}:${params.endDate}:${params.timezone}`;
    const cachedAvailability = availabilityCache.get(cacheKey);
    if (cachedAvailability) {
      return cachedAvailability;
    }

    if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_AVAILABILITY === "1") {
      await wait(360);

      const mockAvailability = { dates: generateTimezoneAwareMockAvailability(params) };
      availabilityCache.set(cacheKey, mockAvailability);
      return mockAvailability;
    }

    if (!supabase) {
      throw new Error("Calendar availability is not configured.");
    }

    await wait(360);

    const { data, error } = await supabase.functions.invoke<AvailabilityResponse>(
      schedulingIntegration.endpoints.getAvailability,
      {
        body: {
          startDate: params.startDate,
          endDate: params.endDate,
          prospectTimezone: params.timezone,
        },
      },
    );

    if (error || !data?.dates) {
      throw new Error("Calendar availability could not be loaded.");
    }

    availabilityCache.set(cacheKey, data);
    return data;
  },

  async createBooking(params: {
    leadId: string | null;
    leadData: SchedulingLeadData;
    startTime: string;
    endTime: string;
    timezone: string;
  }): Promise<CreateBookingResponse> {
    void params.leadData;

    if (!supabase || !params.leadId) {
      throw new Error("Google booking is not configured.");
    }

    if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_BOOKING === "1") {
      const { data, error } = await supabase.functions.invoke<{ success: boolean }>(
        schedulingIntegration.endpoints.updateBookingSelection,
        {
          body: {
            leadId: params.leadId,
            startTime: toUtcIsoTimestamp(params.startTime),
            endTime: toUtcIsoTimestamp(params.endTime),
            timezone: params.timezone,
          },
        },
      );

      if (error || !data?.success) {
        throw new Error("Booking selection update failed.");
      }

      await wait(520);

      return {
        success: true,
        eventId: null,
        startTime: toUtcIsoTimestamp(params.startTime),
        endTime: toUtcIsoTimestamp(params.endTime),
        meetUrl: null,
        attendeeEmailSent: false,
        mode: "mock",
      };
    }

    const { data, error } = await supabase.functions.invoke<
      | {
          success: true;
          eventId: string;
          startTime: string;
          endTime: string;
          meetUrl: string;
          attendeeEmailSent: boolean;
        }
      | {
          success: false;
          code?: string;
        }
    >(
      schedulingIntegration.endpoints.createBooking,
      {
        body: {
          leadId: params.leadId,
          startTime: toUtcIsoTimestamp(params.startTime),
          endTime: toUtcIsoTimestamp(params.endTime),
          timezone: params.timezone,
        },
      },
    );

    if (error || !data) {
      throw new Error("Google booking failed.");
    }

    if (!data.success) {
      throw new Error(data.code ?? "Google booking failed.");
    }

    return {
      success: true,
      eventId: data.eventId,
      startTime: data.startTime,
      endTime: data.endTime,
      meetUrl: data.meetUrl,
      attendeeEmailSent: data.attendeeEmailSent,
      mode: "google",
    };
  },
};
