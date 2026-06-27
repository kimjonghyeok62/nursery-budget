import { useEffect, useState } from 'react';

function Login({ initialError = '' }) {
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const handleGoogleLogin = async () => {
    const verifier = generateVerifier();
    const challenge = await generateChallenge(verifier);
    sessionStorage.setItem('pkce_verifier', verifier);

    const redirectUri = `${window.location.origin}/auth/callback`;
    sessionStorage.setItem('pkce_redirect_uri', redirectUri);

    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-4">
            <img
              src="/icon-192.png"
              alt="유치부"
              className="w-full h-full rounded-2xl object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">유치부 예산관리</h1>
          <p className="text-gray-500 mt-2 text-sm text-center">Google 계정으로 로그인하세요</p>
        </div>

        <button
          onClick={handleGoogleLogin}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            padding: '12px 24px',
            backgroundColor: '#fff',
            color: '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            fontFamily: "'Google Sans', Roboto, sans-serif",
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'box-shadow 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)'}
          onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)'}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
          </svg>
          Google로 로그인
        </button>

        {error && (
          <div className="mt-5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 text-center font-medium">
            {error}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400 text-center">
          인가된 Google 계정만 접속 가능합니다
        </p>
      </div>
    </div>
  );
}

function generateVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export default Login;
