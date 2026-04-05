import { CANVAS_WIDTH, CANVAS_HEIGHT, COLOR, FONT } from '../constants/config';

/**
 * CanvasRenderer
 * Canvas 要素の生成・管理と、毎フレームの描画を担当するクラス。
 * DOM 操作はこのクラスに集約し、ロジック層には依存しない。
 */
export class CanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(mountPoint: HTMLElement) {
    // Canvas 要素を生成
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'slot-canvas';
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    // 2D コンテキストを取得
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('[CanvasRenderer] 2D コンテキストの取得に失敗しました。');
    }
    this.ctx = ctx;

    // マウントポイントに追加
    mountPoint.appendChild(this.canvas);
  }

  // ─────────────────────────────────────────
  // 公開メソッド
  // ─────────────────────────────────────────

  /**
   * 毎フレーム呼び出される描画メソッド。
   * @param _dt デルタタイム (ms) ─ 現段階では未使用、将来のアニメーション実装のために引数として用意
   */
  render(_dt: number): void {
    this.clearScreen();
    this.drawReadyText();
  }

  // ─────────────────────────────────────────
  // プライベートヘルパー
  // ─────────────────────────────────────────

  /** 画面全体を背景色で塗りつぶす */
  private clearScreen(): void {
    this.ctx.fillStyle = COLOR.BG_CANVAS;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  /** 「Slot Engine Ready」テキストを中央に描画する */
  private drawReadyText(): void {
    this.ctx.fillStyle = COLOR.TEXT_PRIMARY;
    this.ctx.font = FONT.READY_TEXT;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Slot Engine Ready', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }
}
