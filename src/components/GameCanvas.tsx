"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "framer-motion";
import {
  createShooterGame,
  type BossMotionValues,
  type GameSnapshot,
  type ShooterGame
} from "@/game/shooterGame";

const initialSnapshot: GameSnapshot = {
  mode: "title",
  score: 0,
  highScore: 0,
  stage: 1,
  lives: 3,
  shields: 0,
  wave: 1,
  weaponPower: 1,
  missileCount: 0,
  combo: 0,
  rank: "D",
  bossHealth: 100,
  bossActive: false,
  devMode: false,
  audioMuted: false,
  message: "Press Enter to launch",
  runSummary: {
    time: 0,
    kills: 0,
    bosses: 0,
    maxCombo: 0,
    pickups: 0,
    hazardsDodged: 0,
    hazardsHit: 0,
    stageReached: 1,
    finalRank: "D",
    result: "In Progress"
  }
};

export default function GameCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<ShooterGame | null>(null);
  const devModeRef = useRef(false);
  const audioMutedRef = useRef(false);
  const bossMotionRef = useRef<BossMotionValues>({ pulse: 0, sway: 0, lunge: 0 });
  const bossPulse = useMotionValue(0);
  const bossSway = useMotionValue(0);
  const bossLunge = useMotionValue(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(initialSnapshot);

  function setDevMode(enabled: boolean) {
    devModeRef.current = enabled;
    setSnapshot((current) => ({ ...current, devMode: enabled }));
  }

  function setAudioMuted(enabled: boolean) {
    audioMutedRef.current = enabled;
    setSnapshot((current) => ({ ...current, audioMuted: enabled }));
  }

  useMotionValueEvent(bossPulse, "change", (value) => {
    bossMotionRef.current.pulse = value;
  });

  useMotionValueEvent(bossSway, "change", (value) => {
    bossMotionRef.current.sway = value;
  });

  useMotionValueEvent(bossLunge, "change", (value) => {
    bossMotionRef.current.lunge = value;
  });

  useEffect(() => {
    const pulseControls = animate(bossPulse, [0, 1, 0], {
      duration: 2.4,
      ease: "easeInOut",
      repeat: Infinity
    });
    const swayControls = animate(bossSway, [-1, 1, -1], {
      duration: 3.8,
      ease: "easeInOut",
      repeat: Infinity
    });
    const lungeControls = animate(bossLunge, [0, 1, 0], {
      duration: 0.95,
      ease: "easeInOut",
      repeat: Infinity,
      repeatDelay: 2.45,
      times: [0, 0.32, 1]
    });

    return () => {
      pulseControls.stop();
      swayControls.stop();
      lungeControls.stop();
    };
  }, [bossLunge, bossPulse, bossSway]);

  useEffect(() => {
    if (!mountRef.current || gameRef.current) {
      return;
    }

    let active = true;

    createShooterGame(
      mountRef.current,
      setSnapshot,
      () => devModeRef.current,
      () => audioMutedRef.current,
      () => bossMotionRef.current
    ).then((game) => {
      if (!active) {
        game.destroy();
        return;
      }
      gameRef.current = game;
    });

    return () => {
      active = false;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      gameRef.current?.handleKeyDown(event);
    }

    function handleKeyUp(event: KeyboardEvent) {
      gameRef.current?.handleKeyUp(event);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []);

  const showPanel = snapshot.mode !== "playing";
  const title =
    snapshot.mode === "victory"
      ? "Stage Clear"
      : snapshot.mode === "stageclear"
        ? "Stage 1 Clear"
        : snapshot.mode === "gameover"
          ? "Game Over"
          : "Astra Lance";
  const actionText = snapshot.mode === "stageclear" ? "continue to stage 2" : snapshot.mode === "title" ? "start" : "restart";
  const showSummary = snapshot.mode === "gameover" || snapshot.mode === "victory";
  const summaryItems = [
    ["Result", snapshot.runSummary.result],
    ["Final Score", String(snapshot.score)],
    ["Stage", String(snapshot.runSummary.stageReached)],
    ["Rank", snapshot.runSummary.finalRank],
    ["Time", formatTime(snapshot.runSummary.time)],
    ["Kills", String(snapshot.runSummary.kills)],
    ["Bosses", String(snapshot.runSummary.bosses)],
    ["Max Combo", String(snapshot.runSummary.maxCombo)],
    ["Pickups", String(snapshot.runSummary.pickups)],
    ["Hazards Dodged", String(snapshot.runSummary.hazardsDodged)],
    ["Hazard Hits", String(snapshot.runSummary.hazardsHit)]
  ];

  return (
    <div className="gameMount" ref={mountRef}>
      <div className="hudOverlay">
        <div className="hudTop">
          <div className="hudGroup">
            <div className="pill">
              Score <strong>{snapshot.score}</strong>
            </div>
            <div className="pill">
              Best <strong>{snapshot.highScore}</strong>
            </div>
            <div className="pill">
              Lives <strong>{snapshot.lives}</strong>
            </div>
            <div className="pill">
              Shield <strong>{snapshot.shields}</strong>
            </div>
            <div className="pill">
              Weapon <strong>{snapshot.weaponPower}</strong>
            </div>
            <div className="pill">
              Missile <strong>{snapshot.missileCount}</strong>
            </div>
            <div className="pill">
              Combo <strong>{snapshot.combo}</strong>
            </div>
            <div className="pill">
              Rank <strong>{snapshot.rank}</strong>
            </div>
          </div>
          <div className="pill">
            S{snapshot.stage} W<strong>{snapshot.wave}</strong>
          </div>
          <button
            className={`hudButton ${snapshot.audioMuted ? "isOn" : ""}`}
            type="button"
            aria-pressed={snapshot.audioMuted}
            onClick={() => setAudioMuted(!snapshot.audioMuted)}
          >
            Sound <strong>{snapshot.audioMuted ? "Off" : "On"}</strong>
          </button>
        </div>
        <div className="hudBottom">
          <div className="hint">WASD/Arrows move. Space fires. Shift focuses. P pauses.</div>
          {snapshot.bossActive ? (
            <div className="pill">
              Boss <strong>{Math.max(0, Math.ceil(snapshot.bossHealth))}%</strong>
            </div>
          ) : null}
        </div>
      </div>

      {showPanel ? (
        <div className="statusPanel">
          <div className="statusPanelInner">
            <h1>{title}</h1>
            <p>{snapshot.message}</p>
            {showSummary ? (
              <div className="summaryGrid" aria-label="Run summary">
                {summaryItems.map(([label, value]) => (
                  <div className="summaryItem" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              className={`menuToggle ${snapshot.devMode ? "isOn" : ""}`}
              type="button"
              aria-pressed={snapshot.devMode}
              onClick={() => setDevMode(!snapshot.devMode)}
            >
              Invincible Dev Mode <strong>{snapshot.devMode ? "On" : "Off"}</strong>
            </button>
            <button
              className={`menuToggle ${snapshot.audioMuted ? "isOn" : ""}`}
              type="button"
              aria-pressed={snapshot.audioMuted}
              onClick={() => setAudioMuted(!snapshot.audioMuted)}
            >
              Sound <strong>{snapshot.audioMuted ? "Off" : "On"}</strong>
            </button>
            <p>
              Press <span className="accent">Enter</span> to {actionText}.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
