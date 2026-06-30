import rawKnockoutMatches from "./knockout.json";

export type KnockoutStage =
  | "round-of-32"
  | "round-of-16"
  | "quarterfinal"
  | "semifinal"
  | "third-place"
  | "final";

export type KnockoutMatch = {
  matchNo: number;
  stage: KnockoutStage;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenalty: number | null;
  awayPenalty: number | null;
  winnerId: string | null;
  kickoff: string;
  note: string;
};

export function createInitialKnockoutMatches(): KnockoutMatch[] {
  return (rawKnockoutMatches as KnockoutMatch[]).map((match) => ({ ...match }));
}
