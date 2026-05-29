import { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ClassData, Student } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function PointsManager() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加扣點 Modal 狀態
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);

  // 1. 取得班級列表
  useEffect(() => {
    const fetchClasses = async () => {
      const q = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ClassData[];
      setClasses(data);
      if (data.length > 0) {
        setSelectedClassId(data[0].id);
      }
      setIsLoading(false);
    };
    fetchClasses();
  }, []);

  // 2. 當班級改變時，取得該班學生
  useEffect(() => {
    if (!selectedClassId) return;
    const fetchStudents = async () => {
      const q = query(collection(db, 'students'), where('classId', '==', selectedClassId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
      data.sort((a, b) => a.seatNumber - b.seatNumber);
      setStudents(data);
    };
    fetchStudents();
  }, [selectedClassId]);

  // 3. 處理加扣點邏輯
  const handleUpdatePoints = async (amount: number) => {
    if (!selectedStudent) return;
    
    // 樂觀更新 (Optimistic Update)
    setStudents(prev => prev.map(s => 
      s.id === selectedStudent.id ? { ...s, points: s.points + amount } : s
    ));
    setIsPointModalOpen(false);

    try {
      const studentRef = doc(db, 'students', selectedStudent.id);
      await updateDoc(studentRef, {
        points: increment(amount)
      });
    } catch (error) {
      console.error('更新點數失敗:', error);
      // 若失敗可以考慮回復狀態 (此處暫略)
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-gray-400 animate-pulse">載入中...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Star className="text-yellow-500" /> 點數系統
        </h2>
        
        {classes.length > 0 && (
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {classes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-500 flex flex-col items-center gap-4">
            <Users size={32} className="text-gray-300 dark:text-gray-600" />
            <p className="text-lg">尚未建立任何班級</p>
            <p className="text-sm text-gray-400">請先到「班級管理」建立班級與學生。</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>這個班級還沒有學生喔！</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {students.map(student => (
            <motion.div
              layout
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              key={student.id}
              onClick={() => {
                setSelectedStudent(student);
                setIsPointModalOpen(true);
              }}
              className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-800 cursor-pointer flex flex-col items-center gap-3 transition-shadow"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center overflow-hidden border-2 border-transparent hover:border-purple-300 transition-colors">
                <img src={student.avatarUrl} alt={student.name} className="w-14 h-14" />
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 font-mono">座號 {student.seatNumber}</div>
                <div className="font-bold text-gray-800 dark:text-gray-100">{student.name}</div>
              </div>
              <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-bold text-lg">
                {student.points}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 加扣點 Modal */}
      <AnimatePresence>
        {isPointModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsPointModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="text-center mb-6">
                <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-20 h-20 mx-auto rounded-full bg-gray-100 mb-3" />
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedStudent.name}</h3>
                <p className="text-gray-500">目前點數：{selectedStudent.points}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-center text-sm font-medium text-green-600 mb-2 flex items-center justify-center gap-1"><TrendingUp size={16} /> 加分</div>
                  {[1, 2, 3, 5, 10].map(pts => (
                    <button 
                      key={`add-${pts}`}
                      onClick={() => handleUpdatePoints(pts)}
                      className="w-full py-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 text-green-700 dark:text-green-400 rounded-xl font-bold transition transform active:scale-95"
                    >
                      +{pts}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-center text-sm font-medium text-red-600 mb-2 flex items-center justify-center gap-1"><TrendingDown size={16} /> 扣分</div>
                  {[1, 2, 3, 5, 10].map(pts => (
                    <button 
                      key={`sub-${pts}`}
                      onClick={() => handleUpdatePoints(-pts)}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 rounded-xl font-bold transition transform active:scale-95"
                    >
                      -{pts}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
