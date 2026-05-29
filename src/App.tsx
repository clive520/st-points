import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherDashboard from './pages/teacher/Dashboard';
import StudentLogin from './pages/student/Login';
import StudentDashboard from './pages/student/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 預設導向學生登入頁面 */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 學生端路由 */}
        <Route path="/login" element={<StudentLogin />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        
        {/* 老師端系統路由 */}
        <Route path="/teacher/*" element={<TeacherDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
