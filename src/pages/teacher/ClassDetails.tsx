import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '../../lib/firebase';
import type { Student } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

// 建立次要 Firebase 實例，用來建立學生帳號，避免把老師登出
const secondaryApp = initializeApp({
  apiKey: "AIzaSyChRbeI9lV93f9EC8bjEoUkEG8jop7md70",
  authDomain: "st-points.firebaseapp.com",
  projectId: "st-points",
}, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export default function ClassDetails() {
  const { classId } = useParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // 批次匯入狀態
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const fetchStudents = async () => {
    if (!classId) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'students'), where('classId', '==', classId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
      // 依座號排序
      data.sort((a, b) => a.seatNumber - b.seatNumber);
      setStudents(data);
    } catch (error) {
      console.error('讀取學生失敗:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [classId]);

  const handleBatchImport = async () => {
    if (!importText.trim() || !classId) return;
    setIsImporting(true);
    
    // 解析文字 (格式: 1 王小明)
    const lines = importText.split('\n').map(l => l.trim()).filter(l => l);
    
    for (const line of lines) {
      const parts = line.split(/[\s,，\t]+/);
      if (parts.length >= 2) {
        const seatNumber = parseInt(parts[0], 10);
        const name = parts[1];
        
        if (isNaN(seatNumber)) continue;
        
        const dummyEmail = `student_${classId}_${seatNumber}@st-points.app`;
        const defaultPassword = `pwd${seatNumber}1234`; // 預設密碼規則
        
        try {
          // 1. 在 Firebase Auth 建立帳號
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, dummyEmail, defaultPassword);
          const authUid = userCredential.user.uid;
          
          // 2. 在 Firestore 建立資料，關聯 Auth UID
          await addDoc(collection(db, 'students'), {
            authUid,
            classId,
            seatNumber,
            name,
            points: 0,
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${name}` // 預設可愛機器人頭像
          });
        } catch (error: any) {
          // 如果信箱已存在，我們只更新或跳過 (簡化處理)
          console.error(`匯入學生 ${name} 失敗:`, error);
        }
      }
    }
    
    setImportText('');
    setIsImportModalOpen(false);
    setIsImporting(false);
    fetchStudents();
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('確定要刪除這位學生嗎？其點數將一併消失。')) return;
    await deleteDoc(doc(db, 'students', id));
    fetchStudents();
  };

  const handleResetPoints = async () => {
    if (!window.confirm('確定要將全班點數歸零嗎？這通常在學期初/末使用。')) return;
    const promises = students.map(s => updateDoc(doc(db, 'students', s.id), { points: 0 }));
    await Promise.all(promises);
    fetchStudents();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link to="/teacher/classes" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition">
          <ArrowLeft size={24} className="text-gray-600 dark:text-gray-300" />
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">學生名單管理</h2>
        
        <div className="ml-auto flex gap-3">
          <button 
            onClick={handleResetPoints}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition shadow-sm"
          >
            點數歸零
          </button>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-sm"
          >
            <Upload size={18} /> 批次匯入
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">載入中...</div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <p className="mb-2">目前沒有任何學生</p>
            <p className="text-sm">點擊上方「批次匯入」貼上名單吧！</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 w-24">座號</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">頭像 & 姓名</th>
                <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300 font-mono">{student.seatNumber}</td>
                  <td className="px-6 py-4 flex items-center gap-3">
                    <img src={student.avatarUrl} alt={student.name} className="w-10 h-10 rounded-full bg-gray-100" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{student.name}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteStudent(student.id)}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="刪除學生"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 批次匯入 Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">批次匯入學生名單</h3>
              <p className="text-sm text-gray-500 mb-4">
                請依照「座號 姓名」的格式輸入，每行一筆資料：<br/>
                <span className="text-purple-500 font-medium">※ 匯入後，學生的預設登入密碼將設定為：pwd + 座號 + 1234 (例如1號的密碼為 pwd11234)</span>
              </p>
              <textarea 
                className="w-full h-48 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm mb-4"
                placeholder="1 王小明&#10;2 李小華&#10;3 張大山"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-5 py-2 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
                >
                  取消
                </button>
                <button 
                  onClick={handleBatchImport}
                  disabled={isImporting}
                  className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? '匯入中...' : '開始匯入'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
