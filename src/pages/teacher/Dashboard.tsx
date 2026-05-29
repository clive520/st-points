import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Users, Star, Gift, Settings } from 'lucide-react';
import ClassManager from './ClassManager';
import ClassDetails from './ClassDetails';
import PointsManager from './PointsManager';
import AuctionManager from './AuctionManager';

const navItems = [
  { path: '/teacher/classes', icon: Users, label: '班級管理' },
  { path: '/teacher/points', icon: Star, label: '點數系統' },
  { path: '/teacher/auctions', icon: Gift, label: '拍賣管理' },
  { path: '/teacher/settings', icon: Settings, label: '系統設定' },
];

export default function TeacherDashboard() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shadow-sm relative z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            教師管理後台
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-purple-100 text-purple-700 font-medium dark:bg-purple-900/30 dark:text-purple-400' 
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={20} className={isActive ? 'text-purple-600 dark:text-purple-400' : ''} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <Routes>
          <Route path="classes" element={<ClassManager />} />
          <Route path="classes/:classId" element={<ClassDetails />} />
          <Route path="points" element={<PointsManager />} />
          <Route path="auctions" element={<AuctionManager />} />
          <Route path="*" element={<ClassManager />} />
        </Routes>
      </main>
    </div>
  );
}
