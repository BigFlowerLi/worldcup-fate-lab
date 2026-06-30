import type { Team } from "../data/tournament";
import type { FateScript, Probability, RootingAdvice } from "./simulation";
import type { Standing } from "./tournament";

export function downloadShareCard(
  team: Team,
  standing: Standing,
  probability: Probability,
  script: FateScript,
  advice: RootingAdvice[],
) {
  const canvas = document.createElement("canvas");
  const width = 1080;
  const height = 1440;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const [primary, secondary] = team.colors;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#101820");
  gradient.addColorStop(0.45, mix(primary, "#101820", 0.46));
  gradient.addColorStop(1, mix(secondary, "#101820", 0.52));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  drawPitchLines(ctx, width, height);
  drawColorBands(ctx, primary, secondary, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundedRect(ctx, 78, 90, 924, 1260, 36);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 78px Microsoft YaHei, PingFang SC, Arial";
  ctx.fillText("主队还有救吗？", 118, 190);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "500 34px Microsoft YaHei, Arial";
  ctx.fillText("世界杯出线命运实验室", 122, 245);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 96px Microsoft YaHei, Arial";
  ctx.fillText(team.name, 118, 390);

  ctx.fillStyle = secondary;
  ctx.font = "900 170px Arial";
  ctx.fillText(`${Math.round(probability.qualify)}`, 118, 575);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 54px Arial";
  ctx.fillText("%", 345, 548);
  ctx.font = "600 34px Microsoft YaHei, Arial";
  ctx.fillText("模拟晋级率", 122, 625);

  ctx.fillStyle = "rgba(255,255,255,0.11)";
  roundedRect(ctx, 560, 300, 330, 300, 28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px Microsoft YaHei, Arial";
  ctx.fillText(`第 ${standing.rank} 名`, 600, 375);
  ctx.font = "700 34px Microsoft YaHei, Arial";
  ctx.fillText(`${standing.points} 分`, 600, 442);
  ctx.fillText(`净胜球 ${standing.gd > 0 ? "+" : ""}${standing.gd}`, 600, 505);
  ctx.fillStyle = "rgba(255,255,255,0.66)";
  ctx.font = "500 26px Microsoft YaHei, Arial";
  ctx.fillText(`前二 ${probability.topTwo}%`, 600, 555);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 44px Microsoft YaHei, Arial";
  wrapText(ctx, script.title, 118, 735, 820, 58);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "500 32px Microsoft YaHei, Arial";
  wrapText(ctx, script.punchline, 118, 825, 820, 44);

  const topAdvice = advice.slice(0, 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  roundedRect(ctx, 118, 1015, 844, 205, 26);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 30px Microsoft YaHei, Arial";
  ctx.fillText("今晚临时支持对象", 154, 1070);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "500 28px Microsoft YaHei, Arial";
  if (topAdvice.length) {
    topAdvice.forEach((item, index) => {
      ctx.fillText(`${index + 1}. ${item.label}：${item.reason}`, 154, 1125 + index * 48);
    });
  } else {
    ctx.fillText("小组算盘暂时打完，去最佳第三名榜单蹲消息。", 154, 1125);
  }

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = "500 24px Microsoft YaHei, Arial";
  ctx.fillText("World Cup Fate Lab · Vibe Coding Challenge", 118, 1304);

  const link = document.createElement("a");
  link.download = `${team.shortName}-fate-card.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function drawPitchLines(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.lineWidth = 4;
  for (let y = 100; y < height; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + 40);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 210, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  ctx.restore();
}

function drawColorBands(ctx: CanvasRenderingContext2D, primary: string, secondary: string, width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.fillStyle = primary;
  ctx.beginPath();
  ctx.moveTo(width * 0.72, 0);
  ctx.lineTo(width, 0);
  ctx.lineTo(width, height * 0.38);
  ctx.lineTo(width * 0.58, height * 0.16);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(0, height * 0.8);
  ctx.lineTo(width * 0.34, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
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

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a: string, b: string, amount: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const next = ca.map((value, index) => Math.round(value * (1 - amount) + cb[index] * amount));
  return `rgb(${next[0]}, ${next[1]}, ${next[2]})`;
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
