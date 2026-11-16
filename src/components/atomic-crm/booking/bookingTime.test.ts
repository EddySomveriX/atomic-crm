import { describe, expect, it } from "vitest";

import {
  addDays,
  dayIn,
  isoWeekday,
  timeIn,
  zonedDateTime,
} from "./bookingTime";
import { columnsOfDay, dayRange, freeGaps, placeSpan } from "./calendarLayout";

describe("booking times in the business time zone", () => {
  it("turns a wall-clock time of the business into a moment", () => {
    // Kyiv is UTC+2 in winter and UTC+3 in summer
    expect(
      zonedDateTime("2030-01-07", "10:00", "Europe/Kyiv").toISOString(),
    ).toBe("2030-01-07T08:00:00.000Z");
    expect(
      zonedDateTime("2030-07-08", "10:00", "Europe/Kyiv").toISOString(),
    ).toBe("2030-07-08T07:00:00.000Z");
  });

  it("keeps the wall clock on the day daylight saving starts", () => {
    // Clocks jump from 03:00 to 04:00 in Kyiv on 2030-03-31
    expect(
      zonedDateTime("2030-03-31", "10:00", "Europe/Kyiv").toISOString(),
    ).toBe("2030-03-31T07:00:00.000Z");
  });

  it("reads the day and time of a moment on the business clock", () => {
    const lateEvening = new Date("2030-01-07T22:30:00Z");
    expect(dayIn(lateEvening, "Europe/Kyiv")).toBe("2030-01-08");
    expect(timeIn(lateEvening, "Europe/Kyiv")).toBe("00:30");
    expect(dayIn(lateEvening, "Europe/Warsaw")).toBe("2030-01-07");
  });

  it("walks through days and weekdays across month ends", () => {
    expect(addDays("2030-01-31", 1)).toBe("2030-02-01");
    expect(addDays("2030-03-01", -1)).toBe("2030-02-28");
    expect(isoWeekday("2030-01-07")).toBe(1);
    expect(isoWeekday("2030-01-13")).toBe(7);
  });
});

describe("calendar day view", () => {
  it("shows 08:00-20:00 and stretches to the working hours and bookings", () => {
    expect(dayRange([], [], "Europe/Kyiv")).toEqual({ start: 480, end: 1200 });
    expect(
      dayRange(
        [{ starts_at: "07:30:00", ends_at: "18:00:00" }],
        [
          {
            starts_at: "2030-01-07T19:00:00Z",
            ends_at: "2030-01-07T19:45:00Z",
          },
        ],
        "Europe/Kyiv",
      ),
    ).toEqual({ start: 420, end: 22 * 60 });
  });

  it("places a booking by its share of the day shown", () => {
    expect(placeSpan(600, 660, { start: 480, end: 1200 })).toEqual({
      top: (120 / 720) * 100,
      height: (60 / 720) * 100,
    });
    // Cut at the edges of the view
    expect(placeSpan(400, 500, { start: 480, end: 1200 }).top).toBe(0);
  });

  it("shows the specialists working or booked that day, in list order", () => {
    expect(
      columnsOfDay([1, 2, 3], [{ sales_id: 3 }], [{ sales_id: 1 }]),
    ).toEqual([1, 3]);
  });

  it("finds the free stretches of an hour or more between bookings", () => {
    expect(
      freeGaps(
        [{ start: 540, end: 1080 }],
        [
          { start: 600, end: 675 },
          { start: 690, end: 780 },
          { start: 1020, end: 1095 },
        ],
      ),
    ).toEqual([
      { start: 540, end: 600 },
      { start: 780, end: 1020 },
    ]);
  });
});
