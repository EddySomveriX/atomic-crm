import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildExportZip, exportFileName, tableToCsv } from "./exportData";

const BOM = "﻿";

describe("tableToCsv", () => {
  it("writes a column for every field any row has, for Excel", () => {
    // Arrange
    const rows = [
      { id: 1, first_name: "Олена" },
      { id: 2, phone: "+380501234567" },
    ];

    // Act
    const csv = tableToCsv(rows);

    // Assert
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual([
      "id;first_name;phone",
      "1;Олена;",
      "2;;+380501234567",
    ]);
  });

  it("keeps nested values readable and quotes separators", () => {
    const csv = tableToCsv([{ tags: [1, 2], note: "a; b" }]);

    expect(csv.slice(1).split("\r\n")[1]).toBe('[1,2];"a; b"');
  });
});

describe("buildExportZip", () => {
  it("packs a table per section and the full copy into a real archive", () => {
    // Arrange
    const data = {
      contacts: [{ id: 1, first_name: "Олена" }],
      deals: [],
    };

    // Act
    const files = unzipSync(buildExportZip(data));

    // Assert
    expect(Object.keys(files).sort()).toEqual(["contacts.csv", "data.json"]);
    expect(JSON.parse(strFromU8(files["data.json"]))).toEqual(data);
    expect(strFromU8(files["contacts.csv"])).toContain("Олена");
  });
});

describe("exportFileName", () => {
  it("names the archive after the day of the export", () => {
    expect(exportFileName("2026-11-22")).toBe("crm-export-2026-11-22.zip");
  });
});
