import './style.css';
import { CanvasRenderer } from './views/CanvasRenderer';
import { ReelController } from './logic/ReelController';
import { FRAME_DURATION_MS } from './constants/config';
import { gameState } from './state/GameState';

// ─────────────────────────────────────────
// マウントポイントの取得
// ─────────────────────────────────────────
const appEl = document.getElementById('app');
if (!appEl) {
  throw new Error('[main] #app 要素が見つかりません。index.html を確認してください。');
}

// ─────────────────────────────────────────
// インスタンス生成
// ─────────────────────────────────────────
const renderer       = new CanvasRenderer(appEl);
const reelController = new ReelController();

// テスト: 初期状態で全リールを回転中にする
reelController.startAll();

// ─────────────────────────────────────────
// キーボード入力
// ─────────────────────────────────────────

/**
 * キーラインブループ:
 *   1 → 左リール停止
 *   2 → 中リール停止
 *   3 → 右リール停止
 *   Space → 全リールが停止済みのときに再回転
 */
window.addEventListener('keydown', (e: KeyboardEvent) => {
  switch (e.key) {
    case '1':
      reelController.stopReel(0); // 左
      break;
    case '2':
      reelController.stopReel(1); // 中
      break;
    case '3':
      reelController.stopReel(2); // 右
      break;
    case '0':
      // デバッグ機能: 強制的にボーナスフラグを立てる
      gameState.hasBonusFlag = true;
      console.log('[DEBUG] ボーナスフラグを強制セットしました！');
      break;
    case ' ':
      // 全リールが停止済みのときのみ再スタート
      if (reelController.areAllStopped()) {
        if (gameState.playState === 'BONUS_GAME') {
          console.log('ボーナス消化中は現在未実装です');
          return;
        }

        // 内部抽選 (NORMAL 状態の時のみ)
        if (gameState.playState === 'NORMAL') {
          // テスト用 1/5 (20%) でボーナスフラグを立てる
          if (Math.random() < 0.2) {
            gameState.hasBonusFlag = true;
            console.log('[DEBUG] 内部抽選: ボーナス当選！');
          } else {
            console.log('[DEBUG] 内部抽選: ハズレ');
          }
        }

        reelController.startAll();
      }
      break;
  }
});

// ─────────────────────────────────────────
// メインゲームループ
// ─────────────────────────────────────────
let lastTime = 0;

/**
 * requestAnimationFrame から毎フレーム呼び出されるゲームループ。
 *
 * 処理順: デルタタイム計算 → FPS 制御 → Update → Render
 *
 * @param timestamp - rAF が渡す経過時間 (ms, DOMHighResTimeStamp)
 */
function gameLoop(timestamp: number): void {
  const dt = timestamp - lastTime;

  // FPS 上限制御: 目標フレーム時間に満たなければスキップ
  if (dt < FRAME_DURATION_MS) {
    requestAnimationFrame(gameLoop);
    return;
  }

  lastTime = timestamp;

  // ── Update ──
  reelController.update(dt);

  // ── Render ──
  renderer.render(dt, reelController);

  requestAnimationFrame(gameLoop);
}

// ループ開始
requestAnimationFrame(gameLoop);
