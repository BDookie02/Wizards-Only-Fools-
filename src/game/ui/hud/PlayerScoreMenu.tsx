import { useMemo } from "react";
import type { PlayerState } from "../../../store/gameStore";
import { buildScoreboardRows } from "./playerScoreRows";
import { useHudBuffClock } from "./useHudBuffClock";

export type ScoreboardRow = {
  id: string;
  label: string;
  status: string;
  health: number;
  armor: number;
  score: number;
  isLocal?: boolean;
};

function getScoreRowClass(isLocal?: boolean) {
  const base = "player-score-row grid grid-cols-[1.35fr_1fr_0.55fr_0.65fr_0.6fr] gap-2 border px-2 py-1.5 text-[10px] tracking-widest";
  return isLocal
    ? `${base} border-yellow-200/55 bg-yellow-200/10 text-yellow-50 shadow-[0_0_14px_rgba(250,204,21,0.18)]`
    : `${base} border-cyan-200/20 bg-cyan-400/5 text-cyan-100/85`;
}

type PlayerScoreMenuProps = {
  localPlayerName: string;
  isSurvivalMode: boolean;
  survivalLevel: number;
  health: number;
  armor: number;
  sleepUntil: number;
  slowUntil: number;
  poisonUntil: number;
  acidUntil: number;
  players: Record<string, PlayerState>;
};

export function PlayerScoreMenu({
  localPlayerName,
  isSurvivalMode,
  survivalLevel,
  health,
  armor,
  sleepUntil,
  slowUntil,
  poisonUntil,
  acidUntil,
  players,
}: PlayerScoreMenuProps) {
  const now = useHudBuffClock({
    speedBoostUntil: 0,
    jumpBoostUntil: 0,
    slowUntil,
    sleepUntil,
    poisonUntil,
    acidUntil,
    magicGlassOrbUntil: 0,
  });
  const rows = useMemo(() => buildScoreboardRows({
    localPlayerName,
    isSurvivalMode,
    survivalLevel,
    health,
    armor,
    sleepSeconds: Math.ceil(Math.max(0, sleepUntil - now) / 1000),
    slowSeconds: Math.ceil(Math.max(0, slowUntil - now) / 1000),
    poisonSeconds: Math.ceil(Math.max(0, poisonUntil - now) / 1000),
    acidSeconds: Math.ceil(Math.max(0, acidUntil - now) / 1000),
    players,
    now,
  }), [
    acidUntil,
    armor,
    health,
    isSurvivalMode,
    localPlayerName,
    now,
    players,
    poisonUntil,
    sleepUntil,
    slowUntil,
    survivalLevel,
  ]);

  return (
    <div className="player-score-menu absolute inset-0 z-[160] flex items-start justify-center px-4 pt-[8dvh] pointer-events-none">
      <div
        data-wof-hud-qa="scoreboard-menu"
        className="player-score-panel border border-cyan-200/60 bg-[#090510]/78 p-3 text-cyan-50 shadow-[0_0_35px_rgba(34,211,238,0.38)] backdrop-blur-sm"
        style={{ width: "min(760px, calc(var(--app-vw, 100dvw) - 28px))" }}
      >
        <div className="player-score-header mb-3 flex items-center justify-between gap-3 border-b border-cyan-200/30 pb-2">
          <div className="player-score-title-block min-w-0">
            <div className="player-score-kicker text-[9px] tracking-[0.35em] text-cyan-200/70">ARENA ROSTER</div>
            <div className="player-score-title text-xl tracking-[0.16em] text-white">PLAYER LIST / SCORE</div>
          </div>
          <div className="player-score-hint text-right text-[8px] tracking-widest text-cyan-100/55">
            HOLD TAB / SELECT
          </div>
        </div>

        <div className="player-score-row player-score-headings grid grid-cols-[1.35fr_1fr_0.55fr_0.65fr_0.6fr] gap-2 border-b border-cyan-200/25 pb-1 text-[8px] tracking-[0.18em] text-cyan-100/55">
          <span>PLAYER</span>
          <span>STATE</span>
          <span className="text-right">HP</span>
          <span className="text-right">
            <span className="player-score-label-full">ARMOR</span>
            <span className="player-score-label-short">ARM</span>
          </span>
          <span className="text-right">
            <span className="player-score-label-full">SCORE</span>
            <span className="player-score-label-short">PWR</span>
          </span>
        </div>

        <div className="mt-1 flex flex-col gap-1">
          {rows.map((row) => (
            <div key={row.id} className={getScoreRowClass(row.isLocal)}>
              <span className="truncate">{row.label}</span>
              <span className="truncate">{row.status}</span>
              <span className="text-right">{Math.round(row.health)}</span>
              <span className="text-right">{Math.round(row.armor)}</span>
              <span className="text-right">{row.score}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-cyan-200/20 pt-2 text-[8px] tracking-widest text-cyan-100/45">
          SCORE IS CURRENT BATTLE POWER UNTIL KILL TRACKING IS ADDED
        </div>
      </div>
    </div>
  );
}
