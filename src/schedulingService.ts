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

export type BookingStatus = "not_started" | "selecting" | "booking" | "booked" | "failed";

export type SchedulingBookingState = {
  leadId: string | null;
  bookingStatus: BookingStatus;
  selectedDate: string | null;
  selectedStartTime: string | null;
  timezone: string | null;
  googleEventId: string | null;
  googleMeetUrl: string | null;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
};

export type AvailabilityDate = {
  date: string;
  slots: AvailabilitySlot[];
};

export type AvailabilityResponse = {
  dates: AvailabilityDate[];
};

export type CreateLeadResponse = {
  leadId: string | null;
  mode: "mock";
};

export type CreateBookingResponse = {
  success: boolean;
  eventId: string | null;
  startTime: string;
  endTime: string;
  meetUrl: string | null;
  attendeeEmailSent: boolean;
  mode: "mock";
};

export const schedulingConfig = {
  meetingDurationMinutes: 30,
  minimumNoticeHours: 12,
  bookingWindowDays: 14,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
  workingDays: [1, 2, 3, 4, 5],
  workingHours: {
    startHour: 9,
    endHour: 16,
  },
};

export const schedulingIntegration = {
  mode: "mock",
  endpoints: {
    createLead: "/create-lead",
    getAvailability: "/calendar-availability",
    createBooking: "/create-booking",
  },
} as const;

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

const createLocalDateTime = (dateKey: string, hour: number, minute: number) => {
  const [year = "0", month = "1", day = "1"] = dateKey.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute, 0, 0);
};

const createMockSlotsForDate = (dateKey: string): AvailabilitySlot[] => {
  const slots = [
    [9, 0],
    [9, 30],
    [10, 30],
    [14, 0],
    [15, 30],
  ];

  return slots.map(([hour, minute]) => {
    const start = createLocalDateTime(dateKey, hour, minute);
    const end = addMinutes(start, schedulingConfig.meetingDurationMinutes);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });
};

export const detectVisitorTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

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
    void leadData;
    await wait(320);
    return {
      leadId: null,
      mode: "mock",
    };
  },

  async getAvailableSlots(params: {
    startDate: string;
    endDate: string;
    timezone: string;
  }): Promise<AvailabilityResponse> {
    void params.endDate;
    void params.timezone;
    await wait(360);

    const start = new Date(`${params.startDate}T00:00:00`);
    const dates: AvailabilityDate[] = [];

    for (let dayOffset = 0; dayOffset < schedulingConfig.bookingWindowDays; dayOffset += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + dayOffset);

      if (!schedulingConfig.workingDays.includes(date.getDay())) {
        continue;
      }

      const dateKey = toDateKey(date);
      dates.push({
        date: dateKey,
        slots: createMockSlotsForDate(dateKey),
      });
    }

    return { dates };
  },

  async createBooking(params: {
    leadId: string | null;
    leadData: SchedulingLeadData;
    startTime: string;
    endTime: string;
    timezone: string;
  }): Promise<CreateBookingResponse> {
    void params.leadId;
    void params.leadData;
    void params.timezone;
    await wait(520);

    return {
      success: true,
      eventId: null,
      startTime: params.startTime,
      endTime: params.endTime,
      meetUrl: null,
      attendeeEmailSent: false,
      mode: "mock",
    };
  },
};
