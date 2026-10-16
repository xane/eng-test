export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function roleFor(username: string): "admin" | "nikita" | "survivor" {
  if (username === "admin") return "admin";
  if (username === "Никита") return "nikita";
  return "survivor";
}
export function roundStatus(
  startsAt: Date,
  endsAt: Date,
  now: Date,
): "scheduled" | "active" | "finished" {
  return now < startsAt ? "scheduled" : now < endsAt ? "active" : "finished";
}
