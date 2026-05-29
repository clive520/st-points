// 學生資料結構
export interface Student {
  id: string; // Firebase Document ID
  name: string;
  seatNumber: number;
  classId: string;
  points: number; // 總點數
  avatarUrl?: string; // 頭像網址
}

// 班級資料結構
export interface ClassData {
  id: string; // Firebase Document ID
  name: string;
  createdAt: number;
}

// 拍賣物品資料結構
export interface AuctionItem {
  id: string; // Firebase Document ID
  name: string;
  description: string;
  imageUrl?: string;
  startingPrice: number;
  quantity: number; // 庫存數量
  currentHighestBid?: number;
  currentHighestBidderId?: string;
  status: 'pending' | 'active' | 'ended'; // 拍賣狀態
}

// 競標紀錄資料結構
export interface Bid {
  id: string;
  itemId: string;
  studentId: string;
  amount: number;
  timestamp: number;
}
