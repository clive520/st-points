import { useState, useEffect } from 'react';
import { Plus, Users, Trash2, X, ChevronRight } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ClassData } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

export default function ClassManager() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as ClassData[];
      setClasses(data);
    } catch (error) {
      console.error('讀取班級失敗:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    try {
      await addDoc(collection(db, 'classes'), {
        name: newClassName.trim(),
        createdAt: Date.now()
      });
      setNewClassName('');
      setIsModalOpen(false);
      fetchClasses();
    } catch (error) {
      console.error('建立班級失敗:', error);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm('確定要刪除這個班級嗎？這將會刪除班級內的所有學生。')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
      fetchClasses();
    } catch (error) {
      console.error('刪除班級失敗:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">班級管理</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition shadow-sm hover:shadow-md"
        >
          <Plus size={18} /> 建立班級
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><div className="animate-pulse text-gray-400">載入中...</div></div>
      ) : classes.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-500 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Users size={32} className="text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-lg">尚未建立任何班級</p>
            <p className="text-sm text-gray-400">點擊右上方按鈕開始建立第一個班級吧！</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={cls.id} 
              className="group bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Users size={24} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
                  className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{cls.name}</h3>
              <p className="text-sm text-gray-500 flex items-center justify-between">
                點擊管理學生名單
                <ChevronRight size={16} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* 建立班級 Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">建立新班級</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateClass}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">班級名稱</label>
                    <input 
                      type="text" 
                      autoFocus
                      required
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="例如：三年一班" 
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition"
                  >
                    建立班級
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
