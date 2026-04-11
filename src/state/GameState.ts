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

  /** 現在消化中のボーナス種別 */
  public runningBonus: 'NONE' | 'BIG' | 'REG' = 'NONE';

  /** ボーナス消化中の累積払い出し枚数 */
  public currentBonusPayOut: number = 0;

  /** 持ち越さるボーナスフラグ */
  public activeBonus: 'NONE' | 'BIG' | 'REG' = 'NONE';

  /** そのゲーム限りの小役フラグ */
  public activeSmallRole: 'NONE' | 'REPLAY' | 'GRAPE' | 'BELL' | 'CLOWN' | 'CHERRY' = 'NONE';

  /** 現在の台設定 (1〜6, またはX) */
  public setting: 1 | 2 | 3 | 4 | 5 | 6 | 'X' = 6;

  /** 所持メダル（クレジット） */
  public credits: number = 0;

  /** 今回の払い出し枚数 */
  public pay: number = 0;

  /** 現在ベットされている枚数 */
  public bet: number = 0;

  /** 次ゲームへのリプレイ状態 */
  public isReplay: boolean = false;

  /** フェーズ6.1: 前回のスピン開始時刻 (ms) */
  public lastSpinTime: number = 0;

  /** フェーズ6.1: ウェイト機能の有効/無効 */
  public isWaitEnabled: boolean = true;

  /** 目押し補助（どこで押しても揃う）の有効/無効 */
  public isAutoAssistEnabled: boolean = false;

  /** インターバル待ち中かどうか */
  public isWaiting: boolean = false;

  /** フェーズ6.3: フラッシュ演出の終了予定時刻 (ms) */
  public flashEndTime: number = 0;

  // ─────────────────────────────────────────
  // データカウンター用プロパティ
  // ─────────────────────────────────────────

  /** 総ゲーム数 */
  public totalGames: number = 0;

  /** 現在のゲーム数（ボーナス後にリセット） */
  public currentGames: number = 0;

  /** BIG BONUS 回数 */
  public bbCount: number = 0;

  /** REGULAR BONUS 回数 */
  public rbCount: number = 0;

  /** 差枚数（ベットで減少・払い出しで増加） */
  public netCoinDiff: number = 0;

  /** スランプグラフ用の差枚数履歴 */
  public history: number[] = [0];

  /** 成立役の履歴（ゲーム数と役のセット） */
  public winHistory: { game: number, role: string }[] = [];

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
