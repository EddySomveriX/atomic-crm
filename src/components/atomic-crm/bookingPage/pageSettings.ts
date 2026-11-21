import { getCurrentBusinessId } from "../providers/supabase/authProvider";
import { getSupabaseClient } from "../providers/supabase/supabase";

/** public.booking_pages: the owner's settings of the public booking page. */
export interface BookingPageSettings {
  slug: string;
  enabled: boolean;
  about: string | null;
  address: string | null;
  phone: string | null;
  instagram: string | null;
}

/** Same rule as the database: latin letters, digits and dashes, 3–40 characters. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "iu",
  я: "ia",
  ё: "yo",
  ы: "y",
  э: "e",
  ъ: "",
};

/** "Київська студія" → "kyivska-studiia": an address suggested from the name. */
/** Letters written differently at the start of a word (KMU transliteration, 2010) */
const WORD_START: Record<string, string> = {
  є: "ye",
  ї: "yi",
  й: "y",
  ю: "yu",
  я: "ya",
};

export const slugFrom = (name: string): string => {
  const letters = [...name.toLowerCase()];
  const latin = letters
    .map((letter, index) => {
      const isWordStart = index === 0 || !/\p{L}/u.test(letters[index - 1]);
      return (
        (isWordStart ? WORD_START[letter] : undefined) ??
        LATIN[letter] ??
        letter
      );
    })
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return latin.length >= 3 ? latin : `${latin || "salon"}-crm`;
};

/** The public address of a page in this app. */
export const pageUrl = (slug: string): string =>
  `${window.location.origin}/#/book/${slug}`;

export const loadPageSettings =
  async (): Promise<BookingPageSettings | null> => {
    const { data, error } = await getSupabaseClient()
      .from("booking_pages")
      .select("slug, enabled, about, address, phone, instagram")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

/** Saves the settings; "slug_taken" when another business has the address. */
export const savePageSettings = async (
  settings: BookingPageSettings,
): Promise<void> => {
  const { error } = await getSupabaseClient()
    .from("booking_pages")
    .upsert(
      { business_id: await getCurrentBusinessId(), ...settings },
      { onConflict: "business_id" },
    );
  if (error?.code === "23505") throw new Error("slug_taken");
  if (error) throw new Error(error.message);
};
