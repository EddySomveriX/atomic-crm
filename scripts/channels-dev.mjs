#!/usr/bin/env node
/* eslint-disable no-console -- a command-line runner reports on the console */
/**
 * Local runner of the channels (stage 3), for a developer machine that
 * Telegram cannot reach with a webhook:
 *   - every few seconds, fetches new messages of the connected bots
 *     (edge function channels_poll);
 *   - every minute, sends the booking reminders that are due
 *     (edge function booking_reminders).
 * In production a webhook replaces the polling, and a scheduled job
 * (Supabase Cron) calls booking_reminders.
 *
 * Needs the local stack (make start) and the functions
 * (npx supabase functions serve). Run: node scripts/channels-dev.mjs
 */
import { execSync } from "node:child_process";

const POLL_EVERY_MS = 3_000;
const REMINDERS_EVERY_MS = 60_000;

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

console.log(
  "Channels runner: polling bots and sending reminders. Ctrl+C stops it.",
);
poll();
remind();
setInterval(remind, REMINDERS_EVERY_MS);
