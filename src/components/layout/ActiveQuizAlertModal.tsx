'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { useQuiz } from '@/hooks/useQuiz';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { db, usersDb } from '@/config/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function ActiveQuizAlertModal() {
  const { quizRoom } = useQuiz();
  const { currentUser } = useAuth();
  const router = useRouter();
  const [showAlert, setShowAlert] = React.useState(false);
  const [manualRoomId, setManualRoomId] = React.useState<string | null>(null);
  
  // クイズルームが進行中の場合、アラートを表示する
  // タイムアウト用のrefを作成
  const autoRedirectTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // ルームへのリダイレクト処理を共通化
  const redirectToRoom = React.useCallback(() => {
    // quizRoom.roomId または manualRoomId を使用
    const roomId = quizRoom?.roomId || manualRoomId;
    
    if (roomId) {
      try {
        console.log('[ActiveQuizAlertModal] ルームにリダイレクト:', roomId);
        setShowAlert(false); // 先に非表示にする
        
        // Next.jsのrouterを使用（App Routerの推奨方法）
        router.push(`/quiz/room?id=${roomId}`);
        
        // バックアップタイマー（router.pushが失敗した場合のみ実行）
        const backupTimer = setTimeout(() => {
          // 既にリダイレクトが完了していないか確認
          if (typeof window !== 'undefined' && window.location.pathname.includes('/quiz/room')) {
            console.log('[ActiveQuizAlertModal] すでにルームページに移動済みです');
            return;
          }
          
          console.log('[ActiveQuizAlertModal] バックアップリダイレクト実行');
          router.replace(`/quiz/room?id=${roomId}`);
        }, 500);
        
        // タイマーをクリアする関数を返す
        return () => clearTimeout(backupTimer);
      } catch (error) {
        console.error('[ActiveQuizAlertModal] リダイレクトエラー:', error);
        // エラー時はreplace（より強制的なリダイレクト）
        router.replace(`/quiz/room?id=${roomId}`);
      }
    } else {
      console.error('[ActiveQuizAlertModal] ルームIDが存在しません:', {
        quizRoom,
        manualRoomId,
        currentUser: currentUser?.uid
      });
      
      // より詳細なエラーメッセージを表示
      const isOfficialQuiz = quizRoom?.classType === '公式' || quizRoom?.quizType === 'official';
      const errorMessage = isOfficialQuiz 
        ? '公式クイズのルームIDが取得できませんでした。クイズ選択画面に戻ります。'
        : 'ルームIDが取得できませんでした。ホームページに戻ります。';
      
      alert(errorMessage);
      router.push('/quiz');
    }
  }, [quizRoom, manualRoomId, router]);

  React.useEffect(() => {
    // 認証チェック - ユーザーが未ログインの場合は表示しない
    if (!currentUser) {
      setShowAlert(false);
      return;
    }
    
    // quizRoomがnullの場合は何もしない
    if (!quizRoom) {
      setShowAlert(false);
      return;
    }
    
    // 既にquizRoomページにいる場合の詳細チェック
    if (typeof window !== 'undefined' && (window.location.pathname.includes('/quiz/room') || window.inQuizRoomPage)) {
      // 現在のルームIDを取得
      const currentRoomIdFromUrl = new URLSearchParams(window.location.search).get('id');
      const targetRoomId = quizRoom.roomId || manualRoomId;
      
      // 既に正しいルームにいる場合はアラートを表示しない
      if (currentRoomIdFromUrl === targetRoomId) {
        setShowAlert(false);
        return;
      }
    }
    
    // ユーザードキュメントからルームIDを確認（公式クイズ対応強化版）
    const checkRoomIdFromFirebase = async () => {
      try {
        if (!quizRoom.roomId && currentUser) {
          // 1. ユーザードキュメントから現在のルームIDを取得
          const userRef = doc(usersDb, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          let foundRoomId = null;
          
          if (userDoc.exists() && userDoc.data().currentRoomId) {
            foundRoomId = userDoc.data().currentRoomId;
          } else {
            // 2. ユーザードキュメントに情報がない場合、アクティブなルームを検索
            // 進行中のルームから、このユーザーが参加しているものを探す
            const roomsRef = collection(db, 'quiz_rooms');
            const roomsQuery = query(
              roomsRef,
              where('status', 'in', ['waiting', 'in_progress']),
            );
            
            try {
              const roomsSnapshot = await getDocs(roomsQuery);
              if (!roomsSnapshot.empty) {
                // 最初に見つかったアクティブなルームを使用
                const firstRoom = roomsSnapshot.docs[0];
                foundRoomId = firstRoom.id;
                
                // ユーザードキュメントも更新しておく
                try {
                  await updateDoc(userRef, { currentRoomId: foundRoomId });
                } catch (updateErr) {
                  console.warn('[ActiveQuizAlertModal] ユーザードキュメント更新に失敗しましたが、処理を続行します:', updateErr);
                }
              }
            } catch (searchErr) {
              console.error('[ActiveQuizAlertModal] ルーム検索に失敗:', searchErr);
            }
          }
          
          // 3. 見つかったルームIDでルーム情報を取得
          if (foundRoomId) {
            const roomRef = doc(db, 'quiz_rooms', foundRoomId);
            const roomSnap = await getDoc(roomRef);
            if (roomSnap.exists()) {
              const roomData = roomSnap.data();
              
              // 手動でルームIDを保存
              setManualRoomId(foundRoomId);
            } else {
              // 存在しないルームIDの場合、ユーザードキュメントをクリア
              try {
                await updateDoc(userRef, { currentRoomId: null });
              } catch (clearErr) {
                console.warn('[ActiveQuizAlertModal] ユーザードキュメントのクリアに失敗:', clearErr);
              }
            }
          }
        }
      } catch (err) {
        console.error('[ActiveQuizAlertModal] ルームID確認エラー:', err);
      }
    };
    
    // デバッグ情報をコンソールに出力
    console.log('[ActiveQuizAlertModal] クイズルーム情報:', {
      roomId: quizRoom.roomId || manualRoomId,
      status: quizRoom.status,
      name: quizRoom.name,
      pathname: typeof window !== 'undefined' ? window.location.pathname : 'undefined'
    });
    
    // roomIdがない場合はFirebaseから取得を試みる
    if (!quizRoom.roomId && !manualRoomId) {
      checkRoomIdFromFirebase();
    }
    
    // クイズが進行中の場合のみアラートを表示
    if (quizRoom.status === 'in_progress') {
      setShowAlert(true);
      
      // 3秒後に自動的にルームページにリダイレクトするタイマーを設定
      if (autoRedirectTimerRef.current) {
        clearTimeout(autoRedirectTimerRef.current);
      }
      
      autoRedirectTimerRef.current = setTimeout(() => {
        console.log('[ActiveQuizAlertModal] 自動リダイレクトタイマー実行');
        redirectToRoom();
      }, 3000); // 3秒後に自動リダイレクト
    } else {
      // 進行中でない場合はアラートを非表示
      setShowAlert(false);
    }
    
    // クリーンアップ関数でタイマーをクリア
    return () => {
      if (autoRedirectTimerRef.current) {
        clearTimeout(autoRedirectTimerRef.current);
      }
    };
  }, [quizRoom, currentUser, manualRoomId, redirectToRoom]);

  if (!showAlert) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-red-600 flex items-center">
              <FaExclamationTriangle className="mr-2" />
              進行中のクイズがあります
            </h2>
            <button
              onClick={() => setShowAlert(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              <FaTimes size={20} />
            </button>
          </div>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              「{quizRoom?.name || 'クイズルーム'}」のクイズが進行中です。
              下のボタンをクリックしてクイズルームに戻ってください。
            </p>
            <div className="w-full bg-gray-200 h-2 rounded-full mt-4">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 3 }}
                className="bg-indigo-600 h-2 rounded-full"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              onClick={redirectToRoom}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              ルームに戻る
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
