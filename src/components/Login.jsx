
import React, { useState } from 'react';
import { KeyRound, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function Login({ onLogin, loading }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    if (password.length !== 2) {
      setError('2자리 비밀번호를 입력해주세요.');
      return;
    }
    onLogin(password, (isValid) => {
      if (!isValid) {
        setError('비밀번호가 올바르지 않습니다.');
        setPassword('');
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 transform transition-all duration-300">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">유치부 예산관리</h1>
          <p className="text-gray-500 mt-2">접속을 위해 비밀번호를 입력해주세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <KeyRound className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="password"
              maxLength={2}
              value={password}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPassword(val);
                setError('');
                if (val.length === 2) {
                  onLogin(val, (isValid) => {
                    if (!isValid) {
                      setError('비밀번호가 올바르지 않습니다.');
                      setPassword('');
                    }
                  });
                }
              }}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="••"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg animate-pulse">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5" />
                <span>확인 중...</span>
              </>
            ) : (
              <>
                <span>접속하기</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            최초 1회 인증 후 브라우저를 닫기 전까지 유지됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
