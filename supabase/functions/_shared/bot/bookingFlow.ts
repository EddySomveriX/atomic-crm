import {
  botText,
  formatDay,
  formatTime,
  formatWhen,
  type BotLanguage,
} from "./botTexts.ts";

/**
 * The booking dialog of the bot (TZ sections 5.2 and 5.3), without any
 * Telegram or database code: the channel turns an update into a BotInput,
 * the database is behind BotDeps, and the answer is a list of replies plus
 * the new state of the conversation. Buttons carry short codes:
 *   consent, book, svc:<service>, spc:<specialist|any>, day:<YYYY-MM-DD>,
 *   slot:<specialist>:<unix seconds>, confirm, cancel
 */

/** Days ahead the bot looks for free time */
export const DAYS_AHEAD = 14;
/** Days with free time shown as buttons */
const DAYS_SHOWN = 7;
/** Free times shown for a day */
const TIMES_SHOWN = 24;
const TIMES_PER_ROW = 4;

export interface BotService {
  id: number;
  name: string;
  duration_minutes: number;
}

export interface BotSpecialist {
  id: number;
  name: string;
}

export interface FreeSlot {
  sales_id: number;
  starts_at: string;
}

export interface BookingRequest {
  serviceId: number;
  salesId: number;
  startsAt: string;
  clientId: number;
}

export interface BotDeps {
  businessName: string;
  timeZone: string;
  now: () => Date;
  services: () => Promise<BotService[]>;
  /** Specialists who work and can do the service */
  specialists: (serviceId: number) => Promise<BotSpecialist[]>;
  freeSlots: (
    serviceId: number,
    day: string,
    salesId: number | null,
  ) => Promise<FreeSlot[]>;
  /** "taken" when the time was booked by someone else meanwhile */
  book: (request: BookingRequest) => Promise<"booked" | "taken">;
  findOrCreateClient: (name: string, phone: string) => Promise<number>;
}

export interface BotState {
  step?: "service" | "specialist" | "day" | "time" | "phone" | "confirm";
  serviceId?: number;
  salesId?: number | "any";
  day?: string;
  slot?: FreeSlot;
}

export interface BotConversation {
  language: BotLanguage;
  hasConsent: boolean;
  clientId: number | null;
  phone: string | null;
  title: string | null;
  isWaiting: boolean;
  state: BotState;
}

export type BotInput =
  | { kind: "start" }
  | { kind: "text"; text: string }
  | { kind: "button"; data: string }
  | { kind: "contact"; phone: string; name: string };

export interface BotButton {
  text: string;
  data: string;
}

export interface BotReply {
  text: string;
  buttons?: BotButton[][];
  /** Show the "send my phone number" keyboard */
  askPhone?: boolean;
}

export interface BotResult {
  replies: BotReply[];
  state: BotState;
  /** The bot answered by itself: the client does not wait for a person */
  handledByBot: boolean;
  consentGiven?: boolean;
  phone?: string;
  clientId?: number;
  bookedAt?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The calendar day of a moment in a time zone: "2030-01-07". */
export const dayIn = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
};

export const addDays = (day: string, days: number): string => {
  const [year, month, date] = day.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + days));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
};

/** Noon of a day: a safe moment to name the day in any time zone. */
const noonOf = (day: string) => new Date(`${day}T12:00:00Z`);

const rows = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  );

/** One free time per moment: the first specialist free then. */
export const firstPerTime = (slots: FreeSlot[]): FreeSlot[] => {
  const seen = new Set<string>();
  return slots.filter((slot) => {
    const key = new Date(slot.starts_at).toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const slotData = (slot: FreeSlot) =>
  `slot:${slot.sales_id}:${Math.floor(Date.parse(slot.starts_at) / 1000)}`;

const parseSlot = (data: string): FreeSlot | null => {
  const match = /^slot:(\d+):(\d+)$/.exec(data);
  return match
    ? {
        sales_id: Number(match[1]),
        starts_at: new Date(Number(match[2]) * 1000).toISOString(),
      }
    : null;
};

/**
 * Answers one input of the client. Never throws for a wrong or outdated
 * button: it starts the dialog again instead.
 */
export async function runBookingFlow(
  input: BotInput,
  conversation: BotConversation,
  deps: BotDeps,
): Promise<BotResult> {
  const lang = conversation.language;
  const t = (key: Parameters<typeof botText>[1], values = {}) =>
    botText(lang, key, values);
  const state = conversation.state;

  const menu = (text: string): BotReply => ({
    text,
    buttons: [[{ text: t("book_button"), data: "book" }]],
  });
  const done = (
    replies: BotReply[],
    next: BotState,
    extra: Partial<BotResult> = {},
  ): BotResult => ({ replies, state: next, handledByBot: true, ...extra });

  const askConsent = (): BotResult =>
    done(
      [
        {
          text: `${t("greeting", { business: deps.businessName })}\n\n${t("consent")}`,
          buttons: [[{ text: t("consent_button"), data: "consent" }]],
        },
      ],
      {},
    );

  const askService = async (): Promise<BotResult> => {
    const services = await deps.services();
    if (services.length === 0) return done([menu(t("no_services"))], {});
    return done(
      [
        {
          text: t("choose_service"),
          buttons: services.map((service) => [
            {
              text: `${service.name} · ${t("minutes", { count: service.duration_minutes })}`,
              data: `svc:${service.id}`,
            },
          ]),
        },
      ],
      { step: "service" },
    );
  };

  const askDay = async (
    serviceId: number,
    salesId: number | "any",
  ): Promise<BotResult> => {
    const today = dayIn(deps.now(), deps.timeZone);
    const days: string[] = [];
    for (
      let offset = 0;
      offset < DAYS_AHEAD && days.length < DAYS_SHOWN;
      offset++
    ) {
      const day = addDays(today, offset);
      const slots = await deps.freeSlots(
        serviceId,
        day,
        salesId === "any" ? null : salesId,
      );
      if (slots.length > 0) days.push(day);
    }
    if (days.length === 0) return done([menu(t("no_days"))], {});
    return done(
      [
        {
          text: t("choose_day"),
          buttons: rows(
            days.map((day) => ({
              text: formatDay(noonOf(day), "UTC", lang),
              data: `day:${day}`,
            })),
            2,
          ),
        },
      ],
      { step: "day", serviceId, salesId },
    );
  };

  const askSpecialist = async (serviceId: number): Promise<BotResult> => {
    const specialists = await deps.specialists(serviceId);
    if (specialists.length <= 1) {
      return askDay(serviceId, specialists[0]?.id ?? "any");
    }
    return done(
      [
        {
          text: t("choose_specialist"),
          buttons: [
            ...specialists.map((specialist) => [
              { text: specialist.name, data: `spc:${specialist.id}` },
            ]),
            [{ text: t("any_specialist"), data: "spc:any" }],
          ],
        },
      ],
      { step: "specialist", serviceId },
    );
  };

  const askTime = async (
    serviceId: number,
    salesId: number | "any",
    day: string,
    intro?: string,
  ): Promise<BotResult> => {
    const slots = firstPerTime(
      await deps.freeSlots(serviceId, day, salesId === "any" ? null : salesId),
    ).slice(0, TIMES_SHOWN);
    if (slots.length === 0) {
      const days = await askDay(serviceId, salesId);
      return { ...days, replies: [{ text: t("no_time") }, ...days.replies] };
    }
    return done(
      [
        {
          text:
            intro ??
            t("choose_time", { day: formatDay(noonOf(day), "UTC", lang) }),
          buttons: rows(
            slots.map((slot) => ({
              text: formatTime(new Date(slot.starts_at), deps.timeZone),
              data: slotData(slot),
            })),
            TIMES_PER_ROW,
          ),
        },
      ],
      { step: "time", serviceId, salesId, day },
    );
  };

  const describe = async (slot: FreeSlot, serviceId: number) => {
    const [services, specialists] = await Promise.all([
      deps.services(),
      deps.specialists(serviceId),
    ]);
    return {
      service: services.find((item) => item.id === serviceId)?.name ?? "",
      specialist:
        specialists.find((item) => item.id === slot.sales_id)?.name ?? "",
      when: formatWhen(new Date(slot.starts_at), deps.timeZone, lang),
    };
  };

  const askConfirm = async (
    next: BotState,
    extra: Partial<BotResult> = {},
  ): Promise<BotResult> =>
    done(
      [
        {
          text: t("confirm", await describe(next.slot!, next.serviceId!)),
          buttons: [
            [
              { text: t("confirm_button"), data: "confirm" },
              { text: t("cancel_button"), data: "cancel" },
            ],
          ],
        },
      ],
      { ...next, step: "confirm" },
      extra,
    );

  const restart = async (): Promise<BotResult> => {
    const again = await askService();
    return { ...again, replies: [{ text: t("expired") }, ...again.replies] };
  };

  // Consent comes first (TZ section 10): nothing is booked without it
  if (!conversation.hasConsent) {
    if (input.kind === "button" && input.data === "consent") {
      return done([menu(t("menu"))], {}, { consentGiven: true });
    }
    return askConsent();
  }

  if (input.kind === "start") return done([menu(t("menu"))], {});

  if (input.kind === "contact") {
    if (state.step !== "phone" || !state.slot || !state.serviceId) {
      return done([menu(t("menu"))], {});
    }
    const digits = input.phone.replace(/\D/g, "");
    if (digits.length < 7) {
      return done([{ text: t("phone_invalid"), askPhone: true }], state);
    }
    const phone = `+${digits}`;
    const clientId = await deps.findOrCreateClient(
      conversation.title ?? input.name,
      phone,
    );
    return askConfirm(state, { phone, clientId });
  }

  if (input.kind === "text") {
    // Free text goes to a person; the bot only says it was received, once
    return {
      replies: conversation.isWaiting ? [] : [menu(t("ack"))],
      state,
      handledByBot: false,
    };
  }

  const data = input.data;
  if (data === "consent") return done([menu(t("menu"))], {});
  if (data === "book") return askService();
  if (data === "cancel") return done([menu(t("cancelled"))], {});

  const service = /^svc:(\d+)$/.exec(data);
  if (service) {
    const serviceId = Number(service[1]);
    const services = await deps.services();
    if (!services.some((item) => item.id === serviceId)) return restart();
    return askSpecialist(serviceId);
  }

  const specialist = /^spc:(\d+|any)$/.exec(data);
  if (specialist && state.serviceId) {
    return askDay(
      state.serviceId,
      specialist[1] === "any" ? "any" : Number(specialist[1]),
    );
  }

  const day = /^day:(\d{4}-\d{2}-\d{2})$/.exec(data);
  if (day && state.serviceId && state.salesId) {
    return askTime(state.serviceId, state.salesId, day[1]);
  }

  const slot = parseSlot(data);
  if (slot && state.serviceId) {
    const next: BotState = { ...state, slot };
    if (conversation.clientId == null && !conversation.phone) {
      return done([{ text: t("ask_phone"), askPhone: true }], {
        ...next,
        step: "phone",
      });
    }
    const clientId =
      conversation.clientId ??
      (await deps.findOrCreateClient(
        conversation.title ?? "",
        conversation.phone!,
      ));
    return askConfirm(next, { clientId });
  }

  if (
    data === "confirm" &&
    state.step === "confirm" &&
    state.slot &&
    state.serviceId
  ) {
    const clientId =
      conversation.clientId ??
      (conversation.phone
        ? await deps.findOrCreateClient(
            conversation.title ?? "",
            conversation.phone,
          )
        : null);
    if (clientId == null) {
      return done([{ text: t("ask_phone"), askPhone: true }], {
        ...state,
        step: "phone",
      });
    }
    const outcome = await deps.book({
      serviceId: state.serviceId,
      salesId: state.slot.sales_id,
      startsAt: state.slot.starts_at,
      clientId,
    });
    if (outcome === "taken") {
      const day =
        state.day ?? dayIn(new Date(state.slot.starts_at), deps.timeZone);
      return askTime(state.serviceId, state.salesId ?? "any", day, t("taken"));
    }
    return done(
      [{ text: t("booked", await describe(state.slot, state.serviceId)) }],
      {},
      { clientId, bookedAt: state.slot.starts_at },
    );
  }

  return restart();
}
