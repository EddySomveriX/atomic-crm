import { describe, expect, it } from "vitest";

import {
  documentMimeType,
  fileProblem,
  formatFileSize,
  safeFileName,
  sha256Hex,
  titleFromFileName,
} from "./documentFiles";

describe("documentMimeType", () => {
  it("takes the type the browser gives", () => {
    expect(documentMimeType({ name: "a.pdf", type: "application/pdf" })).toBe(
      "application/pdf",
    );
  });

  it("knows a HEIC photo by its extension when the browser does not", () => {
    expect(documentMimeType({ name: "IMG_0001.HEIC", type: "" })).toBe(
      "image/heic",
    );
  });

  it("refuses files that are not documents", () => {
    expect(documentMimeType({ name: "run.exe", type: "" })).toBeNull();
    expect(
      documentMimeType({ name: "page.html", type: "text/html" }),
    ).toBeNull();
  });
});

describe("fileProblem", () => {
  it("accepts a PDF up to 20 MB", () => {
    expect(
      fileProblem({ name: "a.pdf", type: "application/pdf", size: 1000 }),
    ).toBeNull();
  });

  it("names why a file cannot be stored", () => {
    expect(
      fileProblem({
        name: "a.pdf",
        type: "application/pdf",
        size: 21 * 1024 * 1024,
      }),
    ).toBe("size");
    expect(
      fileProblem({ name: "a.pdf", type: "application/pdf", size: 0 }),
    ).toBe("empty");
    expect(fileProblem({ name: "a.zip", type: "", size: 10 })).toBe("type");
  });
});

describe("safeFileName", () => {
  it("keeps a storage path free of folders and spaces", () => {
    expect(safeFileName("../Invoice 5 (copy).PDF")).toBe("Invoice-5-copy.pdf");
    expect(safeFileName("Договір № 5.pdf")).toBe("No-5.pdf");
    expect(safeFileName("a/b\\c.png")).not.toMatch(/[/\\]/);
  });

  it("falls back to a name when nothing is left", () => {
    expect(safeFileName("???.pdf")).toBe("document.pdf");
  });
});

describe("titleFromFileName", () => {
  it("drops the extension and underscores", () => {
    expect(titleFromFileName("invoice_12_march.pdf")).toBe("invoice 12 march");
  });
});

describe("sha256Hex", () => {
  it("gives the SHA-256 of the file as hex", async () => {
    expect(await sha256Hex(new Blob(["abc"]))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("formatFileSize", () => {
  it("shows the size in the units a person reads", () => {
    expect(formatFileSize(2.5 * 1024 * 1024, "en")).toBe("2.5 MB");
    expect(formatFileSize(500, "uk")).toBe("500 Б");
  });
});
