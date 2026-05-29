import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Student, AuctionItem } from '../../types';
import { LogOut, Gift, Star, RefreshCw, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentDashboard() {
  const [student, setStudent] = useState<Student | null>(null);
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isBidding, setIsBidding] = useState(false);
  
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/');
      return;
    }

    // 監聽學生即時點數
    const qStudent = query(collection(db, 'students'), where('authUid', '==', user.uid));
    const unsubStudent = onSnapshot(qStudent, (snapshot) => {
      if (!snapshot.empty) {
        setStudent({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Student);
      }
      setIsLoading(false);
    });

    // 監聽正在拍賣中的物品
    const qAuctions = query(collection(db, 'auctionItems'), where('status', '==', 'active'));
    const unsubAuctions = onSnapshot(qAuctions, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AuctionItem[];
      setAuctionItems(items);
    });

    return () => {
      unsubStudent();
      unsubAuctions();
    };
  }, [auth, navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const handleChangeAvatar = async () => {
    if (!student) return;
    setIsChangingAvatar(true);
    const randomSeed = Math.random().toString(36).substring(7);
    const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${student.name}_${randomSeed}`;
    
    try {
      await updateDoc(doc(db, 'students', student.id), { avatarUrl: newAvatarUrl });
    } catch (error) {
      console.error('更換頭像失敗:', error);
    }
    setIsChangingAvatar(false);
  };

  const handleBid = async (item: AuctionItem) => {
    if (!student || isBidding) return;
    
    // 每次加價預設為 10 點
    const bidIncrement = 10;
    const requiredBid = item.currentHighestBid ? item.currentHighestBid + bidIncrement : item.startingPrice;
    
    if (student.points < requiredBid) {
      alert(`點數不足！需要 ${requiredBid} 點才能出價。`);
      return;
    }

    if (item.currentHighestBidderId === student.id) {
      alert("你目前已經是最高出價者囉！");
      return;
    }

    setIsBidding(true);
    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, 'auctionItems', item.id);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) throw new Error("物品不存在");
        
        const currentItem = itemDoc.data() as AuctionItem;
        if (currentItem.status !== 'active') throw new Error("拍賣已結束");

        const actualRequiredBid = currentItem.currentHighestBid ? currentItem.currentHighestBid + bidIncrement : currentItem.startingPrice;
        
        const studentRef = doc(db, 'students', student.id);
        const studentDoc = await transaction.get(studentRef);
        const currentStudent = studentDoc.data() as Student;
        
        if (currentStudent.points < actualRequiredBid) {
          throw new Error("點數不足！");
        }

        // 處理前一位最高出價者的退款 (解凍)
        if (currentItem.currentHighestBidderId) {
          const prevBidderRef = doc(db, 'students', currentItem.currentHighestBidderId);
          const prevBidderDoc = await transaction.get(prevBidderRef);
          if (prevBidderDoc.exists()) {
            const prevPoints = prevBidderDoc.data().points;
            transaction.update(prevBidderRef, { points: prevPoints + currentItem.currentHighestBid! });
          }
        }

        // 扣除目前出價者的點數 (凍結)
        transaction.update(studentRef, { points: currentStudent.points - actualRequiredBid });
        
        // 更新物品最高出價資訊
        transaction.update(itemRef, {
          currentHighestBid: actualRequiredBid,
          currentHighestBidderId: student.id,
          currentHighestBidderName: currentStudent.name
        });
      });
      // 成功不特別顯示，畫面會即時更新
    } catch (error: any) {
      console.error(error);
      alert("出價失敗：" + error.message);
    }
    setIsBidding(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">載入中...</div>;
  }

  if (!student) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={handleChangeAvatar}>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-purple-200 group-hover:border-purple-400 transition-colors">
                <img src={student.avatarUrl} alt={student.name} />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <RefreshCw size={16} className={`text-white ${isChangingAvatar ? 'animate-spin' : ''}`} />
              </div>
            </div>
            <div className="font-bold text-gray-800 dark:text-gray-100 text-lg">{student.name}</div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
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
                  const nextBid = item.currentHighestBid ? item.currentHighestBid + 10 : item.startingPrice;
                  
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
                              onClick={() => handleBid(item)}
                              disabled={isWinning || student.points < nextBid || isBidding}
                              className={`px-6 py-2.5 rounded-xl font-bold transition transform active:scale-95 ${
                                isWinning 
                                  ? 'bg-yellow-400 text-yellow-900 opacity-80 cursor-not-allowed'
                                  : student.points < nextBid
                                    ? 'bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                                    : 'bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/30 hover:scale-[1.02]'
                              }`}
                            >
                              出價 {nextBid} 點
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
    </div>
  );
}
