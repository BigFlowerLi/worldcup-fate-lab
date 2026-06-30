import type { Group, Match, Team } from "../data/tournament";
import {
  calculateAllStandings,
  calculateGroupStandings,
  calculateQualification,
  compareStandings,
  getSelectedStanding,
  isFinished,
} from "./tournament";

export type Probability = {
  qualify: number;
  topTwo: number;
  groupWinner: number;
  thirdPlace: number;
  avgPoints: number;
  avgRank: number;
};

export type SimulationResult = {
  probabilities: Map<string, Probability>;
  thirdCutLine: number;
  volatility: number;
};

export type RootingAdvice = {
  matchId: string;
  label: string;
  impact: number;
  bestOutcome: "home" | "draw" | "away";
  probability: number;
  reason: string;
};

export type FateScript = {
  title: string;
  badge: string;
  punchline: string;
  bullets: string[];
  severity: "calm" | "watch" | "chaos" | "panic";
};

export type ScenarioCard = {
  kind: "best" | "thin" | "danger";
  title: string;
  text: string;
  matchLines: string[];
  scores: Array<{
    matchId: string;
    homeScore: number;
    awayScore: number;
  }>;
  rank: number;
  points: number;
  goalDifference: number;
};

type Accumulator = {
  qualify: number;
  topTwo: number;
  groupWinner: number;
  thirdPlace: number;
  points: number;
  rank: number;
};

const SCORE_OPTIONS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
  [2, 0],
  [0, 2],
  [2, 1],
  [1, 2],
  [2, 2],
  [3, 1],
  [1, 3],
  [3, 2],
  [2, 3],
] as const;

export function simulateTournament(
  groups: Group[],
  matches: Match[],
  iterations = 700,
  chaos = 32,
): SimulationResult {
  const teams = groups.flatMap((group) => group.teams);
  const acc = new Map<string, Accumulator>(
    teams.map((team) => [
      team.id,
      { qualify: 0, topTwo: 0, groupWinner: 0, thirdPlace: 0, points: 0, rank: 0 },
    ]),
  );
  const cutLines: number[] = [];

  for (let i = 0; i < iterations; i += 1) {
    const random = createRandom(9301 + i * 7919 + chaos * 97);
    const simulated = matches.map((match) => {
      if (isFinished(match)) return match;
      const home = findTeam(teams, match.homeId);
      const away = findTeam(teams, match.awayId);
      const [homeScore, awayScore] = sampleScore(home, away, random, chaos);
      return { ...match, homeScore, awayScore };
    });
    const qualification = calculateQualification(groups, simulated);
    const standingsByGroup = calculateAllStandings(groups, simulated);
    const thirdStandings = groups.map((group) => standingsByGroup.get(group.id)![2]).sort(compareStandings);
    cutLines.push(thirdStandings[7]?.points ?? 0);

    for (const group of groups) {
      for (const standing of standingsByGroup.get(group.id)!) {
        const teamAcc = acc.get(standing.team.id)!;
        const status = qualification.find((item) => item.teamId === standing.team.id)!;
        teamAcc.qualify += status.qualifiedNow ? 1 : 0;
        teamAcc.topTwo += standing.rank <= 2 ? 1 : 0;
        teamAcc.groupWinner += standing.rank === 1 ? 1 : 0;
        teamAcc.thirdPlace += status.route === "third-place" ? 1 : 0;
        teamAcc.points += standing.points;
        teamAcc.rank += standing.rank;
      }
    }
  }

  const probabilities = new Map<string, Probability>();
  for (const [teamId, item] of acc) {
    probabilities.set(teamId, {
      qualify: toPercent(item.qualify / iterations),
      topTwo: toPercent(item.topTwo / iterations),
      groupWinner: toPercent(item.groupWinner / iterations),
      thirdPlace: toPercent(item.thirdPlace / iterations),
      avgPoints: round(item.points / iterations, 1),
      avgRank: round(item.rank / iterations, 2),
    });
  }

  return {
    probabilities,
    thirdCutLine: round(cutLines.reduce((sum, value) => sum + value, 0) / Math.max(1, cutLines.length), 1),
    volatility: Math.min(99, Math.round(chaos * 1.4 + standardDeviation(cutLines) * 12)),
  };
}

export function buildRootingAdvice(
  groups: Group[],
  matches: Match[],
  selectedTeamId: string,
  baseline: number,
  chaos: number,
): RootingAdvice[] {
  const selectedGroup = groups.find((group) => group.teams.some((team) => team.id === selectedTeamId))!;
  const teamMap = new Map(groups.flatMap((group) => group.teams).map((team) => [team.id, team]));
  const openMatches = matches
    .filter((match) => match.groupId === selectedGroup.id && !isFinished(match))
    .slice(0, 4);

  return openMatches
    .map((match) => {
      const outcomes = [
        { key: "home" as const, score: [1, 0], label: teamMap.get(match.homeId)!.shortName },
        { key: "draw" as const, score: [1, 1], label: "平局" },
        { key: "away" as const, score: [0, 1], label: teamMap.get(match.awayId)!.shortName },
      ].map((outcome) => {
        const trialMatches = matches.map((candidate) =>
          candidate.id === match.id
            ? { ...candidate, homeScore: outcome.score[0], awayScore: outcome.score[1] }
            : candidate,
        );
        const probability =
          simulateTournament(groups, trialMatches, 260, chaos).probabilities.get(selectedTeamId)?.qualify ?? 0;
        return { ...outcome, probability };
      });

      const best = outcomes.reduce((winner, outcome) =>
        outcome.probability > winner.probability ? outcome : winner,
      );
      const home = teamMap.get(match.homeId)!;
      const away = teamMap.get(match.awayId)!;
      const impact = round(best.probability - baseline, 1);
      const relation =
        match.homeId === selectedTeamId || match.awayId === selectedTeamId
          ? "这是主队自己的比赛，拿分最重要。"
          : impact >= 4
            ? "这场会明显影响出线概率。"
            : impact >= 1
              ? "这场有一定帮助，可以重点关注。"
              : "这场影响较小，可以作为参考。";

      return {
        matchId: match.id,
        label: `${home.shortName} vs ${away.shortName}`,
        impact,
        bestOutcome: best.key,
        probability: best.probability,
        reason: `建议结果：${best.label}。${relation}`,
      };
    })
    .sort((a, b) => b.impact - a.impact);
}

export function generateFateScript(
  groups: Group[],
  matches: Match[],
  team: Team,
  probability: Probability,
  thirdCutLine: number,
): FateScript {
  const standing = getSelectedStanding(groups, matches, team.id);
  const group = groups.find((item) => item.id === team.groupId)!;
  const remaining = matches.filter(
    (match) => match.groupId === team.groupId && !isFinished(match) && (match.homeId === team.id || match.awayId === team.id),
  ).length;
  const pressure = 100 - probability.qualify;
  const severity: FateScript["severity"] =
    probability.qualify >= 75 ? "calm" : probability.qualify >= 45 ? "watch" : probability.qualify >= 20 ? "chaos" : "panic";

  const titles = {
    calm: "形势较好",
    watch: "仍有变数",
    chaos: "需要关键结果配合",
    panic: "出线难度较高",
  };

  const badges = {
    calm: "较稳",
    watch: "观察",
    chaos: "困难",
    panic: "危险",
  };

  const punchlines = {
    calm: `${team.shortName} 当前晋级概率较高，后续比赛保持拿分即可。`,
    watch: `${team.shortName} 仍有主动权，但需要关注同组其他比赛结果。`,
    chaos: `${team.shortName} 需要自己拿分，同时等待其他比赛出现有利结果。`,
    panic: `${team.shortName} 出线难度较高，通常需要胜利和净胜球优势。`,
  };

  return {
    title: titles[severity],
    badge: badges[severity],
    punchline: punchlines[severity],
    severity,
    bullets: [
      `当前在 ${group.id} 组第 ${standing.rank} 名，${standing.points} 分，净胜球 ${signed(standing.gd)}。`,
      `模拟晋级率 ${probability.qualify}%；前二直接晋级 ${probability.topTwo}%；第三名晋级 ${probability.thirdPlace}%。`,
      `主队还剩 ${remaining} 场未完成的小组赛，最佳第三名平均门槛约 ${thirdCutLine} 分。`,
      `风险指数 ${Math.round(pressure)}，数值越高表示越需要其他结果配合。`,
    ],
  };
}

export function findScenarioCards(groups: Group[], matches: Match[], selectedTeamId: string): ScenarioCard[] {
  const selectedGroup = groups.find((group) => group.teams.some((team) => team.id === selectedTeamId))!;
  const groupMatches = matches.filter((match) => match.groupId === selectedGroup.id);
  const pending = groupMatches.filter((match) => !isFinished(match)).slice(0, 4);
  const teamMap = new Map(selectedGroup.teams.map((team) => [team.id, team]));

  if (pending.length === 0) {
    const standing = getSelectedStanding(groups, matches, selectedTeamId);
    return [
      {
        kind: standing.rank <= 2 ? "best" : standing.rank === 3 ? "thin" : "danger",
        title: "小组赛已结束",
        text: standing.rank <= 2 ? "当前排名可以直接晋级。" : "需要查看最佳第三名榜单才能判断是否晋级。",
        matchLines: [`${standing.team.shortName}：${standing.points} 分，净胜球 ${signed(standing.gd)}`],
        scores: [],
        rank: standing.rank,
        points: standing.points,
        goalDifference: standing.gd,
      },
    ];
  }

  const scenarios: Array<{
    matches: Match[];
    standingRank: number;
    standingPoints: number;
    gd: number;
    lines: string[];
    scores: ScenarioCard["scores"];
  }> = [];
  enumerateScores(pending.length, (scores) => {
    const trial = matches.map((match) => {
      const index = pending.findIndex((item) => item.id === match.id);
      if (index === -1) return match;
      return { ...match, homeScore: scores[index][0], awayScore: scores[index][1] };
    });
    const standing = getSelectedStanding(groups, trial, selectedTeamId);
    const lines = pending.map((match, index) => {
      const home = teamMap.get(match.homeId)!;
      const away = teamMap.get(match.awayId)!;
      return `${home.shortName} ${scores[index][0]}-${scores[index][1]} ${away.shortName}`;
    });
    scenarios.push({
      matches: trial,
      standingRank: standing.rank,
      standingPoints: standing.points,
      gd: standing.gd,
      lines,
      scores: pending.map((match, index) => ({
        matchId: match.id,
        homeScore: scores[index][0],
        awayScore: scores[index][1],
      })),
    });
  });

  const qualifies = scenarios.filter((scenario) => scenario.standingRank <= 2 || isLikelyGoodThird(scenario));
  const best = qualifies.sort(
    (a, b) => a.standingRank - b.standingRank || b.standingPoints - a.standingPoints || b.gd - a.gd,
  )[0];
  const thin = qualifies
    .filter((scenario) => scenario.standingRank === 3)
    .sort((a, b) => a.standingPoints - b.standingPoints || a.gd - b.gd)[0];
  const danger = scenarios
    .filter((scenario) => scenario.standingRank >= 3)
    .sort((a, b) => b.standingPoints - a.standingPoints || b.gd - a.gd)[0];

  const cards: ScenarioCard[] = [];
  if (best) {
    cards.push({
      kind: "best",
      title: "较好路径",
      text: best.standingRank === 1 ? "这个结果下可以小组第一晋级。" : "这个结果下可以进入小组前二。",
      matchLines: best.lines,
      scores: best.scores,
      rank: best.standingRank,
      points: best.standingPoints,
      goalDifference: best.gd,
    });
  }
  if (thin) {
    cards.push({
      kind: "thin",
      title: "边缘路径",
      text: `${thin.standingPoints} 分、净胜球 ${signed(thin.gd)}，需要和其他小组第三名比较。`,
      matchLines: thin.lines,
      scores: thin.scores,
      rank: thin.standingRank,
      points: thin.standingPoints,
      goalDifference: thin.gd,
    });
  }
  if (danger) {
    cards.push({
      kind: "danger",
      title: "危险路径",
      text: `这个结果下只有 ${danger.standingPoints} 分，出线可能性较低。`,
      matchLines: danger.lines,
      scores: danger.scores,
      rank: danger.standingRank,
      points: danger.standingPoints,
      goalDifference: danger.gd,
    });
  }

  return cards.slice(0, 3);
}

export function resetOpenMatches(matches: Match[]) {
  return matches.map((match) => (match.note === "已开局" ? match : { ...match, homeScore: null, awayScore: null }));
}

export function fillRandomUniverse(groups: Group[], matches: Match[], chaos: number) {
  const teams = groups.flatMap((group) => group.teams);
  const random = createRandom(Date.now() % 1_000_000);
  return matches.map((match) => {
    if (match.note === "已开局") return match;
    const [homeScore, awayScore] = sampleScore(findTeam(teams, match.homeId), findTeam(teams, match.awayId), random, chaos);
    return { ...match, homeScore, awayScore };
  });
}

function enumerateScores(length: number, visitor: (scores: Array<readonly [number, number]>) => void) {
  const stack: Array<readonly [number, number]> = [];
  function walk(depth: number) {
    if (depth === length) {
      visitor([...stack]);
      return;
    }
    for (const option of SCORE_OPTIONS) {
      stack.push(option);
      walk(depth + 1);
      stack.pop();
    }
  }
  walk(0);
}

function isLikelyGoodThird(scenario: { standingRank: number; standingPoints: number; gd: number }) {
  if (scenario.standingRank <= 2) return true;
  if (scenario.standingRank > 3) return false;
  return scenario.standingPoints >= 5 || (scenario.standingPoints >= 4 && scenario.gd >= 0);
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

function findTeam(teams: Team[], teamId: string) {
  const team = teams.find((candidate) => candidate.id === teamId);
  if (!team) throw new Error(`Unknown team ${teamId}`);
  return team;
}

function createRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function toPercent(value: number) {
  return round(value * 100, 1);
}

function round(value: number, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}
