import { useStore } from "ra-core";

/** Where the calm mode is kept: on this device, for this person. */
export const CALM_MODE_STORE_KEY = "calm_mode";

/** Calm mode: no game parts (levels, animations), only the facts. */
export const useCalmMode = () => useStore<boolean>(CALM_MODE_STORE_KEY, false);
