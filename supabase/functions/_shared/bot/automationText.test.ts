import { describe, expect, it } from "vitest";

import { automationMessage } from "./automationText.ts";
import { isStopWord } from "./botTexts.ts";

const values = { name: "Olena", business: "Studio", service: "Cut", days: 21 };

describe("automationMessage", () => {
  it("fills the standard text and ends with how to stop", () => {
    const text = automationMessage("en", {
      kind: "rebook",
      customText: null,
      link: null,
      values,
    });

    expect(text).toContain("Olena");
    expect(text).toContain("21 days");
    expect(text).toContain("“Cut”");
    expect(text.endsWith("To stop these messages, write “stop”.")).toBe(true);
  });

  it("puts the review link under the thanks", () => {
    const text = automationMessage("uk", {
      kind: "review",
      customText: null,
      link: "https://g.page/r/studio",
      values,
    });

    expect(text).toContain("\nhttps://g.page/r/studio");
  });

  it("uses the business's own text and still adds the link and the stop line", () => {
    const text = automationMessage("uk", {
      kind: "review",
      customText: "%{name}, як вам у %{business}?",
      link: "https://g.page/r/studio",
      values,
    });

    expect(
      text.startsWith("Olena, як вам у Studio?\nhttps://g.page/r/studio"),
    ).toBe(true);
    expect(text).toContain("«стоп»");
  });
});

describe("isStopWord", () => {
  it("knows stop in both languages", () => {
    expect(isStopWord("Стоп")).toBe(true);
    expect(isStopWord(" stop! ")).toBe(true);
    expect(isStopWord("/stop")).toBe(true);
  });

  it("does not stop on a sentence that only mentions it", () => {
    expect(isStopWord("стоп, а можна на завтра?")).toBe(false);
  });
});
