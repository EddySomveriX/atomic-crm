# Plans and billing

The CRM sells three plans: Start, Business and Pro. Prices, member limits and
features live in the `plans` table (`supabase/schemas/32_subscriptions.sql`),
not in the code; the platform admin edits prices and limits on the Platform
page.

## How a business moves through it

1. A new business gets a 30-day trial with everything open.
2. The owner pays you (for now outside the CRM: card, invoice).
3. On the Platform page you pick the plan, the last paid day and the amount
   received. The change is stored in `subscription_events` (never deleted).
4. When the trial or the paid period ends, the business is read-only: people
   still see and export their data, but nothing new is saved until it pays.
   Incoming bot messages and bookings still arrive (they are never lost), but
   the booking page and the site chat close until the plan is paid.

The rules are enforced in the database (`guard_subscription` trigger on every
business table, `guard_member_limit` on members and invitations) and in the
edge functions (`_shared/subscription.ts`), not only in the screens.

## Becoming the platform admin

Run once in the SQL editor of the Supabase project, with your own sign-in
email:

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'you@example.com';
```

The Platform item then shows in the user menu.

## Payment contact

Set `VITE_BILLING_CONTACT` to a link where owners write about payment (for
example a Telegram link). The Plan and billing page shows a button with it;
without it, the page only explains that payment is arranged with you.

## Export

The owner downloads every table of the business as one ZIP from the Plan and
billing page: a CSV per section (`;`-separated with a byte order mark, so
Excel opens it directly) and `data.json` with the full copy. Tokens, code
hashes and short-lived login rows are left out; uploaded files are not
included.
