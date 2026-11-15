import { describe, expect, it } from "vitest";

import {
  runBookingFlow,
  type BookingRequest,
  type BotConversation,
  type BotDeps,
  type BotInput,
  type BotResult,
  type FreeSlot,
} from "./bookingFlow.ts";

// Monday 2030-01-07, 08:00 in Kyiv (UTC+2)
const NOW = new Date("2030-01-07T06:00:00Z");

const makeDeps = (overrides: Partial<BotDeps> = {}) => {
  const booked: BookingRequest[] = [];
  const deps: BotDeps = {
    businessName: "Kvitka",
    timeZone: "Europe/Kyiv",
    now: () => NOW,
    services: async () => [{ id: 1, name: "Haircut", duration_minutes: 60 }],
    specialists: async () => [
      { id: 10, name: "Olena" },
      { id: 11, name: "Iryna" },
    ],
    freeSlots: async (_service, day, salesId): Promise<FreeSlot[]> =>
      day === "2030-01-08"
        ? [
            { sales_id: 10, starts_at: "2030-01-08T08:00:00Z" },
            { sales_id: 11, starts_at: "2030-01-08T08:00:00Z" },
            { sales_id: 11, starts_at: "2030-01-08T09:00:00Z" },
          ].filter((slot) => salesId == null || slot.sales_id === salesId)
        : [],
    book: async (request) => {
      booked.push(request);
      return "booked";
    },
    findOrCreateClient: async () => 77,
    ...overrides,
  };
  return { deps, booked };
};

const conversation = (
  overrides: Partial<BotConversation> = {},
): BotConversation => ({
  language: "uk",
  hasConsent: true,
  clientId: null,
  phone: null,
  title: "Ірина",
  isWaiting: false,
  state: {},
  ...overrides,
});

/** Feeds inputs one after another, carrying the state and client like the channel does. */
const talk = async (
  inputs: BotInput[],
  deps: BotDeps,
  start: Partial<BotConversation> = {},
) => {
  let current = conversation(start);
  const results: BotResult[] = [];
  for (const input of inputs) {
    const result = await runBookingFlow(input, current, deps);
    results.push(result);
    current = {
      ...current,
      state: result.state,
      hasConsent: current.hasConsent || Boolean(result.consentGiven),
      clientId: result.clientId ?? current.clientId,
      phone: result.phone ?? current.phone,
    };
  }
  return results;
};

const buttonData = (result: BotResult) =>
  result.replies.flatMap((reply) =>
    (reply.buttons ?? []).flat().map((button) => button.data),
  );

describe("booking dialog of the bot", () => {
  it("asks for consent before anything else", async () => {
    const { deps } = makeDeps();

    const [first, second] = await talk(
      [{ kind: "start" }, { kind: "button", data: "consent" }],
      deps,
      { hasConsent: false },
    );

    expect(first.replies[0].text).toContain("Kvitka");
    expect(buttonData(first)).toEqual(["consent"]);
    expect(second.consentGiven).toBe(true);
    expect(buttonData(second)).toEqual(["book"]);
  });

  it("books a client from service to confirmation, asking the phone once", async () => {
    const { deps, booked } = makeDeps();

    const results = await talk(
      [
        { kind: "button", data: "book" },
        { kind: "button", data: "svc:1" },
        { kind: "button", data: "spc:any" },
        { kind: "button", data: "day:2030-01-08" },
        { kind: "button", data: "slot:11:1894093200" },
        { kind: "contact", phone: "+380 67 123 45 67", name: "Iryna" },
        { kind: "button", data: "confirm" },
      ],
      deps,
    );

    expect(buttonData(results[1])).toEqual(["spc:10", "spc:11", "spc:any"]);
    // Only days with free time, named in Ukrainian
    expect(results[2].replies[0].buttons?.flat()).toEqual([
      { text: "вт, 8 січня", data: "day:2030-01-08" },
    ]);
    // "Any specialist": one button per time, in the business time zone
    expect(results[3].replies[0].buttons?.flat().map((b) => b.text)).toEqual([
      "10:00",
      "11:00",
    ]);
    expect(results[4].replies[0].askPhone).toBe(true);
    expect(results[5].phone).toBe("+380671234567");
    expect(results[5].replies[0].text).toContain("Iryna");
    expect(results[6].replies[0].text).toContain("Готово");
    expect(booked).toEqual([
      {
        serviceId: 1,
        salesId: 11,
        startsAt: "2030-01-08T09:00:00.000Z",
        clientId: 77,
      },
    ]);
    expect(results[6].state).toEqual({});
  });

  it("does not ask the phone of a known client", async () => {
    const { deps } = makeDeps();

    const [result] = await talk(
      [{ kind: "button", data: "slot:10:1894089600" }],
      deps,
      { clientId: 5, state: { step: "time", serviceId: 1, salesId: 10 } },
    );

    expect(result.state.step).toBe("confirm");
    expect(buttonData(result)).toEqual(["confirm", "cancel"]);
  });

  it("offers other times when the chosen one was just taken", async () => {
    const { deps } = makeDeps({ book: async () => "taken" });

    const [result] = await talk([{ kind: "button", data: "confirm" }], deps, {
      clientId: 5,
      state: {
        step: "confirm",
        serviceId: 1,
        salesId: "any",
        day: "2030-01-08",
        slot: { sales_id: 10, starts_at: "2030-01-08T08:00:00.000Z" },
      },
    });

    expect(result.replies[0].text).toContain("щойно зайняли");
    expect(result.state.step).toBe("time");
  });

  it("passes free text to a person and says so only once", async () => {
    const { deps } = makeDeps();

    const [first] = await talk([{ kind: "text", text: "Are you open?" }], deps);
    const [second] = await talk([{ kind: "text", text: "Hello?" }], deps, {
      isWaiting: true,
    });

    expect(first.handledByBot).toBe(false);
    expect(first.replies).toHaveLength(1);
    expect(second.replies).toHaveLength(0);
  });

  it("starts again on an outdated button", async () => {
    const { deps } = makeDeps();

    const [result] = await talk([{ kind: "button", data: "confirm" }], deps);

    expect(result.replies[0].text).toContain("неактуальна");
    expect(buttonData(result)).toEqual(["svc:1"]);
  });

  it("speaks English to an English-speaking client", async () => {
    const { deps } = makeDeps();

    const [result] = await talk([{ kind: "start" }], deps, {
      language: "en",
    });

    expect(result.replies[0].buttons?.[0][0].text).toBe("Book");
  });
});
