import { botText, formatWhen } from "./botTexts.ts";
import type {
  BotConversation,
  BotDeps,
  BotReply,
  BotResult,
  UpcomingBooking,
} from "./flowShared.ts";

/**
 * "My bookings" of the bot: the client sees the bookings ahead, confirms a
 * visit, cancels one (warned when it is a late cancellation) or starts moving
 * it. Buttons: mine, cnf:<id>, cnl:<id> (asks), cnl!:<id> (cancels),
 * rsc:<id> (moving is handled by the booking dialog).
 * Returns null for any other input.
 */
export async function handleMyBookings(
  data: string,
  conversation: BotConversation,
  deps: BotDeps,
): Promise<BotResult | null> {
  const lang = conversation.language;
  const t = (key: Parameters<typeof botText>[1], values = {}) =>
    botText(lang, key, values);
  const done = (replies: BotReply[]): BotResult => ({
    replies,
    state: {},
    handledByBot: true,
  });
  const when = (booking: UpcomingBooking) =>
    formatWhen(new Date(booking.startsAt), deps.timeZone, lang);
  const menu = (text: string): BotReply => ({
    text,
    buttons: [
      [
        { text: t("book_button"), data: "book" },
        { text: t("my_bookings_button"), data: "mine" },
      ],
    ],
  });

  const match = /^(mine|cnf|cnl|cnl!):?(\d+)?$/.exec(data);
  if (!match) return null;
  const [, action, id] = match;
  const clientId = conversation.clientId;
  if (clientId == null) {
    return done([menu(t("no_bookings"))]);
  }

  if (action === "mine") {
    const bookings = await deps.upcoming(clientId);
    if (bookings.length === 0) return done([menu(t("no_bookings"))]);
    return done([
      { text: t("my_bookings") },
      ...bookings.map((booking) => ({
        text: t("booking_line", {
          when: when(booking),
          service: booking.serviceName,
          specialist: booking.specialistName,
        }),
        buttons: [
          [
            { text: t("reschedule_button"), data: `rsc:${booking.id}` },
            { text: t("cancel_booking_button"), data: `cnl:${booking.id}` },
          ],
        ],
      })),
    ]);
  }

  const booking = (await deps.upcoming(clientId)).find(
    (item) => item.id === Number(id),
  );
  if (!booking) return done([menu(t("booking_gone"))]);

  if (action === "cnf") {
    await deps.confirm(booking.id, clientId);
    return done([{ text: t("visit_confirmed", { when: when(booking) }) }]);
  }

  if (action === "cnl") {
    const hoursLeft =
      (Date.parse(booking.startsAt) - deps.now().getTime()) / 3_600_000;
    const isLate = hoursLeft < deps.policy.freeCancelHours;
    return done([
      {
        text: isLate
          ? t("cancel_confirm_late", {
              hours: deps.policy.freeCancelHours,
              when: when(booking),
            })
          : t("cancel_confirm", { when: when(booking) }),
        buttons: [
          [
            { text: t("cancel_yes"), data: `cnl!:${booking.id}` },
            { text: t("cancel_no"), data: "mine" },
          ],
        ],
      },
    ]);
  }

  // cnl!: the client said yes
  const outcome = await deps.cancel(booking.id, clientId);
  return done([
    menu(t(outcome === "cancelled" ? "booking_cancelled" : "booking_gone")),
  ]);
}
