import { Star } from 'lucide-react';

export default function PointsManager() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">點數管理 (ClassDojo 風格)</h2>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 min-h-[400px] flex items-center justify-center">
        <div className="text-center text-gray-500 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <Star size={32} className="text-gray-400" />
          </div>
          <p className="text-lg">請先到「班級管理」建立班級與學生</p>
          <p className="text-sm text-gray-400">建立完成後，才能在這裡幫學生進行加扣點喔！</p>
        </div>
      </div>
    </div>
  );
}
