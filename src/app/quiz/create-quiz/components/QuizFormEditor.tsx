'use client';

import { FC, useState } from 'react';
import { FaCheck, FaPlus, FaTrash, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Quiz, QuizType } from '@/types/quiz';
import LatexRenderer from '@/components/latex/LatexRenderer';
import LatexGuide from '@/components/latex/LatexGuide';


interface QuizFormEditorProps {
  onSave: (quiz: Omit<Quiz, 'quizId' | 'createdAt'>) => void;
  onCancel: () => void;
  editingQuiz?: Quiz | null;
  genre: string;
  createdBy: string;
}

const QuizFormEditor: FC<QuizFormEditorProps> = ({
  onSave,
  onCancel,
  editingQuiz,
  genre,
  createdBy
}) => {
  // クイズフォームの状態
  const [quizTitle, setQuizTitle] = useState(editingQuiz?.title || '');
  const [question, setQuestion] = useState(editingQuiz?.question || '');
  const [type, setType] = useState<QuizType>(editingQuiz?.type || 'multiple_choice');
  const [choices, setChoices] = useState<string[]>(editingQuiz?.choices && editingQuiz.choices.length >= 3 ? editingQuiz.choices : ['', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState(editingQuiz?.correctAnswer || '');
  const [acceptableAnswers, setAcceptableAnswers] = useState<string[]>(editingQuiz?.acceptableAnswers || ['']);
  const [explanation, setExplanation] = useState(editingQuiz?.explanation || '');
  const [errorMessage, setErrorMessage] = useState('');
  
  // プレビュー表示の状態
  const [showTitlePreview, setShowTitlePreview] = useState(false);
  const [showQuestionPreview, setShowQuestionPreview] = useState(false);
  const [showExplanationPreview, setShowExplanationPreview] = useState(false);
  const [showChoicesPreview, setShowChoicesPreview] = useState(false);
  
  // 問題タイプが変更されたときに正解をリセット
  const handleTypeChange = (newType: QuizType) => {
    setType(newType);
    setCorrectAnswer(''); // 問題タイプが変わったときに正解をリセット
    if (newType === 'multiple_choice' && choices.length < 3) {
      setChoices(['', '', '']);
    }
  };

  // 選択肢の更新
  const updateChoice = (index: number, value: string) => {
    const newChoices = [...choices];
    newChoices[index] = value;
    setChoices(newChoices);
    
    // エラーメッセージが重複に関するものの場合、リアルタイムでクリア
    if (errorMessage.includes('重複')) {
      setErrorMessage('');
    }
  };
  
  // 選択肢の重複チェック（リアルタイム用）
  const isDuplicateChoice = (index: number, value: string) => {
    if (!value.trim()) return false;
    return choices.some((choice, i) => 
      i !== index && choice.trim().toLowerCase() === value.trim().toLowerCase()
    );
  };
  
  // 選択肢を追加
  const addChoice = () => {
    if (choices.length < 5) {
      setChoices([...choices, '']);
    }
  };

  // 選択肢を削除
  const removeChoice = (index: number) => {
    if (choices.length > 3) {
      const newChoices = [...choices];
      newChoices.splice(index, 1);
      
      // 削除した選択肢が正解だった場合、正解をリセット
      if (correctAnswer === choices[index]) {
        setCorrectAnswer('');
      }
      
      setChoices(newChoices);
    }
  };

  // 許容回答の更新
  const updateAcceptableAnswer = (index: number, value: string) => {
    const newAnswers = [...acceptableAnswers];
    newAnswers[index] = value;
    setAcceptableAnswers(newAnswers);
  };

  // 許容回答を追加
  const addAcceptableAnswer = () => {
    setAcceptableAnswers([...acceptableAnswers, '']);
  };

  // 許容回答を削除
  const removeAcceptableAnswer = (index: number) => {
    if (acceptableAnswers.length > 1) {
      const newAnswers = [...acceptableAnswers];
      newAnswers.splice(index, 1);
      setAcceptableAnswers(newAnswers);
    }
  };

  // クイズフォームの検証
  const validateQuizForm = () => {
    if (!quizTitle.trim()) {
      setErrorMessage('クイズのタイトルを入力してください');
      return false;
    }
    
    if (!question.trim()) {
      setErrorMessage('問題文を入力してください');
      return false;
    }
    
    if (type === 'multiple_choice') {
      // 選択肢の数を確認
      if (choices.length < 3) {
        setErrorMessage('選択肢は最低3つ必要です');
        return false;
      }
      
      if (choices.length > 5) {
        setErrorMessage('選択肢は最大5つまでです');
        return false;
      }
      
      // 選択肢が全て入力されているか確認
      if (choices.some(choice => !choice.trim())) {
        setErrorMessage('全ての選択肢を入力してください');
        return false;
      }
      
      // 選択肢の重複チェック
      const trimmedChoices = choices.map(choice => choice.trim());
      const uniqueChoices = new Set(trimmedChoices);
      if (uniqueChoices.size !== trimmedChoices.length) {
        setErrorMessage('選択肢に重複があります。全ての選択肢は異なる内容にしてください');
        return false;
      }
      
      // 正解が選択されているか確認
      if (!correctAnswer || !choices.includes(correctAnswer)) {
        setErrorMessage('選択肢から正解を選択してください');
        return false;
      }
    } else if (type === 'input') {
      // 正解が入力されているか確認
      if (!correctAnswer.trim()) {
        setErrorMessage('正解を入力してください');
        return false;
      }
    }
    
    setErrorMessage('');
    return true;
  };

  // クイズを保存
  const handleSave = () => {
    if (!validateQuizForm()) return;

    const quizData: Omit<Quiz, 'quizId' | 'createdAt'> = {
      title: quizTitle,
      question,
      type,
      choices,
      correctAnswer,
      acceptableAnswers,
      explanation,
      genre,
      createdBy,
      useCount: 0,
      correctCount: 0
    };
    
    onSave(quizData);
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">{editingQuiz ? 'クイズを編集' : '新しいクイズ'}</h3>
        <div className="flex items-center space-x-3">
          <LatexGuide />
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            キャンセル
          </button>
        </div>
      </div>
      
      {errorMessage && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-4">
          <p>{errorMessage}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="quizTitle" className="form-label">クイズタイトル</label>
            <button
              type="button"
              onClick={() => setShowTitlePreview(!showTitlePreview)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              {showTitlePreview ? <FaEyeSlash className="mr-1" /> : <FaEye className="mr-1" />}
              {showTitlePreview ? 'プレビューを隠す' : 'LaTeXプレビュー'}
            </button>
          </div>
          <input
            type="text"
            id="quizTitle"
            className="form-input"
            value={quizTitle}
            onChange={(e) => setQuizTitle(e.target.value)}
            placeholder="クイズのタイトルを入力（LaTeX記法対応: $x^2$, $$\frac{1}{2}$$）"
            required
          />
          {showTitlePreview && quizTitle && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-600 mb-1">プレビュー:</div>
              <div className="text-lg font-bold">
                <LatexRenderer text={quizTitle} />
              </div>
            </div>
          )}
        </div>
        
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="question" className="form-label">問題文</label>
            <button
              type="button"
              onClick={() => setShowQuestionPreview(!showQuestionPreview)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              {showQuestionPreview ? <FaEyeSlash className="mr-1" /> : <FaEye className="mr-1" />}
              {showQuestionPreview ? 'プレビューを隠す' : 'LaTeXプレビュー'}
            </button>
          </div>
          <textarea
            id="question"
            className="form-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="問題文を入力（LaTeX記法対応: $x^2$, $$\frac{1}{2}$$）"
            rows={3}
            required
          ></textarea>
          {showQuestionPreview && question && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-600 mb-1">プレビュー:</div>
              <div className="text-lg">
                <LatexRenderer text={question} />
              </div>
            </div>
          )}
        </div>
        
        
        
        <div>
          <label className="form-label">問題タイプ</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="multiple_choice"
                checked={type === 'multiple_choice'}
                onChange={() => handleTypeChange('multiple_choice')}
                className="mr-2"
              />
              選択式
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="type"
                value="input"
                checked={type === 'input'}
                onChange={() => handleTypeChange('input')}
                className="mr-2"
              />
              入力式
            </label>
          </div>
        </div>
        
        {/* 選択式の場合の選択肢 */}
        {type === 'multiple_choice' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="form-label">選択肢（3〜5択）</p>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowChoicesPreview(!showChoicesPreview)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  {showChoicesPreview ? <FaEyeSlash className="mr-1" /> : <FaEye className="mr-1" />}
                  {showChoicesPreview ? 'プレビューを隠す' : 'LaTeXプレビュー'}
                </button>
                <button
                  type="button"
                  onClick={addChoice}
                  disabled={choices.length >= 5}
                  className={`text-sm flex items-center ${choices.length >= 5 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-800'}`}
                >
                  <FaPlus className="mr-1" size={12} /> 選択肢を追加
                </button>
              </div>
            </div>
            
            {choices.map((choice, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center">
                  <label className="inline-flex items-center mr-4">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={choice}
                      checked={correctAnswer === choice}
                      onChange={() => setCorrectAnswer(choice)}
                      className="mr-2"
                      disabled={!choice.trim()}
                    />
                    <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 text-indigo-800 rounded-full mr-2">
                      {String.fromCharCode(65 + index)}
                    </span>
                  </label>
                  <div className="flex-1 mr-2">
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => updateChoice(index, e.target.value)}
                      className={`form-input ${isDuplicateChoice(index, choice) ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder={`選択肢 ${String.fromCharCode(65 + index)} (LaTeX記法対応: $x^2$, $$\\frac{1}{2}$$)`}
                      required
                    />
                    {isDuplicateChoice(index, choice) && (
                      <p className="text-xs text-red-500 mt-1">この選択肢は重複しています</p>
                    )}
                  </div>
                  {choices.length > 3 && (
                    <button
                      type="button"
                      onClick={() => removeChoice(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
                {showChoicesPreview && choice && (
                  <div className="ml-12 p-2 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="text-xs text-gray-600 mb-1">選択肢 {String.fromCharCode(65 + index)} プレビュー:</div>
                    <div className="text-base">
                      <LatexRenderer text={choice} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <p className="text-xs text-gray-500">
              ※ 選択肢は3〜5個の間で設定できます
            </p>
          </div>
        )}
        
        {/* 入力式の場合の正解と許容回答 */}
        {type === 'input' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="correctAnswer" className="form-label">正解</label>
              <input
                type="text"
                id="correctAnswer"
                className="form-input"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="正解を入力"
              />
            </div>
            
            <div>
              <label className="form-label">許容される他の回答 (省略可)</label>
              {acceptableAnswers.map((answer, index) => (
                <div key={index} className="flex items-center mb-2">
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => updateAcceptableAnswer(index, e.target.value)}
                    className="form-input mr-2"
                    placeholder="別の正解を入力"
                  />
                  {acceptableAnswers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAcceptableAnswer(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAcceptableAnswer}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center mt-2"
              >
                <FaPlus className="mr-1" size={12} /> 別の回答を追加
              </button>
              <p className="text-sm text-gray-500 mt-1">
                入力式の問題では表記ゆれを考慮して複数の回答を許容できます
              </p>
            </div>
          </div>
        )}
        
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="quizExplanation" className="form-label">解説 (省略可)</label>
            <button
              type="button"
              onClick={() => setShowExplanationPreview(!showExplanationPreview)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              {showExplanationPreview ? <FaEyeSlash className="mr-1" /> : <FaEye className="mr-1" />}
              {showExplanationPreview ? 'プレビューを隠す' : 'LaTeXプレビュー'}
            </button>
          </div>
          <textarea
            id="quizExplanation"
            className="form-textarea"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="解説を入力してください。正解の根拠や関連する背景知識なども含めて詳しく説明すると学習効果が高まります。（LaTeX記法対応: $x^2$, $$\frac{1}{2}$$）"
            rows={5}
          ></textarea>
          {showExplanationPreview && explanation && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-sm text-gray-600 mb-1">プレビュー:</div>
              <div className="text-base">
                <LatexRenderer text={explanation} />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary flex items-center"
          >
            {editingQuiz ? (
              <>
                <FaCheck className="mr-2" /> 更新する
              </>
            ) : (
              <>
                <FaPlus className="mr-2" /> 追加する
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizFormEditor;
