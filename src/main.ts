import './style.css';
import { CanvasRenderer } from './views/CanvasRenderer';
import { FRAME_DURATION_MS } from './constants/config';

// ─────────────────────────────────────────
// マウントポイントの取得
// ─────────────────────────────────────────
const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('[main] #app 要素が見つかりません。index.html を確認してください。');
}

// ─────────────────────────────────────────
// レンダラーの初期化
// ─────────────────────────────────────────
const renderer = new CanvasRenderer(appEl);

// ─────────────────────────────────────────
// メインゲームループ
// ─────────────────────────────────────────
let lastTime = 0;

/**
 * requestAnimationFrame によって毎フレーム呼び出されるループ関数。
 *
 * @param timestamp - rAF が渡す経過時間 (ms, DOMHighResTimeStamp)
 */
function gameLoop(timestamp: number): void {
  // デルタタイム (ms) を計算
  const dt = timestamp - lastTime;

  // FPS 制御: 目標フレーム時間に満たない場合はスキップ
  if (dt < FRAME_DURATION_MS) {
    requestAnimationFrame(gameLoop);
    return;
  }

  lastTime = timestamp;

  // ── Update ──
  // TODO: ゲームロジックの更新処理をここに追加する
  // gameState.update(dt);

  // ── Render ──
  renderer.render(dt);

  requestAnimationFrame(gameLoop);
}

// ループ開始
requestAnimationFrame(gameLoop);
