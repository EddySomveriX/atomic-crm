import type { RaRecord } from "ra-core";

export type ReliabilityLevel = "reliable" | "regular" | "watch" | "unreliable";

/** A row of the client_reliability view: the last twelve months of a client. */
export interface ClientReliability extends RaRecord {
  visits: number;
  no_shows: number;
  late_cancels: number;
  late_reschedules: number;
  late_arrivals: number;
  reliability_override: "reliable" | "unreliable" | null;
  level: ReliabilityLevel;
}
