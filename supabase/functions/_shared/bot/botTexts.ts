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
  price_line: "Ціна: %{price}",
  price_offer: "Ціна: %{price} замість %{list} (%{offer})",
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
  auto_rebook:
    "%{name}, вітаємо! Минуло вже %{days} днів після «%{service}» — саме час повторити. Записатися можна тут, кнопкою нижче.",
  auto_no_show:
    "%{name}, шкода, що вчора не вдалося зустрітися. Оберіть інший зручний час — кнопка нижче.",
  auto_review:
    "%{name}, дякуємо, що завітали до нас! Будемо вдячні за відгук — це займе хвилину.%{link}",
  auto_birthday:
    "%{name}, вітаємо з днем народження! Бажаємо радості й гарного настрою. Чекаємо на вас у %{business}.",
  auto_reactivation:
    "%{name}, давно вас не бачили! Будемо раді знову зустрітися — записатися можна кнопкою нижче.",
  auto_stop_hint: "Щоб не отримувати такі повідомлення, напишіть «стоп».",
  auto_stopped:
    "Добре, більше не надсилатимемо автоматичних повідомлень. Записатися чи поставити питання можна будь-коли.",
  staff_linked:
    "Готово, %{name}! Сюди приходитимуть повідомлення про ваші записи: нові, перенесені й скасовані.",
  staff_code_invalid:
    "Код не підійшов або застарів. Отримайте новий у CRM: Команда → Мій Telegram.",
  staff_new: "Новий запис\n%{service}\n%{when}\nКлієнт: %{client}",
  staff_moved: "Запис перенесено\n%{service}\nтепер %{when}\nКлієнт: %{client}",
  staff_cancelled: "Запис скасовано\n%{service}\n%{when}\nКлієнт: %{client}",
  staff_no_client: "без клієнта",
};

export type BotTextKey = keyof typeof uk;

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
  price_line: "Price: %{price}",
  price_offer: "Price: %{price} instead of %{list} (%{offer})",
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
  auto_rebook:
    "%{name}, hello! It has been %{days} days since “%{service}”: a good time to repeat it. Book with the button below.",
  auto_no_show:
    "%{name}, sorry we missed you yesterday. Pick another time that suits you with the button below.",
  auto_review:
    "%{name}, thank you for visiting us! We would be grateful for a review: it takes a minute.%{link}",
  auto_birthday:
    "%{name}, happy birthday! We wish you joy and a great mood. See you at %{business}.",
  auto_reactivation:
    "%{name}, we have not seen you for a while! We would be glad to see you again: book with the button below.",
  auto_stop_hint: "To stop these messages, write “stop”.",
  auto_stopped:
    "All right, no more automatic messages. You can book or ask a question any time.",
  staff_linked:
    "Done, %{name}! Messages about your bookings will come here: new, moved and cancelled.",
  staff_code_invalid:
    "The code did not fit or has expired. Get a new one in the CRM: Team → My Telegram.",
  staff_new: "New booking\n%{service}\n%{when}\nClient: %{client}",
  staff_moved: "Booking moved\n%{service}\nnow %{when}\nClient: %{client}",
  staff_cancelled: "Booking cancelled\n%{service}\n%{when}\nClient: %{client}",
  staff_no_client: "no client",
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

/** The code in "/start staff_ABCD2345", the deep link a member opens. */
export const staffLinkCode = (text: string): string | null =>
  /^\/start\s+staff_([A-Za-z2-9]{8})$/.exec(text.trim())?.[1] ?? null;

/** "stop" in a message: the client does not want automatic messages. */
export const isStopWord = (text: string): boolean =>
  /^\/?(стоп|stop|відписатися|unsubscribe)[.!]?$/iu.test(text.trim());

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

/** "650 ₴" for minor units of a currency, in the language of the client. */
export const formatPrice = (
  minor: number,
  currency: string,
  language: BotLanguage,
): string =>
  new Intl.NumberFormat(LOCALES[language], {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
