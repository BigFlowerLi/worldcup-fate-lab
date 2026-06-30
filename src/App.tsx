import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  CircleHelp,
  Crown,
  Download,
  Dices,
  ExternalLink,
  Flag,
  Home,
  Info,
  ListRestart,
  Minus,
  MessageSquareText,
  Play,
  Plus,
  Route,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import FateCanvas from "./components/FateCanvas";
import { createInitialKnockoutMatches } from "./data/knockout";
import { createInitialMatches, groups, teams, type Match, type Team } from "./data/tournament";
import { analyzeChampionRace, type ChampionAnalysis } from "./lib/champion";
import {
  buildRootingAdvice,
  fillRandomUniverse,
  findScenarioCards,
  generateFateScript,
  simulateTournament,
  type FateScript,
  type Probability,
  type RootingAdvice,
  type ScenarioCard,
} from "./lib/simulation";
import { downloadShareCard } from "./lib/share";
import {
  calculateGroupStandings,
  getSelectedStanding,
  getThirdPlaceTable,
  isFinished,
  setMatchScore,
  updateMatchScore,
  type Standing,
} from "./lib/tournament";

type PageId = "home" | "rules" | "simulator" | "paths" | "champion" | "glossary" | "poster";
type HelpKey =
  | "home"
  | "team"
  | "result"
  | "rules"
  | "simulator"
  | "advice"
  | "paths"
  | "third"
  | "champion"
  | "glossary"
  | "poster";

const pageItems: Array<{ id: PageId; label: string; icon: ReactNode }> = [
  { id: "home", label: "首页", icon: <Home size={17} /> },
  { id: "rules", label: "规则", icon: <Info size={17} /> },
  { id: "simulator", label: "模拟", icon: <Play size={17} /> },
  { id: "paths", label: "路径", icon: <Route size={17} /> },
  { id: "champion", label: "夺冠树", icon: <Trophy size={17} /> },
  { id: "glossary", label: "词典", icon: <BookOpen size={17} /> },
  { id: "poster", label: "海报", icon: <Share2 size={17} /> },
];

const pageIds = new Set<PageId>(pageItems.map((item) => item.id));

function readPageFromHash(): PageId {
  const value = window.location.hash.replace("#", "");
  return pageIds.has(value as PageId) ? (value as PageId) : "home";
}

const severityText: Record<FateScript["severity"], string> = {
  calm: "较稳",
  watch: "观察",
  chaos: "困难",
  panic: "危险",
};

const helpCopy: Record<HelpKey, { title: string; image: string; body: string; bullets: string[] }> = {
  home: {
    title: "先选一支队",
    image: "/liukanshan/liu-4.jpg",
    body: "首页只给你最重要的结论：这支队现在大概稳不稳，以及下一步应该去哪看。",
    bullets: ["晋级率是模拟结果，不是官方预测。", "如果看不懂名词，先去词典页。", "想改比分，就进模拟页。"],
  },
  team: {
    title: "主队选择",
    image: "/liukanshan/liu-2.jpg",
    body: "可以搜索队名，也可以按首字母或小组找队。后面的概率、积分榜、路径都会跟着这支队变化。",
    bullets: ["A-L 是 12 个小组。", "球队旁边的短句只是风格提示。", "静态赛程可以后续手动补比分。"],
  },
  result: {
    title: "怎么看结论",
    image: "/liukanshan/liu-3.jpg",
    body: "这里把复杂积分规则压缩成一个结论。外行只需要先看晋级率和状态标签。",
    bullets: ["前二可以直接晋级。", "小组第三还要和其他小组第三比较。", "风险指数越高，越需要别人比赛配合。"],
  },
  rules: {
    title: "扩军规则",
    image: "/liukanshan/liu-1.jpg",
    body: "2026 年世界杯从 32 队扩到 48 队，最大变化是会出现 32 强淘汰赛和 8 个最佳第三名。",
    bullets: ["12 个小组，每组 4 队。", "小组前二直接晋级。", "12 个第三名里成绩最好的 8 个也晋级。"],
  },
  simulator: {
    title: "比分模拟",
    image: "/liukanshan/liu-1.jpg",
    body: "这里可以改剩余比赛比分。每改一次，积分榜和晋级概率都会重新计算。",
    bullets: ["加号是进一球，减号是少一球。", "清空按钮可以把某场改回未赛。", "不确定性越高，冷门结果越容易出现。"],
  },
  advice: {
    title: "该支持谁",
    image: "/liukanshan/liu-4.jpg",
    body: "如果你只关心主队，这里会告诉你同组其他比赛什么结果对主队更有利。",
    bullets: ["主胜、平局、客胜分别代表三种方向。", "后面的百分比是对主队晋级率的影响。", "影响小的比赛可以不用重点盯。"],
  },
  paths: {
    title: "出线路径",
    image: "/liukanshan/liu-2.jpg",
    body: "这里列出几种可能剧本：较好、边缘、危险。它不是预言，只是帮你看清比分组合。",
    bullets: ["较好路径通常能进前二。", "边缘路径多半要比较最佳第三名。", "危险路径说明分数或净胜球不够稳。"],
  },
  third: {
    title: "最佳第三名",
    image: "/liukanshan/liu-3.jpg",
    body: "2026 赛制下，不是所有第三名都淘汰。12 个小组第三里，成绩最好的 8 个还能晋级。",
    bullets: ["先比积分。", "再比净胜球和进球数。", "绿色位置表示当前在晋级区。"],
  },
  champion: {
    title: "夺冠树",
    image: "/liukanshan/liu-2.jpg",
    body: "这里把小组赛出线概率继续往后推，模拟每队从 32 强一路到冠军的概率。",
    bullets: ["小组未结束时，对阵树只是当前投影。", "比分改动后，夺冠概率和路径都会变。", "淘汰赛胜负按球队强度做概率模拟。"],
  },
  glossary: {
    title: "足球词典",
    image: "/liukanshan/liu-1.jpg",
    body: "这个页面专门给不常看球的人用。点一个词，就能看到直白解释和比赛里会发生什么。",
    bullets: ["不用一次看完。", "先看越位、净胜球、补时、最佳第三名。", "可以把术语卡导出成图片。"],
  },
  poster: {
    title: "海报工坊",
    image: "/liukanshan/liu-4.jpg",
    body: "这里把你当前选择的主队和结论做成图片，适合发知乎文章、想法或回答。",
    bullets: ["海报文字来自当前盘面。", "改比分后再生成，结论会跟着变。", "术语图在词典页生成。"],
  },
};

const glossaryTerms = [
  {
    id: "offside",
    term: "越位",
    tag: "最常见疑问",
    short: "进攻球员接队友传球时，站得比倒数第二名防守球员更靠近球门，并参与进攻。",
    plain: "简单说：不是球进了就一定算。传球那一刻，接球的人站位如果太靠前，就可能越位。",
    example: "常见画面：球员已经庆祝，边裁举旗，VAR 复核后进球取消。",
  },
  {
    id: "goal-difference",
    term: "净胜球",
    tag: "积分相同时常用",
    short: "进球数减去失球数。比如进 5 球、丢 2 球，净胜球就是 +3。",
    plain: "小组里如果积分相同，净胜球常常决定谁排前面。",
    example: "所以末轮领先后还继续进攻，可能是为了多拿净胜球。",
  },
  {
    id: "third-place",
    term: "最佳第三名",
    tag: "2026 重点",
    short: "12 个小组第三名里，成绩最好的 8 个也可以晋级。",
    plain: "这就是为什么第三名不一定出局。它要和其他小组第三名比较。",
    example: "4 分不一定稳，3 分通常很悬，净胜球会变得很重要。",
  },
  {
    id: "stoppage-time",
    term: "补时",
    tag: "最后几分钟",
    short: "常规 90 分钟之外，裁判补回因伤停、换人、VAR 等损耗的时间。",
    plain: "比赛不是到 90:00 就立刻结束。补时阶段也能进球，也能改变排名。",
    example: "很多绝平、绝杀都发生在 90+ 分钟。",
  },
  {
    id: "var",
    term: "VAR",
    tag: "视频助理裁判",
    short: "用视频回看辅助裁判处理关键判罚。",
    plain: "VAR 主要看进球、点球、红牌、认错人等关键事件。",
    example: "进球后等很久，通常是在检查越位或犯规。",
  },
  {
    id: "penalty",
    term: "点球",
    tag: "禁区犯规",
    short: "防守方在禁区内犯规，进攻方获得距离球门 12 码的一脚射门。",
    plain: "点球进球概率高，所以一次禁区犯规可能直接改变比赛。",
    example: "淘汰赛打平后也可能进入点球大战，那是另一套规则。",
  },
];

const termImageSets: Record<string, string[]> = {
  offside: [
    "/generated/terms/term-offside.png",
    "/generated/terms/term-var.png",
    "/generated/terms/term-goal-difference.png",
  ],
  "goal-difference": [
    "/generated/terms/term-goal-difference.png",
    "/generated/terms/term-third-place.png",
    "/generated/terms/term-offside.png",
  ],
  "third-place": [
    "/generated/terms/term-third-place.png",
    "/generated/terms/term-goal-difference.png",
    "/generated/football-analyst.png",
  ],
  "stoppage-time": [
    "/generated/terms/term-stoppage-time.png",
    "/generated/terms/term-var.png",
    "/generated/terms/term-penalty.png",
  ],
  var: [
    "/generated/terms/term-var.png",
    "/generated/football-analyst.png",
    "/generated/terms/term-offside.png",
  ],
  penalty: [
    "/generated/terms/term-penalty.png",
    "/generated/terms/term-stoppage-time.png",
    "/generated/terms/term-offside.png",
  ],
};

const termCautions: Record<string, string> = {
  offside: "越位看的是传球一瞬间的位置，不是接到球之后的位置。",
  "goal-difference": "净胜球不是进球数。进得多但丢得也多，净胜球未必高。",
  "third-place": "小组第三不是自动晋级，要和其他小组第三一起排名。",
  "stoppage-time": "补时不是固定 1 分钟或 3 分钟，裁判会根据比赛中断情况决定。",
  var: "VAR 不会重看所有球，只介入进球、点球、红牌等关键判罚。",
  penalty: "点球发生在禁区内犯规；点球大战是淘汰赛打平后的另一种规则。",
};

function getTermCards(term: (typeof glossaryTerms)[number]) {
  const images = termImageSets[term.id] ?? ["/generated/football-analyst.png"];
  return [
    {
      label: "速懂版",
      title: `${term.term}是什么`,
      body: term.plain,
      note: term.short,
      image: images[0],
    },
    {
      label: "现场版",
      title: "比赛里怎么看",
      body: term.example,
      note: "看转播时，先抓住这个画面。",
      image: images[1] ?? images[0],
    },
    {
      label: "避坑版",
      title: "最容易误会",
      body: termCautions[term.id] ?? "先看规则触发的瞬间，再看裁判最终判罚。",
      note: "这张适合发给第一次看球的朋友。",
      image: images[2] ?? images[0],
    },
  ];
}

function App() {
  const [page, setPage] = useState<PageId>(() => readPageFromHash());
  const [matches, setMatches] = useState<Match[]>(() => createInitialMatches());
  const knockoutMatches = useMemo(() => createInitialKnockoutMatches(), []);
  const [selectedTeamId, setSelectedTeamId] = useState("I1");
  const [chaos, setChaos] = useState(34);
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const [selectedTermId, setSelectedTermId] = useState(glossaryTerms[0].id);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const selectedGroup = groups.find((group) => group.id === selectedTeam.groupId) ?? groups[0];
  const simulation = useMemo(() => simulateTournament(groups, matches, 620, chaos), [matches, chaos]);
  const probability = simulation.probabilities.get(selectedTeam.id) ?? fallbackProbability;
  const standings = useMemo(() => calculateGroupStandings(selectedGroup, matches), [selectedGroup, matches]);
  const selectedStanding = useMemo(
    () => getSelectedStanding(groups, matches, selectedTeam.id),
    [matches, selectedTeam.id],
  );
  const script = useMemo(
    () => generateFateScript(groups, matches, selectedTeam, probability, simulation.thirdCutLine),
    [matches, probability, selectedTeam, simulation.thirdCutLine],
  );
  const advice = useMemo(
    () => buildRootingAdvice(groups, matches, selectedTeam.id, probability.qualify, chaos),
    [matches, selectedTeam.id, probability.qualify, chaos],
  );
  const scenarios = useMemo(() => findScenarioCards(groups, matches, selectedTeam.id), [matches, selectedTeam.id]);
  const championAnalysis = useMemo(
    () => analyzeChampionRace(groups, matches, knockoutMatches, selectedTeam.id, 620, chaos),
    [matches, knockoutMatches, selectedTeam.id, chaos],
  );
  const thirdTable = useMemo(() => getThirdPlaceTable(groups, matches), [matches]);
  const groupMatches = matches.filter((match) => match.groupId === selectedGroup.id);
  const selectedTerm = glossaryTerms.find((term) => term.id === selectedTermId) ?? glossaryTerms[0];

  useEffect(() => {
    const syncPage = () => setPage(readPageFromHash());
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const navigatePage = (nextPage: PageId) => {
    if (readPageFromHash() === nextPage) {
      setPage(nextPage);
      return;
    }
    window.location.hash = nextPage;
  };

  const handleScore = (matchId: string, side: "home" | "away", delta: number) => {
    setMatches((current) => updateMatchScore(current, matchId, side, delta));
  };

  const handleClear = (matchId: string) => {
    setMatches((current) => setMatchScore(current, matchId, null, null));
  };

  const exportTeamCard = () => {
    downloadShareCard(selectedTeam, selectedStanding, probability, script, advice);
  };

  const exportTermCard = () => {
    downloadGlossaryCard(selectedTerm);
  };

  const applyScenario = (scenario: ScenarioCard) => {
    if (!scenario.scores.length) return;
    setMatches((current) =>
      current.map((match) => {
        const score = scenario.scores.find((item) => item.matchId === match.id);
        return score ? { ...match, homeScore: score.homeScore, awayScore: score.awayScore } : match;
      }),
    );
    navigatePage("simulator");
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <button className="brand-button" type="button" onClick={() => navigatePage("home")}>
          <span className="brand-mark">
            <Trophy size={23} />
          </span>
          <span>
            <small>World Cup Fate Lab</small>
            <strong>主队还有救吗？</strong>
          </span>
        </button>

        <nav className="site-nav" aria-label="站点导航">
          {pageItems.map((item) => (
            <button
              className={page === item.id ? "nav-button active" : "nav-button"}
              key={item.id}
              type="button"
              onClick={() => navigatePage(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={() => setMatches(createInitialMatches())}>
            <ListRestart size={17} />
            重置
          </button>
          <button className="ghost-button" type="button" onClick={() => setMatches(fillRandomUniverse(groups, matches, chaos))}>
            <Dices size={17} />
            随机赛果
          </button>
          <button className="primary-button" type="button" onClick={exportTeamCard}>
            <Download size={17} />
            导出
          </button>
        </div>
      </header>

      {page === "home" && (
        <HomePage
          selectedTeam={selectedTeam}
          selectedGroupId={selectedGroup.id}
          probability={probability}
          script={script}
          standings={standings}
          selectedTeamId={selectedTeamId}
          setSelectedTeamId={setSelectedTeamId}
          setPage={navigatePage}
          openHelp={setHelpKey}
        />
      )}

      {page === "simulator" && (
        <SimulatorPage
          selectedTeam={selectedTeam}
          selectedGroupId={selectedGroup.id}
          groupMatches={groupMatches}
          standings={standings}
          probabilities={simulation.probabilities}
          advice={advice}
          chaos={chaos}
          setChaos={setChaos}
          onScore={handleScore}
          onClear={handleClear}
          openHelp={setHelpKey}
        />
      )}

      {page === "rules" && <RulesPage setPage={navigatePage} openHelp={setHelpKey} />}

      {page === "paths" && (
        <PathsPage
          selectedTeam={selectedTeam}
          scenarios={scenarios}
          thirdTable={thirdTable}
          thirdCutLine={simulation.thirdCutLine}
          applyScenario={applyScenario}
          openHelp={setHelpKey}
        />
      )}

      {page === "champion" && (
        <ChampionPage
          selectedTeam={selectedTeam}
          championAnalysis={championAnalysis}
          setPage={navigatePage}
          openHelp={setHelpKey}
        />
      )}

      {page === "glossary" && (
        <GlossaryPage
          terms={glossaryTerms}
          selectedTerm={selectedTerm}
          setSelectedTermId={setSelectedTermId}
          exportTermCard={exportTermCard}
          openHelp={setHelpKey}
        />
      )}

      {page === "poster" && (
        <PosterPage
          selectedTeam={selectedTeam}
          selectedStanding={selectedStanding}
          probability={probability}
          script={script}
          advice={advice}
          exportTeamCard={exportTeamCard}
          exportTermCard={exportTermCard}
          openHelp={setHelpKey}
          setPage={navigatePage}
        />
      )}

      {helpKey && <CoachModal helpKey={helpKey} onClose={() => setHelpKey(null)} />}
    </main>
  );
}

function HomePage({
  selectedTeam,
  selectedGroupId,
  probability,
  script,
  standings,
  selectedTeamId,
  setSelectedTeamId,
  setPage,
  openHelp,
}: {
  selectedTeam: Team;
  selectedGroupId: string;
  probability: Probability;
  script: FateScript;
  standings: Standing[];
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
  setPage: (page: PageId) => void;
  openHelp: (key: HelpKey) => void;
}) {
  return (
    <section className="page-stack">
      <div className="home-hero">
        <div className="hero-copy">
          <div className="mini-label">
            <Flag size={16} />
            先选主队，再看出线形势
          </div>
          <h1>{selectedTeam.name} 当前{script.title}</h1>
          <p>{script.punchline}</p>
          <div className="hero-actions">
            <button className="primary-button large" type="button" onClick={() => setPage("simulator")}>
              <Play size={18} />
              改比分试试
            </button>
            <button className="ghost-button large" type="button" onClick={() => setPage("glossary")}>
              <BookOpen size={18} />
              先看词典
            </button>
            <CoachButton label="首页说明" onClick={() => openHelp("home")} />
          </div>
          <div className="kick-guide">
            <img src="/liukanshan/liukanshan-kick.gif" alt="刘看山踢球" />
            <div>
              <strong>2026 赛制变了</strong>
              <p>48 队、12 组、32 强淘汰赛。第三名也可能晋级。</p>
              <button className="ghost-button" type="button" onClick={() => setPage("rules")}>
                <Info size={16} />
                看扩军规则
              </button>
            </div>
          </div>
        </div>
        <div className="hero-board">
          <FateCanvas groups={groups} selectedTeam={selectedTeam} probabilities={new Map([[selectedTeam.id, probability]])} volatility={30} />
        </div>
      </div>

      <div className="home-grid">
        <section className="module-block team-module">
          <ModuleHeader icon={<ShieldCheck size={18} />} title="选择主队" helpKey="team" openHelp={openHelp} />
          <TeamPicker selectedGroupId={selectedGroupId} selectedTeamId={selectedTeamId} setSelectedTeamId={setSelectedTeamId} />
        </section>

        <section className="module-block result-module">
          <ModuleHeader icon={<Target size={18} />} title="当前结论" helpKey="result" openHelp={openHelp} />
          <ResultSummary selectedTeam={selectedTeam} probability={probability} script={script} standings={standings} />
        </section>
      </div>

      <section className="module-block">
        <ModuleHeader icon={<MessageSquareText size={18} />} title="知乎热议" helpKey="home" openHelp={openHelp} />
        <ZhihuBuzz selectedTeam={selectedTeam} />
      </section>

      <section className="next-steps">
        <StepButton icon={<Info size={19} />} title="看扩军规则" text="先理解 2026 和以往赛制哪里不同。" onClick={() => setPage("rules")} />
        <StepButton icon={<Zap size={19} />} title="模拟比分" text="输入剩余比赛结果，看看排名怎么变。" onClick={() => setPage("simulator")} />
        <StepButton icon={<Route size={19} />} title="看出线路径" text="查看较好、边缘、危险三类结果。" onClick={() => setPage("paths")} />
        <StepButton icon={<Trophy size={19} />} title="看夺冠树" text="从小组赛一路推到大力神杯。" onClick={() => setPage("champion")} />
        <StepButton icon={<BookOpen size={19} />} title="补足球概念" text="用图文解释越位、净胜球、补时等词。" onClick={() => setPage("glossary")} />
      </section>
    </section>
  );
}

function SimulatorPage({
  selectedTeam,
  selectedGroupId,
  groupMatches,
  standings,
  probabilities,
  advice,
  chaos,
  setChaos,
  onScore,
  onClear,
  openHelp,
}: {
  selectedTeam: Team;
  selectedGroupId: string;
  groupMatches: Match[];
  standings: Standing[];
  probabilities: Map<string, Probability>;
  advice: RootingAdvice[];
  chaos: number;
  setChaos: (value: number) => void;
  onScore: (matchId: string, side: "home" | "away", delta: number) => void;
  onClear: (matchId: string) => void;
  openHelp: (key: HelpKey) => void;
}) {
  return (
    <section className="page-stack">
      <PageTitle
        eyebrow={`${selectedGroupId} 组 · ${selectedTeam.name}`}
        title="赛果模拟器"
        text="改比分，马上看积分榜、晋级率和该关注哪场比赛。"
        helpKey="simulator"
        openHelp={openHelp}
      />

      <div className="simulator-layout">
        <section className="module-block">
          <ModuleHeader icon={<Zap size={18} />} title="改比分" helpKey="simulator" openHelp={openHelp} />
          <div className="match-list relaxed">
            {groupMatches.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                teamsById={teamLookup}
                selectedTeamId={selectedTeam.id}
                onScore={onScore}
                onClear={onClear}
              />
            ))}
          </div>
          <div className="control-strip">
            <div>
              <strong>不确定性</strong>
              <span>数值越高，模拟越容易出现冷门比分。</span>
            </div>
            <input
              aria-label="不确定性"
              type="range"
              min="0"
              max="70"
              value={chaos}
              onChange={(event) => setChaos(Number(event.target.value))}
            />
            <b>{chaos}</b>
          </div>
        </section>

        <section className="module-block">
          <ModuleHeader icon={<BarChart3 size={18} />} title="积分榜" helpKey="result" openHelp={openHelp} />
          <StandingsTable standings={standings} selectedTeamId={selectedTeam.id} probabilities={probabilities} />
        </section>
      </div>

      <section className="module-block">
        <ModuleHeader icon={<CircleHelp size={18} />} title="为了主队，该希望哪场出什么结果" helpKey="advice" openHelp={openHelp} />
        <div className="advice-grid">
          {advice.length ? (
            advice.map((item) => <AdviceItem key={item.matchId} advice={item} />)
          ) : (
            <div className="empty-state">这个小组的示例赛程已经全部完成。</div>
          )}
        </div>
      </section>
    </section>
  );
}

function PathsPage({
  selectedTeam,
  scenarios,
  thirdTable,
  thirdCutLine,
  applyScenario,
  openHelp,
}: {
  selectedTeam: Team;
  scenarios: ScenarioCard[];
  thirdTable: ReturnType<typeof getThirdPlaceTable>;
  thirdCutLine: number;
  applyScenario: (scenario: ScenarioCard) => void;
  openHelp: (key: HelpKey) => void;
}) {
  const [selectedScenarioTitle, setSelectedScenarioTitle] = useState(scenarios[0]?.title ?? "");
  const selectedScenario = scenarios.find((scenario) => scenario.title === selectedScenarioTitle) ?? scenarios[0];

  useEffect(() => {
    if (scenarios.length && !scenarios.some((scenario) => scenario.title === selectedScenarioTitle)) {
      setSelectedScenarioTitle(scenarios[0].title);
    }
  }, [scenarios, selectedScenarioTitle]);

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow={selectedTeam.name}
        title="出线路径"
        text="点一条路径，查看需要哪些比分；觉得有意思，就一键套用到模拟器继续玩。"
        helpKey="paths"
        openHelp={openHelp}
      />

      <section className="module-block">
        <ModuleHeader icon={<Route size={18} />} title="可能路径" helpKey="paths" openHelp={openHelp} />
        <div className="scenario-grid">
          {scenarios.map((scenario) => (
            <button
              className={`scenario-card scenario-option ${scenario.kind} ${selectedScenario?.title === scenario.title ? "active" : ""}`}
              key={scenario.title}
              type="button"
              onClick={() => setSelectedScenarioTitle(scenario.title)}
            >
              <strong>{scenario.title}</strong>
              <p>{scenario.text}</p>
              <b>第 {scenario.rank} 名 · {scenario.points} 分 · 净胜球 {formatGoalDiff(scenario.goalDifference)}</b>
              <div>
                {scenario.matchLines.slice(0, 4).map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              <em>点击查看战术单</em>
            </button>
          ))}
        </div>
      </section>

      {selectedScenario && (
        <section className="module-block path-playground">
          <div className="path-board">
            <div>
              <p className="eyebrow">Path Challenge</p>
              <h2>{selectedScenario.title}</h2>
              <p>{selectedScenario.text}</p>
            </div>
            <div className="path-metrics">
              <span>排名 <strong>{selectedScenario.rank}</strong></span>
              <span>积分 <strong>{selectedScenario.points}</strong></span>
              <span>净胜球 <strong>{formatGoalDiff(selectedScenario.goalDifference)}</strong></span>
            </div>
          </div>
          <div className="path-lines">
            {selectedScenario.matchLines.map((line, index) => (
              <div className="path-line" key={`${line}-${index}`}>
                <span>{index + 1}</span>
                <strong>{line}</strong>
              </div>
            ))}
          </div>
          <div className="path-actions">
            <button className="primary-button large" type="button" onClick={() => applyScenario(selectedScenario)}>
              <Wand2 size={18} />
              套用这条路径
            </button>
            <p>套用后会自动跳到“模拟”页，你可以继续手动改比分。</p>
          </div>
        </section>
      )}

      <section className="module-block">
        <ModuleHeader icon={<Trophy size={18} />} title={`最佳第三名 · 平均门槛 ${thirdCutLine} 分`} helpKey="third" openHelp={openHelp} />
        <div className="third-track">
          {thirdTable.map((item) => (
            <div className={item.advancing ? "third-chip advancing" : "third-chip"} key={item.groupId}>
              <span>{item.thirdRank}</span>
              <strong>{item.standing.team.shortName}</strong>
              <small>{item.groupId} 组 · {item.standing.points} 分 · {formatGoalDiff(item.standing.gd)}</small>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function RulesPage({ setPage, openHelp }: { setPage: (page: PageId) => void; openHelp: (key: HelpKey) => void }) {
  const oldRules = [
    ["参赛队", "32 队"],
    ["小组", "8 组，每组 4 队"],
    ["出线", "每组前 2 名"],
    ["淘汰赛", "16 强开始"],
    ["总场次", "64 场"],
  ];
  const newRules = [
    ["参赛队", "48 队"],
    ["小组", "12 组，每组 4 队"],
    ["出线", "前 2 名 + 8 个最佳第三名"],
    ["淘汰赛", "32 强开始"],
    ["总场次", "104 场"],
  ];

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="2026 Format"
        title="今年扩军后，规则变在哪？"
        text="以前很多人只需要关心小组前二。2026 年开始，小组第三也可能晋级，所以出线计算和夺冠路径都会更复杂。"
        helpKey="rules"
        openHelp={openHelp}
      />

      <div className="rules-compare">
        <RuleCard title="以往常见赛制" tone="old" items={oldRules} />
        <RuleCard title="2026 扩军赛制" tone="new" items={newRules} />
      </div>

      <section className="module-block">
        <ModuleHeader icon={<Route size={18} />} title="从 48 队到冠军" helpKey="rules" openHelp={openHelp} />
        <div className="format-flow">
          {[
            ["48 队", "进入小组赛"],
            ["12 组", "每组 4 队"],
            ["24 队", "小组前二直接晋级"],
            ["8 队", "最佳第三名补进来"],
            ["32 强", "新增一轮淘汰赛"],
            ["冠军", "一路赢到大力神杯"],
          ].map(([title, text], index) => (
            <div className="flow-node" key={title}>
              <span>{index + 1}</span>
              <strong>{title}</strong>
              <small>{text}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="rules-impact">
        <article>
          <h2>为什么第三名很关键？</h2>
          <p>12 个小组第三里，成绩最好的 8 个还能进入 32 强。也就是说，4 分、净胜球、进球数都可能决定命运。</p>
        </article>
        <article>
          <h2>为什么夺冠树会变化？</h2>
          <p>小组名次和最佳第三名会影响 32 强对阵。小组赛没结束前，树只能按当前盘面投影；比分一变，对手和概率也会变。</p>
        </article>
        <article>
          <h2>这个网站怎么用？</h2>
          <p>先在模拟页改比分，再看路径页和夺冠树。你会看到同一个比分如何影响出线、对阵和夺冠概率。</p>
        </article>
      </section>

      <div className="rules-actions">
        <button className="primary-button large" type="button" onClick={() => setPage("simulator")}>
          <Zap size={18} />
          去改比分
        </button>
        <button className="ghost-button large" type="button" onClick={() => setPage("champion")}>
          <Trophy size={18} />
          看夺冠树
        </button>
      </div>
    </section>
  );
}

function RuleCard({ title, tone, items }: { title: string; tone: "old" | "new"; items: string[][] }) {
  return (
    <section className={`rule-card ${tone}`}>
      <h2>{title}</h2>
      <div>
        {items.map(([label, value]) => (
          <p key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </p>
        ))}
      </div>
    </section>
  );
}

function ChampionPage({
  selectedTeam,
  championAnalysis,
  setPage,
  openHelp,
}: {
  selectedTeam: Team;
  championAnalysis: ChampionAnalysis;
  setPage: (page: PageId) => void;
  openHelp: (key: HelpKey) => void;
}) {
  const selected = championAnalysis.selected;
  const selectedMatch = championAnalysis.selectedMatch;
  const selectedOpponent = selectedMatch
    ? selectedMatch.left.team.id === selectedTeam.id
      ? selectedMatch.right
      : selectedMatch.left
    : null;

  const stages = [
    ["32 强", selected.r32],
    ["16 强", selected.r16],
    ["8 强", selected.quarter],
    ["4 强", selected.semi],
    ["决赛", selected.final],
    ["冠军", selected.champion],
  ];

  return (
    <section className="page-stack">
      <PageTitle
        eyebrow={selectedTeam.name}
        title="直通大力神杯"
        text="真实淘汰赛结果会锁定晋级，未赛场次继续模拟。"
        helpKey="champion"
        openHelp={openHelp}
      />

      <section className="champion-hero module-block">
        <div>
          <p className="eyebrow">Champion Odds</p>
          <h2>{selectedTeam.name} 夺冠概率</h2>
          <strong>{selected.champion}%</strong>
          <p>{championAnalysis.bracketNote}</p>
          <button className="primary-button large" type="button" onClick={() => setPage("simulator")}>
            <Zap size={18} />
            改比分后重算
          </button>
        </div>
        <img src="/liukanshan/liukanshan-kick.gif" alt="刘看山踢球" />
      </section>

      <section className="module-block">
        <ModuleHeader icon={<Trophy size={18} />} title="主队晋级树" helpKey="champion" openHelp={openHelp} />
        <div className="trophy-tree">
          {stages.map(([label, value], index) => (
            <div className="tree-node" key={label}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
              <b>{value}%</b>
            </div>
          ))}
        </div>
        {selectedMatch && selectedOpponent && (
          <div className="selected-duel">
            <Swords size={20} />
            <div>
              <strong>
                {selectedMatch.lockedWinner
                  ? selectedMatch.lockedWinner.id === selectedTeam.id
                    ? `已晋级：${selectedTeam.shortName} 进入下一轮`
                    : `已出局：${selectedMatch.lockedWinner.shortName} 晋级`
                  : `32 强首轮：${selectedTeam.shortName} vs ${selectedOpponent.team.shortName}`}
              </strong>
              <p>
                {formatKnockoutScore(selectedMatch)}。主队位置：
                {selectedMatch.left.team.id === selectedTeam.id ? selectedMatch.left.seed : selectedMatch.right.seed}；
                对手位置：{selectedOpponent.seed}。
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="champion-layout">
        <div className="module-block">
          <ModuleHeader icon={<Crown size={18} />} title="夺冠热门" helpKey="champion" openHelp={openHelp} />
          <div className="contender-list">
            {championAnalysis.contenders.slice(0, 10).map((contender, index) => (
              <div className={contender.team.id === selectedTeam.id ? "contender active" : "contender"} key={contender.team.id}>
                <span>{index + 1}</span>
                <strong>{contender.team.name}</strong>
                <div>
                  <b>{contender.champion}%</b>
                  <small>冠军</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="module-block">
          <ModuleHeader icon={<Route size={18} />} title="32 强投影对阵" helpKey="champion" openHelp={openHelp} />
          <div className="bracket-grid">
            {championAnalysis.projectedMatches.map((match) => (
              <div
                className={
                  [
                    "bracket-match",
                    match.lockedWinner ? "locked" : "",
                    match.left.team.id === selectedTeam.id || match.right.team.id === selectedTeam.id ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
                key={match.matchNo}
              >
                <span>M{match.matchNo}</span>
                <strong>{match.left.seed} · {match.left.team.shortName}</strong>
                <small>vs</small>
                <strong>{match.right.seed} · {match.right.team.shortName}</strong>
                <small className="match-result">{formatKnockoutScore(match)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function formatKnockoutScore(match: ChampionAnalysis["projectedMatches"][number]) {
  const actual = match.actual;
  if (!actual) return "当前投影，等待赛程落位";

  const home = teamLookup.get(actual.homeId);
  const away = teamLookup.get(actual.awayId);
  const label = `${actual.kickoff}${actual.note ? ` · ${actual.note}` : ""}`;

  if (actual.homeScore === null || actual.awayScore === null) {
    return `${label} · 待赛`;
  }

  const base = `${home?.shortName ?? actual.homeId} ${actual.homeScore}-${actual.awayScore} ${
    away?.shortName ?? actual.awayId
  }`;
  const penalties =
    actual.homePenalty !== null && actual.awayPenalty !== null ? `，点球 ${actual.homePenalty}-${actual.awayPenalty}` : "";
  const winner = match.lockedWinner ? `，${match.lockedWinner.shortName} 晋级` : "";

  return `${base}${penalties}${winner}`;
}

function GlossaryPage({
  terms,
  selectedTerm,
  setSelectedTermId,
  exportTermCard,
  openHelp,
}: {
  terms: typeof glossaryTerms;
  selectedTerm: (typeof glossaryTerms)[number];
  setSelectedTermId: (id: string) => void;
  exportTermCard: () => void;
  openHelp: (key: HelpKey) => void;
}) {
  const termCards = getTermCards(selectedTerm);

  return (
    <section className="page-stack">
      <div className="glossary-hero">
        <div className="glossary-copy">
          <div className="mini-label">
            <BookOpen size={16} />
            足球词典
          </div>
          <h1>把比赛里听不懂的词讲明白</h1>
          <p>点一个词，看直白解释和常见误解。后续改词也方便。</p>
          <div className="hero-actions">
            <button className="primary-button large" type="button" onClick={exportTermCard}>
              <Download size={18} />
              导出术语图
            </button>
            <CoachButton label="词典说明" onClick={() => openHelp("glossary")} />
          </div>
        </div>
      </div>

      <div className="glossary-layout">
        <section className="term-list" aria-label="术语列表">
          {terms.map((term) => (
            <button
              className={term.id === selectedTerm.id ? "term-button active" : "term-button"}
              key={term.id}
              type="button"
              onClick={() => setSelectedTermId(term.id)}
            >
              <span>{term.tag}</span>
              <strong>{term.term}</strong>
              <small>{term.short}</small>
            </button>
          ))}
        </section>

        <div className="term-showcase">
          <div className="term-gallery" aria-label={`${selectedTerm.term} 解说图片预览`}>
            {termCards.map((card, index) => (
              <section
                className={`term-card-preview variant-${index}`}
                key={card.label}
                style={{ "--term-bg": `url(${card.image})` } as CSSProperties}
              >
                <div className="term-card-top">
                  <span>{card.label}</span>
                  <strong>{selectedTerm.term}</strong>
                </div>
                <div className="term-card-copy">
                  <small>{selectedTerm.tag}</small>
                  <h2>{card.title}</h2>
                  <p>{card.body}</p>
                  <b>{card.note}</b>
                </div>
              </section>
            ))}
          </div>

          <section className="term-detail">
            <ModuleHeader icon={<Info size={18} />} title={selectedTerm.term} helpKey="glossary" openHelp={openHelp} />
            <p className="term-lead">{selectedTerm.plain}</p>
            <div className="term-example">
              <strong>比赛里通常会这样出现</strong>
              <p>{selectedTerm.example}</p>
            </div>
            <button className="ghost-button" type="button" onClick={exportTermCard}>
              <Download size={17} />
              下载这一张术语图
            </button>
          </section>
        </div>
      </div>
    </section>
  );
}

function PosterPage({
  selectedTeam,
  selectedStanding,
  probability,
  script,
  advice,
  exportTeamCard,
  exportTermCard,
  openHelp,
  setPage,
}: {
  selectedTeam: Team;
  selectedStanding: Standing;
  probability: Probability;
  script: FateScript;
  advice: RootingAdvice[];
  exportTeamCard: () => void;
  exportTermCard: () => void;
  openHelp: (key: HelpKey) => void;
  setPage: (page: PageId) => void;
}) {
  return (
    <section className="page-stack">
      <PageTitle
        eyebrow="Share cards"
        title="海报工坊"
        text="把当前主队结论或足球术语做成图片，方便发知乎内容。"
        helpKey="poster"
        openHelp={openHelp}
      />

      <div className="poster-layout">
        <section className="poster-preview team-poster">
          <div>
            <span>{script.badge}</span>
            <h2>{selectedTeam.name}</h2>
            <strong>{probability.qualify}%</strong>
            <p>当前第 {selectedStanding.rank} 名，{selectedStanding.points} 分，净胜球 {formatGoalDiff(selectedStanding.gd)}</p>
          </div>
          <button className="primary-button" type="button" onClick={exportTeamCard}>
            <Download size={17} />
            导出主队海报
          </button>
        </section>

        <section className="poster-preview term-poster">
          <div>
            <span>Football Glossary</span>
            <h2>足球词典图</h2>
            <p>适合解释越位、净胜球、最佳第三名这类新手高频问题。</p>
          </div>
          <div className="poster-actions">
            <button className="ghost-button" type="button" onClick={() => setPage("glossary")}>
              <BookOpen size={17} />
              选术语
            </button>
            <button className="primary-button" type="button" onClick={exportTermCard}>
              <Download size={17} />
              导出术语图
            </button>
          </div>
        </section>
      </div>

      <section className="module-block">
        <ModuleHeader icon={<Sparkles size={18} />} title="当前海报会包含" helpKey="poster" openHelp={openHelp} />
        <div className="poster-notes">
          <span>主队：{selectedTeam.name}</span>
          <span>晋级率：{probability.qualify}%</span>
          <span>状态：{script.title}</span>
          <span>建议关注：{advice[0]?.label ?? "暂无"}</span>
        </div>
      </section>
    </section>
  );
}

function TeamPicker({
  selectedGroupId,
  selectedTeamId,
  setSelectedTeamId,
}: {
  selectedGroupId: string;
  selectedTeamId: string;
  setSelectedTeamId: (teamId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeInitial, setActiveInitial] = useState<string>("all");
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const queryText = query.trim().toLowerCase();
  const initials = useMemo(() => Array.from(new Set(teams.map((team) => team.name[0]))).sort(), []);
  const visibleTeams = useMemo(() => {
    if (queryText) {
      return teams.filter((team) => getTeamSearchText(team).includes(queryText));
    }

    if (activeInitial !== "all") {
      return teams.filter((team) => team.name.startsWith(activeInitial));
    }

    return selectedGroup.teams;
  }, [activeInitial, queryText, selectedGroup.teams]);

  const modeLabel = queryText
    ? `搜索结果 · ${visibleTeams.length} 支`
    : activeInitial !== "all"
      ? `${activeInitial} 开头 · ${visibleTeams.length} 支`
      : `${selectedGroup.id} 组 · ${selectedGroup.nickname}`;

  const pickTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
  };

  return (
    <>
      <div className="team-search-panel">
        <label className="team-search" aria-label="搜索球队">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索球队名、缩写或中文名"
          />
        </label>
        <div className="selector-label">
          <span>首字母快速找队</span>
          <button
            className={activeInitial === "all" && !queryText ? "initial-tab active" : "initial-tab"}
            type="button"
            onClick={() => {
              setActiveInitial("all");
              setQuery("");
            }}
          >
            当前组
          </button>
        </div>
        <div className="initial-tabs" aria-label="按首字母选择球队">
          {initials.map((initial) => (
            <button
              className={activeInitial === initial && !queryText ? "initial-tab active" : "initial-tab"}
              key={initial}
              type="button"
              onClick={() => {
                setActiveInitial(initial);
                setQuery("");
              }}
            >
              {initial}
            </button>
          ))}
        </div>
        <p className="team-count">{modeLabel}</p>
      </div>

      <div className="group-tabs" role="tablist" aria-label="小组">
        {groups.map((group) => (
          <button
            className={group.id === selectedGroup.id ? "group-tab active" : "group-tab"}
            key={group.id}
            type="button"
            onClick={() => {
              setActiveInitial("all");
              setQuery("");
              pickTeam(group.teams[0].id);
            }}
          >
            {group.id}
          </button>
        ))}
      </div>
      <div className="team-list">
        {visibleTeams.length ? (
          visibleTeams.map((team) => (
            <button
              className={team.id === selectedTeamId ? "team-button active" : "team-button"}
              key={team.id}
              type="button"
              onClick={() => pickTeam(team.id)}
              style={{ "--team-a": team.colors[0], "--team-b": team.colors[1] } as CSSProperties}
            >
              <span className="kit-dot" />
              <span>
                <strong>{team.name}</strong>
                <small>{team.groupId} 组 · {team.shortName} · {team.vibe}</small>
              </span>
            </button>
          ))
        ) : (
          <div className="empty-state">没有找到这支队。可以试试英文名、三字母缩写或中文常用名。</div>
        )}
      </div>
    </>
  );
}

type ZhihuApiItem = {
  title: string;
  description: string;
  url: string;
  contentType: string;
  authorName: string;
  voteUpCount: number | null;
  commentCount: number | null;
};

type ZhihuApiState = {
  status: "loading" | "ready" | "fallback";
  items: ZhihuApiItem[];
  reason?: string;
};

function ZhihuBuzz({ selectedTeam }: { selectedTeam: Team }) {
  const topics = getZhihuTopics(selectedTeam);
  const primaryTopic = topics[0];
  const [apiState, setApiState] = useState<ZhihuApiState>({ status: "loading", items: [] });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ query: primaryTopic.query, count: "6" });

    setApiState({ status: "loading", items: [] });

    fetch(`/.netlify/functions/zhihu-search?${params.toString()}`)
      .then((response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        if (!contentType.includes("application/json")) throw new Error("LOCAL_FUNCTION_UNAVAILABLE");
        return response.json();
      })
      .then((payload: { ok?: boolean; items?: ZhihuApiItem[]; reason?: string }) => {
        if (cancelled) return;
        const items = Array.isArray(payload.items) ? payload.items.filter((item) => item.title && item.url) : [];
        setApiState(items.length ? { status: "ready", items } : { status: "fallback", items: [], reason: payload.reason });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setApiState({ status: "fallback", items: [], reason: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [primaryTopic.query]);

  const hasLiveItems = apiState.status === "ready" && apiState.items.length > 0;
  const panelBadge = apiState.status === "loading" ? "读取中" : hasLiveItems ? "API 接入" : "搜索兜底";

  return (
    <div className="zhihu-panel">
      <div className="zhihu-panel-head">
        <div>
          <p className="eyebrow">Zhihu Inside</p>
          <h3>{getTeamDisplayName(selectedTeam)} 的知乎站内讨论</h3>
        </div>
        <span>{panelBadge}</span>
      </div>
      <div className="zhihu-buzz">
        {hasLiveItems
          ? apiState.items.slice(0, 3).map((item) => (
              <a className="zhihu-card zhihu-live-card" href={item.url} key={item.url} target="_blank" rel="noreferrer">
                <span>{item.contentType || "知乎内容"}</span>
                <strong>{item.title}</strong>
                <small>{item.description || "来自知乎开放平台的站内搜索结果。"}</small>
                <b>
                  {formatZhihuMetric(item)}
                  <ExternalLink size={14} />
                </b>
              </a>
            ))
          : topics.map((topic) => (
              <a className="zhihu-card" href={topic.href} key={topic.query} target="_blank" rel="noreferrer">
                <span>{topic.tag}</span>
                <strong>{topic.title}</strong>
                <small>{topic.description}</small>
                <b>
                  去知乎看看
                  <ExternalLink size={14} />
                </b>
              </a>
            ))}
      </div>
      {hasLiveItems && (
        <div className="zhihu-search-row">
          {topics.slice(1).map((topic) => (
            <a href={topic.href} key={topic.query} target="_blank" rel="noreferrer">
              {topic.tag}
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      )}
      <p className="zhihu-note">
        {apiState.status === "loading"
          ? "正在通过服务端函数读取知乎开放平台；如果你在本地普通 Vite 预览，模块会自动退回到站内搜索入口。"
          : hasLiveItems
            ? "这些结果来自知乎开放平台 zhihu_search。Access Secret 只存在于 Netlify 环境变量里，不会暴露给浏览器。"
            : `未配置 ZHIHU_TOKEN 或接口暂时不可用时，会显示知乎站内搜索入口。${formatZhihuReason(apiState.reason)}`}
      </p>
    </div>
  );
}

function formatZhihuMetric(item: ZhihuApiItem) {
  const parts = [];
  if (item.authorName) parts.push(item.authorName);
  if (typeof item.voteUpCount === "number") parts.push(`${item.voteUpCount} 赞`);
  if (typeof item.commentCount === "number") parts.push(`${item.commentCount} 评论`);

  return parts.length ? parts.join(" · ") : "去知乎看看";
}

function formatZhihuReason(reason?: string) {
  if (!reason) return "";
  const reasonMap: Record<string, string> = {
    LOCAL_FUNCTION_UNAVAILABLE: "本地预览未启动 Netlify Function。",
    ZHIHU_TOKEN_NOT_CONFIGURED: "服务端还没有配置知乎 Access Secret。",
    ZHIHU_API_TIMEOUT: "知乎接口响应超时。",
    ZHIHU_API_FAILED: "知乎接口暂时不可用。",
    EMPTY_QUERY: "当前查询词为空。",
  };

  return `当前状态：${reasonMap[reason] ?? "知乎接口暂时不可用。"}`;
}

const teamAliases: Record<string, string> = {
  A1: "墨西哥",
  A2: "南非",
  A3: "韩国",
  A4: "捷克",
  B1: "加拿大",
  B2: "波黑 波斯尼亚 黑塞哥维那",
  B3: "卡塔尔",
  B4: "瑞士",
  C1: "巴西",
  C2: "摩洛哥",
  C3: "海地",
  C4: "苏格兰",
  D1: "美国",
  D2: "巴拉圭",
  D3: "澳大利亚",
  D4: "土耳其",
  E1: "德国",
  E2: "库拉索",
  E3: "科特迪瓦 象牙海岸",
  E4: "厄瓜多尔",
  F1: "荷兰",
  F2: "日本",
  F3: "瑞典",
  F4: "突尼斯",
  G1: "比利时",
  G2: "埃及",
  G3: "伊朗",
  G4: "新西兰",
  H1: "西班牙",
  H2: "佛得角",
  H3: "沙特 沙特阿拉伯",
  H4: "乌拉圭",
  I1: "法国",
  I2: "塞内加尔",
  I3: "伊拉克",
  I4: "挪威",
  J1: "阿根廷",
  J2: "阿尔及利亚",
  J3: "奥地利",
  J4: "约旦",
  K1: "葡萄牙",
  K2: "刚果民主共和国 民主刚果",
  K3: "乌兹别克斯坦",
  K4: "哥伦比亚",
  L1: "英格兰 英国",
  L2: "克罗地亚",
  L3: "加纳",
  L4: "巴拿马",
};

function getTeamSearchText(team: Team) {
  return `${team.name} ${team.shortName} ${team.groupId} ${teamAliases[team.id] ?? ""}`.toLowerCase();
}

function getTeamDisplayName(team: Team) {
  return (teamAliases[team.id]?.split(" ")[0] ?? team.name).trim();
}

function createZhihuSearchUrl(query: string) {
  return `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(query)}`;
}

function getZhihuTopics(team: Team) {
  const displayName = getTeamDisplayName(team);
  const teamQuery = `${displayName} 世界杯`;

  return [
    {
      tag: "主队讨论",
      title: `${displayName} 最近被怎么聊？`,
      description: "查看知乎站内关于这支队的问答、文章和想法。",
      query: teamQuery,
      href: createZhihuSearchUrl(teamQuery),
    },
    {
      tag: "出线争议",
      title: `${displayName} 出线形势`,
      description: "把模拟器里的概率和站内讨论放在一起看。",
      query: `${displayName} 出线 世界杯`,
      href: createZhihuSearchUrl(`${displayName} 出线 世界杯`),
    },
    {
      tag: "规则补课",
      title: "2026 扩军赛制",
      description: "第三名晋级、32 强路径、净胜球规则都可以继续查。",
      query: "2026 世界杯 扩军 赛制 最佳第三名",
      href: createZhihuSearchUrl("2026 世界杯 扩军 赛制 最佳第三名"),
    },
  ];
}

function ResultSummary({
  selectedTeam,
  probability,
  script,
  standings,
}: {
  selectedTeam: Team;
  probability: Probability;
  script: FateScript;
  standings: Standing[];
}) {
  const standing = standings.find((item) => item.team.id === selectedTeam.id) ?? standings[0];

  return (
    <div className="result-summary">
      <div className="score-circle" style={{ "--team-a": selectedTeam.colors[0], "--team-b": selectedTeam.colors[1] } as CSSProperties}>
        <strong>{Math.round(probability.qualify)}%</strong>
        <span>晋级率</span>
      </div>
      <div className="result-copy">
        <span className={`status-pill ${script.severity}`}>{severityText[script.severity]}</span>
        <h2>{script.title}</h2>
        <p>{script.punchline}</p>
        <div className="result-facts">
          <span>排名：第 {standing.rank}</span>
          <span>积分：{standing.points}</span>
          <span>净胜球：{formatGoalDiff(standing.gd)}</span>
        </div>
      </div>
    </div>
  );
}

function StandingsTable({
  standings,
  selectedTeamId,
  probabilities,
}: {
  standings: Standing[];
  selectedTeamId: string;
  probabilities: Map<string, Probability>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>球队</th>
            <th>赛</th>
            <th>分</th>
            <th>净</th>
            <th>晋级</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr className={standing.team.id === selectedTeamId ? "selected-row" : ""} key={standing.team.id}>
              <td>{standing.rank}</td>
              <td>
                <span className="team-cell">
                  <i style={{ background: standing.team.colors[0] }} />
                  {standing.team.shortName}
                </span>
              </td>
              <td>{standing.played}</td>
              <td>{standing.points}</td>
              <td>{formatGoalDiff(standing.gd)}</td>
              <td>{probabilities.get(standing.team.id)?.qualify ?? 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchRow({
  match,
  teamsById,
  selectedTeamId,
  onScore,
  onClear,
}: {
  match: Match;
  teamsById: Map<string, Team>;
  selectedTeamId: string;
  onScore: (matchId: string, side: "home" | "away", delta: number) => void;
  onClear: (matchId: string) => void;
}) {
  const home = teamsById.get(match.homeId)!;
  const away = teamsById.get(match.awayId)!;
  const active = match.homeId === selectedTeamId || match.awayId === selectedTeamId;

  return (
    <div className={active ? "match-row active" : "match-row"}>
      <div className="match-meta">
        <span>{match.kickoff}</span>
        <small>{match.note}</small>
      </div>
      <ScoreSide team={home} score={match.homeScore} side="home" matchId={match.id} onScore={onScore} />
      <span className={isFinished(match) ? "score-divider done" : "score-divider"}>vs</span>
      <ScoreSide team={away} score={match.awayScore} side="away" matchId={match.id} onScore={onScore} />
      <button className="icon-button" type="button" onClick={() => onClear(match.id)} aria-label="清空比分">
        <ListRestart size={15} />
      </button>
    </div>
  );
}

function ScoreSide({
  team,
  score,
  side,
  matchId,
  onScore,
}: {
  team: Team;
  score: number | null;
  side: "home" | "away";
  matchId: string;
  onScore: (matchId: string, side: "home" | "away", delta: number) => void;
}) {
  return (
    <div className="score-side" style={{ "--team-a": team.colors[0] } as CSSProperties}>
      <span className="team-short">{team.shortName}</span>
      <button className="mini-button" type="button" onClick={() => onScore(matchId, side, -1)} aria-label={`${team.shortName} 减一球`}>
        <Minus size={13} />
      </button>
      <strong>{score ?? "-"}</strong>
      <button className="mini-button" type="button" onClick={() => onScore(matchId, side, 1)} aria-label={`${team.shortName} 加一球`}>
        <Plus size={13} />
      </button>
    </div>
  );
}

function AdviceItem({ advice }: { advice: RootingAdvice }) {
  const outcome = advice.bestOutcome === "draw" ? "希望平局" : advice.bestOutcome === "home" ? "希望主胜" : "希望客胜";

  return (
    <article className="advice-item">
      <div>
        <span>{outcome}</span>
        <strong>{advice.label}</strong>
        <p>{advice.reason}</p>
      </div>
      <b className={advice.impact >= 0 ? "impact positive" : "impact"}>{formatImpact(advice.impact)}</b>
    </article>
  );
}

function PageTitle({
  eyebrow,
  title,
  text,
  helpKey,
  openHelp,
}: {
  eyebrow: string;
  title: string;
  text: string;
  helpKey: HelpKey;
  openHelp: (key: HelpKey) => void;
}) {
  return (
    <section className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <CoachButton label={`${title}说明`} onClick={() => openHelp(helpKey)} />
    </section>
  );
}

function ModuleHeader({
  icon,
  title,
  helpKey,
  openHelp,
}: {
  icon: ReactNode;
  title: string;
  helpKey: HelpKey;
  openHelp: (key: HelpKey) => void;
}) {
  return (
    <div className="module-header">
      <div>
        <span>{icon}</span>
        <h2>{title}</h2>
      </div>
      <CoachButton label={`${title}说明`} onClick={() => openHelp(helpKey)} />
    </div>
  );
}

function StepButton({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button className="step-button" type="button" onClick={onClick}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{text}</small>
      <ChevronRight size={18} />
    </button>
  );
}

function CoachButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="coach-button" type="button" onClick={onClick} aria-label={label} title={label}>
      <span className="coach-avatar">
        <img src="/liukanshan/coach-avatar.jpg" alt="刘看山" />
      </span>
      <span className="coach-copy">
        <strong>刘看山</strong>
        <small>解说</small>
      </span>
      <Wand2 size={14} />
    </button>
  );
}

function CoachModal({ helpKey, onClose }: { helpKey: HelpKey; onClose: () => void }) {
  const copy = helpCopy[helpKey];

  return (
    <div className="coach-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="coach-modal" role="dialog" aria-modal="true" aria-label={copy.title} onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" onClick={onClose} aria-label="关闭">
          <X size={18} />
        </button>
        <img src={copy.image} alt="刘看山解说员" />
        <div>
          <p className="eyebrow">刘看山解说</p>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <ul>
            {copy.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function downloadGlossaryCard(term: (typeof glossaryTerms)[number]) {
  const card = getTermCards(term)[0];
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const image = new Image();
  image.onload = () => {
    drawCoverImage(ctx, image, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(8, 13, 20, 0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    roundedRect(ctx, 70, 70, 940, 180, 28);
    ctx.fill();
    ctx.fillStyle = "#12312a";
    ctx.font = "900 62px Microsoft YaHei, Arial";
    ctx.fillText(term.term, 118, 150);
    ctx.font = "700 32px Microsoft YaHei, Arial";
    ctx.fillText(card.label, 122, 205);

    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    roundedRect(ctx, 70, 900, 940, 430, 32);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 58px Microsoft YaHei, Arial";
    wrapText(ctx, card.title, 118, 1005, 820, 70);
    ctx.fillStyle = "#15803d";
    ctx.font = "800 30px Microsoft YaHei, Arial";
    ctx.fillText(term.tag, 122, 1060);
    ctx.fillStyle = "#17212d";
    ctx.font = "500 34px Microsoft YaHei, Arial";
    wrapText(ctx, card.body, 118, 1138, 840, 52);
    ctx.fillStyle = "#475569";
    ctx.font = "500 28px Microsoft YaHei, Arial";
    wrapText(ctx, card.note, 118, 1265, 840, 42);

    const link = document.createElement("a");
    link.download = `${term.term}-football-glossary.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  image.src = card.image;
}

function drawCoverImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const x = (width - image.width * scale) / 2;
  const y = (height - image.height * scale) / 2;
  ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = "";
  let currentY = y;
  for (const char of text) {
    const trial = line + char;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

function formatGoalDiff(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatImpact(value: number) {
  return value > 0 ? `+${value}%` : `${value}%`;
}

const teamLookup = new Map(teams.map((team) => [team.id, team]));

const fallbackProbability: Probability = {
  qualify: 0,
  topTwo: 0,
  groupWinner: 0,
  thirdPlace: 0,
  avgPoints: 0,
  avgRank: 4,
};

export default App;
