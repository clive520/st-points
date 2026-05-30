import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction, getDocs, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Student, AuctionItem } from '../../types';
import { LogOut, Gift, Star, RefreshCw, Trophy, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { playAddPointSound } from '../../utils/audio';

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [classmates, setClassmates] = useState<Student[]>([]);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isBidding, setIsBidding] = useState(false);
  
  // 使用裁切好的 24 張小怪獸圖片
  const AVATAR_URLS = Array.from({ length: 24 }, (_, i) => `/avatars/avatar_${i + 1}.png`);
  
  const navigate = useNavigate();

  useEffect(() => {
    const studentAuthId = localStorage.getItem('studentAuthId');
    const studentClassId = localStorage.getItem('studentClassId');

    if (!studentAuthId || !studentClassId) {
      navigate('/login');
      return;
    }

    // 監聽自己的資料
    const unsubStudent = onSnapshot(doc(db, 'students', studentAuthId), (docSnap) => {
      if (docSnap.exists()) {
        const s = { id: docSnap.id, ...docSnap.data() } as Student;
        setStudent(s);
        
        // 如果是小老師，順便抓取全班同學資料
        if (s.isAssistant) {
          fetchClassmates(s.classId);
        }
      } else {
        handleLogout(); // 資料被刪除則登出
      }
      setIsLoading(false);
    });

    // 監聽拍賣
    const qAuctions = query(collection(db, 'auctionItems'), where('status', '==', 'active'));
    const unsubAuctions = onSnapshot(qAuctions, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AuctionItem[];
      setAuctionItems(items);
    });

    return () => {
      unsubStudent();
      unsubAuctions();
    };
  }, [navigate]);

  const fetchClassmates = async (classId: string) => {
    const q = query(collection(db, 'students'), where('classId', '==', classId));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Student[];
    data.sort((a, b) => a.seatNumber - b.seatNumber);
    setClassmates(data);
  };

  const handleLogout = () => {
    localStorage.removeItem('studentAuthId');
    localStorage.removeItem('studentClassId');
    navigate('/login');
  };

  const openAvatarModal = () => {
    setIsAvatarModalOpen(true);
  };

  const handleSelectAvatar = async (url: string) => {
    if (!student) return;
    setIsChangingAvatar(true);
    
    try {
      await updateDoc(doc(db, 'students', student.id), { avatarUrl: url });
      setIsAvatarModalOpen(false);
    } catch (error) {
      console.error('更換頭像失敗:', error);
      alert('更換頭像失敗');
    }
    setIsChangingAvatar(false);
  };

  // 小老師幫同學加分
  const handleAssistantAddPoint = async (targetStudentId: string, pts: number) => {
    if (!student?.isAssistant) return;
    try {
      playAddPointSound(); // 播放音效
      await updateDoc(doc(db, 'students', targetStudentId), {
        points: increment(pts)
      });
      // 由於同學列表不會即時更新 (沒寫 onSnapshot)，我們手動重新整理一下同學列表
      fetchClassmates(student.classId);
    } catch (error) {
      console.error(error);
      alert('加分失敗');
    }
  };

  // 出價相關狀態
  const [biddingItem, setBiddingItem] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);

  const openBidModal = (item: AuctionItem) => {
    const minBid = item.currentHighestBid ? item.currentHighestBid + 1 : item.startingPrice;
    setBiddingItem(item);
    setBidAmount(minBid);
  };

  const handleConfirmBid = async () => {
    if (!student || !biddingItem || isBidding) return;
    
    if (student.points < bidAmount) {
      alert(`點數不足！你只有 ${student.points} 點。`);
      return;
    }

    const minBid = biddingItem.currentHighestBid ? biddingItem.currentHighestBid + 1 : biddingItem.startingPrice;
    if (bidAmount < minBid) {
      alert(`出價必須大於等於 ${minBid} 點！`);
      return;
    }

    setIsBidding(true);
    // 這裡我們直接使用原本在元件內的 Transaction，或者你也可以匯入 utils/auction.ts 的 placeBid。
    // 為了保持狀態更新順暢，我們在這裡執行樂觀鎖 Transaction：
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'auctionItems', biddingItem.id);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) throw new Error("物品不存在");
        
        const currentItem = itemDoc.data() as AuctionItem;
        if (currentItem.status !== 'active') throw new Error("拍賣已結束");

        const actualRequiredBid = currentItem.currentHighestBid ? currentItem.currentHighestBid + 1 : currentItem.startingPrice;
        
        if (bidAmount < actualRequiredBid) {
          throw new Error(`手腳太慢囉！目前最高價已經來到 ${currentItem.currentHighestBid} 點`);
        }
        
        const studentRef = doc(db, 'students', student.id);
        const studentDoc = await transaction.get(studentRef);
        const currentStudent = studentDoc.data() as Student;
        
        if (currentStudent.points < bidAmount) {
          throw new Error("點數餘額不足！");
        }

        if (currentItem.currentHighestBidderId) {
          const prevBidderRef = doc(db, 'students', currentItem.currentHighestBidderId);
          const prevBidderDoc = await transaction.get(prevBidderRef);
          if (prevBidderDoc.exists()) {
            const prevPoints = prevBidderDoc.data().points;
            transaction.update(prevBidderRef, { points: prevPoints + currentItem.currentHighestBid! });
          }
        }

        transaction.update(studentRef, { points: currentStudent.points - bidAmount });
        transaction.update(itemRef, {
          currentHighestBid: bidAmount,
          currentHighestBidderId: student.id,
          currentHighestBidderName: currentStudent.name
        });
      });
      alert('出價成功！你是目前的最高出價者！');
      setBiddingItem(null);
    } catch (error: any) {
      console.error(error);
      alert("出價失敗：" + error.message);
    }
    setIsBidding(false);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">載入中...</div>;
  if (!student) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={openAvatarModal} title="點擊更換頭像">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-purple-200 group-hover:border-purple-400 transition-colors">
                <img src={student.avatarUrl} alt={student.name} />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <RefreshCw size={16} className={`text-white ${isChangingAvatar ? 'animate-spin' : ''}`} />
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-800 dark:text-gray-100 text-lg flex items-center gap-2">
                {student.name}
                {student.isAssistant && (
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-md flex items-center gap-1 font-medium">
                    <ShieldCheck size={12} /> 小老師
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">座號 {student.seatNumber}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* 小老師加分區塊 */}
        {student.isAssistant && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl p-6 shadow-sm border border-yellow-200 dark:border-yellow-800"
          >
            <div className="flex items-center gap-2 mb-4 text-yellow-800 dark:text-yellow-500 font-bold">
              <ShieldCheck /> 小老師任務：幫同學加分
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {classmates.filter(c => c.id !== student.id).map(c => (
                <div key={c.id} className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-yellow-100 dark:border-yellow-900/50 flex flex-col items-center gap-2">
                  <img src={c.avatarUrl} alt={c.name} className="w-12 h-12 rounded-full bg-gray-100" />
                  <div className="text-sm font-bold text-gray-800 dark:text-gray-100 text-center truncate w-full">{c.name}</div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">{c.points} 點</div>
                  <button 
                    onClick={() => handleAssistantAddPoint(c.id, 1)} 
                    className="w-full py-1.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg font-bold text-sm transition-colors active:scale-95"
                  >
                    + 1 分
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-purple-500/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative z-10 flex flex-col items-center">
            <p className="text-purple-100 font-medium mb-2">你的目前點數 (可使用額度)</p>
            <div className="text-6xl font-black tracking-tight flex items-center gap-2">
              <Star className="text-yellow-400 fill-yellow-400" size={48} />
              {student.points}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <Gift className="text-pink-500" /> 即時拍賣大廳
            </h2>
            {auctionItems.length > 0 && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
              </span>
            )}
          </div>
          
          {auctionItems.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-12 text-center text-gray-500">
              <p className="mb-2 text-lg font-medium">老師尚未開啟拍賣</p>
              <p className="text-sm">敬請期待！累積更多點數來換取禮物吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {auctionItems.map(item => {
                  const isWinning = item.currentHighestBidderId === student.id;
                  const nextBid = item.currentHighestBid ? item.currentHighestBid + 1 : item.startingPrice;
                  const canAfford = student.points >= nextBid;
                  
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={item.id} 
                      className={`relative p-5 rounded-2xl border-2 transition-all overflow-hidden ${
                        isWinning 
                          ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' 
                          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                      }`}
                    >
                      {isWinning && (
                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-400/20 rounded-full blur-xl"></div>
                      )}
                      
                      <div className="flex gap-4 relative z-10">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-24 h-24 rounded-xl object-cover" />
                        ) : (
                          <div className="w-24 h-24 bg-pink-50 dark:bg-pink-900/20 rounded-xl flex items-center justify-center">
                            <Gift size={32} className="text-pink-300 dark:text-pink-700/50" />
                          </div>
                        )}
                        
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{item.name}</h3>
                            {isWinning && (
                              <span className="flex items-center gap-1 text-xs font-bold text-yellow-600 dark:text-yellow-500 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded-full">
                                <Trophy size={12} /> 你目前最高價
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 line-clamp-1 mb-2">{item.description}</p>
                          
                          <div className="mt-auto flex items-end justify-between">
                            <div>
                              <div className="text-xs text-gray-400">目前最高價</div>
                              <div className="text-2xl font-black text-pink-600 dark:text-pink-400">
                                {item.currentHighestBid || '尚未出價'}
                              </div>
                            </div>
                            
                            <button 
                              onClick={() => openBidModal(item)}
                              disabled={isWinning || isBidding || !canAfford}
                              className={`px-6 py-2.5 rounded-xl font-bold transition transform active:scale-95 ${
                                isWinning 
                                  ? 'bg-yellow-400 text-yellow-900 opacity-80 cursor-not-allowed'
                                  : !canAfford
                                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/30 hover:scale-[1.02]'
                              }`}
                            >
                              {!canAfford && !isWinning ? '點數不足' : '我要出價'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </main>

      {/* 出價 Modal */}
      <AnimatePresence>
        {biddingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setBiddingItem(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">確認出價</h3>
              
              <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-2xl mb-4 border border-pink-100 dark:border-pink-800">
                <div className="text-sm text-pink-600 dark:text-pink-400 font-bold mb-1">{biddingItem.name}</div>
                <div className="text-xs text-gray-500">目前最高價：{biddingItem.currentHighestBid || '0'} 點</div>
                <div className="text-xs text-gray-500">你的可用點數：{student.points} 點</div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  請輸入你要出價的點數：
                </label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setBidAmount(prev => Math.max((biddingItem.currentHighestBid || biddingItem.startingPrice - 1) + 1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 font-bold flex items-center justify-center disabled:opacity-50"
                  >-</button>
                  <input 
                    type="number"
                    value={bidAmount}
                    onChange={(e) => {
                      let val = parseInt(e.target.value) || 0;
                      // 不讓使用者輸入超過可用點數
                      if (val > student.points) val = student.points;
                      setBidAmount(val);
                    }}
                    className="flex-1 text-center px-4 py-3 text-2xl font-black text-pink-600 dark:text-pink-400 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <button 
                    onClick={() => setBidAmount(prev => Math.min(student.points, prev + 1))}
                    className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 font-bold flex items-center justify-center disabled:opacity-50"
                  >+</button>
                </div>
                {bidAmount > student.points && (
                  <div className="text-red-500 text-xs font-bold mt-2 text-center">點數不足！</div>
                )}
                {bidAmount <= (biddingItem.currentHighestBid || biddingItem.startingPrice - 1) && (
                  <div className="text-red-500 text-xs font-bold mt-2 text-center">出價必須大於目前最高價！</div>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setBiddingItem(null)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition"
                  disabled={isBidding}
                >
                  取消
                </button>
                <button 
                  onClick={handleConfirmBid}
                  disabled={isBidding || bidAmount > student.points || bidAmount <= (biddingItem.currentHighestBid || biddingItem.startingPrice - 1)}
                  className="flex-1 py-3 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition flex justify-center items-center gap-2"
                >
                  {isBidding ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '確定出價'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 頭像選擇 Modal */}
      <AnimatePresence>
        {isAvatarModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsAvatarModalOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">選擇你喜歡的頭像</h3>
                <p className="text-gray-500 text-sm mt-1">選一個最能代表你的可愛圖片吧！</p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {AVATAR_URLS.map((url) => {
                  const isSelected = student.avatarUrl === url;
                  return (
                    <div 
                      key={url}
                      onClick={() => handleSelectAvatar(url)}
                      className={`relative cursor-pointer rounded-2xl overflow-hidden border-4 transition-all hover:scale-105 active:scale-95 ${
                        isSelected ? 'border-purple-500 shadow-lg shadow-purple-500/30' : 'border-transparent hover:border-purple-200 dark:hover:border-purple-800 bg-gray-50 dark:bg-gray-800'
                      }`}
                    >
                      <img src={url} alt="Avatar" className="w-full h-auto aspect-square object-contain p-2 drop-shadow-md" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 flex justify-center">
                <button 
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
