import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
        setError('Email atau password salah.');
        setIsSubmitting(false);
    }
    // On success, the onAuthStateChange listener in App.tsx will handle the state transition.
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img
            src="https://wqgbkwujfxdwlywxrjup.supabase.co/storage/v1/object/public/publik/nala%20baru%20svg.svg"
            alt="Nala Media Logo"
            className="h-20 w-80"
          />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <h1 className="text-xl font-bold text-center text-gray-800 mb-1">LOGIN</h1>
          <p className="text-center text-sm text-gray-500 mb-6">Masukkan data login untuk melanjutkan ke Aplikasi Nalamedia</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password"className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                />
              </div>
            </div>

            <div className="h-6 text-center text-sm">
                {error && (
                    <p className="text-red-600">{error}</p>
                )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:bg-pink-300"
              >
                {isSubmitting ? 'Memproses...' : 'Masuk'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
