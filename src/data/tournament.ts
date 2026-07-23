export type GroupId =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L";

export type Team = {
  id: string;
  groupId: GroupId;
  name: string;
  shortName: string;
  rating: number;
  colors: [string, string];
  vibe: string;
};

export type Match = {
  id: string;
  groupId: GroupId;
  homeId: string;
  awayId: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: string;
  note: string;
};

export type Group = {
  id: GroupId;
  nickname: string;
  teams: Team[];
};

const groupIds: GroupId[] = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

type RawTeam = [string, string, number, [string, string], string];
type FixtureSeed = [homeIndex: number, awayIndex: number, dateLabel: string, venue: string, score: [number, number] | null];

const rawTeams: Team[][] = ([
  [
    ["Mexico", "MEX", 1820, ["#0b7a3b", "#f43f5e"], "揭幕战已经拿到 3 分，主场氛围很足"],
    ["South Africa", "RSA", 1665, ["#16a34a", "#facc15"], "首战失利，后两场需要尽快抢分"],
    ["South Korea", "KOR", 1765, ["#ef4444", "#2563eb"], "开局赢球，跑动和转换速度是优势"],
    ["Czechia", "CZE", 1715, ["#2563eb", "#dc2626"], "首战落后，接下来要提高进攻效率"],
  ],
  [
    ["Canada", "CAN", 1715, ["#ef4444", "#f8fafc"], "东道主之一，首战平局后仍有主动权"],
    ["Bosnia and Herzegovina", "BIH", 1700, ["#2563eb", "#facc15"], "首战拿到 1 分，防守稳定性很关键"],
    ["Qatar", "QAT", 1625, ["#7f1d1d", "#f8fafc"], "首战打平，控球节奏需要更有威胁"],
    ["Switzerland", "SUI", 1795, ["#dc2626", "#f8fafc"], "纪律性强，平局开局后仍是出线热门"],
  ],
  [
    ["Brazil", "BRA", 2010, ["#facc15", "#16a34a"], "首战被逼平，个人能力仍然是上限来源"],
    ["Morocco", "MAR", 1835, ["#dc2626", "#16a34a"], "首战逼平巴西，防守和反击都很有质量"],
    ["Haiti", "HAI", 1580, ["#2563eb", "#ef4444"], "首战小负，后续必须抓住定位球和反击"],
    ["Scotland", "SCO", 1710, ["#1d4ed8", "#f8fafc"], "开局 3 分到手，比赛强度和对抗很在线"],
  ],
  [
    ["United States", "USA", 1815, ["#1d4ed8", "#ef4444"], "东道主首战大胜，出线形势很好"],
    ["Paraguay", "PAR", 1660, ["#dc2626", "#2563eb"], "首战失利，后两场要压低失误"],
    ["Australia", "AUS", 1715, ["#facc15", "#16a34a"], "首战赢球，身体对抗和定位球很有威胁"],
    ["Turkiye", "TUR", 1760, ["#dc2626", "#f8fafc"], "首战落后，需要把前场冲击打出来"],
  ],
  [
    ["Germany", "GER", 1940, ["#111827", "#facc15"], "首战大胜，净胜球优势非常明显"],
    ["Curacao", "CUW", 1550, ["#2563eb", "#facc15"], "首战压力很大，接下来要先稳住防线"],
    ["Ivory Coast", "CIV", 1760, ["#f97316", "#16a34a"], "首战赢球，力量和推进很直接"],
    ["Ecuador", "ECU", 1770, ["#facc15", "#2563eb"], "首战失利，但体能和推进能力仍不错"],
  ],
  [
    ["Netherlands", "NED", 1945, ["#f97316", "#1d4ed8"], "首战平局，控球优势还需要转成胜势"],
    ["Japan", "JPN", 1815, ["#2563eb", "#e11d48"], "首战逼平强队，速度和压迫很亮眼"],
    ["Sweden", "SWE", 1780, ["#facc15", "#2563eb"], "首战大胜，净胜球暂时很舒服"],
    ["Tunisia", "TUN", 1640, ["#ef4444", "#f8fafc"], "首战失利，防守端必须尽快调整"],
  ],
  [
    ["Belgium", "BEL", 1885, ["#facc15", "#dc2626"], "首战平局，进攻质量还有提升空间"],
    ["Egypt", "EGY", 1735, ["#111827", "#dc2626"], "首战拿分，核心球员状态很关键"],
    ["Iran", "IRN", 1695, ["#16a34a", "#dc2626"], "首战打平，反击效率决定上限"],
    ["New Zealand", "NZL", 1655, ["#111827", "#f8fafc"], "首战抢到 1 分，防守韧性不错"],
  ],
  [
    ["Spain", "ESP", 1965, ["#dc2626", "#facc15"], "首战被逼平，控球之外需要更多终结"],
    ["Cape Verde", "CPV", 1625, ["#2563eb", "#f8fafc"], "首战拿分，门前防守表现很硬"],
    ["Saudi Arabia", "KSA", 1665, ["#16a34a", "#f8fafc"], "首战平局，压迫和节奏敢提速"],
    ["Uruguay", "URU", 1835, ["#60a5fa", "#111827"], "首战平局，关键比赛经验仍然充足"],
  ],
  [
    ["France", "FRA", 2025, ["#1d4ed8", "#ef4444"], "首战 3 分到手，阵容深度和效率都很好"],
    ["Senegal", "SEN", 1810, ["#16a34a", "#f59e0b"], "首战失利，但转换进攻仍有威胁"],
    ["Iraq", "IRQ", 1625, ["#16a34a", "#ef4444"], "首战失利，后两场要先减少防守漏洞"],
    ["Norway", "NOR", 1885, ["#dc2626", "#1d4ed8"], "首战大胜，锋线冲击力很强"],
  ],
  [
    ["Argentina", "ARG", 1995, ["#60a5fa", "#f8fafc"], "首战大胜，控场和终结都很稳定"],
    ["Algeria", "ALG", 1720, ["#16a34a", "#f8fafc"], "首战失利，后续要提高进攻效率"],
    ["Austria", "AUT", 1810, ["#dc2626", "#f8fafc"], "首战赢球，整体压迫和反击都很扎实"],
    ["Jordan", "JOR", 1585, ["#dc2626", "#111827"], "首战进球但失利，后两场必须抢分"],
  ],
  [
    ["Portugal", "POR", 1950, ["#16a34a", "#dc2626"], "首战被逼平，后续需要把控球优势转成胜势"],
    ["DR Congo", "COD", 1660, ["#2563eb", "#dc2626"], "首战逼平强队，身体对抗和反击都很有存在感"],
    ["Uzbekistan", "UZB", 1685, ["#2563eb", "#f8fafc"], "首战进球但失利，后两场要提高防守稳定性"],
    ["Colombia", "COL", 1805, ["#facc15", "#2563eb"], "首战赢球，前场技术点和终结效率都不错"],
  ],
  [
    ["England", "ENG", 1980, ["#f8fafc", "#dc2626"], "首战赢下强强对话，进攻火力很足"],
    ["Croatia", "CRO", 1845, ["#ef4444", "#2563eb"], "首战丢分较多，后续必须提高防守质量"],
    ["Ghana", "GHA", 1715, ["#f59e0b", "#111827"], "首战绝杀拿到 3 分，出线主动权提升"],
    ["Panama", "PAN", 1605, ["#2563eb", "#ef4444"], "首战小负，后两场需要先抢到积分"],
  ],
] satisfies RawTeam[][]).map((teamGroup, groupIndex) =>
  teamGroup.map(([name, shortName, rating, colors, vibe], teamIndex) => ({
    id: `${groupIds[groupIndex]}${teamIndex + 1}`,
    groupId: groupIds[groupIndex],
    name,
    shortName,
    rating,
    colors,
    vibe,
  })),
);

const groupNicknames = [
  "揭幕战小组",
  "东道主北境小组",
  "巴西考验小组",
  "美国主场小组",
  "德国净胜球小组",
  "橙蓝速度小组",
  "平局观察小组",
  "控球与韧性小组",
  "法国挪威锋线小组",
  "冠军压力小组",
  "葡萄牙首秀小组",
  "英格兰硬仗小组",
];

const fixtureSeeds: Record<GroupId, FixtureSeed[]> = {
  A: [
    [0, 1, "6/11 已完赛", "Mexico City", [2, 0]],
    [2, 3, "6/11 已完赛", "Zapopan", [2, 1]],
    [3, 1, "6/18 已完赛", "Atlanta", [1, 1]],
    [0, 2, "6/18 已完赛", "Zapopan", [1, 0]],
    [3, 0, "6/24 已完赛", "Mexico City", [0, 3]],
    [1, 2, "6/24 已完赛", "Guadalupe", [1, 0]],
  ],
  B: [
    [0, 1, "6/12 已完赛", "Toronto", [1, 1]],
    [2, 3, "6/13 已完赛", "Santa Clara", [1, 1]],
    [3, 1, "6/18 已完赛", "Inglewood", [4, 1]],
    [0, 2, "6/18 已完赛", "Vancouver", [6, 0]],
    [3, 0, "6/24 已完赛", "Vancouver", [2, 1]],
    [1, 2, "6/24 已完赛", "Seattle", [3, 1]],
  ],
  C: [
    [0, 1, "6/13 已完赛", "East Rutherford", [1, 1]],
    [2, 3, "6/13 已完赛", "Foxborough", [0, 1]],
    [3, 1, "6/19 已完赛", "Foxborough", [0, 1]],
    [0, 2, "6/19 已完赛", "Philadelphia", [3, 0]],
    [3, 0, "6/24 已完赛", "Miami Gardens", [0, 3]],
    [1, 2, "6/24 已完赛", "Atlanta", [4, 2]],
  ],
  D: [
    [0, 1, "6/12 已完赛", "Inglewood", [4, 1]],
    [2, 3, "6/14 已完赛", "Vancouver", [2, 0]],
    [0, 2, "6/19 已完赛", "Seattle", [2, 0]],
    [3, 1, "6/19 已完赛", "Santa Clara", [0, 1]],
    [3, 0, "6/25 已完赛", "Inglewood", [3, 2]],
    [1, 2, "6/25 已完赛", "Santa Clara", [0, 0]],
  ],
  E: [
    [0, 1, "6/14 已完赛", "Houston", [7, 1]],
    [2, 3, "6/14 已完赛", "Philadelphia", [1, 0]],
    [0, 2, "6/20 已完赛", "Toronto", [2, 1]],
    [3, 1, "6/20 已完赛", "Kansas City", [0, 0]],
    [3, 0, "6/25 已完赛", "East Rutherford", [2, 1]],
    [1, 2, "6/25 已完赛", "Philadelphia", [0, 2]],
  ],
  F: [
    [0, 1, "6/14 已完赛", "Arlington", [2, 2]],
    [2, 3, "6/14 已完赛", "Guadalupe", [5, 1]],
    [0, 2, "6/20 已完赛", "Houston", [5, 1]],
    [3, 1, "6/21 已完赛", "Guadalupe", [0, 4]],
    [1, 2, "6/25 已完赛", "Arlington", [1, 1]],
    [3, 0, "6/25 已完赛", "Kansas City", [1, 3]],
  ],
  G: [
    [0, 1, "6/15 已完赛", "Seattle", [1, 1]],
    [2, 3, "6/15 已完赛", "Inglewood", [2, 2]],
    [0, 2, "6/21 已完赛", "Inglewood", [0, 0]],
    [3, 1, "6/21 已完赛", "Vancouver", [1, 3]],
    [1, 2, "6/26 已完赛", "Seattle", [1, 1]],
    [3, 0, "6/26 已完赛", "Vancouver", [1, 5]],
  ],
  H: [
    [0, 1, "6/15 已完赛", "Atlanta", [0, 0]],
    [2, 3, "6/15 已完赛", "Miami Gardens", [1, 1]],
    [0, 2, "6/21 已完赛", "Atlanta", [4, 0]],
    [3, 1, "6/21 已完赛", "Miami Gardens", [2, 2]],
    [1, 2, "6/26 已完赛", "Houston", [0, 0]],
    [3, 0, "6/26 已完赛", "Zapopan", [0, 1]],
  ],
  I: [
    [0, 1, "6/16 已完赛", "East Rutherford", [3, 1]],
    [2, 3, "6/16 已完赛", "Foxborough", [1, 4]],
    [0, 2, "6/22 已完赛", "Philadelphia", [3, 0]],
    [3, 1, "6/22 已完赛", "East Rutherford", [3, 2]],
    [3, 0, "6/26 已完赛", "Foxborough", [1, 4]],
    [1, 2, "6/26 已完赛", "Toronto", [5, 0]],
  ],
  J: [
    [0, 1, "6/16 已完赛", "Kansas City", [3, 0]],
    [2, 3, "6/17 已完赛", "Santa Clara", [3, 1]],
    [0, 2, "6/22 已完赛", "Arlington", [2, 0]],
    [3, 1, "6/22 已完赛", "Santa Clara", [1, 2]],
    [1, 2, "6/27 已完赛", "Kansas City", [3, 3]],
    [3, 0, "6/27 已完赛", "Arlington", [1, 3]],
  ],
  K: [
    [0, 1, "6/17 已完赛", "Houston", [1, 1]],
    [2, 3, "6/17 已完赛", "Mexico City", [1, 3]],
    [0, 2, "6/23 已完赛", "Houston", [5, 0]],
    [3, 1, "6/23 已完赛", "Zapopan", [1, 0]],
    [3, 0, "6/27 已完赛", "Miami Gardens", [0, 0]],
    [1, 2, "6/27 已完赛", "Atlanta", [3, 1]],
  ],
  L: [
    [0, 1, "6/17 已完赛", "Arlington", [4, 2]],
    [2, 3, "6/17 已完赛", "Toronto", [1, 0]],
    [0, 2, "6/23 已完赛", "Foxborough", [0, 0]],
    [3, 1, "6/23 已完赛", "Toronto", [0, 1]],
    [3, 0, "6/27 已完赛", "East Rutherford", [0, 2]],
    [1, 2, "6/27 已完赛", "Philadelphia", [2, 1]],
  ],
};

export const groups: Group[] = rawTeams.map((teams, index) => ({
  id: groupIds[index],
  nickname: groupNicknames[index],
  teams,
}));

export const teams = groups.flatMap((group) => group.teams);

export function createInitialMatches(): Match[] {
  return groups.flatMap((group) =>
    fixtureSeeds[group.id].map(([homeIndex, awayIndex, dateLabel, venue, score], matchIndex) => ({
      id: `${group.id}-${matchIndex + 1}`,
      groupId: group.id,
      homeId: group.teams[homeIndex].id,
      awayId: group.teams[awayIndex].id,
      homeScore: score?.[0] ?? null,
      awayScore: score?.[1] ?? null,
      kickoff: dateLabel,
      note: venue,
    })),
  );
}

export const demoNotice =
  "静态数据已通过一键脚本更新至 2026-07-23：小组赛比分与淘汰赛赛程/结果已分开维护。";
