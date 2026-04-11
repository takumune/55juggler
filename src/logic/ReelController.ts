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
 * かつての固定滑り定数。現在はフェーズ3.1の動的滑り計算 (calculateSlip) に置き換わっています。
 * 参考: 実際のパチスロでの最大引き込みコマ数は 4 コマ。
 */
// const SLIDE_SYMBOLS = 2; // もう使わないが記録用にコメント

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
   * SPINNING → SLIDING へ遷移し、フラグ状態と出目に応じた滑りコマ数を計算して
   * targetY を設定する。
   *
   * @param reelIndex 0=左, 1=中, 2=右
   */
  stopReel(reelIndex: number): void {
    const id = INDEX_TO_REEL_ID[reelIndex];
    if (!id) return;

    const s = this.states[id];
    if (s.status !== 'SPINNING') return; // SLIDING・STOPPED はガード

    // ── targetY 計算 ──
    // 停止ボタンが押された瞬間の位置から「次のコマ境界」を求める
    const nextBoundary = Math.ceil(s.scrollY / SYMBOL_HEIGHT) * SYMBOL_HEIGHT;

    // 次の境界に到達した時点で一番上に描画される図柄のインデックス(baseFirstIndex)を逆算
    const targetInv = (TOTAL_STRIP_HEIGHT - nextBoundary % TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;
    const baseFirstIndex = Math.floor(targetInv / SYMBOL_HEIGHT) % REEL_LENGTH;

    // フェーズ3.1: フラグに基づく「引き込み（滑り）」コマ数（0〜4）の計算
    const slip = this.calculateSlip(reelIndex, baseFirstIndex);

    s.targetY = (nextBoundary + slip * SYMBOL_HEIGHT) % TOTAL_STRIP_HEIGHT;

    // SPINNING → SLIDING へ遷移（速度は据え置き）
    s.status    = 'SLIDING';
    s.isSpinning = true;  // まだ動いている
    s.isStopped  = false;
  }

  /**
   * 現在のフラグに基づいて、最大4コマの範囲で「引き込み（滑り）」コマ数を計算する。
   * (フェーズ3.1: 当選役の引き込み ＋ フェーズ3.2: ハズレ役の蹴飛ばし)
   */
  private calculateSlip(reelIndex: number, currentFirstIndex: number): number {
    const id = INDEX_TO_REEL_ID[reelIndex];
    // アクティブなフラグ（小役優先、なければボーナス）
    const flag = gameState.activeSmallRole !== 'NONE' ? gameState.activeSmallRole : gameState.activeBonus;
    
    let targetSymbol: SymbolType | null = null;
    
    // 各フラグに対する目標図柄（すべての中段ラインに揃える前提）
    if (flag === 'BIG') targetSymbol = '7';
    else if (flag === 'REG') targetSymbol = (id === 'right') ? 'BAR' : '7';
    else if (flag === 'GRAPE') targetSymbol = 'GRAPE';
    else if (flag === 'REPLAY') targetSymbol = 'REPLAY';
    else if (flag === 'BELL') targetSymbol = 'BELL';
    else if (flag === 'CLOWN') targetSymbol = 'CLOWN';
    else if (flag === 'CHERRY') targetSymbol = 'CHERRY';

    // 1. 当選役がある場合、0コマ〜4コマ滑りの範囲で引き込みを試みる (3.1)
    if (targetSymbol) {
      for (let slip = 0; slip <= 4; slip++) {
        const candidateFirstIndex = (currentFirstIndex - slip + REEL_LENGTH) % REEL_LENGTH;
        const candidateCenterIndex = (candidateFirstIndex + 1) % REEL_LENGTH;
        if (REEL_CONFIG[id][candidateCenterIndex] === targetSymbol) {
          // 引き込める位置だが、他の誤爆（偶然当たっていない別役が揃う）がないか確認 (3.2連携)
          if (!this.wouldFormUnauthorizedWin(reelIndex, slip, currentFirstIndex)) {
            return slip; 
          }
        }
      }
    }

    // 2. 引っ込み対象がない（ハズレ）、または引けない場合、0コマ〜4コマの間で
    // 「不正な入賞が発生しない」最短の滑りを優先して探す（フェーズ3.2 蹴飛ばし）
    for (let slip = 0; slip <= 4; slip++) {
      if (!this.wouldFormUnauthorizedWin(reelIndex, slip, currentFirstIndex)) {
        return slip;
      }
    }

    // 3. 万が一（配列構造上で回避不可能な場合など、理論上起こらないがフォールバック）
    return 0;
  }

  /**
   * その滑りコマ数で停止した場合、「当選していない役」が誤って揃ってしまうか（誤爆）を判定する。
   * (フェーズ4.1: 有効5ラインの全判定に対応)
   */
  private wouldFormUnauthorizedWin(reelIndex: number, slip: number, currentFirstIndex: number): boolean {
    const id = INDEX_TO_REEL_ID[reelIndex];
    const candidateFirstIndex = (currentFirstIndex - slip + REEL_LENGTH) % REEL_LENGTH;

    const layout = {
      left: this.states.left.status === 'STOPPED' 
        ? this.getVisibleSymbols('left')
        : { top: 'UL_T', center: 'UL_C', bottom: 'UL_B' },
      center: this.states.center.status === 'STOPPED'
        ? this.getVisibleSymbols('center')
        : { top: 'UC_T', center: 'UC_C', bottom: 'UC_B' },
      right: this.states.right.status === 'STOPPED'
        ? this.getVisibleSymbols('right')
        : { top: 'UR_T', center: 'UR_C', bottom: 'UR_B' }
    };

    // シミュレーション対象のリールを上書き
    layout[id] = this.getSimulatedVisibleSymbols(id, candidateFirstIndex);

    const lines = [
      [layout.left.center, layout.center.center, layout.right.center],
      [layout.left.top, layout.center.top, layout.right.top],
      [layout.left.bottom, layout.center.bottom, layout.right.bottom],
      [layout.left.top, layout.center.center, layout.right.bottom],
      [layout.left.bottom, layout.center.center, layout.right.top]
    ];

    const flag = gameState.activeSmallRole !== 'NONE' ? gameState.activeSmallRole : gameState.activeBonus;

    for (const [l, c, r] of lines) {
      const winRole = this.getWinRole(l, c, r);
      if (winRole !== 'NONE' && winRole !== flag) {
        return true; // 当選していない役が揃ってしまう
      }
    }

    return false;
  }

  /** あるリールの現在の見え方（上・中・下段）を取得する */
  private getVisibleSymbols(id: ReelId) {
    const s = this.states[id];
    const inv = (TOTAL_STRIP_HEIGHT - s.scrollY % TOTAL_STRIP_HEIGHT) % TOTAL_STRIP_HEIGHT;
    const firstIndex = Math.floor(inv / SYMBOL_HEIGHT) % REEL_LENGTH;
    return this.getSimulatedVisibleSymbols(id, firstIndex);
  }

  /** 指定インデックスが先頭に来た時の見え方（上・中・下段）をシミュレートする */
  private getSimulatedVisibleSymbols(id: ReelId, firstIndex: number) {
    return {
      top: REEL_CONFIG[id][firstIndex],
      center: REEL_CONFIG[id][(firstIndex + 1) % REEL_LENGTH],
      bottom: REEL_CONFIG[id][(firstIndex + 2) % REEL_LENGTH],
    };
  }

  /** ライン上の3つの図柄から成立役を判定する */
  private getWinRole(symL: string, symC: string, symR: string): string {
    if (symL === '7' && symC === '7' && symR === '7') return 'BIG';
    if (symL === '7' && symC === '7' && symR === 'BAR') return 'REG';
    if (symL === 'BAR' && symC === 'BAR' && symR === 'BAR') return 'REG'; // 万が一のため
    if (symL === 'REPLAY' && symC === 'REPLAY' && symR === 'REPLAY') return 'REPLAY';
    if (symL === 'GRAPE' && symC === 'GRAPE' && symR === 'GRAPE') return 'GRAPE';
    if (symL === 'BELL' && symC === 'BELL' && symR === 'BELL') return 'BELL';
    if (symL === 'CLOWN' && symC === 'CLOWN' && symR === 'CLOWN') return 'CLOWN';
    // チェリーは左に止まるだけで単独入賞
    if (symL === 'CHERRY') return 'CHERRY';
    
    return 'NONE';
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
   * 全てのリールが停止した際に呼び出され、5ラインの入賞判定、払い出し、後告知等を行う。
   */
  evaluateWin(): void {
    const layout = {
      left: this.getVisibleSymbols('left'),
      center: this.getVisibleSymbols('center'),
      right: this.getVisibleSymbols('right')
    };

    const lines = [
      [layout.left.center, layout.center.center, layout.right.center],
      [layout.left.top, layout.center.top, layout.right.top],
      [layout.left.bottom, layout.center.bottom, layout.right.bottom],
      [layout.left.top, layout.center.center, layout.right.bottom],
      [layout.left.bottom, layout.center.center, layout.right.top]
    ];

    let totalPay = 0;
    let wonBonus: string = 'NONE';
    let wonReplay = false;
    let cherryPaid = false; // チェリーの重複払出を防ぐ用

    for (const [l, c, r] of lines) {
      const role = this.getWinRole(l as string, c as string, r as string);
      switch(role) {
        case 'REPLAY': wonReplay = true; break;
        case 'GRAPE': 
          totalPay += (gameState.playState === 'BONUS_GAME') ? 14 : 8; 
          break;
        case 'BELL': totalPay += 14; break;
        case 'CLOWN': totalPay += 10; break;
        case 'BIG': wonBonus = 'BIG'; break;
        case 'REG': wonBonus = 'REG'; break;
        case 'CHERRY': 
          if (!cherryPaid) {
            totalPay += 2; 
            cherryPaid = true;
          }
          break;
      }
    }

    // フェーズ4.2: 払い出し処理
    if (totalPay > 0) {
      console.log(`🎰 小役入賞: ${totalPay}枚の払い出し！`);
      gameState.pay = totalPay;
      gameState.credits += totalPay;
      
      // フェーズ6.3: フラッシュ演出（バックライトを500ms点滅）
      gameState.flashEndTime = Date.now() + 500;
    }

    // フェーズ5.1: ボーナス終了判定
    if (gameState.playState === 'BONUS_GAME' && totalPay > 0) {
      gameState.currentBonusPayOut += totalPay;
      const targetPay = gameState.runningBonus === 'BIG' ? 252 : 98;
      if (gameState.currentBonusPayOut >= targetPay) {
        console.log(`🎊 ${gameState.runningBonus} ボーナス終了！（合計払い出し: ${gameState.currentBonusPayOut}枚）`);
        gameState.playState = 'NORMAL';
        gameState.runningBonus = 'NONE';
        gameState.currentBonusPayOut = 0;
      }
    }

    // フェーズ1.3: リプレイの判定
    if (wonReplay) {
      console.log('🔄 リプレイ成立！次ゲームはメダル不要です');
      gameState.isReplay = true;
      gameState.bet = 3; // 次ゲーム用に自動ベット
    } else {
       gameState.isReplay = false;
    }

    if (gameState.playState === 'BONUS_STANDBY') {
      // 既にフラグが立ってランプが光っている状態でのボーナス入賞完了
      if (wonBonus !== 'NONE') {
        console.log(`🎉 ボーナス（${wonBonus}）開始！`);
        gameState.playState = 'BONUS_GAME';
        gameState.activeBonus = 'NONE';
        gameState.isGogoLampOn = false;
      }
    } else if (gameState.playState === 'NORMAL') {
      // 後告知: 回転開始時の抽選で当選していれば、停止時にランプを点灯する
      if (gameState.activeBonus !== 'NONE') {
        gameState.isGogoLampOn = true;
        gameState.playState = 'BONUS_STANDBY';
        console.log('[DEBUG] GOGO!ランプ点灯 ✨');
      }
    }
  }
}
