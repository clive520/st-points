import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';

export default function TeacherLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const auth = getAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/teacher/classes');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // 將教師紀錄存入 Firestore
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          role: 'teacher',
          createdAt: Date.now()
        });
        navigate('/teacher/classes');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('此信箱已被註冊過！');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('信箱或密碼錯誤！');
      } else {
        setError('發生錯誤：' + err.message);
      }
    }
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('請先在上方輸入您的信箱，再點擊忘記密碼。');
      return;
    }
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('密碼重設信件已發送，請檢查您的信箱！');
    } catch (err: any) {
      setError('發送失敗：' + err.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-gray-800"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-4 transform rotate-12 shadow-lg shadow-purple-500/30">
            <span className="text-3xl text-white font-black">ST</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isLogin ? '教師登入' : '教師註冊'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isLogin ? '歡迎回來，請登入您的帳號' : '建立帳號以管理班級點數'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl text-sm text-center">
              {message}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">電子信箱</label>
            <input 
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.edu"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">密碼</label>
            <input 
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼 (至少6位)"
              minLength={6}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:hover:scale-100 mt-4"
          >
            {isLoading ? '處理中...' : (isLogin ? '登入' : '註冊帳號')}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-center text-sm">
          {isLogin && (
            <button 
              onClick={handleResetPassword}
              type="button"
              className="text-purple-600 dark:text-purple-400 hover:underline"
            >
              忘記密碼？
            </button>
          )}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }}
            type="button"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {isLogin ? '還沒有帳號嗎？點我註冊' : '已經有帳號了嗎？點我登入'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
