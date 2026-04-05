// ─────────────────────────────────────────
// 汎用ユーティリティ型
// ─────────────────────────────────────────

/** キャンバスのサイズ */
export interface CanvasSize {
  width: number;
  height: number;
}

/** 2D座標 */
export interface Point {
  x: number;
  y: number;
}

// ─────────────────────────────────────────
// ゲームの進行状態
// ─────────────────────────────────────────

/** スロットマシン全体のフェーズ */
export type GamePhase =
  | 'IDLE'        // 待機中（レバーON待ち）
  | 'SPINNING'    // リール回転中
  | 'STOPPING'    // 停止ボタン処理中
  | 'JUDGING'     // 入賞判定中
  | 'BONUS';      // ボーナス演出中

/** ゲーム全体の状態スナップショット */
export interface GameState {
  phase: GamePhase;
  medals: number;      // 所持メダル枚数
  bet: number;         // 現在のベット枚数
  totalGames: number;  // 累計ゲーム数
}

// ─────────────────────────────────────────
// 図柄 (Symbol)
// ─────────────────────────────────────────

/**
 * リール上に存在する図柄の種類。
 * REEL_CONFIG の文字列リテラルと対応させること。
 */
export type SymbolType =
  | 'BELL'
  | '7'
  | 'REPLAY'
  | 'GRAPE'
  | 'BAR'
  | 'CHERRY'
  | 'CLOWN';

// ─────────────────────────────────────────
// リール (Reel)
// ─────────────────────────────────────────

/** リールの識別子（左・中・右） */
export type ReelId = 'left' | 'center' | 'right';

/**
 * 個別リールの状態遷移を表す型。
 *
 * ```
 * SPINNING ──[stop 入力]──► SLIDING ──[targetY 到達]──► STOPPED
 *    ▲                                                      │
 *    └──────────────────[space 入力]──────────────────────┘
 * ```
 */
export type ReelStatus = 'SPINNING' | 'SLIDING' | 'STOPPED';

/**
 * 各リールの実行時状態を保持するインターフェース。
 *
 * - `status`       : 主状態（SPINNING / SLIDING / STOPPED）
 * - `topIndex`     : リール配列内で「上コマ」に相当するインデックス（0〜20、環状）
 * - `scrollOffset` : コマ内ピクセルオフセット（0 〜 SYMBOL_HEIGHT-1）
 * - `stopIndex`    : 完全停止時の topIndex 確定値（STOPPED 前は null）
 * - `targetY`      : 滑り停止の目標 scrollY（SLIDING 時のみ有効）
 * - `isSpinning`   : status が SPINNING または SLIDING（後方互換ヘルパー）
 * - `isStopped`    : status が STOPPED（後方互換ヘルパー）
 */
export interface ReelState {
  status: ReelStatus;
  topIndex: number;         // 0 〜 REEL_LENGTH - 1
  scrollOffset: number;     // px
  stopIndex: number | null;
  targetY: number;          // SLIDING 時の目標 scrollY
  // ── 後方互換ヘルパー（status から派生） ──
  isSpinning: boolean;      // = status !== 'STOPPED'
  isStopped: boolean;       // = status === 'STOPPED'
}
