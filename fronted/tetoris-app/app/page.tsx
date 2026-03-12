"use client"
import { useState, useEffect, useCallback, useRef } from "react";

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const TICK_SPEED = 500;

// テトリスの形の定義と色
const TETROMINOES: Record<string, { shape: number[][]; color: string }> = {
  I: { shape: [[1,1,1,1]], color: "#00f5ff" },
  O: { shape: [[1,1],[1,1]], color: "#ffe500" },
  T: { shape: [[0,1,0],[1,1,1]], color: "#bf00ff" },
  S: { shape: [[0,1,1],[1,1,0]], color: "#00ff7f" },
  Z: { shape: [[1,1,0],[0,1,1]], color: "#ff3131" },
  J: { shape: [[1,0,0],[1,1,1]], color: "#ff8c00" },
  L: { shape: [[0,0,1],[1,1,1]], color: "#0080ff" },
};

// I, O, T, S, Z, J, L
const KEYS: string[] = Object.keys(TETROMINOES);

// ボードの作成、初期化
const createBoard = () =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));

// ランダムなミノを生成
const randomTetromino = () => {
  const key = KEYS[Math.floor(Math.random() * KEYS.length)];
  return { type: key, ...TETROMINOES[key] };
};

// ミノの回転（90度時計回り）
const rotate = (matrix: number[][]): number[][] =>
  matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());

// ミノが指定位置に置けるかの判定(game overの判定も)
const isValid = (board: (string | null)[][], shape: number[][], pos: { x: number; y: number }): boolean =>{
  // ミノの全てのセルについて、ボード上の対応する位置が空いているかをチェック
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nr = pos.y + r;
      const nc = pos.x + c;
      if (nr >= BOARD_HEIGHT || nc < 0 || nc >= BOARD_WIDTH) return false;
      if (nr >= 0 && board[nr][nc]) return false;
    }
  }
  return true;
};

// ミノをボードに固定する（置く）
const merge = (board: (string | null)[][], shape: number[][], pos: { x: number; y: number }, color: string): (string | null)[][] => {
  // ボードをコピーしてからミノを置く
  const newBoard: (string | null)[][] = board.map((row) => [...row]);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c] && pos.y + r >= 0) {
        newBoard[pos.y + r][pos.x + c] = color;
      }
    }
  }
  return newBoard;
};

// ラインが揃っているかの判定と、揃っていたら消す
const clearLines = (board: (string | null)[][]): { board: (string | null)[][]; cleared: number } => {
  const newBoard = board.filter((row) => row.some((cell) => !cell));
  const cleared = BOARD_HEIGHT - newBoard.length;
  const empty = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null));
  return { board: [...empty, ...newBoard], cleared };
};

// 消したライン数に応じたスコア
const SCORES = [0, 100, 300, 500, 800];

export default function Tetris() {
  // ゲームの状態を管理するためのReactの状態と参照(useStateで状態を変更して再レンダリング、useRefで値を保持してイベントハンドラやタイマーで使用)
  const [board, setBoard] = useState<(string | null)[][]>(createBoard());
  const [current, setCurrent] = useState<ReturnType<typeof randomTetromino> | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [next, setNext] = useState<ReturnType<typeof randomTetromino> | null>(null);
  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [started, setStarted] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [flash, setFlash] = useState<boolean>(false);

  const boardRef = useRef<(string | null)[][]>(board);
  const currentRef = useRef<ReturnType<typeof randomTetromino> | null>(current);
  const posRef = useRef<{ x: number; y: number }>(pos);
  const pausedRef = useRef<boolean>(paused);
  const gameOverRef = useRef<boolean>(gameOver);

  boardRef.current = board;
  currentRef.current = current;
  posRef.current = pos;
  pausedRef.current = paused;
  gameOverRef.current = gameOver;

  // ミノをスポーンさせる関数。次のミノを引数で受け取ることもできる（ライン消去後の呼び出し用）
  const spawnPiece = useCallback((nextPiece: ReturnType<typeof randomTetromino> | null, brd: (string | null)[][] ): void => {
    const piece: ReturnType<typeof randomTetromino> = nextPiece || randomTetromino();
    const spawnPos = { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2), y: -1 };
    if (!isValid(brd, piece.shape, spawnPos)) {
      setGameOver(true);
      return;
    }
    setCurrent(piece);
    setPos(spawnPos);
    setNext(randomTetromino());
  }, []);

  const startGame = useCallback(() => {
    const freshBoard = createBoard();
    setBoard(freshBoard);
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    const first = randomTetromino();
    const nx = randomTetromino();
    setNext(nx);
    const sp = { x: Math.floor(BOARD_WIDTH / 2) - Math.floor(first.shape[0].length / 2), y: -1 };
    setCurrent(first);
    setPos(sp);
    setStarted(true);
  }, []);

  const lockPiece = useCallback((brd, piece, p) => {
    const merged = merge(brd, piece.shape, p, piece.color);
    const { board: cleared, cleared: count } = clearLines(merged);
    if (count > 0) {
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }
    setScore((s) => s + SCORES[count] * level);
    setLines((l) => {
      const nl = l + count;
      setLevel(Math.floor(nl / 10) + 1);
      return nl;
    });
    setBoard(cleared);
    spawnPiece(null, cleared);
  }, [level, spawnPiece]);

  // Tick
  useEffect(() => {
    if (!started || gameOver || paused || !current) return;
    const speed = Math.max(100, TICK_SPEED - (level - 1) * 40);
    const id = setInterval(() => {
      const newPos = { ...posRef.current, y: posRef.current.y + 1 };
      if (isValid(boardRef.current, currentRef.current.shape, newPos)) {
        setPos(newPos);
      } else {
        lockPiece(boardRef.current, currentRef.current, posRef.current);
      }
    }, speed);
    return () => clearInterval(id);
  }, [started, gameOver, paused, current, level, lockPiece]);

  // Keys
  useEffect(() => {
    const handle = (e) => {
      if (!started || gameOverRef.current || pausedRef.current) return;
      const b = boardRef.current;
      const c = currentRef.current;
      const p = posRef.current;
      if (!c) return;
      if (e.key === "ArrowLeft") {
        const np = { ...p, x: p.x - 1 };
        if (isValid(b, c.shape, np)) setPos(np);
      } else if (e.key === "ArrowRight") {
        const np = { ...p, x: p.x + 1 };
        if (isValid(b, c.shape, np)) setPos(np);
      } else if (e.key === "ArrowDown") {
        const np = { ...p, y: p.y + 1 };
        if (isValid(b, c.shape, np)) setPos(np);
        else lockPiece(b, c, p);
      } else if (e.key === "ArrowUp") {
        const rotated = rotate(c.shape);
        if (isValid(b, rotated, p)) setCurrent({ ...c, shape: rotated });
      } else if (e.key === " ") {
        e.preventDefault();
        let np = { ...p };
        while (isValid(b, c.shape, { ...np, y: np.y + 1 })) np.y++;
        lockPiece(b, c, np);
      } else if (e.key === "p" || e.key === "P") {
        setPaused((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [started, lockPiece]);

  // Ghost piece
  const ghostPos = (() => {
    if (!current || !started) return null;
    let gp = { ...pos };
    while (isValid(board, current.shape, { ...gp, y: gp.y + 1 })) gp.y++;
    return gp;
  })();

  // Render board with current + ghost
  const displayBoard = board.map((row) => [...row]);
  if (current && ghostPos) {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          const gr = ghostPos.y + r;
          const gc = ghostPos.x + c;
          if (gr >= 0 && gr < BOARD_HEIGHT && !displayBoard[gr][gc]) {
            displayBoard[gr][gc] = "ghost";
          }
        }
      }
    }
  }
  if (current) {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          const br = pos.y + r;
          const bc = pos.x + c;
          if (br >= 0 && br < BOARD_HEIGHT) displayBoard[br][bc] = current.color;
        }
      }
    }
  }

  const nextBoard = Array.from({ length: 4 }, () => Array(4).fill(null));
  if (next) {
    const offR = Math.floor((4 - next.shape.length) / 2);
    const offC = Math.floor((4 - next.shape[0].length) / 2);
    next.shape.forEach((row, r) =>
      row.forEach((v, c) => { if (v) nextBoard[offR + r][offC + c] = next.color; })
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Scanlines overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 10,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
      }} />
      {/* CRT glow */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9,
        background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%)",
      }} />

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", zIndex: 20 }}>
        {/* Main board */}
        <div style={{
          border: "2px solid #00f5ff",
          boxShadow: flash
            ? "0 0 40px #fff, 0 0 80px #00f5ff inset"
            : "0 0 20px #00f5ff55, 0 0 40px #00f5ff22 inset",
          transition: "box-shadow 0.1s",
          background: "#050510",
          padding: "4px",
        }}>
          {displayBoard.map((row, r) => (
            <div key={r} style={{ display: "flex" }}>
              {row.map((cell, c) => (
                <div key={c} style={{
                  width: 28, height: 28,
                  background: cell === "ghost"
                    ? "rgba(255,255,255,0.07)"
                    : cell
                    ? cell
                    : "rgba(255,255,255,0.02)",
                  border: cell === "ghost"
                    ? "1px solid rgba(255,255,255,0.15)"
                    : cell
                    ? `1px solid ${cell}88`
                    : "1px solid rgba(255,255,255,0.04)",
                  boxSizing: "border-box",
                  boxShadow: cell && cell !== "ghost"
                    ? `0 0 8px ${cell}88, inset 0 0 4px ${cell}44`
                    : "none",
                  transition: "background 0.05s",
                }} />
              ))}
            </div>
          ))}
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 140 }}>
          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 28, fontWeight: 900, letterSpacing: 8,
              color: "#00f5ff",
              textShadow: "0 0 10px #00f5ff, 0 0 30px #00f5ff88",
            }}>TETRIS</div>
            <div style={{ fontSize: 10, color: "#ffffff44", letterSpacing: 4, marginTop: 2 }}>ARCADE</div>
          </div>

          {/* Score */}
          {[
            { label: "SCORE", value: score.toString().padStart(6, "0") },
            { label: "LINES", value: lines.toString().padStart(4, "0") },
            { label: "LEVEL", value: level.toString().padStart(2, "0") },
          ].map(({ label, value }) => (
            <div key={label} style={{
              border: "1px solid #00f5ff44",
              background: "#050510",
              padding: "10px 14px",
              boxShadow: "0 0 10px #00f5ff22",
            }}>
              <div style={{ fontSize: 9, color: "#00f5ff88", letterSpacing: 3, marginBottom: 4 }}>{label}</div>
              <div style={{
                fontSize: 22, color: "#fff",
                textShadow: "0 0 8px #00f5ff",
                fontVariantNumeric: "tabular-nums",
              }}>{value}</div>
            </div>
          ))}

          {/* Next */}
          <div style={{
            border: "1px solid #00f5ff44",
            background: "#050510",
            padding: "10px 14px",
            boxShadow: "0 0 10px #00f5ff22",
          }}>
            <div style={{ fontSize: 9, color: "#00f5ff88", letterSpacing: 3, marginBottom: 8 }}>NEXT</div>
            <div style={{ display: "inline-block" }}>
              {nextBoard.map((row, r) => (
                <div key={r} style={{ display: "flex" }}>
                  {row.map((cell, c) => (
                    <div key={c} style={{
                      width: 18, height: 18,
                      background: cell || "transparent",
                      border: cell ? `1px solid ${cell}88` : "none",
                      boxShadow: cell ? `0 0 6px ${cell}88` : "none",
                      boxSizing: "border-box",
                    }} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          {!started || gameOver ? (
            <button onClick={startGame} style={{
              background: "transparent",
              border: "2px solid #00f5ff",
              color: "#00f5ff",
              fontFamily: "inherit",
              fontSize: 13,
              letterSpacing: 3,
              padding: "12px 0",
              cursor: "pointer",
              textShadow: "0 0 8px #00f5ff",
              boxShadow: "0 0 14px #00f5ff44",
              transition: "all 0.2s",
            }}
              onMouseEnter={e => e.target.style.background = "#00f5ff22"}
              onMouseLeave={e => e.target.style.background = "transparent"}
            >
              {gameOver ? "RETRY" : "START"}
            </button>
          ) : (
            <button onClick={() => setPaused(p => !p)} style={{
              background: "transparent",
              border: `2px solid ${paused ? "#ffe500" : "#00f5ff44"}`,
              color: paused ? "#ffe500" : "#00f5ff44",
              fontFamily: "inherit",
              fontSize: 11,
              letterSpacing: 2,
              padding: "10px 0",
              cursor: "pointer",
            }}>
              {paused ? "▶ RESUME" : "⏸ PAUSE"}
            </button>
          )}

          {/* Game over overlay */}
          {gameOver && (
            <div style={{
              fontSize: 13, color: "#ff3131",
              textShadow: "0 0 10px #ff3131",
              textAlign: "center", letterSpacing: 2,
            }}>GAME OVER</div>
          )}
          {paused && !gameOver && (
            <div style={{
              fontSize: 11, color: "#ffe500",
              textShadow: "0 0 8px #ffe500",
              textAlign: "center", letterSpacing: 2,
            }}>PAUSED</div>
          )}

          {/* Keys hint */}
          <div style={{ fontSize: 9, color: "#ffffff22", letterSpacing: 1, lineHeight: 1.8 }}>
            <div>← → 移動</div>
            <div>↑ 回転</div>
            <div>↓ 落下</div>
            <div>SPACE ドロップ</div>
            <div>P ポーズ</div>
          </div>
        </div>
      </div>
    </div>
  );
}