import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ClassData, Student } from '../../types';
import { motion } from 'framer-motion';

export default function StudentLogin() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  // 取得班級列表
  useEffect(() => {
    const fetchClasses = async () => {
      const q = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ClassData[];
      setClasses(data);
    };
    fetchClasses();
  }, []);

  // 取得該班學生列表
  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }
    const fetchStudents = async () => {
      const q = query(collection(db, 'students'), where('classId', '==', selectedClassId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
      data.sort((a, b) => a.seatNumber - b.seatNumber);
      setStudents(data);
    };
    fetchStudents();
  }, [selectedClassId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedClassId || !selectedStudentId || !password) {
      setError('請選擇班級、姓名並輸入密碼');
      return;
    }

    setIsLoading(true);
    const student = students.find(s => s.id === selectedStudentId);
    
    if (!student) {
      setError('找不到該學生資料');
      setIsLoading(false);
      return;
    }

    // 免 Auth 驗證機制：直接比對資料庫儲存的密碼
    if (student.password === password) {
      // 登入成功，將資訊存入 localStorage
      localStorage.setItem('studentAuthId', student.id);
      localStorage.setItem('studentClassId', student.classId);
      navigate('/student/dashboard');
    } else {
      setError('密碼錯誤，請重新輸入！');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl mx-auto flex items-center justify-center mb-4 transform rotate-12">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">學生登入</h1>
          <p className="text-gray-500 mt-2">選擇你的班級與姓名來查看點數</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">班級</label>
            <select 
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            >
              <option value="">請選擇班級...</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名</label>
            <select 
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={!selectedClassId || students.length === 0}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all disabled:opacity-50"
            >
              <option value="">請選擇姓名...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.seatNumber}號 - {s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密碼</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 mt-4"
          >
            {isLoading ? '登入中...' : '進入系統'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
