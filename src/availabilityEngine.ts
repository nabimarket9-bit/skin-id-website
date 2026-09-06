export type AvailabilitySlot = {
  start: string;
  end: string;
};

export type AvailabilityDate = {
  date: string;
  slots: AvailabilitySlot[];
};

type WeekdayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type TimeRange = readonly [string, string];

export const schedulingConfig = {
  ownerTimezone: "Europe/Paris",
  meetingDurationMinutes: 30,
  minimumNoticeHours: 12,
  bookingWindowDays: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
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

const weekdayKeys: WeekdayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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

export const getZonedParts = (date: Date, timezone: string) => {
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

export const getZonedDateKey = (date: Date, timezone: string) => {
  const parts = getZonedParts(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
};

export const getZonedMinuteOfDay = (date: Date, timezone: string) => {
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
  const secondPass = new Date(utcGuess.getTime() - getTimezoneOffsetMs(firstPass, timezone));
  return secondPass;
};

export const isSupportedTimezone = (timezone: string) => {
  try {
    const supportedValuesOf = Intl.supportedValuesOf?.bind(Intl);
    if (supportedValuesOf) {
      return supportedValuesOf("timeZone").includes(timezone);
    }
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimezone = (timezone: string) => (isSupportedTimezone(timezone) ? timezone : "UTC");

export const isInsideProspectLocalWindow = (start: Date, end: Date, timezone: string) => {
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

export const generateTimezoneAwareMockAvailability = (params: {
  startDate: string;
  endDate: string;
  timezone: string;
  now?: Date;
}): AvailabilityDate[] => {
  const prospectTimezone = normalizeTimezone(params.timezone);
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

        if (start < minimumStart || !isInsideProspectLocalWindow(start, end, prospectTimezone)) {
          continue;
        }

        const prospectDateKey = getZonedDateKey(start, prospectTimezone);
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
