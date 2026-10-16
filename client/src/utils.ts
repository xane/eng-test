import type { Round, RoundStatus } from "../../shared/contracts";
export const labels: Record<RoundStatus, string> = {
  scheduled: "Подготовка",
  active: "В эфире",
  finished: "Завершён",
};
export const message = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить запрос";
export function statusAt(round: Round, now: number): RoundStatus {
  return now < Date.parse(round.startsAt)
    ? "scheduled"
    : now < Date.parse(round.endsAt)
      ? "active"
      : "finished";
}
export function countdown(target: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function date(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
