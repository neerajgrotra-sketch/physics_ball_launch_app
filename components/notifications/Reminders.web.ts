import type { DailyState } from '../../game/daily';

// Web: a page can't schedule reminders, so there are none (Settings hides the section, the daily card never asks).
export const remindersSupported = false;
export const inExpoGo = false;
export async function ensurePermission(): Promise<boolean> { return false; }
export async function hasPermission(): Promise<boolean> { return false; }
export function rescheduleReminders(_state: DailyState) {}
export async function sendTestReminder(): Promise<boolean> { return false; }
export function onReminderTap(_open: (url: string) => void): () => void { return () => {}; }
