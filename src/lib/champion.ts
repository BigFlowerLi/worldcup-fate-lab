import type { KnockoutMatch, KnockoutStage } from "../data/knockout";
import type { Group, GroupId, Match, Team } from "../data/tournament";
import { calculateAllStandings, compareStandings, isFinished, type Standing } from "./tournament";

export type KnockoutEntrant = {
  seed: string;
  team: Team;
  groupId: GroupId;
  rank: number;
};

export type ProjectedKnockoutMatch = {
  matchNo: number;
  stage: "round-of-32";
  left: KnockoutEntrant;
  right: KnockoutEntrant;
  actual?: KnockoutMatch;
  lockedWinner?: Team;
};

export type ChampionContender = {
  team: Team;
  r32: number;
  r16: number;
  quarter: number;
  semi: number;
  final: number;
  champion: number;
};

export type ChampionAnalysis = {
  contenders: ChampionContender[];
  selected: ChampionContender;
  projectedMatches: ProjectedKnockoutMatch[];
  selectedMatch?: ProjectedKnockoutMatch;
  bracketNote: string;
};

type Counter = {
  r32: number;
  r16: number;
  quarter: number;
  semi: number;
  final: number;
  champion: number;
};

type Slot =
  | {
      kind: "seed";
      seed: string;
    }
  | {
      kind: "third";
      pool: GroupId[];
    };

type R32Template = {
  matchNo: number;
  left: Slot;
  right: Slot;
};

type StageReached = keyof Counter;

type NextRound = {
  matchNo: number;
  left: number;
  right: number;
  reachedStage: StageReached;
  actualStage: KnockoutStage;
};

type SeedContext = {
  seedMap: Map<string, KnockoutEntrant>;
  entrantByTeamId: Map<string, KnockoutEntrant>;
  standingsByGroup: Map<GroupId, Standing[]>;
  thirdStandings: Standing[];
  teamMap: Map<string, Team>;
};

type ActualLookup = {
  byMatchNo: Map<number, KnockoutMatch>;
  byStagePair: Map<string, KnockoutMatch>;
  hasFullR32: boolean;
};

const groupIds: GroupId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const r32Template: R32Template[] = [
  { matchNo: 73, left: seed("2A"), right: seed("2B") },
  { matchNo: 74, left: seed("1E"), right: third(["A", "B", "C", "D", "F"]) },
  { matchNo: 75, left: seed("1F"), right: seed("2C") },
  { matchNo: 76, left: seed("1C"), right: seed("2F") },
  { matchNo: 77, left: seed("1I"), right: third(["C", "D", "F", "G", "H"]) },
  { matchNo: 78, left: seed("2E"), right: seed("2I") },
  { matchNo: 79, left: seed("1A"), right: third(["C", "E", "F", "H", "I"]) },
  { matchNo: 80, left: seed("1L"), right: third(["E", "H", "I", "J", "K"]) },
  { matchNo: 81, left: seed("1D"), right: third(["B", "E", "F", "I", "J"]) },
  { matchNo: 82, left: seed("1G"), right: third(["A", "E", "H", "I", "J"]) },
  { matchNo: 83, left: seed("2K"), right: seed("2L") },
  { matchNo: 84, left: seed("1H"), right: seed("2J") },
  { matchNo: 85, left: seed("1B"), right: third(["E", "F", "G", "I", "J"]) },
  { matchNo: 86, left: seed("1J"), right: seed("2H") },
  { matchNo: 87, left: seed("1K"), right: third(["D", "E", "I", "J", "L"]) },
  { matchNo: 88, left: seed("2D"), right: seed("2G") },
];

const nextRounds: NextRound[] = [
  { matchNo: 89, left: 73, right: 75, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 90, left: 74, right: 77, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 91, left: 76, right: 78, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 92, left: 79, right: 80, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 93, left: 83, right: 84, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 94, left: 81, right: 82, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 95, left: 86, right: 88, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 96, left: 85, right: 87, reachedStage: "quarter", actualStage: "round-of-16" },
  { matchNo: 97, left: 89, right: 90, reachedStage: "semi", actualStage: "quarterfinal" },
  { matchNo: 98, left: 93, right: 94, reachedStage: "semi", actualStage: "quarterfinal" },
  { matchNo: 99, left: 91, right: 92, reachedStage: "semi", actualStage: "quarterfinal" },
  { matchNo: 100, left: 95, right: 96, reachedStage: "semi", actualStage: "quarterfinal" },
  { matchNo: 101, left: 97, right: 98, reachedStage: "final", actualStage: "semifinal" },
  { matchNo: 102, left: 99, right: 100, reachedStage: "final", actualStage: "semifinal" },
  { matchNo: 104, left: 101, right: 102, reachedStage: "champion", actualStage: "final" },
];

export function analyzeChampionRace(
  groups: Group[],
  matches: Match[],
  knockoutMatches: KnockoutMatch[],
  selectedTeamId: string,
  iterations = 700,
  chaos = 34,
): ChampionAnalysis {
  const teams = groups.flatMap((group) => group.teams);
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const actualLookup = createActualLookup(knockoutMatches);
  const counters = new Map<string, Counter>(
    teams.map((team) => [team.id, { r32: 0, r16: 0, quarter: 0, semi: 0, final: 0, champion: 0 }]),
  );

  const projectedMatches = buildProjectedKnockout(groups, matches, knockoutMatches, actualLookup);

  for (let i = 0; i < iterations; i += 1) {
    const random = createRandom(17011 + i * 1117 + chaos * 19);
    const simulatedGroupMatches = actualLookup.hasFullR32
      ? matches
      : matches.map((match) => {
          if (isFinished(match)) return match;
          const home = teamMap.get(match.homeId)!;
          const away = teamMap.get(match.awayId)!;
          const [homeScore, awayScore] = sampleScore(home, away, random, chaos);
          return { ...match, homeScore, awayScore };
        });
    const r32 = actualLookup.hasFullR32
      ? projectedMatches
      : buildProjectedKnockout(groups, simulatedGroupMatches, knockoutMatches, actualLookup);
    const winners = new Map<number, Team>();

    r32.forEach((match) => {
      increment(counters, match.left.team.id, "r32");
      increment(counters, match.right.team.id, "r32");
      const winner = resolveKnockoutWinner(
        match.left.team,
        match.right.team,
        "round-of-32",
        match.matchNo,
        random,
        actualLookup,
      );
      increment(counters, winner.id, "r16");
      winners.set(match.matchNo, winner);
    });

    nextRounds.forEach((round) => {
      const left = winners.get(round.left);
      const right = winners.get(round.right);
      if (!left || !right) return;
      const winner = resolveKnockoutWinner(left, right, round.actualStage, round.matchNo, random, actualLookup);
      increment(counters, winner.id, round.reachedStage);
      winners.set(round.matchNo, winner);
    });
  }

  const contenders = teams
    .map((team) => {
      const item = counters.get(team.id)!;
      return {
        team,
        r32: pct(item.r32, iterations),
        r16: pct(item.r16, iterations),
        quarter: pct(item.quarter, iterations),
        semi: pct(item.semi, iterations),
        final: pct(item.final, iterations),
        champion: pct(item.champion, iterations),
      };
    })
    .sort((a, b) => b.champion - a.champion || b.final - a.final || b.r32 - a.r32);

  const selected =
    contenders.find((contender) => contender.team.id === selectedTeamId) ??
    ({ team: teams[0], r32: 0, r16: 0, quarter: 0, semi: 0, final: 0, champion: 0 } satisfies ChampionContender);

  const lockedCount = knockoutMatches.filter((match) => match.winnerId).length;

  return {
    contenders,
    selected,
    projectedMatches,
    selectedMatch: projectedMatches.find(
      (match) => match.left.team.id === selectedTeamId || match.right.team.id === selectedTeamId,
    ),
    bracketNote: actualLookup.hasFullR32
      ? `已读取真实淘汰赛对阵；${lockedCount} 场已完赛结果会锁定晋级，未赛场次继续按强度模拟。`
      : "小组赛未完全落位时，对阵树会用当前积分榜投影；真实淘汰赛结果会优先锁定。",
  };
}

function buildProjectedKnockout(
  groups: Group[],
  matches: Match[],
  knockoutMatches: KnockoutMatch[],
  actualLookup: ActualLookup,
): ProjectedKnockoutMatch[] {
  const context = buildSeedContext(groups, matches);
  const actualR32 = knockoutMatches
    .filter((match) => match.stage === "round-of-32")
    .filter((match) => context.teamMap.has(match.homeId) && context.teamMap.has(match.awayId))
    .sort((a, b) => a.matchNo - b.matchNo);

  if (actualR32.length >= 16) {
    return actualR32.map((match) => {
      const left = resolveTeamEntrant(match.homeId, context);
      const right = resolveTeamEntrant(match.awayId, context);
      return {
        matchNo: match.matchNo,
        stage: "round-of-32",
        left,
        right,
        actual: match,
        lockedWinner: getActualWinner(match, context.teamMap, left.team, right.team),
      };
    });
  }

  const usedThirdGroups = new Set<GroupId>();

  return r32Template.map((match) => {
    const left = resolveSlot(match.left, context.seedMap, context.thirdStandings, usedThirdGroups);
    const right = resolveSlot(match.right, context.seedMap, context.thirdStandings, usedThirdGroups);
    const actual = findActualMatch(actualLookup, "round-of-32", match.matchNo, left.team, right.team);
    return {
      matchNo: match.matchNo,
      stage: "round-of-32",
      left,
      right,
      actual,
      lockedWinner: actual ? getActualWinner(actual, context.teamMap, left.team, right.team) : undefined,
    };
  });
}

function buildSeedContext(groups: Group[], matches: Match[]): SeedContext {
  const standingsByGroup = calculateAllStandings(groups, matches);
  const seedMap = new Map<string, KnockoutEntrant>();
  const entrantByTeamId = new Map<string, KnockoutEntrant>();
  const teamMap = new Map(groups.flatMap((group) => group.teams).map((team) => [team.id, team]));

  groups.forEach((group) => {
    const standings = standingsByGroup.get(group.id)!;
    standings.forEach((standing) => {
      const entrant = createEntrant(standing, `${standing.rank}${group.id}`);
      entrantByTeamId.set(standing.team.id, entrant);
    });
    addSeed(seedMap, standings[0], `1${group.id}`);
    addSeed(seedMap, standings[1], `2${group.id}`);
  });

  const thirdStandings = groupIds
    .map((groupId) => standingsByGroup.get(groupId)![2])
    .sort(compareStandings)
    .slice(0, 8);

  thirdStandings.forEach((standing) => addSeed(seedMap, standing, `3${standing.team.groupId}`));

  return {
    seedMap,
    entrantByTeamId,
    standingsByGroup,
    thirdStandings,
    teamMap,
  };
}

function addSeed(seedMap: Map<string, KnockoutEntrant>, standing: Standing, seedLabel: string) {
  seedMap.set(seedLabel, createEntrant(standing, seedLabel));
}

function createEntrant(standing: Standing, seedLabel: string): KnockoutEntrant {
  return {
    seed: seedLabel,
    team: standing.team,
    groupId: standing.team.groupId,
    rank: standing.rank,
  };
}

function resolveTeamEntrant(teamId: string, context: SeedContext): KnockoutEntrant {
  const existing = context.entrantByTeamId.get(teamId);
  if (existing) return existing;
  const team = context.teamMap.get(teamId);
  if (!team) throw new Error(`Unknown knockout team id: ${teamId}`);
  return {
    seed: team.shortName,
    team,
    groupId: team.groupId,
    rank: 0,
  };
}

function resolveSlot(
  slot: Slot,
  seedMap: Map<string, KnockoutEntrant>,
  thirdStandings: Standing[],
  usedThirdGroups: Set<GroupId>,
): KnockoutEntrant {
  if (slot.kind === "seed") return seedMap.get(slot.seed)!;
  const candidate =
    thirdStandings.find((standing) => slot.pool.includes(standing.team.groupId) && !usedThirdGroups.has(standing.team.groupId)) ??
    thirdStandings.find((standing) => !usedThirdGroups.has(standing.team.groupId)) ??
    thirdStandings[0];
  usedThirdGroups.add(candidate.team.groupId);
  return seedMap.get(`3${candidate.team.groupId}`)!;
}

function resolveKnockoutWinner(
  left: Team,
  right: Team,
  stage: KnockoutStage,
  matchNo: number,
  random: () => number,
  actualLookup: ActualLookup,
) {
  const actual = findActualMatch(actualLookup, stage, matchNo, left, right);
  const lockedWinner = actual ? getActualWinner(actual, new Map([[left.id, left], [right.id, right]]), left, right) : undefined;
  return lockedWinner ?? playKnockout(left, right, random);
}

function getActualWinner(match: KnockoutMatch, teamMap: Map<string, Team>, left: Team, right: Team) {
  if (!match.winnerId) return undefined;
  if (match.winnerId !== left.id && match.winnerId !== right.id) return undefined;
  return teamMap.get(match.winnerId);
}

function createActualLookup(knockoutMatches: KnockoutMatch[]): ActualLookup {
  const byMatchNo = new Map<number, KnockoutMatch>();
  const byStagePair = new Map<string, KnockoutMatch>();
  let r32Count = 0;

  knockoutMatches.forEach((match) => {
    byMatchNo.set(match.matchNo, match);
    byStagePair.set(stagePairKey(match.stage, match.homeId, match.awayId), match);
    if (match.stage === "round-of-32") r32Count += 1;
  });

  return {
    byMatchNo,
    byStagePair,
    hasFullR32: r32Count >= 16,
  };
}

function findActualMatch(
  lookup: ActualLookup,
  stage: KnockoutStage,
  matchNo: number,
  left: Team,
  right: Team,
) {
  const byPair = lookup.byStagePair.get(stagePairKey(stage, left.id, right.id));
  if (byPair) return byPair;

  const byNo = lookup.byMatchNo.get(matchNo);
  if (byNo?.stage === stage && samePair(byNo.homeId, byNo.awayId, left.id, right.id)) return byNo;

  return undefined;
}

function samePair(homeId: string, awayId: string, leftId: string, rightId: string) {
  return (homeId === leftId && awayId === rightId) || (homeId === rightId && awayId === leftId);
}

function stagePairKey(stage: KnockoutStage, firstId: string, secondId: string) {
  return `${stage}:${pairKey(firstId, secondId)}`;
}

function pairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("|");
}

function playKnockout(left: Team, right: Team, random: () => number) {
  const probability = 1 / (1 + Math.exp((right.rating - left.rating) / 235));
  return random() <= probability ? left : right;
}

function sampleScore(home: Team, away: Team, random: () => number, chaos: number): [number, number] {
  const ratingGap = home.rating - away.rating;
  const chaosFactor = 1 + chaos / 160;
  const homeMean = clamp(1.28 * Math.exp(ratingGap / 760) * chaosFactor, 0.18, 3.7);
  const awayMean = clamp(1.05 * Math.exp(-ratingGap / 820) * chaosFactor, 0.15, 3.5);
  return [Math.min(7, poisson(homeMean, random)), Math.min(7, poisson(awayMean, random))];
}

function poisson(lambda: number, random: () => number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}

function increment(counters: Map<string, Counter>, teamId: string, stage: StageReached) {
  counters.get(teamId)![stage] += 1;
}

function pct(value: number, total: number) {
  return Math.round((value / total) * 1000) / 10;
}

function seed(seedLabel: string): Slot {
  return { kind: "seed", seed: seedLabel };
}

function third(pool: GroupId[]): Slot {
  return { kind: "third", pool };
}

function createRandom(seedValue: number) {
  let value = seedValue % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
