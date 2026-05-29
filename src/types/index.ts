export interface ClassData {
  id: string; // Firebase Document ID
  name: string;
  ownerId?: string; // 班級建立者的 Firebase Auth UID
  coTeacherEmails?: string[]; // 共同管理的老師信箱清單
  createdAt: number;
}

export interface Student {
  id: string; // Firebase Document ID
  classId: string;
  name: string;
  seatNumber: number;
  gender?: '男' | '女'; // 新增性別
  password?: string; // 新增直接驗證密碼
  points: number; // 總點數
  avatarUrl: string; // 頭像網址
  authUid?: string; // 保留供未來需要，或向下相容
  isAssistant?: boolean; // 是否為加分小老師
}

export interface AuctionItem {
  id: string; // Firebase Document ID
  name: string;
  description: string;
  imageUrl?: string;
  startingPrice: number;
  quantity: number; // 庫存數量
  currentHighestBid?: number;
  currentHighestBidderId?: string;
  currentHighestBidderName?: string;
  status: 'pending' | 'active' | 'ended'; // 拍賣狀態
}
