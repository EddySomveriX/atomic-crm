import Papa from "papaparse";

import type { BusinessExport } from "./types";
import { zipFiles } from "./zip";

const encoder = new TextEncoder();
const strToU8 = (text: string): Uint8Array => encoder.encode(text);

/**
 * Excel in Ukraine and most of Europe splits columns on ";" and reads UTF-8
 * only with a byte order mark, so the tables open right with a double click.
 */
const CSV_DELIMITER = ";";
const BOM = "﻿";

const cell = (value: unknown): string | number | boolean => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
};

/** One table as CSV: a column for every field any row has. */
export const tableToCsv = (rows: Record<string, unknown>[]): string => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = Papa.unparse(
    {
      fields: columns,
      data: rows.map((row) => columns.map((column) => cell(row[column]))),
    },
    { delimiter: CSV_DELIMITER },
  );
  return BOM + body;
};

/** File name of the archive, with the day of the export. */
export const exportFileName = (day: string): string => `crm-export-${day}.zip`;

/**
 * The archive: a CSV per table that has rows (Excel) and the full copy in
 * data.json (to move to another system).
 */
export const buildExportZip = (data: BusinessExport): Uint8Array => {
  const files: Record<string, Uint8Array> = {
    "data.json": strToU8(JSON.stringify(data, null, 2)),
  };
  for (const [table, rows] of Object.entries(data)) {
    if (rows.length > 0) files[`${table}.csv`] = strToU8(tableToCsv(rows));
  }
  return zipFiles(files);
};
