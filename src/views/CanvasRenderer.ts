import type { ReelId, SymbolType } from '../types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  REEL_CONFIG, REEL_LENGTH,
  SYMBOL_WIDTH, SYMBOL_HEIGHT,
  VISIBLE_ROWS, REEL_VIEW_HEIGHT,
  REEL_GAP, REEL_AREA_X, REEL_AREA_Y,
} from '../constants/config';
import type { ReelController } from '../logic/ReelController';
import { gameState } from '../state/GameState';

// ─────────────────────────────────────────
// 図柄スタイル定義
// ─────────────────────────────────────────

/** 図柄ごとの背景色・文字色・表示ラベル */
const SYMBOL_STYLE: Record<SymbolType, { bg: string; fg: string; label: string }> = {
  '7':      { bg: '#3d0000', fg: '#ff4444', label: '７'  },
  'BELL':   { bg: '#2e2800', fg: '#ffd700', label: 'BEL' },
  'REPLAY': { bg: '#001630', fg: '#33aaff', label: 'RP'  },
  'GRAPE':  { bg: '#1a0030', fg: '#cc66ff', label: 'GRP' },
  'BAR':    { bg: '#0d0d0d', fg: '#aaaaaa', label: 'BAR' },
  'CHERRY': { bg: '#3d0012', fg: '#ff6688', label: 'CHR' },
  'CLOWN':  { bg: '#3d1800', fg: '#ff9922', label: 'CLN' },
};

const REEL_IDS: ReelId[] = ['left', 'center', 'right'];

/** リール帯の総ピクセル高さ（環状オフセット計算に使用） */
const TOTAL_STRIP_HEIGHT = REEL_LENGTH * SYMBOL_HEIGHT;

// ─────────────────────────────────────────
// CanvasRenderer
// ─────────────────────────────────────────

/**
 * Canvas への描画処理をすべて担当するクラス。
 * ロジック層（ReelController 等）の「状態を受け取って描く」だけに徹する。
 */
export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(mountPoint: HTMLElement) {
    this.canvas    = document.createElement('canvas');
    this.canvas.id = 'slot-canvas';
    this.canvas.width  = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('[CanvasRenderer] 2D コンテキストの取得に失敗しました。');
    this.ctx = ctx;

    mountPoint.appendChild(this.canvas);
  }

  // ─────────────────────────────────────────
  // 公開メソッド
  // ─────────────────────────────────────────

  /**
   * 毎フレーム呼び出されるメイン描画メソッド。
   * @param _dt       デルタタイム (ms) ─ 将来のアニメーション用
   * @param reelCtrl  ReelController インスタンス（スクロール量の取得に使用）
   */
  render(_dt: number, reelCtrl: ReelController): void {
    this.clearScreen();
    this.drawTitle();
    this.drawReels(reelCtrl);
    this.drawReelFrame();
    this.drawWinLine();
    this.drawGogoLamp();
    this.drawUI();
  }

  // ─────────────────────────────────────────
  // プライベート：背景 / タイトル
  // ─────────────────────────────────────────

  private clearScreen(): void {
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /** ゲームタイトルをキャンバス上部に描画 */
  private drawTitle(): void {
    this.ctx.textAlign    = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle    = '#ffd700';
    this.ctx.font         = 'bold 28px "Courier New", monospace';
    this.ctx.fillText('55 JUGGLER', CANVAS_WIDTH / 2, 50);

    // 下線
    this.ctx.strokeStyle = '#ffd70055';
    this.ctx.lineWidth   = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(CANVAS_WIDTH / 2 - 100, 66);
    this.ctx.lineTo(CANVAS_WIDTH / 2 + 100, 66);
    this.ctx.stroke();
  }

  // ─────────────────────────────────────────
  // プライベート：リール描画
  // ─────────────────────────────────────────

  /**
   * 3本のリールをそれぞれ clip() でマスクしながら描画する。
   */
  private drawReels(rc: ReelController): void {
    REEL_IDS.forEach((id, i) => {
      const reelX   = REEL_AREA_X + i * (SYMBOL_WIDTH + REEL_GAP);
      const scrollY = rc.getScrollY(id);

      // ── クリッピング設定 ──
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.rect(reelX, REEL_AREA_Y, SYMBOL_WIDTH, REEL_VIEW_HEIGHT);
      this.ctx.clip();

      // リール背景
      this.ctx.fillStyle = '#050505';
      this.ctx.fillRect(reelX, REEL_AREA_Y, SYMBOL_WIDTH, REEL_VIEW_HEIGHT);

      // ── 下向きスクロール計算 ──
      // scrollY が増加するほど図柄が「上から下へ」流れるよう逆変換する
      const inv         = (TOTAL_STRIP_HEIGHT - scrollY % TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;
      const firstIndex  = Math.floor(inv / SYMBOL_HEIGHT) % REEL_LENGTH;
      const pixelOffset = inv % SYMBOL_HEIGHT;

      // VISIBLE_ROWS + 1 コマ描画（先頭が部分的に見えるコマ＋3コマ）
      for (let r = 0; r <= VISIBLE_ROWS; r++) {
        const symbolIndex = (firstIndex + r) % REEL_LENGTH;
        const symbol      = REEL_CONFIG[id][symbolIndex];
        const drawX       = reelX;
        const drawY       = REEL_AREA_Y + r * SYMBOL_HEIGHT - pixelOffset;
        this.drawSymbol(symbol, drawX, drawY);
      }

      this.ctx.restore(); // clip を解除

      // コマ境界線（clip 外に描くため restore 後）
      this.drawRowSeparators(reelX);
    });
  }

  /**
   * 1コマ分の図柄を描画する。
   * 背景塗りつぶし → 境界線 → ラベルテキストの順で重ねる。
   */
  private drawSymbol(symbol: SymbolType, x: number, y: number): void {
    const style = SYMBOL_STYLE[symbol];

    // 背景
    this.ctx.fillStyle = style.bg;
    this.ctx.fillRect(x, y, SYMBOL_WIDTH, SYMBOL_HEIGHT);

    // 内枠ハイライト（上辺のみ明るく）
    this.ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    this.ctx.lineWidth   = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, SYMBOL_WIDTH - 1, SYMBOL_HEIGHT - 1);

    // ラベルテキスト
    this.ctx.fillStyle    = style.fg;
    this.ctx.font         = 'bold 22px "Courier New", monospace';
    this.ctx.textAlign    = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(style.label, x + SYMBOL_WIDTH / 2, y + SYMBOL_HEIGHT / 2);
  }

  /**
   * リール内の上コマ／中コマ境界に水平なセパレータ線を引く。
   * （clip 解除後に呼ぶこと）
   */
  private drawRowSeparators(reelX: number): void {
    this.ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    this.ctx.lineWidth   = 1;
    for (let row = 1; row < VISIBLE_ROWS; row++) {
      const lineY = REEL_AREA_Y + row * SYMBOL_HEIGHT;
      this.ctx.beginPath();
      this.ctx.moveTo(reelX,                  lineY);
      this.ctx.lineTo(reelX + SYMBOL_WIDTH,   lineY);
      this.ctx.stroke();
    }
  }

  // ─────────────────────────────────────────
  // プライベート：リール枠・ライン
  // ─────────────────────────────────────────

  /** 3本リールを囲む外枠を描画する */
  private drawReelFrame(): void {
    const pad = 3;
    const x   = REEL_AREA_X - pad;
    const y   = REEL_AREA_Y - pad;
    const w   = SYMBOL_WIDTH * 3 + REEL_GAP * 2 + pad * 2;
    const h   = REEL_VIEW_HEIGHT + pad * 2;

    // 外枠
    this.ctx.strokeStyle = '#555555';
    this.ctx.lineWidth   = 2;
    this.ctx.strokeRect(x, y, w, h);

    // リール間の縦区切り線
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth   = 1;
    for (let i = 1; i < 3; i++) {
      const lineX = REEL_AREA_X + i * (SYMBOL_WIDTH + REEL_GAP) - REEL_GAP / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(lineX, y);
      this.ctx.lineTo(lineX, y + h);
      this.ctx.stroke();
    }
  }

  /**
   * 入賞ライン（中段）を両サイドのマーカーで示す。
   */
  private drawWinLine(): void {
    const midY     = REEL_AREA_Y + SYMBOL_HEIGHT + SYMBOL_HEIGHT / 2;
    const markerW  = 10;
    const markerH  = 4;
    const pad      = 3;
    const leftEdge = REEL_AREA_X - pad;
    const rightEdge = REEL_AREA_X + SYMBOL_WIDTH * 3 + REEL_GAP * 2 + pad;

    this.ctx.fillStyle = '#ff4444';
    // 左マーカー
    this.ctx.fillRect(leftEdge - markerW - 2, midY - markerH / 2, markerW, markerH);
    // 右マーカー
    this.ctx.fillRect(rightEdge + 2,           midY - markerH / 2, markerW, markerH);
  }

  /**
   * 画面左下付近に告知ランプ（GOGO!）を描画する
   */
  private drawGogoLamp(): void {
    const x = REEL_AREA_X - 60;
    const y = REEL_AREA_Y + REEL_VIEW_HEIGHT - 20;

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = 'bold 36px "Courier New", monospace';
    
    if (gameState.isGogoLampOn) {
      this.ctx.fillStyle = '#ff00ff';
      // 光の拡散効果
      this.ctx.shadowColor = '#ff22ff';
      this.ctx.shadowBlur = 25;
    } else {
      this.ctx.fillStyle = '#222222';
      this.ctx.shadowBlur = 0;
    }
    
    this.ctx.fillText('GOGO!', x, y);
    this.ctx.restore();
  }

  // ─────────────────────────────────────────
  // プライベート：UI情報描画
  // ─────────────────────────────────────────

  /**
   * メダル情報（CREDIT, PAY, BET）を画面下部にデジタル表示する
   */
  private drawUI(): void {
    const marginY = CANVAS_HEIGHT - 30;

    this.ctx.textBaseline = 'middle';
    this.ctx.font = 'bold 24px "Courier New", monospace';

    // ── BET 表示 (左下) ──
    this.ctx.textAlign = 'left';
    this.ctx.fillStyle = '#ff4444';
    this.ctx.fillText(`BET: ${gameState.bet}`, 30, marginY);

    // ── PAY 表示 (右下・上段) ──
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#00ffaa';
    this.ctx.fillText(`PAY: ${gameState.pay}`, CANVAS_WIDTH - 30, marginY - 30);

    // ── CREDIT 表示 (右下・下段) ──
    this.ctx.fillStyle = '#ffaa00';
    this.ctx.fillText(`CREDIT: ${gameState.credits}`, CANVAS_WIDTH - 30, marginY);
  }
}
