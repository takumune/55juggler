import type { ReelId, ReelState, SymbolType } from '../types';
import { REEL_LENGTH, SYMBOL_HEIGHT, REEL_CONFIG } from '../constants/config';
import { gameState } from '../state/GameState';

/** リールインデックス → ReelId の対応表 */
const INDEX_TO_REEL_ID: ReelId[] = ['left', 'center', 'right'];

// ─────────────────────────────────────────
// 定数
// ─────────────────────────────────────────

/** リール回転速度 (px/秒) */
const SPIN_SPEED_PPS = 450;

/** リール1本の帯ピクセル長（21コマ × 100px） */
const TOTAL_STRIP_HEIGHT = REEL_LENGTH * SYMBOL_HEIGHT;

/**
 * 停止ボタン押下後に「滑らせる」コマ数。
 * 実際のパチスロでは役抽選によって 0〜4 コマ変動するが、
 * 現フェーズはアニメーションテストのため固定値とする。
 */
const SLIDE_SYMBOLS = 2;

// ─────────────────────────────────────────
// 内部状態型（ReelState + scrollY を追加）
// ─────────────────────────────────────────

/**
 * ReelController 内部でのみ使用する拡張状態型。
 * scrollY を一次データとし、他フィールドは派生または補助値として管理する。
 */
interface InternalReelState extends ReelState {
  /**
   * 累積スクロールピクセル数（0 〜 TOTAL_STRIP_HEIGHT の環状値）。
   * この値を元に topIndex / scrollOffset など全派生値を計算する。
   */
  scrollY: number;
}

// ─────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────

/**
 * scrollY → status に対応したフラグ類を一括で派生させるヘルパー。
 * `status` と `scrollY` が確定した直後に必ず呼ぶ。
 */
function syncDerived(s: InternalReelState): void {
  s.topIndex     = Math.floor(s.scrollY / SYMBOL_HEIGHT) % REEL_LENGTH;
  s.scrollOffset = s.scrollY % SYMBOL_HEIGHT;
  s.isSpinning   = s.status !== 'STOPPED';
  s.isStopped    = s.status === 'STOPPED';
}

// ─────────────────────────────────────────
// ReelController
// ─────────────────────────────────────────

/**
 * 左・中・右 3本のリールの回転状態を管理する純粋ロジッククラス。
 * DOM / Canvas には一切依存しない。
 *
 * ## 状態遷移
 * ```
 * SPINNING ──[stopReel()]──► SLIDING ──[targetY 到達]──► STOPPED
 *    ▲                                                       │
 *    └───────────────────[startAll()]──────────────────────┘
 * ```
 */
export class ReelController {
  private readonly ids: ReelId[] = ['left', 'center', 'right'];
  private readonly states: Record<ReelId, InternalReelState>;

  constructor() {
    const initial = (): InternalReelState => ({
      status:       'STOPPED',
      scrollY:      0,
      topIndex:     0,
      scrollOffset: 0,
      stopIndex:    null,
      targetY:      0,
      isSpinning:   false,
      isStopped:    true,
    });

    this.states = {
      left:   initial(),
      center: initial(),
      right:  initial(),
    };
  }

  // ─────────────────────────────────────────
  // 公開 API
  // ─────────────────────────────────────────

  /** 全リールを SPINNING 状態にして回転開始する */
  startAll(): void {
    for (const id of this.ids) {
      const s      = this.states[id];
      s.status     = 'SPINNING';
      s.stopIndex  = null;
      s.targetY    = 0;
      syncDerived(s);
    }
  }

  /**
   * ゲームループから毎フレーム呼び出す更新メソッド。
   *
   * - SPINNING: scrollY を均一速度で前進させる
   * - SLIDING : 同速度で前進し、targetY に到達したらスナップして STOPPED へ遷移
   * - STOPPED : 何もしない
   *
   * @param dt デルタタイム (ms)
   */
  update(dt: number): void {
    const advance = SPIN_SPEED_PPS * (dt / 1000); // このフレームで進むピクセル数

    for (const id of this.ids) {
      const s = this.states[id];

      if (s.status === 'SPINNING') {
        s.scrollY = (s.scrollY + advance) % TOTAL_STRIP_HEIGHT;
        syncDerived(s);

      } else if (s.status === 'SLIDING') {
        // ── 「targetY を通り過ぎるか」を環状距離で判定 ──
        // remaining: 現在位置から targetY まで「進行方向に何px残っているか」
        //   scrollY < targetY → targetY - scrollY
        //   scrollY > targetY → TOTAL_STRIP_HEIGHT - scrollY + targetY（折り返しあり）
        const remaining = (s.targetY - s.scrollY + TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;

        if (remaining <= advance) {
          // このフレームで targetY に到達 or 通り過ぎる → スナップして完全停止
          s.scrollY     = s.targetY;
          s.status      = 'STOPPED';
          s.stopIndex   = Math.floor(s.scrollY / SYMBOL_HEIGHT) % REEL_LENGTH;
          s.scrollOffset = 0;
          s.isSpinning  = false;
          s.isStopped   = true;
          s.topIndex    = s.stopIndex;

          if (this.areAllStopped()) {
            this.evaluateWin();
          }
        } else {
          // まだ targetY に届かない → 通常回転を継続
          s.scrollY = (s.scrollY + advance) % TOTAL_STRIP_HEIGHT;
          syncDerived(s);
        }
      }
      // STOPPED は何もしない
    }
  }

  /**
   * 指定リールに停止指令を出す。
   *
   * SPINNING → SLIDING へ遷移し、現在のコマ境界から SLIDE_SYMBOLS コマ先の
   * コマ境界を targetY として設定する。
   * リールの速度は変わらず、update() 内で targetY 到達時に自動的に STOPPED へ移行する。
   *
   * @param reelIndex 0=左, 1=中, 2=右
   */
  stopReel(reelIndex: number): void {
    const id = INDEX_TO_REEL_ID[reelIndex];
    if (!id) return;

    const s = this.states[id];
    if (s.status !== 'SPINNING') return; // SLIDING・STOPPED はガード

    // ── targetY 計算 ──
    // 「ボタン押下時に上端にいるコマ」の境界座標 + SLIDE_SYMBOLS コマ分前進
    // → 常にコマ境界（scrollOffset = 0）になる。
    const currentBoundary = Math.floor(s.scrollY / SYMBOL_HEIGHT) * SYMBOL_HEIGHT;
    s.targetY = (currentBoundary + SLIDE_SYMBOLS * SYMBOL_HEIGHT) % TOTAL_STRIP_HEIGHT;

    // SPINNING → SLIDING へ遷移（速度は据え置き）
    s.status    = 'SLIDING';
    s.isSpinning = true;  // まだ動いている
    s.isStopped  = false;
  }

  // ─────────────────────────────────────────
  // ゲッター
  // ─────────────────────────────────────────

  /**
   * 描画クラスが参照する累積スクロール量を返す。
   * @returns 0 〜 TOTAL_STRIP_HEIGHT の環状 px 値
   */
  getScrollY(id: ReelId): number {
    return this.states[id].scrollY;
  }

  /** ReelState スナップショットを読み取り専用で返す */
  getState(id: ReelId): Readonly<ReelState> {
    return this.states[id];
  }

  /**
   * 3本すべてのリールが STOPPED かどうかを返す。
   * Space キーによる再スタート可否の判定に使用。
   */
  areAllStopped(): boolean {
    return this.ids.every((id) => this.states[id].status === 'STOPPED');
  }

  /**
   * デバッグ用: すべてのリールを強制停止し、指定した図柄を中段に表示するよう
   * 座標(scrollY)を書き換える。
   */
  forceStopAt(targetSymbol: SymbolType): void {
    for (const id of this.ids) {
      const s = this.states[id];
      // 該当リールの targetSymbol のインデックスを検索（最初に見つかったもの）
      const centerIndex = REEL_CONFIG[id].indexOf(targetSymbol);
      if (centerIndex === -1) continue;

      // 描画される一番上のコマ（firstIndex）は中段の1つ前
      const firstIndex = (centerIndex - 1 + REEL_LENGTH) % REEL_LENGTH;
      
      // firstIndex に対応する inv (逆変換座標)
      const inv = firstIndex * SYMBOL_HEIGHT;
      
      // inv から scrollY を逆算
      const scrollY = (TOTAL_STRIP_HEIGHT - inv) % TOTAL_STRIP_HEIGHT;

      // 状態を完全に書き換え
      s.scrollY     = scrollY;
      s.status      = 'STOPPED';
      s.isSpinning  = false;
      s.isStopped   = true;
      s.scrollOffset = 0;
      s.stopIndex   = Math.floor(scrollY / SYMBOL_HEIGHT) % REEL_LENGTH;
      s.topIndex    = s.stopIndex;
      s.targetY     = scrollY; // 念のため
    }
  }

  /**
   * 指定したリールで、現在枠の「中段」に表示されている図柄を取得する。
   * 描画時と同様の逆変換を用いて、配列上のインデックスを導出する。
   */
  getCenterSymbol(id: ReelId): SymbolType {
    const s = this.states[id];
    // 下向きスクロールの逆変換: 先頭コマのインデックスを計算
    const inv = (TOTAL_STRIP_HEIGHT - s.scrollY % TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;
    const firstIndex = Math.floor(inv / SYMBOL_HEIGHT) % REEL_LENGTH;
    // 中段は上から2番目なので +1
    const centerIndex = (firstIndex + 1) % REEL_LENGTH;
    
    return REEL_CONFIG[id][centerIndex];
  }

  /**
   * 全てのリールが停止した際に呼び出され、入賞判定や後告知（ランプ点灯）を行う。
   */
  evaluateWin(): void {
    const left = this.getCenterSymbol('left');
    const center = this.getCenterSymbol('center');
    const right = this.getCenterSymbol('right');

    const isSevenWin = left === '7' && center === '7' && right === '7';
    const isBarWin = left === 'BAR' && center === 'BAR' && right === 'BAR';
    const isAligned = isSevenWin || isBarWin;

    if (gameState.playState === 'BONUS_STANDBY') {
      // 既にフラグが立ってランプが光っている状態での入賞チェック
      if (isAligned) {
        console.log('🎉 ボーナス開始！');
        gameState.playState = 'BONUS_GAME';
        gameState.hasBonusFlag = false;
        gameState.isGogoLampOn = false;
      }
    } else if (gameState.playState === 'NORMAL') {
      // 後告知: 回転開始時の抽選で当選していれば、停止時にランプを点灯する
      if (gameState.hasBonusFlag) {
        gameState.isGogoLampOn = true;
        gameState.playState = 'BONUS_STANDBY';
        console.log('[DEBUG] GOGO!ランプ点灯 ✨');
      }
    }
  }
}
