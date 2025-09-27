import { db } from '@/config/firebase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Timestamp, collection, doc, runTransaction } from 'firebase/firestore';
import * as yaml from 'js-yaml';
import { QUIZ_UNIT } from '@/config/quizConfig';
import { AI } from '@/config/quizConfig';

// AI生成クイズのインターフェース
interface AIGeneratedQuiz {
  title: string;
  question: string;
  type: 'multiple_choice' | 'input';
  choices?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation?: string;
}

interface AIQuizUnit {
  title: string;
  description?: string;
  quizzes: AIGeneratedQuiz[];
}

export class AIQuizGenerationService {
  private static getGenAI() {
    const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!API_KEY) {
      throw new Error('NEXT_PUBLIC_GEMINI_API_KEY環境変数が設定されていません');
    }
    return new GoogleGenerativeAI(API_KEY);
  }

  private static getModel() {
    return this.getGenAI().getGenerativeModel({ model: AI.MODEL_NAME });
  }

  /**
   * Gemini APIを使ってクイズを生成する（リトライ機能付き）
   */
  static async generateQuizzes(
    topic: string,
    count: number = QUIZ_UNIT.MAX_QUESTIONS_PER_UNIT,
    questionType: 'mixed' | 'multiple_choice' | 'input' = 'mixed'
  ): Promise<AIQuizUnit> {
    const maxRetries = AI.MAXRETRYS; // 最大試行回数
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[AIQuizGeneration] クイズ生成開始 (試行 ${attempt}/${maxRetries}): ${topic}, 問題数: ${count}`);

        const prompt = this.createPrompt(topic, count, questionType);
        
        const model = this.getModel();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const rawText = response.text();

        console.log(`[AIQuizGeneration] Gemini APIレスポンス受信 (試行 ${attempt})`);

        // YAMLコードブロックタグを除去
        const cleanedText = this.cleanYamlResponse(rawText);
        console.log(`[AIQuizGeneration] YAML清浄化完了 (試行 ${attempt})`);

        // YAMLをパースして検証
        const parsedData = yaml.load(cleanedText) as AIQuizUnit;
        const validatedData = this.validateAndFixQuizData(parsedData, topic, count);

        console.log(`[AIQuizGeneration] クイズ生成完了: ${validatedData.quizzes.length}問`);
        return validatedData;

      } catch (error) {
        console.error(`[AIQuizGeneration] 試行 ${attempt} でエラー:`, error);
        lastError = error instanceof Error ? error : new Error('不明なエラー');
        
        // APIキーエラーやモデル利用不可の場合は即座に失敗
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMsg = error.message as string;
          if (errorMsg.includes('API key') || errorMsg.includes('invalid')) {
            throw new Error('APIキーが無効または設定されていません。管理者に連絡してください。');
          }
          if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes(`models/${AI.MODEL_NAME}`)) {
            throw new Error('AIモデルが利用できません。時間をおいて再度お試しください。');
          }
        }
        
        // 最大試行回数に達した場合
        if (attempt === maxRetries) {
          break;
        }
        
        // 次の試行まで少し待機
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // 全ての試行が失敗した場合
    const errorMessage = lastError?.message || 'クイズ生成中にエラーが発生しました';
    throw new Error(`AI生成に${maxRetries}回失敗しました。${errorMessage}\n\n別のトピックで再度お試しください。`);
  }

  /**
   * プロンプトを作成
   */
  private static createPrompt(
    topic: string,
    count: number,
    questionType: 'mixed' | 'multiple_choice' | 'input'
  ): string {

    const isEnLongPassage = topic.includes('英語長文')||topic.includes('長文')||topic.includes('英語') ? true : false;

    const typeDescription: Record<'mixed' | 'multiple_choice' | 'input', string> = {
      mixed: '選択肢問題と記述問題を混合',
      multiple_choice: '選択肢問題のみ',
      input: '記述問題のみ'
    };

    return `
あなたは教育コンテンツの専門家です。「${topic}」に関するクイズを10問作成してください。
${topic}です。難易度は、中堅国公立から難関私立大学入試くらいです。
高校生向け。中学生で習うような簡単すぎる内容が入らないように注意しろ。
カタカナの読み方は、十分に注意して、教科書と同じになるようにして。
explanationは長過ぎないように。短くても良いです。長い場合は"で囲ってください。
絶対に、titleに答えが含まれないようにして。もっと抽象的なタイトルで良い。
選択肢の数は3~5つまでで、全て文字列型で表現してください。
入力式の回答は長くなり過ぎないように、また一単語のみになるように。
${isEnLongPassage ? 'questionのところに本文（50~100語）と質問を一緒にして入れてください。' : ''}

【要求仕様】
- 問題形式: ${typeDescription[questionType]}
- 出力形式: 生のYAML形式（コードブロック不要）

【YAML形式の例】
title: 雑学クイズ
description: 雑学に関するクイズ集
quizzes:
  - title: 日本の首都
    question: "日本の首都はどこですか？"
    type: multiple_choice
    choices:
      - 大阪
      - 東京
      - 京都
    correctAnswer: 東京
    explanation: 東京都は1868年に日本の首都となりました。

  - title: G7加盟国
    question: 次のうちG7（主要国首脳会議）加盟国はどれですか？
    type: multiple_choice
    choices:
      - カナダ
      - ロシア
      - 中国
      - オーストラリア
      - インド
    correctAnswer: カナダ
    explanation: G7加盟国は、アメリカ、日本、イギリス、フランス、ドイツ、イタリア、カナダの7か国です。

  - title: 富士山の高さ
    question: 富士山の標高は何メートルですか？
    type: input
    correctAnswer: "3776"
    acceptableAnswers:
      - "3,776"
      - "約3800"
    explanation: 富士山の正確な標高は3,776メートルです。

【重要な制約】
1. 選択肢問題は必ず3〜5つの選択肢を用意
2. correctAnswerは選択肢のテキストと完全一致させる（インデックス番号ではなく）
3. 記述問題の場合、acceptableAnswersで表記揺れを考慮
4. 全ての問題に解説を付ける
5. 事実に基づいた正確な内容のみ,早押しクイズとして問題の質を高めることに努めてください。
6. YAMLの構文エラーがないよう注意
7. titleに、問題の答えを含めないよう注意

【出力指示】
\`\`\`yaml や \`\`\` などのコードブロック記号は一切使用せず、
title: から始まる生のYAMLテキストのみを出力してください。

上記の仕様に従って、${topic}に関する10問のクイズをYAML形式で生成してください。
`;
  }

  /**
   * 生成されたクイズデータを検証・修正
   */
  private static validateAndFixQuizData(data: any, topic: string, expectedCount: number = 10): AIQuizUnit {
    if (!data || typeof data !== 'object') {
      throw new Error('無効なデータ形式');
    }

    // 基本構造の検証・修正
    const result: AIQuizUnit = {
      title: data.title || `${topic}クイズ`,
      description: data.description || `${topic}に関するクイズ集`,
      quizzes: []
    };

    if (!data.quizzes || !Array.isArray(data.quizzes)) {
      throw new Error('クイズデータが見つかりません');
    }

    // 各クイズの検証・修正
    const validationErrors: string[] = [];
    data.quizzes.forEach((quiz: any, index: number) => {
      try {
        const validatedQuiz = this.validateSingleQuiz(quiz, index);
        result.quizzes.push(validatedQuiz);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '不明なエラー';
        validationErrors.push(`クイズ${index + 1}: ${errorMsg}`);
        console.warn(`[AIQuizGeneration] クイズ${index + 1}の検証エラー:`, error);
      }
    });

    if (result.quizzes.length === 0) {
      const errorDetails = validationErrors.length > 0 
        ? `\n検証エラー詳細:\n${validationErrors.join('\n')}` 
        : '';
      throw new Error(`有効なクイズが生成されませんでした。${errorDetails}`);
    }

    // 生成されたクイズが少なすぎる場合も警告
    if (result.quizzes.length < Math.min(5, expectedCount / 2)) {
      console.warn(`[AIQuizGeneration] 生成されたクイズ数が少なすぎます: ${result.quizzes.length}問`);
    }

    return result;
  }

  /**
   * 単一クイズの検証
   */
  private static validateSingleQuiz(quiz: any, index: number): AIGeneratedQuiz {
    const errors: string[] = [];

    // 必須フィールドの検証
    if (!quiz.title || typeof quiz.title !== 'string') {
      errors.push('タイトルが無効');
    }
    if (!quiz.question || typeof quiz.question !== 'string') {
      errors.push('問題文が無効');
    }
    if (!quiz.type || !['multiple_choice', 'input'].includes(quiz.type)) {
      errors.push('問題タイプが無効');
    }
    if (!quiz.correctAnswer) {
      errors.push('正解が無効');
    }

    // 選択肢問題の検証
    if (quiz.type === 'multiple_choice') {
      if (!quiz.choices || !Array.isArray(quiz.choices) || quiz.choices.length < 3) {
        errors.push('選択肢が不足');
      }
      
      // 正解が選択肢に含まれているかチェック
      if (quiz.choices && !quiz.choices.includes(quiz.correctAnswer)) {
        // インデックス指定の場合もチェック
        const index = parseInt(quiz.correctAnswer);
        if (isNaN(index) || index < 0 || index >= quiz.choices.length) {
          errors.push('正解が選択肢に含まれていない');
        } else {
          quiz.correctAnswer = quiz.choices[index];
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`問題${index + 1}: ${errors.join(', ')}`);
    }

    return {
      title: quiz.title.slice(0, 50), // 長さ制限
      question: quiz.question.slice(0, 500), // 長さ制限
      type: quiz.type,
      choices: quiz.type === 'multiple_choice' ? quiz.choices : undefined,
      correctAnswer: String(quiz.correctAnswer).slice(0, 100),
      acceptableAnswers: quiz.acceptableAnswers || [],
      explanation: quiz.explanation || ''
    };
  }

  /**
   * 生成したクイズをFirestoreに保存
   */
  static async saveGeneratedQuizUnit(
    aiQuizUnit: AIQuizUnit,
    genreId: string,
    createdBy: string,
    unitName: string
  ): Promise<string> {
    try {
      console.log(`[AIQuizGeneration] Firestoreに保存開始: ${genreId}/${unitName}`);

      const unitId = await runTransaction(db, async (transaction) => {
        // 単元ドキュメントを作成
        const unitRef = doc(collection(db, 'genres', genreId, 'official_quiz_units'));
        const unitData = {
          title: unitName,
          description: aiQuizUnit.description,
          genre: genreId,
          createdBy: createdBy,
          createdAt: Timestamp.now(),
          quizCount: aiQuizUnit.quizzes.length,
          useCount: 0,
          isPublic: true
        };

        transaction.set(unitRef, unitData);

        // 各クイズを保存
        aiQuizUnit.quizzes.forEach((quiz, index) => {
          const quizRef = doc(collection(db, 'genres', genreId, 'official_quiz_units', unitRef.id, 'quizzes'));
          const quizData = {
            title: quiz.title,
            question: quiz.question,
            type: quiz.type,
            choices: quiz.choices || [],
            correctAnswer: quiz.correctAnswer,
            acceptableAnswers: quiz.acceptableAnswers || [],
            explanation: quiz.explanation || '',
            genre: genreId,
            createdBy: createdBy,
            createdAt: Timestamp.now(),
            useCount: 0,
            correctCount: 0
          };

          transaction.set(quizRef, quizData);
        });

        return unitRef.id;
      });

      console.log(`[AIQuizGeneration] 保存完了: unitId=${unitId}`);
      return unitId;

    } catch (error) {
      console.error('[AIQuizGeneration] 保存エラー:', error);
      throw new Error('生成したクイズの保存に失敗しました');
    }
  }

  /**
   * YAMLレスポンスからコードブロックタグを除去
   */
  private static cleanYamlResponse(rawText: string): string {
    // コードブロックタグを除去
    let cleanedText = rawText
      .replace(/^```yaml\s*\n?/gim, '') // 開始タグを除去
      .replace(/^```\s*$/gim, '') // 終了タグを除去
      .replace(/^`{1,2}yaml\s*\n?/gim, '') // バッククォート1-2個の開始タグ
      .replace(/^`{1,2}\s*$/gim, '') // バッククォート1-2個の終了タグ
      .trim();

    // デバッグ用：清浄化前後のテキストをログ出力
    console.log('[AIQuizGeneration] Raw text (最初の200文字):', rawText.substring(0, 200));
    console.log('[AIQuizGeneration] Cleaned text (最初の200文字):', cleanedText.substring(0, 200));

    return cleanedText;
  }
}
