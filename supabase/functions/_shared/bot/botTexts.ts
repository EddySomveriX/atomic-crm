/**
 * Texts of the booking bot and the reminders, in the languages of the
 * interface (docs/PRODUCT_RULES.md: all texts through translation files).
 * The bot runs on the server, so it has its own small translation file.
 * %{name} is replaced by a value.
 */

export type BotLanguage = "uk" | "en";

const uk = {
  greeting:
    "Вітаємо! Це бот «%{business}». Тут можна записатися на послугу або поставити питання.",
  consent:
    "Щоб записати вас, ми збережемо ваше ім'я, телефон і листування з нами. Дані використовуються лише для запису та нагадувань і не передаються третім особам.",
  consent_button: "Згоден",
  menu: "Оберіть, що зробити, або просто напишіть питання.",
  book_button: "Записатися",
  choose_service: "Оберіть послугу:",
  no_services:
    "Запис онлайн поки недоступний. Напишіть нам, і адміністратор допоможе.",
  choose_specialist: "Оберіть майстра:",
  any_specialist: "Будь-який майстер",
  choose_day: "Оберіть день:",
  no_days:
    "На найближчі два тижні вільного часу немає. Напишіть нам, і адміністратор підбере час.",
  choose_time: "Вільний час %{day}:",
  no_time: "На цей день вільного часу вже немає. Оберіть інший день:",
  ask_phone:
    "Надішліть, будь ласка, свій номер телефону кнопкою нижче, щоб ми могли підтвердити запис.",
  phone_button: "Надіслати номер",
  phone_invalid:
    "Не вдалося прочитати номер. Натисніть кнопку «Надіслати номер».",
  confirm:
    "Перевірте запис:\n%{service}\n%{when}\nМайстер: %{specialist}\n\nУсе правильно?",
  confirm_button: "Підтвердити",
  cancel_button: "Скасувати",
  booked:
    "Готово, ви записані!\n%{service}\n%{when}\nМайстер: %{specialist}\n\nМи нагадаємо за день і за 2 години до візиту.",
  booked_site:
    "Готово, ви записані!\n%{service}\n%{when}\nМайстер: %{specialist}\n\nЯкщо плани зміняться, напишіть нам тут.",
  taken: "Цей час щойно зайняли. Оберіть, будь ласка, інший:",
  cancelled: "Запис не створено. Коли будете готові, натисніть «Записатися».",
  expired: "Ця кнопка вже неактуальна. Почнімо спочатку.",
  ack: "Дякуємо за повідомлення! Адміністратор відповість найближчим часом.",
  minutes: "%{count} хв",
  my_bookings_button: "Мої записи",
  my_bookings: "Ваші записи:",
  no_bookings: "У вас немає майбутніх записів.",
  booking_line: "%{when}\n%{service}, майстер %{specialist}",
  reschedule_button: "Перенести",
  cancel_booking_button: "Скасувати",
  confirm_visit_button: "Підтверджую",
  cancel_confirm: "Скасувати запис %{when}?",
  cancel_confirm_late:
    "До візиту менше %{hours} год, тому це пізня відміна. Все одно скасувати запис %{when}?",
  cancel_yes: "Так, скасувати",
  cancel_no: "Ні, залишити",
  booking_cancelled: "Запис скасовано. Будемо раді бачити вас знову!",
  booking_gone: "Цей запис уже змінено або скасовано.",
  visit_confirmed: "Дякуємо, що підтвердили! Чекаємо на вас %{when}.",
  booking_moved:
    "Готово, запис перенесено:\n%{service}\n%{when}\nМайстер: %{specialist}",
  book_via_admin:
    "Щоб записатися, напишіть, будь ласка, сюди повідомлення — адміністратор підбере для вас час.",
  reminder_24h:
    "Нагадуємо: завтра у вас запис.\n%{service}\n%{when}\nМайстер: %{specialist}\n\nЯкщо плани змінилися, напишіть нам у відповідь.",
  reminder_2h:
    "Чекаємо на вас через 2 години!\n%{service}\n%{when}\nМайстер: %{specialist}",
  reminder_now:
    "Нагадуємо про ваш запис:\n%{service}\n%{when}\nМайстер: %{specialist}",
};

type BotTextKey = keyof typeof uk;

const en: Record<BotTextKey, string> = {
  greeting:
    "Welcome! This is the bot of %{business}. You can book a service or ask a question here.",
  consent:
    "To book you, we keep your name, phone number and messages. They are used only for your bookings and reminders and are not shared with anyone else.",
  consent_button: "I agree",
  menu: "Choose what to do, or just write your question.",
  book_button: "Book",
  choose_service: "Choose a service:",
  no_services:
    "Online booking is not available yet. Write to us and we will help.",
  choose_specialist: "Choose a specialist:",
  any_specialist: "Any specialist",
  choose_day: "Choose a day:",
  no_days:
    "No free time in the next two weeks. Write to us and we will find a time.",
  choose_time: "Free times on %{day}:",
  no_time: "No free time left on this day. Choose another day:",
  ask_phone:
    "Please send your phone number with the button below so we can confirm the booking.",
  phone_button: "Send my number",
  phone_invalid: "We could not read the number. Press “Send my number”.",
  confirm:
    "Please check your booking:\n%{service}\n%{when}\nSpecialist: %{specialist}\n\nIs everything right?",
  confirm_button: "Confirm",
  cancel_button: "Cancel",
  booked:
    "Done, you are booked!\n%{service}\n%{when}\nSpecialist: %{specialist}\n\nWe will remind you a day and 2 hours before.",
  booked_site:
    "Done, you are booked!\n%{service}\n%{when}\nSpecialist: %{specialist}\n\nIf your plans change, write to us here.",
  taken: "This time was just taken. Please choose another one:",
  cancelled: "No booking was made. Press “Book” when you are ready.",
  expired: "This button is out of date. Let's start again.",
  ack: "Thank you for your message! We will answer soon.",
  minutes: "%{count} min",
  my_bookings_button: "My bookings",
  my_bookings: "Your bookings:",
  no_bookings: "You have no bookings ahead.",
  booking_line: "%{when}\n%{service}, specialist %{specialist}",
  reschedule_button: "Move",
  cancel_booking_button: "Cancel",
  confirm_visit_button: "I'll come",
  cancel_confirm: "Cancel the booking on %{when}?",
  cancel_confirm_late:
    "It is less than %{hours} h before the visit, so this is a late cancellation. Cancel the booking on %{when} anyway?",
  cancel_yes: "Yes, cancel",
  cancel_no: "No, keep it",
  booking_cancelled: "The booking is cancelled. We hope to see you again!",
  booking_gone: "This booking was already changed or cancelled.",
  visit_confirmed: "Thank you for confirming! See you on %{when}.",
  booking_moved:
    "Done, the booking is moved:\n%{service}\n%{when}\nSpecialist: %{specialist}",
  book_via_admin:
    "To book, please write a message here and our administrator will find a time for you.",
  reminder_24h:
    "Reminder: you have a booking tomorrow.\n%{service}\n%{when}\nSpecialist: %{specialist}\n\nIf your plans changed, just reply to this message.",
  reminder_2h:
    "See you in 2 hours!\n%{service}\n%{when}\nSpecialist: %{specialist}",
  reminder_now:
    "A reminder of your booking:\n%{service}\n%{when}\nSpecialist: %{specialist}",
};

const TEXTS: Record<BotLanguage, Record<BotTextKey, string>> = { uk, en };

export const botText = (
  language: BotLanguage,
  key: BotTextKey,
  values: Record<string, string | number> = {},
): string =>
  TEXTS[language][key].replace(/%\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );

/** The language of a client from Telegram's language code: uk or en. */
export const botLanguageOf = (code: string | undefined | null): BotLanguage =>
  code && /^(uk|ru)/i.test(code) ? "uk" : code ? "en" : "uk";

const LOCALES: Record<BotLanguage, string> = { uk: "uk-UA", en: "en-GB" };

/** "пн, 16 листопада" in the business time zone. */
export const formatDay = (
  date: Date,
  timeZone: string,
  language: BotLanguage,
): string =>
  new Intl.DateTimeFormat(LOCALES[language], {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);

/** "10:30" in the business time zone. */
export const formatTime = (date: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

/** "пн, 16 листопада, 10:30" */
export const formatWhen = (
  date: Date,
  timeZone: string,
  language: BotLanguage,
): string =>
  `${formatDay(date, timeZone, language)}, ${formatTime(date, timeZone)}`;
