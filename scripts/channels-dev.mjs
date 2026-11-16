#!/usr/bin/env node
/* eslint-disable no-console -- a command-line runner reports on the console */
/**
 * Local runner of the channels (stage 3), for a developer machine that
 * Telegram cannot reach with a webhook:
 *   - every few seconds, fetches new messages of the connected bots and
 *     tells members of their new, moved and cancelled bookings
 *     (edge functions channels_poll and staff_notify);
 *   - every minute, sends the booking reminders and the automatic messages
 *     that are due and publishes the planned posts (edge functions
 *     booking_reminders, automations_run and posts_publish);
 *   - every hour, removes documents kept in the trash over 30 days
 *     (edge function documents_purge).
 * In production a webhook replaces the polling, and a scheduled job
 * (Supabase Cron) calls booking_reminders, automations_run, posts_publish
 * and documents_purge.
 *
 * Needs the local stack (make start) and the functions
 * (npx supabase functions serve). Run: node scripts/channels-dev.mjs
 */
import { execSync } from "node:child_process";

const POLL_EVERY_MS = 3_000;
const REMINDERS_EVERY_MS = 60_000;
const PURGE_EVERY_MS = 60 * 60_000;

const readStatus = () => {
  const output = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const value = (name) =>
    new RegExp(`^${name}="?([^"\\r\\n]+)"?`, "m").exec(output)?.[1];
  const apiUrl = value("API_URL");
  const serviceKey = value("SERVICE_ROLE_KEY");
  if (!apiUrl || !serviceKey) {
    throw new Error("Local Supabase is not running: start it with make start");
  }
  return { apiUrl, serviceKey };
};

const { apiUrl, serviceKey } = readStatus();

const call = async (name) => {
  const response = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${name}: ${response.status} ${text}`);
  return JSON.parse(text);
};

const stamp = () => new Date().toLocaleTimeString();

const poll = async () => {
  try {
    const { processed, failures } = await call("channels_poll");
    if (processed || failures) {
      console.log(
        `${stamp()} messages: ${processed} processed, ${failures} failed`,
      );
    }
    const { sent, failed } = await call("staff_notify");
    if (sent || failed) {
      console.log(`${stamp()} team messages: ${sent} sent, ${failed} failed`);
    }
  } catch (error) {
    console.error(`${stamp()} ${error.message}`);
  }
  setTimeout(poll, POLL_EVERY_MS);
};

const remind = async () => {
  try {
    const { sent, no_chat: noChat, failed } = await call("booking_reminders");
    if (sent || noChat || failed) {
      console.log(
        `${stamp()} reminders: ${sent} sent, ${noChat} without a chat, ${failed} failed`,
      );
    }
  } catch (error) {
    console.error(`${stamp()} ${error.message}`);
  }
};

const automate = async () => {
  try {
    const { sent, failed } = await call("automations_run");
    if (sent || failed) {
      console.log(
        `${stamp()} automatic messages: ${sent} sent, ${failed} failed`,
      );
    }
  } catch (error) {
    console.error(`${stamp()} ${error.message}`);
  }
};

const publishPosts = async () => {
  try {
    const { published, failed, refreshed } = await call("posts_publish");
    if (published || failed || refreshed) {
      console.log(
        `${stamp()} posts: ${published} published, ${failed} failed, ${refreshed} tokens refreshed`,
      );
    }
  } catch (error) {
    console.error(`${stamp()} ${error.message}`);
  }
};

const purge = async () => {
  try {
    const { removed, orphans } = await call("documents_purge");
    if (removed || orphans) {
      console.log(
        `${stamp()} documents: ${removed} removed from the trash, ${orphans} stray files removed`,
      );
    }
  } catch (error) {
    console.error(`${stamp()} ${error.message}`);
  }
};

console.log(
  "Channels runner: polling bots and sending reminders. Ctrl+C stops it.",
);
poll();
remind();
setInterval(remind, REMINDERS_EVERY_MS);
automate();
setInterval(automate, REMINDERS_EVERY_MS);
publishPosts();
setInterval(publishPosts, REMINDERS_EVERY_MS);
purge();
setInterval(purge, PURGE_EVERY_MS);
