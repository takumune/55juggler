import type { SymbolType } from '../types';

// ─────────────────────────────────────────
// 画面・キャンバス設定 (下部のリール幅に基づいて後で自動計算されます)
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// ゲームループ設定
// ─────────────────────────────────────────
/** ターゲットFPS（フレームレートの上限） */
export const TARGET_FPS = 60;
/** 1フレームあたりの目標経過時間 (ms) */
export const FRAME_DURATION_MS = 1000 / TARGET_FPS;

// ─────────────────────────────────────────
// カラーパレット
// ─────────────────────────────────────────
export const COLOR = {
  BG_CANVAS: '#000000',
  BG_BODY: '#111111',
  TEXT_PRIMARY: '#ffffff',
} as const;

// ─────────────────────────────────────────
// フォント設定
// ─────────────────────────────────────────
export const FONT = {
  READY_TEXT: '24px "Inter", sans-serif',
} as const;

// ─────────────────────────────────────────
// リール配列 (21コマ × 左・中・右)
// ─────────────────────────────────────────

/** リール1本あたりのコマ数 */
export const REEL_LENGTH = 21;

export const REEL_CONFIG: Record<'left' | 'center' | 'right', SymbolType[]> = {
  left: [
    'BELL', '7', 'REPLAY', 'GRAPE', 'REPLAY', 'GRAPE', 'BAR', 'CHERRY',
    'GRAPE', 'REPLAY', 'GRAPE', '7', 'CLOWN', 'GRAPE', 'REPLAY', 'GRAPE',
    'CHERRY', 'BAR', 'GRAPE', 'REPLAY', 'GRAPE',
  ],
  center: [
    'REPLAY', '7', 'GRAPE', 'CHERRY', 'REPLAY', 'BELL', 'GRAPE', 'CHERRY',
    'REPLAY', 'BAR', 'GRAPE', 'CHERRY', 'REPLAY', 'BELL', 'GRAPE', 'CHERRY',
    'REPLAY', 'BAR', 'GRAPE', 'CHERRY', 'CLOWN',
  ],
  right: [
    'GRAPE', '7', 'BAR', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL',
    'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY', 'GRAPE', 'CLOWN', 'BELL',
    'REPLAY', 'GRAPE', 'CLOWN', 'BELL', 'REPLAY',
  ],
} as const;

// ─────────────────────────────────────────
// リール描画設定
// ─────────────────────────────────────────

/**
 * 1コマあたりのサイズ (px)
 * 横幅を変えたい場合は SYMBOL_WIDTH を変更します。
 * 【リールの縦幅（高さ）を変えたい場合は SYMBOL_HEIGHT を変更してください】
 */
export const SYMBOL_WIDTH = 140;
export const SYMBOL_HEIGHT = 65;

/** 1リールに表示するコマ数（上・中・下） */
export const VISIBLE_ROWS = 3;

/** リール表示エリアの高さ (px) */
export const REEL_VIEW_HEIGHT = SYMBOL_HEIGHT * VISIBLE_ROWS;

/**
 * リール間のギャップ (px)
 * 【リールの左右の間隔を調整する場合は、この数値を変更してください】
 */
export const REEL_GAP = 20;

/** リール数 */
export const REEL_COUNT = 3;

/** 3本のリールをまとめた表示エリアの幅 (px) */
export const REEL_AREA_WIDTH = SYMBOL_WIDTH * REEL_COUNT + REEL_GAP * (REEL_COUNT - 1);

// キャンバス自体のサイズをリール表示エリアのサイズに自動追従させる
export const CANVAS_WIDTH = REEL_AREA_WIDTH;
export const CANVAS_HEIGHT = REEL_VIEW_HEIGHT;

/**
 * リール表示エリアの左上起点 X 座標（キャンバス中央揃え）。
 */
export const REEL_AREA_X = 0; // (CANVAS_WIDTH - REEL_AREA_WIDTH) / 2;

/**
 * リール表示エリアの左上起点 Y 座標（キャンバス上寄り配置）。
 */
export const REEL_AREA_Y = 0; // (CANVAS_HEIGHT - REEL_VIEW_HEIGHT) / 2 - 40;
