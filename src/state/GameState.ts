// ─────────────────────────────────────────
// ゲーム全体の状態管理
// ─────────────────────────────────────────

export type PlayState = 'NORMAL' | 'BONUS_STANDBY' | 'BONUS_GAME';

export class GameState {
  private static instance: GameState;

  /** GOGO!ランプの点灯状態（完全告知） */
  public isGogoLampOn: boolean = false;

  /** 現在のゲーム状態（通常時、ボーナス確定状態、ボーナス消化中） */
  public playState: PlayState = 'NORMAL';

  /** 内部的にボーナスが当選しているかどうか（フラグ） */
  public hasBonusFlag: boolean = false;

  private constructor() {}

  /** シングルトンインスタンスを取得 */
  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }
}

/** グローバルなゲーム状態にアクセスするためのエクスポート */
export const gameState = GameState.getInstance();
