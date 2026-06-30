import type { Group, Match, Team } from "../data/tournament";

export type Standing = {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rank: number;
};

export type QualificationStatus = {
  teamId: string;
  groupId: string;
  rank: number;
  qualifiedNow: boolean;
  route: "top-two" | "third-place" | "outside";
  thirdRank?: number;
};

export function isFinished(match: Match) {
  return match.homeScore !== null && match.awayScore !== null;
}

export function updateMatchScore(
  matches: Match[],
  matchId: string,
  side: "home" | "away",
  delta: number,
) {
  return matches.map((match) => {
    if (match.id !== matchId) return match;
    const nextHome = match.homeScore ?? 0;
    const nextAway = match.awayScore ?? 0;
    if (side === "home") {
      return { ...match, homeScore: Math.max(0, Math.min(9, nextHome + delta)), awayScore: nextAway };
    }
    return { ...match, homeScore: nextHome, awayScore: Math.max(0, Math.min(9, nextAway + delta)) };
  });
}

export function setMatchScore(matches: Match[], matchId: string, homeScore: number | null, awayScore: number | null) {
  return matches.map((match) =>
    match.id === matchId
      ? {
          ...match,
          homeScore: homeScore === null ? null : Math.max(0, Math.min(9, homeScore)),
          awayScore: awayScore === null ? null : Math.max(0, Math.min(9, awayScore)),
        }
      : match,
  );
}

export function calculateGroupStandings(group: Group, matches: Match[]): Standing[] {
  const stats = new Map<string, Standing>();
  group.teams.forEach((team) => {
    stats.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
      rank: 0,
    });
  });

  matches
    .filter((match) => match.groupId === group.id && isFinished(match))
    .forEach((match) => {
      const home = stats.get(match.homeId)!;
      const away = stats.get(match.awayId)!;
      const homeScore = match.homeScore!;
      const awayScore = match.awayScore!;

      home.played += 1;
      away.played += 1;
      home.gf += homeScore;
      home.ga += awayScore;
      away.gf += awayScore;
      away.ga += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (homeScore < awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return [...stats.values()]
    .map((standing) => ({ ...standing, gd: standing.gf - standing.ga }))
    .sort(compareStandings)
    .map((standing, index) => ({ ...standing, rank: index + 1 }));
}

export function compareStandings(a: Standing, b: Standing) {
  return (
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.ga - b.ga ||
    b.team.rating - a.team.rating ||
    a.team.name.localeCompare(b.team.name)
  );
}

export function calculateAllStandings(groups: Group[], matches: Match[]) {
  return new Map(groups.map((group) => [group.id, calculateGroupStandings(group, matches)]));
}

export function calculateQualification(groups: Group[], matches: Match[]): QualificationStatus[] {
  const standingsByGroup = calculateAllStandings(groups, matches);
  const thirdTeams = groups
    .map((group) => standingsByGroup.get(group.id)![2])
    .sort(compareStandings)
    .map((standing, index) => ({ ...standing, thirdRank: index + 1 }));

  const thirdRankByTeam = new Map(thirdTeams.map((standing) => [standing.team.id, standing.thirdRank]));

  return groups.flatMap((group) =>
    standingsByGroup.get(group.id)!.map((standing) => {
      const thirdRank = thirdRankByTeam.get(standing.team.id);
      const qualifiesAsThird = standing.rank === 3 && thirdRank !== undefined && thirdRank <= 8;
      const qualifiedNow = standing.rank <= 2 || qualifiesAsThird;
      return {
        teamId: standing.team.id,
        groupId: group.id,
        rank: standing.rank,
        qualifiedNow,
        route: standing.rank <= 2 ? "top-two" : qualifiesAsThird ? "third-place" : "outside",
        thirdRank,
      };
    }),
  );
}

export function getThirdPlaceTable(groups: Group[], matches: Match[]) {
  const standingsByGroup = calculateAllStandings(groups, matches);
  return groups
    .map((group) => ({ groupId: group.id, standing: standingsByGroup.get(group.id)![2] }))
    .sort((a, b) => compareStandings(a.standing, b.standing))
    .map((item, index) => ({ ...item, thirdRank: index + 1, advancing: index < 8 }));
}

export function getTeamById(teams: Team[], teamId: string) {
  const team = teams.find((candidate) => candidate.id === teamId);
  if (!team) throw new Error(`Unknown team id: ${teamId}`);
  return team;
}

export function getSelectedStanding(groups: Group[], matches: Match[], teamId: string) {
  const team = groups.flatMap((group) => group.teams).find((item) => item.id === teamId);
  if (!team) throw new Error(`Unknown team id: ${teamId}`);
  return calculateGroupStandings(groups.find((group) => group.id === team.groupId)!, matches).find(
    (standing) => standing.team.id === teamId,
  )!;
}
