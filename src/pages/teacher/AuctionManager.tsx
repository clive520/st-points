import { useState, useEffect, useRef } from 'react';
import { Gift, Play, Square, Trash2, Image as ImageIcon, Plus } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { AuctionItem, ClassData } from '../../types';
import { compressImage } from '../../utils/image';
import { motion, AnimatePresence } from 'framer-motion';
import { getAuth } from 'firebase/auth';
import { playBidSound } from '../../utils/audio';

export default function AuctionManager() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [items, setItems] = useState<AuctionItem[]>([]);
  const prevItemsRef = useRef<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    startingPrice: 10,
    quantity: 1,
    imageUrl: ''
  });
  
  // 圖片上傳狀態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 1. 取得班級列表
  useEffect(() => {
    const fetchClasses = async () => {
      if (!currentUser) return;
      const q = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ClassData[];
      
      const filtered = data.filter(c => 
        c.ownerId === currentUser.uid || 
        (c.coTeacherEmails && currentUser.email && c.coTeacherEmails.includes(currentUser.email))
      );
      setClasses(filtered);
      
      if (filtered.length > 0) {
        setSelectedClassId(filtered[0].id);
      }
      setIsLoading(false);
    };
    fetchClasses();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedClassId) return;
    setIsLoading(true);
    
    const q = query(collection(db, 'auctionItems'), where('classId', '==', selectedClassId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AuctionItem[];
      setItems(data);
      setIsLoading(false);
    }, (error) => {
      console.error('即時讀取物品失敗:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedClassId]);

  // 監聽出價變動播放音效
  useEffect(() => {
    if (items.length > 0 && prevItemsRef.current.length > 0) {
      let bidIncreased = false;
      items.forEach(item => {
        const prevItem = prevItemsRef.current.find(p => p.id === item.id);
        if (prevItem && (item.currentHighestBid || 0) > (prevItem.currentHighestBid || 0)) {
          bidIncreased = true;
        }
      });
      if (bidIncreased) {
        playBidSound();
      }
    }
    prevItemsRef.current = items;
  }, [items]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !selectedClassId) return;
    
    setIsUploading(true);
    try {
      let finalImageUrl = newItem.imageUrl;
      
      // 如果有選擇檔案，則進行壓縮並轉成 Base64 字串存入資料庫
      if (selectedFile) {
        // 先顯示假進度
        setUploadProgress(30);
        const compressedBlob = await compressImage(selectedFile, 600);
        setUploadProgress(60);
        
        // 將 Blob 轉為 Base64 字串 (Data URL)
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(compressedBlob);
        });
        setUploadProgress(100);
      }

      const promises = [];
      for (let i = 0; i < newItem.quantity; i++) {
        const nameSuffix = newItem.quantity > 1 ? ` (${i + 1}/${newItem.quantity})` : '';
        promises.push(addDoc(collection(db, 'auctionItems'), {
          ...newItem,
          name: `${newItem.name}${nameSuffix}`,
          quantity: 1, // 拆分後的獨立物品數量皆為 1
          imageUrl: finalImageUrl,
          status: 'pending',
          currentHighestBid: 0,
          currentHighestBidderId: null,
          classId: selectedClassId
        }));
      }
      
      await Promise.all(promises);
      
      setIsModalOpen(false);
      setNewItem({ name: '', description: '', startingPrice: 10, quantity: 1, imageUrl: '' });
      setSelectedFile(null);
      setPreviewUrl('');
      setUploadProgress(0);
    } catch (error) {
      console.error('新增物品失敗:', error);
      alert('上傳失敗，請確認 Firebase Storage 權限設定是否正確。');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: AuctionItem['status']) => {
    try {
      await updateDoc(doc(db, 'auctionItems', id), { status });
    } catch (error) {
      console.error('更新狀態失敗:', error);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('確定要刪除此拍賣物品嗎？')) return;
    try {
      await deleteDoc(doc(db, 'auctionItems', id));
    } catch (error) {
      console.error('刪除物品失敗:', error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Gift className="text-pink-500" /> 拍賣管理
        </h2>
        <div className="flex gap-4">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-700 dark:text-gray-300 shadow-sm"
          >
            {classes.length === 0 && <option value="">無班級</option>}
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-medium rounded-xl hover:bg-pink-700 transition shadow-sm"
          >
            <Plus size={18} /> 新增物品
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-400 animate-pulse">載入中...</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex items-center justify-center">
          <div className="text-center text-gray-500 flex flex-col items-center gap-4">
            <Gift size={48} className="text-gray-300 dark:text-gray-600" />
            <p className="text-lg">尚未上架任何拍賣物品</p>
            <p className="text-sm text-gray-400">點擊右上方按鈕新增獎品，讓學生們競標吧！</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <motion.div 
              layout
              key={`${item.id}-${item.currentHighestBid}`}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-800 flex flex-col"
            >
              <div className="h-40 bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center relative">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={48} className="text-pink-200 dark:text-pink-800/50" />
                )}
                
                {/* 狀態標籤 */}
                <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                  item.status === 'active' ? 'bg-green-500 text-white animate-pulse' :
                  item.status === 'ended' ? 'bg-gray-500 text-white' :
                  'bg-yellow-500 text-white'
                }`}>
                  {item.status === 'active' ? '拍賣中' : item.status === 'ended' ? '已結束' : '準備中'}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{item.name}</h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{item.description || '無詳細說明'}</p>
                
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <div className="text-xs text-gray-400">起標/目前最高價</div>
                    <div className="font-bold text-pink-600 dark:text-pink-400">
                      {item.currentHighestBid || item.startingPrice} 點
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">數量</div>
                    <div className="font-bold text-gray-700 dark:text-gray-300">{item.quantity} 份</div>
                  </div>
                </div>

                {item.status === 'ended' && item.currentHighestBidderName && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <div className="text-xs text-yellow-600 dark:text-yellow-500 font-bold mb-1">👑 得標者</div>
                    <div className="text-gray-800 dark:text-gray-200 font-medium">{item.currentHighestBidderName}</div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {item.status === 'pending' && (
                    <button 
                      onClick={() => handleUpdateStatus(item.id, 'active')}
                      className="flex-1 flex justify-center items-center gap-1 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl font-medium transition"
                    >
                      <Play size={16} /> 開始拍賣
                    </button>
                  )}
                  {item.status === 'active' && (
                    <button 
                      onClick={() => handleUpdateStatus(item.id, 'ended')}
                      className="flex-1 flex justify-center items-center gap-1 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition"
                    >
                      <Square size={16} /> 結束拍賣
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* 新增物品 Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">新增拍賣物品</h3>
              <form onSubmit={handleCreateItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">物品名稱</label>
                  <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">物品說明 (選填)</label>
                  <textarea value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">起標價 (點數)</label>
                    <input type="number" min="1" required value={newItem.startingPrice} onChange={e => setNewItem({...newItem, startingPrice: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500" disabled={isUploading} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">數量</label>
                    <input type="number" min="1" required value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value)})} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-500" disabled={isUploading} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">物品圖片上傳</label>
                  <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl relative overflow-hidden">
                    {previewUrl ? (
                      <div className="absolute inset-0">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-50" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              setPreviewUrl('');
                            }}
                            className="bg-black/50 text-white px-4 py-2 rounded-lg hover:bg-black/70 transition"
                            disabled={isUploading}
                          >
                            移除圖片
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                        <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                          <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-pink-600 hover:text-pink-500 focus-within:outline-none">
                            <span>點擊選擇圖片</span>
                            <input 
                              type="file" 
                              className="sr-only" 
                              accept="image/*"
                              disabled={isUploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFile(file);
                                  setPreviewUrl(URL.createObjectURL(file));
                                }
                              }}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-gray-500">上傳後將自動為您等比例壓縮至 600 像素</p>
                      </div>
                    )}
                  </div>
                  {isUploading && uploadProgress > 0 && (
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                      <div className="bg-pink-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition" disabled={isUploading}>取消</button>
                  <button type="submit" className="flex-1 py-3 bg-pink-600 text-white font-medium rounded-xl hover:bg-pink-700 transition shadow-md flex justify-center items-center gap-2" disabled={isUploading}>
                    {isUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        處理中...
                      </>
                    ) : (
                      '上架物品'
                    )}
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
