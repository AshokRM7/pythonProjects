import React, { useState, useEffect } from 'react';
import { UserPlus, LogIn, Shield, Lock, ChevronRight, CheckCircle2 } from 'lucide-react';

interface SignInProps {
  onSignIn: (username: string) => void;
}

export default function SignIn({ onSignIn }: SignInProps) {
  const [username, setUsername] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    const usersJson = localStorage.getItem('users');
    const users: string[] = usersJson ? JSON.parse(usersJson) : [];

    if (isCreatingUser) {
      if (users.includes(username.trim())) {
        setError('User already exists. Please sign in instead.');
        return;
      }
      users.push(username.trim());
      localStorage.setItem('users', JSON.stringify(users));
      setSuccess('Account created successfully!');
      setTimeout(() => {
        onSignIn(username.trim());
      }, 800);
    } else {
      if (!users.includes(username.trim())) {
        setError('User not found. Please create a new account.');
        return;
      }
      onSignIn(username.trim());
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans selection:bg-[#012169] selection:text-white">
      {/* Top BofA Red Bar */}
      <div className="h-2 w-full bg-[#E31837] fixed top-0 z-50 shadow-sm" />

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#012169]/5 rounded-full blur-[120px] -mr-48 -mt-48 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#E31837]/5 rounded-full blur-[100px] -ml-24 -mb-24" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10 transition-all duration-700 ease-out translate-y-0 opacity-100">
        <div className={`max-w-[440px] w-full transition-all duration-1000 transform ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

          {/* Brand Header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-3 mb-6 group cursor-default">
              <div className="w-14 h-14 bg-[#012169] rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 duration-300">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="text-left border-l-2 border-gray-100 pl-4">
                <h1 className="text-2xl font-black text-[#012169] tracking-tight leading-none">
                  App Governance
                </h1>
                <p className="text-[#E31837] font-bold text-xs uppercase tracking-[0.2em] mt-1.5">
                  Secure Access Management
                </p>
              </div>
            </div>
          </div>

          {/* Card Container */}
          <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(1,33,105,0.12)] border border-gray-100 overflow-hidden">
            <div className={`p-10 transition-all duration-500 ${isCreatingUser ? 'bg-gray-50/50' : 'bg-white'}`}>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {isCreatingUser ? 'Register Account' : 'Welcome Back'}
                </h2>
                <div className="h-1 w-12 bg-[#E31837] mt-3 rounded-full" />
                <p className="text-gray-500 text-sm mt-4 font-medium">
                  {isCreatingUser
                    ? 'Create an administrative profile to manage governance tickets.'
                    : 'Securely sign into the governance portal.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-xs font-bold text-gray-500 uppercase tracking-widest block ml-1">
                    Username
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-[#012169] transition-colors" />
                    </div>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#012169]/10 focus:border-[#012169] focus:bg-white outline-none transition-all duration-300 text-gray-900 font-medium placeholder:text-gray-400 placeholder:font-normal"
                      placeholder="Enter your corporate ID"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-[#E31837] px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 animate-shake">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E31837]" />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#012169] text-white py-4 rounded-2xl font-bold hover:bg-[#00174F] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-blue-900/10 group"
                >
                  <span>{isCreatingUser ? 'Complete Registration' : 'Enter Portal'}</span>
                  {isCreatingUser ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    setIsCreatingUser(!isCreatingUser);
                    setError('');
                    setSuccess('');
                  }}
                  className="w-full py-2 text-sm font-bold text-[#012169] hover:text-[#E31837] transition-colors flex items-center justify-center gap-1 group"
                >
                  {isCreatingUser ? 'Already have an account? Sign In' : "New to App Governance? Create Profile"}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-10 font-bold uppercase tracking-[0.2em]">
            Bank of America &copy; 2025 • Internal Governance Use Only
          </p>
        </div>
      </main>

      {/* Footer Branding Area */}
      <div className="p-8 text-center flex justify-center gap-8 border-t border-gray-50 opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#012169]" />
          <span className="text-[10px] font-black tracking-widest text-gray-500">GDPR COMPLIANT</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 rounded-full bg-green-500" />
          <span className="text-[10px] font-black tracking-widest">SYSTEMS ONLINE</span>
        </div>
      </div>
    </div>
  );
}

