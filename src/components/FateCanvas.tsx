import { useEffect, useRef } from "react";
import type { Group, Team } from "../data/tournament";
import type { Probability } from "../lib/simulation";

type FateCanvasProps = {
  groups: Group[];
  selectedTeam: Team;
  probabilities: Map<string, Probability>;
  volatility: number;
};

export default function FateCanvas({ groups, selectedTeam, probabilities, volatility }: FateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let animation = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(context, rect.width, rect.height, groups, selectedTeam, probabilities, volatility, frame);
      frame += 1;
      animation = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animation);
  }, [groups, probabilities, selectedTeam, volatility]);

  return <canvas className="fate-canvas" ref={canvasRef} aria-label="出线概率星图" />;
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groups: Group[],
  selectedTeam: Team,
  probabilities: Map<string, Probability>,
  volatility: number,
  frame: number,
) {
  const [primary, secondary] = selectedTeam.colors;
  ctx.clearRect(0, 0, width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#15201a");
  bg.addColorStop(0.48, "#17212d");
  bg.addColorStop(1, "#211918");
  ctx.fillStyle = bg;
  roundedRect(ctx, 0, 0, width, height, 8);
  ctx.fill();

  drawPitch(ctx, width, height);
  drawProbabilityWeb(ctx, width, height, groups, selectedTeam, probabilities, frame);
  drawSelectedCore(ctx, width, height, selectedTeam, probabilities.get(selectedTeam.id)?.qualify ?? 0, primary, secondary, volatility, frame);
}

function drawPitch(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 36; x < width; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 60, height);
    ctx.stroke();
  }
  for (let y = 28; y < height; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + 30);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  roundedRect(ctx, 20, 20, width - 40, height - 40, 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawProbabilityWeb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  groups: Group[],
  selectedTeam: Team,
  probabilities: Map<string, Probability>,
  frame: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.min(width, height) * 0.38;
  groups.forEach((group, groupIndex) => {
    const angle = (Math.PI * 2 * groupIndex) / groups.length - Math.PI / 2;
    const gx = cx + Math.cos(angle) * outer;
    const gy = cy + Math.sin(angle) * outer;
    const groupProbability =
      group.teams.reduce((sum, team) => sum + (probabilities.get(team.id)?.qualify ?? 0), 0) / group.teams.length;

    ctx.strokeStyle = group.id === selectedTeam.groupId ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = group.id === selectedTeam.groupId ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(gx, gy);
    ctx.stroke();

    group.teams.forEach((team, teamIndex) => {
      const teamAngle = angle + (teamIndex - 1.5) * 0.1;
      const pulse = Math.sin(frame / 22 + teamIndex + groupIndex) * 2;
      const probability = probabilities.get(team.id)?.qualify ?? 0;
      const radius = 4 + probability / 18 + pulse * 0.18;
      const tx = gx + Math.cos(teamAngle) * (16 + teamIndex * 7);
      const ty = gy + Math.sin(teamAngle) * (16 + teamIndex * 7);
      ctx.fillStyle = team.id === selectedTeam.id ? team.colors[1] : `rgba(255,255,255,${0.34 + probability / 180})`;
      ctx.beginPath();
      ctx.arc(tx, ty, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 11px Inter, Arial";
    ctx.fillText(`${group.id}${Math.round(groupProbability)}`, gx - 12, gy - 18);
  });
}

function drawSelectedCore(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  team: Team,
  probability: number,
  primary: string,
  secondary: string,
  volatility: number,
  frame: number,
) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.15;
  const ring = radius + Math.sin(frame / 18) * 3;

  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, ring * 2.5);
  halo.addColorStop(0, withAlpha(primary, 0.52));
  halo.addColorStop(0.55, withAlpha(secondary, 0.17));
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, ring * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (probability / 100));
  ctx.stroke();

  ctx.strokeStyle = withAlpha(secondary, 0.85);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 16 + volatility * 0.04, frame / 70, Math.PI * 1.3 + frame / 70);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Inter, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(probability)}%`, cx, cy + 4);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "700 13px Inter, Arial";
  ctx.fillText(team.shortName, cx, cy + 30);
  ctx.textAlign = "start";
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

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
