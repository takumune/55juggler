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
// リール・図柄
// ─────────────────────────────────────────

/** リール上の図柄の種類 */
export type SymbolId =
  | 'BAR'
  | 'SEVEN'
  | 'CHERRY'
  | 'BELL'
  | 'WATERMELON'
  | 'REPLAY';

/** 図柄の定義 */
export interface SymbolDef {
  id: SymbolId;
  label: string;   // 描画用ラベル（暫定テキスト）
  color: string;   // 暫定の背景色
}
