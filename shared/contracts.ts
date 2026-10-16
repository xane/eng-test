export interface User {
  id: string;
  username: string;
  role: "admin" | "survivor" | "nikita";
}
export type RoundStatus = "scheduled" | "active" | "finished";
export interface Round {
  id: string;
  createdAt: string;
  startsAt: string;
  endsAt: string;
  totalScore: number;
  status: RoundStatus;
  serverNow: string;
}
export interface RoundDetail extends Round {
  mine: { taps: number; score: number };
  winner: { id: string; username: string; score: number } | null;
}
export interface TapResult {
  taps: number;
  score: number;
  totalScore: number;
  serverNow: string;
}
