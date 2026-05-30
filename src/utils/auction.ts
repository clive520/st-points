import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AuctionItem, Student } from '../types';

export interface BidResult {
  success: boolean;
  message: string;
  newPrice?: number;
}

export const placeBid = async (
  auctionId: string,
  studentId: string,
  bidAmount: number
): Promise<BidResult> => {
  const auctionRef = doc(db, 'auctionItems', auctionId);
  const studentRef = doc(db, 'students', studentId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const auctionDoc = await transaction.get(auctionRef);
      if (!auctionDoc.exists()) {
        throw new Error('拍賣品不存在');
      }

      const auction = auctionDoc.data() as AuctionItem;

      if (auction.status !== 'active') {
        throw new Error('該物品目前不在拍賣中');
      }

      const currentHighest = auction.currentHighestBid || auction.startingPrice;

      // 檢查是否已被超越
      if (bidAmount <= currentHighest) {
        throw new Error(`出價太慢囉！目前最高價已經來到 ${currentHighest} 點`);
      }

      // 取得學生資料
      const studentDoc = await transaction.get(studentRef);
      if (!studentDoc.exists()) {
        throw new Error('找不到該學生資料');
      }

      const student = studentDoc.data() as Student;

      // 檢查點數餘額
      if (student.points < bidAmount) {
        throw new Error('點數餘額不足');
      }

      // 檢查是否是自己超越自己
      if (auction.currentHighestBidderId === studentId) {
        throw new Error('你已經是最高出價者了！');
      }

      // 如果有上一位最高出價者，進行退款
      if (auction.currentHighestBidderId) {
        const prevBidderRef = doc(db, 'students', auction.currentHighestBidderId);
        const prevBidderDoc = await transaction.get(prevBidderRef);
        
        if (prevBidderDoc.exists()) {
          const prevBidder = prevBidderDoc.data() as Student;
          // 退還之前扣除的點數
          transaction.update(prevBidderRef, {
            points: prevBidder.points + (auction.currentHighestBid || 0)
          });
        }
      }

      // 扣除目前出價者的點數
      transaction.update(studentRef, {
        points: student.points - bidAmount
      });

      // 更新拍賣品狀態
      transaction.update(auctionRef, {
        currentHighestBid: bidAmount,
        currentHighestBidderId: studentId,
        currentHighestBidderName: student.name
      });

      return {
        success: true,
        message: '出價成功！你是目前的最高出價者！',
        newPrice: bidAmount
      };
    });

    return result;
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '出價失敗，請稍後再試',
    };
  }
};
