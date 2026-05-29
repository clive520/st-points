import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherDashboard from './pages/teacher/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 預設先導向老師端，等學生端做好再做入口選擇頁面 */}
        <Route path="/" element={<Navigate to="/teacher" replace />} />
        
        {/* 老師端系統路由 */}
        <Route path="/teacher/*" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
