import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const tournamentPath = path.join(projectRoot, "src", "data", "tournament.ts");
const knockoutPath = path.join(projectRoot, "src", "data", "knockout.json");
const endpoint = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

const groupIds = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const teamIds = {
  mexico: "A1",
  "south africa": "A2",
  "south korea": "A3",
  czechia: "A4",
  canada: "B1",
  "bosnia and herzegovina": "B2",
  "bosnia-herzegovina": "B2",
  qatar: "B3",
  switzerland: "B4",
  brazil: "C1",
  morocco: "C2",
  haiti: "C3",
  scotland: "C4",
  "united states": "D1",
  usa: "D1",
  paraguay: "D2",
  australia: "D3",
  turkiye: "D4",
  turkey: "D4",
  germany: "E1",
  curacao: "E2",
  "ivory coast": "E3",
  "cote d'ivoire": "E3",
  ecuador: "E4",
  netherlands: "F1",
  japan: "F2",
  sweden: "F3",
  tunisia: "F4",
  belgium: "G1",
  egypt: "G2",
  iran: "G3",
  "new zealand": "G4",
  spain: "H1",
  "cape verde": "H2",
  "saudi arabia": "H3",
  uruguay: "H4",
  france: "I1",
  senegal: "I2",
  iraq: "I3",
  norway: "I4",
  argentina: "J1",
  algeria: "J2",
  austria: "J3",
  jordan: "J4",
  portugal: "K1",
  "dr congo": "K2",
  "congo dr": "K2",
  "congo democratic republic": "K2",
  uzbekistan: "K3",
  colombia: "K4",
  england: "L1",
  croatia: "L2",
  ghana: "L3",
  panama: "L4",
};

const knockoutStageMap = {
  "round-of-32": "round-of-32",
  "round-of-16": "round-of-16",
  quarterfinal: "quarterfinal",
  quarterfinals: "quarterfinal",
  semifinal: "semifinal",
  semifinals: "semifinal",
  "third-place": "third-place",
  "third-place-game": "third-place",
  final: "final",
};

const stageOrder = {
  "round-of-32": 1,
  "round-of-16": 2,
  quarterfinal: 3,
  semifinal: 4,
  "third-place": 5,
  final: 6,
};

function normalizeName(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\s+/g, " ")
    .trim();
}

function dateKey(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date).replaceAll("-", "");
}

function shortDateLabel(date, completed) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
  });
  return `${formatter.format(date)} ${completed ? "已完赛" : "待赛"}`;
}

function buildDateRange() {
  const dates = [];
  const start = new Date("2026-06-11T12:00:00-04:00");
  const today = new Date();
  const end = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    dates.push(dateKey(day));
  }

  return Array.from(new Set(dates)).sort();
}

async function fetchScoreboardEvents() {
  const results = [];
  const seen = new Set();

  for (const date of buildDateRange()) {
    const response = await fetch(`${endpoint}?dates=${date}`);
    if (!response.ok) {
      throw new Error(`ESPN scoreboard request failed for ${date}: ${response.status}`);
    }

    const payload = await response.json();
    for (const event of payload.events ?? []) {
      const key = event.id ?? `${event.date}-${event.name}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const parsed = parseScoreboardEvent(event);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

function parseScoreboardEvent(event) {
  const competition = event.competitions?.[0];
  const status = competition?.status?.type;
  const home = competition?.competitors?.find((item) => item.homeAway === "home");
  const away = competition?.competitors?.find((item) => item.homeAway === "away");
  if (!competition || !status || !home || !away) return null;

  const homeId = teamIds[normalizeName(home.team?.displayName)];
  const awayId = teamIds[normalizeName(away.team?.displayName)];
  if (!homeId || !awayId) {
    if (status.completed) console.warn(`Skipped unknown completed match: ${event.name}`);
    return null;
  }

  const slug = event.season?.slug;
  const stage = slug === "group-stage" ? "group-stage" : knockoutStageMap[slug];
  if (!stage) return null;

  const completed = Boolean(status.completed);
  const date = new Date(event.date);
  const homeScore = completed ? safeNumber(home.score) : null;
  const awayScore = completed ? safeNumber(away.score) : null;
  const homePenalty = parsePenalty(home.shootoutScore);
  const awayPenalty = parsePenalty(away.shootoutScore);
  const winnerId = inferWinner({
    completed,
    home,
    away,
    homeId,
    awayId,
    homeScore,
    awayScore,
    homePenalty,
    awayPenalty,
  });

  return {
    eventId: Number(event.id),
    stage,
    date,
    completed,
    homeId,
    awayId,
    homeScore,
    awayScore,
    homePenalty,
    awayPenalty,
    winnerId,
    kickoff: shortDateLabel(date, completed),
    note: competition.venue?.fullName ?? competition.venue?.address?.city ?? "",
    name: event.name,
  };
}

function inferWinner({ completed, home, away, homeId, awayId, homeScore, awayScore, homePenalty, awayPenalty }) {
  if (!completed) return null;
  if (home.winner) return homeId;
  if (away.winner) return awayId;
  if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
    return homeScore > awayScore ? homeId : awayId;
  }
  if (homePenalty !== null && awayPenalty !== null && homePenalty !== awayPenalty) {
    return homePenalty > awayPenalty ? homeId : awayId;
  }
  return null;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parsePenalty(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function replaceInGroupBlock(source, groupId, updater) {
  const currentIndex = groupIds.indexOf(groupId);
  const startMarker = `  ${groupId}: [`;
  const start = source.indexOf(startMarker);
  if (start === -1) return { source, changed: false };

  const nextGroup = groupIds[currentIndex + 1];
  const end = nextGroup ? source.indexOf(`  ${nextGroup}: [`, start + startMarker.length) : source.indexOf("};", start);
  if (end === -1) return { source, changed: false };

  const before = source.slice(0, start);
  const block = source.slice(start, end);
  const after = source.slice(end);
  const nextBlock = updater(block);

  return {
    source: `${before}${nextBlock}${after}`,
    changed: block !== nextBlock,
  };
}

function updateFixture(source, result) {
  if (result.stage !== "group-stage" || !result.completed) return { source, changed: false };
  if (result.homeId[0] !== result.awayId[0]) return { source, changed: false };
  if (result.homeScore === null || result.awayScore === null) return { source, changed: false };

  const groupId = result.homeId[0];
  const homeIndex = Number(result.homeId.slice(1)) - 1;
  const awayIndex = Number(result.awayId.slice(1)) - 1;
  const label = shortDateLabel(result.date, true);

  const apply = (block, firstIndex, secondIndex, firstScore, secondScore) => {
    const pattern = new RegExp(
      `(\\s*\\[${firstIndex},\\s*${secondIndex},\\s*")([^"]*)("\\s*,\\s*"[^"]+"\\s*,\\s*)(null|\\[\\d+,\\s*\\d+\\])(\\],)`,
    );
    return block.replace(pattern, `$1${label}$3[${firstScore}, ${secondScore}]$5`);
  };

  const { source: firstPass, changed } = replaceInGroupBlock(source, groupId, (block) =>
    apply(block, homeIndex, awayIndex, result.homeScore, result.awayScore),
  );
  if (changed) return { source: firstPass, changed: true };

  return replaceInGroupBlock(source, groupId, (block) =>
    apply(block, awayIndex, homeIndex, result.awayScore, result.homeScore),
  );
}

function updateNotice(source) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return source.replace(
    /export const demoNotice =\s*\n\s*"[^"]+";/,
    `export const demoNotice =\n  "静态数据已通过一键脚本更新至 ${today}：小组赛比分与淘汰赛赛程/结果已分开维护。";`,
  );
}

async function updateKnockoutRows(events) {
  const before = await readFile(knockoutPath, "utf8");
  const rows = JSON.parse(before);

  for (const event of events) {
    if (event.stage === "group-stage") continue;
    const existingIndex = rows.findIndex(
      (row) => row.stage === event.stage && samePair(row.homeId, row.awayId, event.homeId, event.awayId),
    );
    const previous = existingIndex >= 0 ? rows[existingIndex] : null;
    const next = {
      matchNo: previous?.matchNo ?? nextMatchNo(rows),
      stage: event.stage,
      homeId: event.homeId,
      awayId: event.awayId,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      homePenalty: event.homePenalty,
      awayPenalty: event.awayPenalty,
      winnerId: event.winnerId,
      kickoff: event.kickoff,
      note: event.note || previous?.note || "",
    };

    if (existingIndex >= 0) rows[existingIndex] = next;
    else rows.push(next);
  }

  rows.sort((a, b) => (stageOrder[a.stage] ?? 99) - (stageOrder[b.stage] ?? 99) || a.matchNo - b.matchNo);

  const after = `${JSON.stringify(rows, null, 2)}\n`;
  await writeFile(knockoutPath, after, "utf8");

  return before === after ? 0 : rows.length;
}

function samePair(homeId, awayId, leftId, rightId) {
  return (homeId === leftId && awayId === rightId) || (homeId === rightId && awayId === leftId);
}

function nextMatchNo(rows) {
  return Math.max(88, ...rows.map((row) => Number(row.matchNo) || 0)) + 1;
}

const events = await fetchScoreboardEvents();
let source = await readFile(tournamentPath, "utf8");
let groupUpdateCount = 0;

for (const event of events) {
  const result = updateFixture(source, event);
  if (result.changed) {
    groupUpdateCount += 1;
    source = result.source;
  }
}

source = updateNotice(source);
await writeFile(tournamentPath, source, "utf8");

const knockoutRowCount = await updateKnockoutRows(events);

console.log(`Updated ${groupUpdateCount} group-stage rows from ESPN scoreboard.`);
console.log(`Synced knockout data (${knockoutRowCount || "no"} row changes).`);
console.log("Run npm run build before publishing.");
