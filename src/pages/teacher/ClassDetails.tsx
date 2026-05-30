import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Upload, Trash2, UserPlus, Star, Edit2, ImagePlus } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../../lib/firebase';
import type { Student, ClassData, CustomAvatar } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImage } from '../../utils/image';
import { useRef } from 'react';

export default function ClassDetails() {
  const { classId } = useParams();
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [isSingleAddModalOpen, setIsSingleAddModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ seatNumber: 1, name: '', gender: '男', password: '' });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isCoTeacherModalOpen, setIsCoTeacherModalOpen] = useState(false);
  const [coTeacherEmail, setCoTeacherEmail] = useState('');

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [customAvatars, setCustomAvatars] = useState<CustomAvatar[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [avatarPrice, setAvatarPrice] = useState(0);

  const auth = getAuth();
  const currentUser = auth.currentUser;
  const isOwner = classData?.ownerId === currentUser?.uid;

  const fetchClassAndStudents = async () => {
    if (!classId) return;
    setIsLoading(true);
    
    // 讀取班級資訊
    const classDoc = await getDoc(doc(db, 'classes', classId));
    if (classDoc.exists()) {
      setClassData({ id: classDoc.id, ...classDoc.data() } as ClassData);
    }

    // 讀取學生列表
    const q = query(collection(db, 'students'), where('classId', '==', classId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
    data.sort((a, b) => a.seatNumber - b.seatNumber);
    setStudents(data);
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClassAndStudents();

    if (!classId) return;
    const qAvatars = query(collection(db, 'avatars'), where('classId', '==', classId));
    const unsubAvatars = onSnapshot(qAvatars, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CustomAvatar[];
      setCustomAvatars(items.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => unsubAvatars();
  }, [classId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAvatarFile(file);
    setAvatarPrice(0); // 預設 0 點
    setIsPriceModalOpen(true);
  };

  const handleConfirmUploadAvatar = async () => {
    if (!pendingAvatarFile || !classId) return;

    setIsUploadingAvatar(true);
    setIsPriceModalOpen(false);
    
    try {
      const compressedBlob = await compressImage(pendingAvatarFile, 200);
      const base64Url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });

      await addDoc(collection(db, 'avatars'), {
        classId,
        imageUrl: base64Url,
        price: avatarPrice,
        createdAt: Date.now()
      });
      
    } catch (error) {
      console.error('上傳頭像失敗', error);
      alert('上傳頭像失敗');
    } finally {
      setIsUploadingAvatar(false);
      setPendingAvatarFile(null);
      if (avatarFileInputRef.current) {
        avatarFileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAvatar = async (avatar: CustomAvatar) => {
    // 檢查是否有學生正在使用
    const isInUse = students.some(s => s.avatarUrl === avatar.imageUrl);
    if (isInUse) {
      alert('無法刪除：目前有學生正在使用此頭像！請先請學生更換頭像。');
      return;
    }
    
    if (!window.confirm('確定要刪除此自訂頭像嗎？')) return;
    
    try {
      await deleteDoc(doc(db, 'avatars', avatar.id));
    } catch (error) {
      console.error('刪除頭像失敗', error);
      alert('刪除頭像失敗');
    }
  };

  // 新版批次匯入 (免 Auth)
  const handleBatchImport = async () => {
    if (!importText.trim() || !classId) return;
    setIsImporting(true);
    
    const lines = importText.split('\n').filter(l => l.trim());
    const promises = lines.map(async (line) => {
      // 格式：座號 姓名 性別 密碼
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const seatNumber = parseInt(parts[0]);
        const name = parts[1];
        let gender = '男';
        let password = `pwd${seatNumber}1234`; // 預設

        if (parts.length >= 3) {
          const g = parts[2].toLowerCase();
          if (g === '女' || g === 'f' || g === 'girl') gender = '女';
        }
        if (parts.length >= 4) {
          password = parts[3];
        }

        const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${name}_${classId}_${seatNumber}`;

        return addDoc(collection(db, 'students'), {
          classId,
          seatNumber,
          name,
          gender,
          password,
          points: 0,
          avatarUrl,
          isAssistant: false
        });
      }
    });

    try {
      await Promise.all(promises);
      setImportText('');
      setIsImportModalOpen(false);
      fetchClassAndStudents();
    } catch (error) {
      console.error('匯入失敗:', error);
      alert('匯入失敗，請稍後再試！');
    }
    setIsImporting(false);
  };

  // 單筆新增學生
  const handleSingleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !newStudent.name) return;
    
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${newStudent.name}_${classId}_${newStudent.seatNumber}`;
    
    try {
      await addDoc(collection(db, 'students'), {
        classId,
        seatNumber: newStudent.seatNumber,
        name: newStudent.name,
        gender: newStudent.gender,
        password: newStudent.password || `pwd${newStudent.seatNumber}1234`,
        points: 0,
        avatarUrl,
        isAssistant: false
      });
      setIsSingleAddModalOpen(false);
      setNewStudent({ seatNumber: students.length + 2, name: '', gender: '男', password: '' });
      fetchClassAndStudents();
    } catch (error) {
      console.error('新增失敗:', error);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('確定要刪除這位學生嗎？其點數將一併消失。')) return;
    await deleteDoc(doc(db, 'students', id));
    fetchClassAndStudents();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        seatNumber: editingStudent.seatNumber,
        name: editingStudent.name,
        gender: editingStudent.gender,
        password: editingStudent.password,
        points: editingStudent.points,
      });
      setIsEditModalOpen(false);
      setEditingStudent(null);
      fetchClassAndStudents();
    } catch (error) {
      console.error('更新失敗:', error);
    }
  };

  const handleResetPoints = async () => {
    if (!window.confirm('確定要將全班點數歸零嗎？這通常在學期初/末使用。')) return;
    const promises = students.map(s => updateDoc(doc(db, 'students', s.id), { points: 0 }));
    await Promise.all(promises);
    fetchClassAndStudents();
  };

  const toggleAssistant = async (student: Student) => {
    await updateDoc(doc(db, 'students', student.id), { isAssistant: !student.isAssistant });
    fetchClassAndStudents();
  };

  const handleAddCoTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classData || !coTeacherEmail.trim()) return;
    
    const currentEmails = classData.coTeacherEmails || [];
    if (currentEmails.includes(coTeacherEmail)) {
      alert("此信箱已在協同教師名單中");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'classes', classData.id), {
        coTeacherEmails: [...currentEmails, coTeacherEmail.trim()]
      });
      setCoTeacherEmail('');
      setIsCoTeacherModalOpen(false);
      fetchClassAndStudents();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveCoTeacher = async (email: string) => {
    if (!classData) return;
    const currentEmails = classData.coTeacherEmails || [];
    try {
      await updateDoc(doc(db, 'classes', classData.id), {
        coTeacherEmails: currentEmails.filter(e => e !== email)
      });
      fetchClassAndStudents();
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) return <div className="p-12 text-center text-gray-400">載入中...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 flex-wrap">
        <Link to="/teacher/classes" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition">
          <ArrowLeft className="text-gray-500" />
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          {classData?.name} <span className="text-gray-400 font-normal text-lg ml-2">({students.length} 名學生)</span>
        </h2>
        
        <div className="ml-auto flex flex-wrap gap-2">
            {isOwner && (
              <button 
                onClick={() => setIsCoTeacherModalOpen(true)}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition"
              >
                <UserPlus size={18} />
                共同管理老師
              </button>
            )}
            <button 
              onClick={() => setIsAvatarModalOpen(true)}
              className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition"
            >
              <ImagePlus size={18} />
              頭像管理
            </button>
            <button 
              onClick={handleResetPoints}
            className="px-4 py-2 bg-amber-500 text-white font-medium rounded-xl hover:bg-amber-600 transition shadow-sm"
          >
            點數歸零
          </button>
          <button 
            onClick={() => setIsSingleAddModalOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition shadow-sm flex items-center gap-2"
          >
            <UserPlus size={18} /> 單筆新增
          </button>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-sm flex items-center gap-2"
          >
            <Upload size={18} /> 批次匯入
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">座號</th>
                <th className="px-6 py-4 font-medium">頭像</th>
                <th className="px-6 py-4 font-medium">姓名</th>
                <th className="px-6 py-4 font-medium">性別</th>
                <th className="px-6 py-4 font-medium">密碼</th>
                <th className="px-6 py-4 font-medium">總點數</th>
                <th className="px-6 py-4 font-medium text-center">小老師</th>
                <th className="px-6 py-4 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{student.seatNumber}</td>
                  <td className="px-6 py-4">
                    <img src={student.avatarUrl} alt={student.name} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800" />
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{student.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{student.gender || '男'}</td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-500">{student.password}</td>
                  <td className="px-6 py-4 font-bold text-purple-600 dark:text-purple-400">{student.points}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleAssistant(student)}
                      className={`p-2 rounded-lg transition-colors ${student.isAssistant ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-300 hover:bg-gray-100'}`}
                      title={student.isAssistant ? "取消小老師" : "設為小老師"}
                    >
                      <Star size={20} className={student.isAssistant ? "fill-yellow-500" : ""} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => {
                        setEditingStudent(student);
                        setIsEditModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="編輯資料"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStudent(student.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="刪除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    目前還沒有任何學生，請點擊右上方匯入或新增。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                請依照「座號 姓名 性別 密碼」的格式輸入，以空格分隔，每行一筆資料：<br/>
                <span className="text-purple-500 font-medium">※ 性別與密碼為選填。未填寫密碼則預設為 pwd+座號+1234。</span>
              </p>
              <textarea 
                className="w-full h-48 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm mb-4"
                placeholder="1 王小明 男 pwd11234&#10;2 李小華 女 5566&#10;3 張大山"
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                  className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
                >
                  取消
                </button>
                <button 
                  onClick={handleBatchImport}
                  disabled={isImporting}
                  className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-md disabled:opacity-50"
                >
                  {isImporting ? '匯入中...' : '開始匯入'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 單筆新增 Modal */}
      <AnimatePresence>
        {isSingleAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">新增單筆學生</h3>
              <form onSubmit={handleSingleAdd} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">座號</label>
                    <input type="number" required min="1" value={newStudent.seatNumber} onChange={e => setNewStudent({...newStudent, seatNumber: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">性別</label>
                    <select value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value as '男'|'女'})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名</label>
                  <input type="text" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">登入密碼 (留空則使用預設)</label>
                  <input type="text" value={newStudent.password} onChange={e => setNewStudent({...newStudent, password: e.target.value})} placeholder={`預設為 pwd${newStudent.seatNumber}1234`} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsSingleAddModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">取消</button>
                  <button type="submit" className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition shadow-md">新增學生</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 編輯學生 Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">編輯學生資料</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">座號</label>
                    <input type="number" required min="1" value={editingStudent.seatNumber} onChange={e => setEditingStudent({...editingStudent, seatNumber: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">性別</label>
                    <select value={editingStudent.gender} onChange={e => setEditingStudent({...editingStudent, gender: e.target.value as '男'|'女'})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none">
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">姓名</label>
                  <input type="text" required value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">登入密碼</label>
                  <input type="text" required value={editingStudent.password} onChange={e => setEditingStudent({...editingStudent, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-mono focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">總點數</label>
                  <input type="number" required value={editingStudent.points} onChange={e => setEditingStudent({...editingStudent, points: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">取消</button>
                  <button type="submit" className="flex-1 py-3 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 transition shadow-md">儲存變更</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 協同管理者 Modal */}
      <AnimatePresence>
        {isCoTeacherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">共同管理者設定</h3>
              
              <div className="mb-6 space-y-2">
                <p className="text-sm text-gray-500 font-medium mb-2">目前的共同管理者：</p>
                {(!classData?.coTeacherEmails || classData.coTeacherEmails.length === 0) ? (
                  <p className="text-sm text-gray-400">尚無共同管理者</p>
                ) : (
                  classData.coTeacherEmails.map(email => (
                    <div key={email} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-xl text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{email}</span>
                      <button onClick={() => handleRemoveCoTeacher(email)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddCoTeacher} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">邀請新管理者 (輸入註冊信箱)</label>
                  <input type="email" required value={coTeacherEmail} onChange={e => setCoTeacherEmail(e.target.value)} placeholder="teacher@school.edu" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsCoTeacherModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">完成</button>
                  <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-md">新增</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* 頭像管理 Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800">自訂頭像管理</h3>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={avatarFileInputRef}
                onChange={handleFileSelect}
              />
              <button 
                onClick={() => avatarFileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition disabled:opacity-50"
              >
                <Upload size={18} />
                {isUploadingAvatar ? '上傳中...' : '新增頭像'}
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              您可以在此上傳班級專屬的自訂頭像，學生可在更換頭像時選擇它們。
              若有學生正在使用該頭像，將無法刪除。
            </p>

            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {customAvatars.map(avatar => (
                <div key={avatar.id} className="relative group">
                  <div className="aspect-square rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center p-2">
                    <img src={avatar.imageUrl} alt="Custom Avatar" className="w-full h-full object-contain" />
                  </div>
                  <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                      {avatar.price > 0 ? `${avatar.price} 點` : '免費'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteAvatar(avatar)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                    title="刪除頭像"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {customAvatars.length === 0 && (
                <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-2xl">
                  尚未新增任何自訂頭像
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsAvatarModalOpen(false)} className="px-6 py-2 rounded-xl text-gray-500 hover:bg-gray-100 font-bold transition">
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 設定頭像價格 Modal */}
      <AnimatePresence>
        {isPriceModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">設定解鎖價格</h3>
              <p className="text-sm text-gray-500 mb-6">
                請輸入學生需要花費多少點數才能解鎖此頭像。（若設為 0 則免費更換）
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">解鎖點數</label>
                <input 
                  type="number" 
                  min="0"
                  value={avatarPrice} 
                  onChange={e => setAvatarPrice(Math.max(0, parseInt(e.target.value) || 0))} 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none" 
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setIsPriceModalOpen(false);
                    setPendingAvatarFile(null);
                    if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
                  }} 
                  className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition"
                >
                  取消
                </button>
                <button 
                  onClick={handleConfirmUploadAvatar} 
                  className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition shadow-md"
                >
                  確認上傳
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
