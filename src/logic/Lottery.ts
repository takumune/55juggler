export type LotteryFlag = 'NONE' | 'REPLAY' | 'GRAPE' | 'BELL' | 'CLOWN' | 'CHERRY' | 'BIG' | 'REG';
export type Setting = 1 | 2 | 3 | 4 | 5 | 6 | 'X';

// デノミとしての分母。各小役の確率は 1/x となる。
const PROB_TABLE: Record<Setting, Record<Exclude<LotteryFlag, 'NONE'>, number>> = {
  1: { BIG: 259.0, REG: 354.2, GRAPE: 6.40, CHERRY: 36.0, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  2: { BIG: 258.0, REG: 332.7, GRAPE: 6.36, CHERRY: 35.9, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  3: { BIG: 257.0, REG: 306.2, GRAPE: 6.32, CHERRY: 35.7, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  4: { BIG: 254.0, REG: 268.6, GRAPE: 6.26, CHERRY: 35.2, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  5: { BIG: 247.3, REG: 255.0, GRAPE: 6.20, CHERRY: 34.9, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  6: { BIG: 234.9, REG: 234.9, GRAPE: 6.10, CHERRY: 34.1, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
  'X': { BIG: 2.0, REG: 354.2, GRAPE: 6.40, CHERRY: 36.0, CLOWN: 1024, BELL: 1024, REPLAY: 7.3 },
};

export class Lottery {
  /**
   * 現在の設定に基づいて、1ゲームごとの成立役を抽選する。
   * (簡略化のため現状は完全排他抽選としているが、本来はチェリー同時当選等も存在可能)
   */
  public static draw(setting: Setting): LotteryFlag {
    const table = PROB_TABLE[setting];
    
    // 排他抽選を行うため、順番に評価する
    // 役物優先度が高いものから評価（実際はどこからでも同じだが積み上げで判定）
    const roles: Exclude<LotteryFlag, 'NONE'>[] = [
      'REPLAY', 'GRAPE', 'BELL', 'CLOWN', 'CHERRY', 'BIG', 'REG'
    ];
    
    const randomVal = Math.random();
    let cumulative = 0;

    for (const role of roles) {
      const prob = 1 / table[role];
      cumulative += prob;
      if (randomVal < cumulative) {
        return role;
      }
    }
    
    return 'NONE';
  }

  /**
   * ボーナス消化中の抽選（フェーズ5.1）
   * 実際はチェリーなども低確率で抽選されるが、便宜上ブドウ高確率（今回は100%）とする。
   */
  public static drawBonus(): LotteryFlag {
    return 'GRAPE';
  }
}
