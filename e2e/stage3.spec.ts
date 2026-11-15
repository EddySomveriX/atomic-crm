import { expect, test, type Page } from "@playwright/test";

/**
 * Stage 3 acceptance (TZ section 11): "a client booked through the bot, the
 * booking is in the calendar, the reminder arrived".
 *
 * Telegram cannot be driven from a test, so the booking dialog of the bot is
 * covered by supabase/functions/_shared/bot/bookingFlow.test.ts and the
 * reminders by supabase/tests/database/channels.test.sql. This scenario runs
 * the same booking path end to end through the website widget, which uses
 * the same server code (free slots, client by phone, booking, chat center):
 * an owner sets up a service and working hours, a visitor books on the test
 * website and asks a question, the booking is in the calendar and the
 * question waits in the chat center, and the answer reaches the website.
 *
 * Needs make start and npx supabase functions serve:
 *   PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test e2e/stage3.spec.ts --project=chromium
 */

test.use({ locale: "uk-UA", timezoneId: "Europe/Kyiv" });
test.describe.configure({ mode: "serial" });

const run = Date.now();
const owner = { email: `stage3-${run}@test.local`, password: "Stage3-Ua!" };
const service = `Манікюр ${run}`;

const signUpWithBusiness = async (page: Page) => {
  await page.goto("/#/sign-up");
  await page.getByLabel(/^Ім.я$/).fill("Олена");
  await page.getByLabel("Прізвище").fill("Майстер");
  await page.getByLabel("Ел. пошта").fill(owner.email);
  await page.getByLabel("Пароль").fill(owner.password);
  await page.getByRole("button", { name: "Створити акаунт" }).click();
  await page.waitForURL(/#\/(setup)?$/);
  if (!page.url().includes("/setup")) await page.goto("/#/setup");

  await page.getByLabel("Назва бізнесу").fill(`Студія ${run}`);
  await page.getByRole("radio", { name: /Україна/ }).click();
  await page.getByRole("radio", { name: /^Послуги/ }).click();
  await page.getByLabel("Код ЄДРПОУ").fill("14360570");
  await page.getByRole("button", { name: "Створити бізнес" }).click();
  await expect(page.getByRole("link", { name: "Чати" })).toBeVisible();
};

test("a visitor books on the website and the booking is in the calendar", async ({
  page,
}) => {
  await signUpWithBusiness(page);

  // A bookable service and the working week of the owner
  await page.goto("/#/products/create");
  await page.getByText("Послуга", { exact: true }).click();
  await page.getByLabel("Назва").fill(service);
  await page.getByLabel("Тривалість, хв").fill("45");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await page.waitForURL(/#\/products\/\d+\/show/);

  await page.goto("/#/working-hours");
  await page.getByRole("button", { name: "Пн–Пт, 9:00–18:00" }).click();
  await expect(page.getByText("09:00–18:00")).toHaveCount(5);

  // The website widget
  await page.goto("/#/business");
  await page.getByRole("button", { name: "Увімкнути віджет" }).click();
  const demo = await page
    .getByRole("link", { name: "Відкрити тестову сторінку з віджетом" })
    .getAttribute("href");

  const site = await page.context().newPage();
  await site.goto(demo!);
  await site.getByRole("button", { name: "Написати / Записатися" }).click();
  await site.getByRole("button", { name: new RegExp(service) }).click();
  // The first day with free time, then its first free time
  await site.locator(".choices").nth(1).getByRole("button").first().click();
  await site.locator(".choices").nth(2).getByRole("button").first().click();
  await site.getByLabel("Ваше ім'я").fill("Марія Коваль");
  await site.getByLabel("Телефон").fill(`+38050${String(run).slice(-7)}`);
  await site.getByText(/Погоджуюся/).click();
  await site.getByRole("button", { name: "Записатися", exact: true }).click();
  await expect(site.getByText("Готово, ви записані!")).toBeVisible();

  await site.getByRole("tab", { name: "Написати" }).click();
  await site.getByLabel("Повідомлення").fill("Чи можна з дитиною?");
  await site.getByRole("button", { name: "Надіслати" }).click();

  // The booking is in the calendar, with its client
  await page.goto("/#/");
  await expect(page.getByText("Марія Коваль").first()).toBeVisible();
  await page.goto("/#/calendar");
  for (let day = 0; day < 14; day++) {
    if (await page.getByText(service).count()) break;
    await page.getByRole("button", { name: "Наступний день" }).click();
  }
  await expect(page.getByText(service)).toBeVisible();

  // The question waits in the chat center; the answer reaches the website
  await page.goto("/#/chats");
  await page.getByRole("tab", { name: "Чекають відповіді" }).click();
  await page.getByRole("button", { name: /Марія Коваль/ }).click();
  await expect(page.getByText("Чи можна з дитиною?")).toBeVisible();
  await page
    .getByPlaceholder(/Відповідь клієнту/)
    .fill("Так, у нас є дитячий куточок.");
  await page.getByRole("button", { name: "Надіслати" }).click();
  await expect(site.getByText("Так, у нас є дитячий куточок.")).toBeVisible({
    timeout: 15_000,
  });
});
