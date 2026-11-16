import { botText, formatDay, formatTime, formatWhen } from "./botTexts.ts";
import {
  DAYS_AHEAD,
  DAYS_SHOWN,
  TIMES_PER_ROW,
  TIMES_SHOWN,
  addDays,
  dayIn,
  firstPerTime,
  noonOf,
  parseSlot,
  rows,
  slotData,
  type BotConversation,
  type BotDeps,
  type BotInput,
  type BotReply,
  type BotResult,
  type BotState,
  type FreeSlot,
} from "./flowShared.ts";
import { handleMyBookings } from "./myBookings.ts";

export * from "./flowShared.ts";

/**
 * The booking dialog of the bot (TZ sections 5.2 and 5.3), without any
 * Telegram or database code: the channel turns an update into a BotInput,
 * the database is behind BotDeps, and the answer is a list of replies plus
 * the new state of the conversation. Buttons carry short codes:
 *   consent, book, svc:<service>, spc:<specialist|any>, day:<YYYY-MM-DD>,
 *   slot:<specialist>:<unix seconds>, confirm, cancel; moving a booking:
 *   rsc:<booking>; the other buttons of "my bookings" are in myBookings.ts
 */

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

  let rescheduleId = state.rescheduleId;
  const keep = () => (rescheduleId ? { rescheduleId } : {});
  const menu = (text: string): BotReply => ({
    text,
    buttons: [
      conversation.clientId != null
        ? [
            { text: t("book_button"), data: "book" },
            { text: t("my_bookings_button"), data: "mine" },
          ]
        : [{ text: t("book_button"), data: "book" }],
    ],
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
      { step: "day", serviceId, salesId, ...keep() },
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
      { step: "time", serviceId, salesId, day, ...keep() },
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
  if (data === "book") {
    rescheduleId = undefined;
    if (
      deps.policy.blockUnreliable &&
      conversation.clientId != null &&
      (await deps.reliability(conversation.clientId)) === "unreliable"
    ) {
      // Booked by a person: the request waits in the chat center
      return {
        replies: [{ text: t("book_via_admin") }],
        state: {},
        handledByBot: false,
      };
    }
    return askService();
  }

  const mine = await handleMyBookings(data, conversation, deps);
  if (mine) return mine;

  const move = /^rsc:(\d+)$/.exec(data);
  if (move && conversation.clientId != null) {
    const booking = (await deps.upcoming(conversation.clientId)).find(
      (item) => item.id === Number(move[1]),
    );
    if (!booking) return done([menu(t("booking_gone"))], {});
    rescheduleId = booking.id;
    return askDay(booking.serviceId, booking.salesId);
  }
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
  if (slot && state.serviceId && rescheduleId && conversation.clientId) {
    const outcome = await deps.reschedule(
      rescheduleId,
      conversation.clientId,
      slot,
    );
    if (outcome === "taken") {
      return askTime(
        state.serviceId,
        state.salesId ?? "any",
        state.day ?? dayIn(new Date(slot.starts_at), deps.timeZone),
        t("taken"),
      );
    }
    if (outcome === "not_found") return done([menu(t("booking_gone"))], {});
    return done(
      [{ text: t("booking_moved", await describe(slot, state.serviceId)) }],
      {},
    );
  }
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
