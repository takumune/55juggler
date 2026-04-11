import type { ReelId, SymbolType } from '../types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  REEL_CONFIG, REEL_LENGTH,
  SYMBOL_WIDTH, SYMBOL_HEIGHT,
  VISIBLE_ROWS, REEL_VIEW_HEIGHT,
  REEL_GAP, REEL_AREA_X, REEL_AREA_Y,
  EXTRA_TOP_VISIBLE_RATIO,
  REEL_RADIUS_SYMBOLS,
} from '../constants/config';
import type { ReelController } from '../logic/ReelController';
import { gameState } from '../state/GameState';

// ─────────────────────────────────────────
// 図柄スタイル定義
// ─────────────────────────────────────────

/** 図柄ごとの背景色・文字色・表示ラベル (フォールバック用) */
const SYMBOL_STYLE: Record<SymbolType, { bg: string; fg: string; label: string }> = {
  '7':      { bg: '#3d0000', fg: '#ff4444', label: '７'  },
  'BELL':   { bg: '#2e2800', fg: '#ffd700', label: 'BEL' },
  'REPLAY': { bg: '#001630', fg: '#33aaff', label: 'RP'  },
  'GRAPE':  { bg: '#1a0030', fg: '#cc66ff', label: 'GRP' },
  'BAR':    { bg: '#0d0d0d', fg: '#aaaaaa', label: 'BAR' },
  'CHERRY': { bg: '#3d0012', fg: '#ff6688', label: 'CHR' },
  'CLOWN':  { bg: '#3d1800', fg: '#ff9922', label: 'CLN' },
};

/** 読み込む画像アセットのパス (Phase 7.1/8.1) */
const BASE_URL = import.meta.env.BASE_URL || '/';
const IMAGE_PATHS: Record<SymbolType, string> = {
  '7':      `${BASE_URL}img/Seven.png`,
  'BAR':    `${BASE_URL}img/bar.png`,
  'REPLAY': `${BASE_URL}img/Replay.png`,
  'GRAPE':  `${BASE_URL}img/grp.png`,
  'BELL':   `${BASE_URL}img/Bell.png`,
  'CHERRY': `${BASE_URL}img/Cherry.png`,
  'CLOWN':  `${BASE_URL}img/clown.png`,
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
  private imageAssets: Record<SymbolType, HTMLImageElement | null> = {
    '7': null, 'BAR': null, 'REPLAY': null, 'GRAPE': null, 'BELL': null, 'CHERRY': null, 'CLOWN': null
  };

  constructor(mountPoint: HTMLElement) {
    this.canvas    = document.createElement('canvas');
    this.canvas.id = 'slot-canvas';
    this.canvas.width  = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('[CanvasRenderer] 2D コンテキストの取得に失敗しました。');
    this.ctx = ctx;

    mountPoint.appendChild(this.canvas);

    // 画像アセットの非同期読み込み
    Object.entries(IMAGE_PATHS).forEach(([key, path]) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        this.imageAssets[key as SymbolType] = img;
      };
    });
  }

  // ─────────────────────────────────────────
  // 公開メソッド
  // ─────────────────────────────────────────

  /**
   * 平面上のY座標を、円柱に張り付けたような遠近感(3D湾曲)のあるY座標に変換します。
   */
  private projectY(rawY: number): number {
    const R = (REEL_RADIUS_SYMBOLS * SYMBOL_HEIGHT) / (Math.PI * 2); 
    const centerY = REEL_AREA_Y + REEL_VIEW_HEIGHT / 2;
    const d = rawY - centerY;
    
    // 裏側に回り込んでいる場合は近似値
    if (d > R * 1.5 || d < -R * 1.5) return rawY;
    
    return centerY + R * Math.sin(d / R);
  }

  /**
   * 毎フレーム呼び出されるメイン描画メソッド。
   * @param _dt       デルタタイム (ms) ─ 将来のアニメーション用
   * @param reelCtrl  ReelController インスタンス（スクロール量の取得に使用）
   */
  render(_dt: number, reelCtrl: ReelController): void {
    // 全体を暗号塗りつぶし（隙間の色）
    this.ctx.fillStyle = '#111111';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    this.drawReels(reelCtrl);
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

      // リール背景 (白いリール帯)
      this.ctx.fillStyle = '#f4f4f4';
      this.ctx.fillRect(reelX, REEL_AREA_Y, SYMBOL_WIDTH, REEL_VIEW_HEIGHT);

      // ── 下向きスクロール計算 ──
      // scrollY が増加するほど図柄が「上から下へ」流れるよう逆変換する
      const inv         = (TOTAL_STRIP_HEIGHT - scrollY % TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;
      const firstIndex  = Math.floor(inv / SYMBOL_HEIGHT) % REEL_LENGTH;
      const pixelOffset = inv % SYMBOL_HEIGHT;
      const baseOffset  = SYMBOL_HEIGHT * EXTRA_TOP_VISIBLE_RATIO;

      // 少し余裕を持たせてより広い範囲を描画（湾曲で裏側が見えるため）
      for (let r = -2; r <= VISIBLE_ROWS + 1; r++) {
        const symbolIndex = (firstIndex + r + REEL_LENGTH) % REEL_LENGTH;
        const symbol      = REEL_CONFIG[id][symbolIndex];
        const drawX       = reelX;
        
        // 平面上の上端と下端のY座標
        const rawTop      = REEL_AREA_Y + baseOffset + r * SYMBOL_HEIGHT - pixelOffset;
        const rawBottom   = rawTop + SYMBOL_HEIGHT;
        
        // 湾曲投影して、画面上での描画位置と潰れた高さを算出
        const screenTop    = this.projectY(rawTop);
        const screenBottom = this.projectY(rawBottom);
        const drawHeight   = Math.max(0.1, screenBottom - screenTop); // 最小高さを確保

        this.drawSymbol(symbol, drawX, screenTop, drawHeight);
      }

      // ──── 立体感を出すための円柱シャドウ（グラデーション） ────
      const grad = this.ctx.createLinearGradient(0, REEL_AREA_Y, 0, REEL_AREA_Y + REEL_VIEW_HEIGHT);
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0.7)'); // 上部の暗がり
      grad.addColorStop(0.15, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(0.50, 'rgba(255, 255, 255, 0.1)'); // 中央のハイライト
      grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.2)');
      grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.7)'); // 下部の暗がり
      
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(reelX, REEL_AREA_Y, SYMBOL_WIDTH, REEL_VIEW_HEIGHT);

      // フェーズ6.3: フラッシュ演出 (バックライトのように全ての図柄の上から重ねることで視認性を上げる)
      if (Date.now() < gameState.flashEndTime) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; // 半透明の白
        this.ctx.fillRect(reelX, REEL_AREA_Y, SYMBOL_WIDTH, REEL_VIEW_HEIGHT);
      }

      this.ctx.restore(); // clip を解除

      // コマ境界線（clip 外に描くため restore 後）
      this.drawRowSeparators(reelX);
    });
  }

  /**
   * 1コマ分の図柄を描画する。
   * 画像が読み込まれていれば画像を描画し、そうでない場合はフォールバックのテキストを描画する。
   */
  private drawSymbol(symbol: SymbolType, x: number, y: number, height: number = SYMBOL_HEIGHT): void {
    const img = this.imageAssets[symbol];
    const scaleY = height / SYMBOL_HEIGHT;

    if (img && img.complete) {
      // リール帯の背景色を敷く
      this.ctx.fillStyle = '#f4f4f4';
      this.ctx.fillRect(x, y, SYMBOL_WIDTH, height);

      // 7やBARは大きく、小役は小さく表示するためのパディング設定
      const isLarge = symbol === '7' || symbol === 'BAR';
      const padX = isLarge ? 4 : 16;
      const padY = isLarge ? 4 : 10;
      const scaledPadY = padY * scaleY;

      // 描画（リール窓の幅に合わせるため少し拡大縮小がかかる）
      this.ctx.drawImage(img, x + padX, y + scaledPadY, SYMBOL_WIDTH - padX * 2, height - scaledPadY * 2);
      
      // 文字盤の境目を見やすくるためのごく薄い線
      this.ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      this.ctx.lineWidth   = 1;
      this.ctx.strokeRect(x, y, SYMBOL_WIDTH, height);
    } else {
      // フォールバック処理
      const style = SYMBOL_STYLE[symbol];

      // 背景
      this.ctx.fillStyle = style.bg;
      this.ctx.fillRect(x, y, SYMBOL_WIDTH, height);

      // 内枠ハイライト（上辺のみ明るく）
      this.ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      this.ctx.lineWidth   = 1;
      this.ctx.strokeRect(x + 0.5, y + 0.5, SYMBOL_WIDTH - 1, height - 1);

      // ラベルテキスト
      this.ctx.fillStyle    = style.fg;
      this.ctx.font         = 'bold 22px "Courier New", monospace';
      this.ctx.textAlign    = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(style.label, x + SYMBOL_WIDTH / 2, y + height / 2);
    }
  }

  /**
   * リール内の上コマ／中コマ境界に水平なセパレータ線を引く。
   * （clip 解除後に呼ぶこと）
   */
  private drawRowSeparators(reelX: number): void {
    this.ctx.strokeStyle = 'rgba(0,0,0,0.1)'; // 薄いグレーの境目
    this.ctx.lineWidth   = 1;
    const baseOffset = SYMBOL_HEIGHT * EXTRA_TOP_VISIBLE_RATIO;
    
    for (let row = -1; row <= VISIBLE_ROWS; row++) {
      const lineY = REEL_AREA_Y + baseOffset + row * SYMBOL_HEIGHT;
      // リール表示領域内におさまる境界線だけ描画
      if (lineY > REEL_AREA_Y && lineY < REEL_AREA_Y + REEL_VIEW_HEIGHT) {
        this.ctx.beginPath();
        this.ctx.moveTo(reelX, lineY);
        this.ctx.lineTo(reelX + SYMBOL_WIDTH, lineY);
        this.ctx.stroke();
      }
    }
  }

}
