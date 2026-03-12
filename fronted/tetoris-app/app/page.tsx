import { useState, useEffect, useRef, useCallback } from "react";

// 型定義
type Cell = string | null;
type Board = Cell[][];
type Shape = number[][];

interface Piece {
  shape: Shape;
  color: string;
  x: number;
  y: number;
}

// 定数
const Width = 10;
const Height = 20;

// ミノの形と色
const MINOS: { shape: Shape; color: string }[] = [
  { shape: [[1,1,1,1]],         color: "#00f5ff" }, // I
  { shape: [[1,1],[1,1]],       color: "#ffe500" }, // O
  { shape: [[0,1,0],[1,1,1]],   color: "#bf00ff" }, // T
  { shape: [[0,1,1],[1,1,0]],   color: "#00ff7f" }, // S
  { shape: [[1,1,0],[0,1,1]],   color: "#ff3131" }, // Z
  { shape: [[1,0,0],[1,1,1]],   color: "#0080ff" }, // J
  { shape: [[0,0,1],[1,1,1]],   color: "#ff8c00" }, // L
];

// 純粋関数
// 空のボードを生成
const emptyBoard = (): Board =>
  Array.from({ length: Height }, () => Array(Width).fill(null));

// ランダムなピースを生成（初期位置は上中央）
const randomPiece = (): Piece => {
  const p = MINOS[Math.floor(Math.random() * MINOS.length)];
  return { ...p, x: Math.floor(Width / 2) - Math.floor(p.shape[0].length / 2), y: -1 };
};

// ピースを90度回転
const rotate = (shape: Shape): Shape =>
  shape[0].map((_, c) => shape.map((row) => row[c]).reverse());

// ピースがボード上の位置に収まるか(収まらなければgame over)
const fits = (board: Board, shape: Shape, x: number, y: number): boolean => {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      if (y + r >= Height || x + c < 0 || x + c >= Width) return false;
      if (y + r >= 0 && board[y + r][x + c]) return false;
    }
  return true;
};

// ピースをボードに固定
const place = (board: Board, mino: Piece): Board => {
  const b = board.map((row) => [...row]);
  mino.shape.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell && mino.y + r >= 0) b[mino.y + r][mino.x + c] = mino.color;
    })
  );
  return b;
};

// ラインを消去
const sweep = (board: Board): { board: Board; cleared: number } => {
  const kept = board.filter((row) => row.some((c) => !c));
  const cleared = Height - kept.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array(Width).fill(null)), ...kept],
    cleared,
  };
};

// コンポーネント
export default function Tetris() {
  // setStateで状態を更新して再レンダリング
  const [board, setBoard]     = useState<Board>(emptyBoard);
  const [mino, setMino]       = useState<Piece | null>(null);
  const [score, setScore]     = useState(0);
  const [over, setOver]       = useState(false);
  const [running, setRunning] = useState(false);

  // refで最新値を保持（useEffect内のクロージャ対策）
  const boardRef = useRef(board);
  const minoRef  = useRef(mino);
  boardRef.current = board;
  minoRef.current  = mino;

  // 新しいピースを生成。置けなければゲームオーバー
  const spawn = useCallback((b: Board) => {
    const p = randomPiece();
    if (!fits(b, p.shape, p.x, p.y)) { setOver(true); return; }
    setMino(p);
  }, []);

  // ピースを固定してライン消去 → 次のピースへ & スコア加算
  const lock = useCallback((b: Board, p: Piece) => {
    const merged = place(b, p);
    const { board: next, cleared } = sweep(merged);
    setScore((s) => s + [0, 100, 300, 500, 800][cleared]);
    setBoard(next);
    spawn(next);
  }, [spawn]);

  // 自動落下タイマー(500msごと)
  useEffect(() => {
    if (!running || over || !mino) return;
    const id = setInterval(() => {
      const p = minoRef.current!;
      const b = boardRef.current;
      if (fits(b, p.shape, p.x, p.y + 1)) setMino({ ...p, y: p.y + 1 });
      else lock(b, p);
    }, 500);
    return () => clearInterval(id);
  }, [running, over, mino, lock]);

  // キー操作
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = minoRef.current;
      const b = boardRef.current;
      if (!p || !running || over) return;

      if (e.key === "ArrowLeft"  && fits(b, p.shape, p.x - 1, p.y)) setMino({ ...p, x: p.x - 1 });
      if (e.key === "ArrowRight" && fits(b, p.shape, p.x + 1, p.y)) setMino({ ...p, x: p.x + 1 });
      if (e.key === "ArrowDown") {
        if (fits(b, p.shape, p.x, p.y + 1)) setMino({ ...p, y: p.y + 1 });
        else lock(b, p);
      }
      if (e.key === "ArrowUp") {
        const r = rotate(p.shape);
        if (fits(b, r, p.x, p.y)) setMino({ ...p, shape: r });
      }
      if (e.key === " ") {
        e.preventDefault();
        let ny = p.y;
        while (fits(b, p.shape, p.x, ny + 1)) ny++;
        lock(b, { ...p, y: ny });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, over, lock]);

  const start = () => {
    const b = emptyBoard();
    setBoard(b);
    setScore(0);
    setOver(false);
    setRunning(true);
    spawn(b);
  };

  // 表示用ボード（固定ブロック + 現在ピース）
  const display: Board = board.map((row) => [...row]);
  if (mino) {
    mino.shape.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell && mino.y + r >= 0) display[mino.y + r][mino.x + c] = mino.color;
      })
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 24, background: "#111", minHeight: "100vh", color: "#fff", fontFamily: "monospace" }}>
      <h1 style={{ letterSpacing: 8, marginBottom: 16 }}>TETRIS</h1>
      <div style={{ marginBottom: 12, fontSize: 18 }}>SCORE: {score}</div>

      {/* ボード */}
      <div style={{ border: "2px solid #555", display: "inline-block" }}>
        {display.map((row, r) => (
          <div key={r} style={{ display: "flex" }}>
            {row.map((cell, c) => (
              <div key={c} style={{
                width: 28, height: 28,
                background: cell ?? "#1a1a1a",
                border: "1px solid #2a2a2a",
                boxSizing: "border-box",
              }} />
            ))}
          </div>
        ))}
      </div>

      {/* ボタン */}
      <button onClick={start} style={{ marginTop: 20, padding: "10px 32px", fontSize: 16, cursor: "pointer", background: "#333", color: "#fff", border: "1px solid #666", letterSpacing: 4 }}>
        {over ? "RETRY" : running ? "RESTART" : "START"}
      </button>

      {over && <div style={{ marginTop: 12, color: "#ff3131", letterSpacing: 4 }}>GAME OVER</div>}

      <div style={{ marginTop: 16, fontSize: 11, color: "#555", lineHeight: 2 }}>
        ← → 移動　↑ 回転　↓ 落下　SPACE ドロップ
      </div>
    </div>
  );
}