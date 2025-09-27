/**
 * クイズアプリ全体で使用される設定値
 */

// タイミング関連の設定（ミリ秒）
export const TIMING = {
  // ルーム自動解散時間（3分）
  AUTO_DISBAND_TIME_MS: 3 * 60 * 10005,

  // 正解後、次の問題に進むまでの待機時間
  NEXT_QUESTION_DELAY: 5000,
  
  // 解答制限時間（早押し後の制限時間）
  ANSWER_TIMEOUT: 8000, // 8秒
  
  // ルーム参加ボタン無効化時間（連打防止）
  ROOM_JOIN_BUTTON_DISABLE_TIME: 4000, // 4秒
  
  // 問題の制限時間（デフォルト）
  QUESTION_TIMEOUT: 30000,
  // ジャンル別制限時間（ミリ秒）
  GENRE_TIMEOUTS: {
    '日本史': 20000,    // 15秒
    '世界史': 20000,    // 15秒
    '数学': 60000,      // 60秒
    '物理': 45000,      // 45秒
    '化学': 45000,      // 45秒
    '生物': 45000,      // 45秒
    '地理': 30000,      // 30秒
    '現代社会': 30000,  // 30秒
    '政治・経済': 30000, // 30秒
    '倫理': 30000,      // 30秒
    '国語': 30000,      // 30秒
    '英語': 300000       // 5分
  } as const,


  QUIZ_AUTO_SAVE_INTERVAL: 10000, // クイズ自動保存間隔（ミリ秒）


  QUIZ_UNIT_PUBLISH_ROUTER_INTERVAL: 1000, // クイズユニットのパブリッシュ間隔（ミリ秒）
};


export const QUIZ_UNIT = {
  // ルーム関連
  MAX_QUIZES_PER_ROOM: 10, // 各ルームの最大クイズ数

  // 単元関連
  MAX_UNITS: 100, // 最大100ユニット
  MAX_QUESTIONS_PER_UNIT: 100, // 各ユニットの最大問題数
  
  // テキスト長制限
  MAX_TITLE_LENGTH: 50, // タイトルの最大文字数
  MAX_DESCRIPTION_LENGTH: 200, // 説明の最大文字数
  MAX_QUESTION_LENGTH: 6000, // 問題文の最大文字数
  MAX_CORRECT_ANSWER_LENGTH: 150, // 正解の最大文字数
  MAX_CHOICE_LENGTH: 150, // 選択肢の最大文字数
  MAX_EXPLANATION_LENGTH: 1500, // 解説の最大文字数
  MAX_ACCEPTABLE_ANSWER_LENGTH: 1200, // 許容回答の最大文字数
  
  // 選択肢関連
  MIN_CHOICES: 3, // 最小選択肢数
  MAX_CHOICES: 5, // 最大選択肢数
  
}

// スコア関連の設定
export const SCORING = {

  SOLO_MULTIPLIER: 0.3, // 一人プレイ時の経験値倍率 (0~1)

  // 正解時の得点
  CORRECT_ANSWER_SCORE: 50,

  // 不正解時の減点
  INCORRECT_ANSWER_PENALTY: -20,

  SCORE_PER_EXP: 10, // 1経験値あたりのスコア（10ポイントで1経験値）

  EXP_PERFECT_ANSWER: 5, // 完答時の経験値
};

export const AI = {
  
  MODEL_NAME: 'gemini-2.0-flash', // AIモデル名

  MAXRETRYS: 3, // AIの最大リトライ回数
}


/**
 * ジャンルに応じた制限時間を取得
 * @param genre ジャンル名
 * @returns 制限時間（ミリ秒）
 */
export function getQuestionTimeout(genre: string): number {
  return TIMING.GENRE_TIMEOUTS[genre as keyof typeof TIMING.GENRE_TIMEOUTS] || TIMING.QUESTION_TIMEOUT;
}
