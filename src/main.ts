import './style.css';
import { CanvasRenderer } from './views/CanvasRenderer';
import { ReelController } from './logic/ReelController';
import { FRAME_DURATION_MS } from './constants/config';
import { gameState } from './state/GameState';
import { Lottery } from './logic/Lottery';

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

// フェーズ1実装に伴い、初期状態での自動回転は停止しました。

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
    case 'm':
    case 'ArrowUp':
      // フェーズ1.4: サンド機能（メダル50枚投入）
      gameState.credits += 50;
      console.log(`[SYSTEM] メダルを追加: 現在 ${gameState.credits} 枚`);
      break;
    case 'b':
    case 'Enter':
      if (gameState.isReplay) {
        console.log('[SYSTEM] リプレイ作動中のためベットは自動で行われています');
        break;
      }
      // フェーズ1.2 & 5.1: MAX BET (3枚掛け)
      // ボーナス消化中もBET可能にするため、playState !== 'BONUS_GAME' 制約を外した
      if (reelController.areAllStopped()) {
        const required = 3 - gameState.bet;
        if (required > 0 && gameState.credits >= required) {
          gameState.credits -= required;
          gameState.bet = 3;
          console.log('[SYSTEM] 3枚BET完了');
        } else if (required > 0) {
          console.log('[SYSTEM] クレジットが足りません');
        }
      }
      break;
    case 's':
      // 設定（1〜6, X）の変更
      if (gameState.setting === 'X') {
        gameState.setting = 1;
      } else if (gameState.setting === 6) {
        gameState.setting = 'X';
      } else {
        gameState.setting = (Number(gameState.setting) + 1) as any;
      }
      console.log(`[SYSTEM] 設定を ${gameState.setting} に変更しました`);
      break;
    case '0':
      // デバッグ機能: 強制的にボーナスフラグを立てる
      gameState.activeBonus = 'BIG';
      console.log('[DEBUG] BIGボーナスフラグを強制セットしました！');
      break;
    case ' ':
      // 全リールが停止済みのときのみ再スタート
      if (reelController.areAllStopped()) {
        if (gameState.bet < 3) {
          console.log('[SYSTEM] メダルを3枚BETしてください');
          return;
        }

        // 次ゲーム開始時の初期化
        gameState.bet = 0;
        gameState.pay = 0;
        gameState.isReplay = false; // リプレイ権利を消費
        gameState.activeSmallRole = 'NONE'; // 1ゲーム完結の小役フラグをリセット

        // 内部抽選 (通常時、ボーナス成立後、およびボーナス中)
        if (gameState.playState === 'BONUS_GAME') {
          const drawn = Lottery.drawBonus();
          gameState.activeSmallRole = drawn as any;
          console.log(`[DEBUG] ボーナス中抽選: 小役（${drawn}）当選！`);
        } else {
          const drawn = Lottery.draw(gameState.setting);

          if (drawn === 'BIG' || drawn === 'REG') {
            // ボーナスは揃えるまで持ち越されるため、未成立時のみセットする
            if (gameState.activeBonus === 'NONE') {
              gameState.activeBonus = drawn;
              console.log(`[DEBUG] 内部抽選: ボーナス（${drawn}）当選！設定${gameState.setting}`);
            } else {
               console.log(`[DEBUG] 内部抽選: ハズレ（ボーナス成立済み）`);
            }
          } else if (drawn !== 'NONE') {
            // 小役当選
            gameState.activeSmallRole = drawn;
            console.log(`[DEBUG] 内部抽選: 小役（${drawn}）当選！設定${gameState.setting}`);
          } else {
            console.log(`[DEBUG] 内部抽選: ハズレ 設定${gameState.setting}`);
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
