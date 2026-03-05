import React, { useState, useEffect } from 'react';
import { UserPlus, LogIn, Lock, ChevronRight, CheckCircle, Loader2 } from 'lucide-react';
import bofaFlag from '../assets/bofa-flag.png';



interface SignInProps {
  onSignIn: (username: string) => void;
}

export default function SignIn({ onSignIn }: SignInProps) {
  const [username, setUsername] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [showRiseLoader, setShowRiseLoader] = useState(false);

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

      // Trigger the RISE portal loading screen
      setShowRiseLoader(true);
      setTimeout(() => {
        onSignIn(username.trim());
      }, 5000);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col font-sans selection:bg-[#012169] selection:text-white overflow-hidden">
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
          <div className="mb-8 flex flex-col items-center">
            <div className="group cursor-default mb-4">
              <img src={bofaFlag} alt="Bank of America" className="h-24 w-auto object-contain mx-auto" />
            </div>
            <div className="h-1 w-16 bg-[#E31837] mb-6 rounded-full" />
            <h1 className="text-2xl font-black text-[#012169] tracking-tighter text-center uppercase leading-none">
              App Governance <span className="text-[#E31837]">Portal</span>
            </h1>
          </div>

          {/* Card Container */}
          <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(1,33,105,0.12)] border border-gray-100 overflow-hidden">
            <div className={`p-10 transition-all duration-500 ${isCreatingUser ? 'bg-gray-50/50' : 'bg-white'}`}>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                  {isCreatingUser ? 'Register Account' : 'Sign In'}
                </h2>
                <div className="h-1 w-12 bg-[#E31837] mt-3 rounded-full" />
                <p className="text-gray-500 text-sm mt-4 font-medium leading-relaxed">
                  {isCreatingUser
                    ? 'Create an administrative profile to manage governance tickets.'
                    : 'Enter your User ID to get started.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-xs font-bold text-gray-500 uppercase tracking-widest block ml-1">
                    User ID
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
                    <CheckCircle className="w-4 h-4" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#012169] text-white py-4 rounded-2xl font-bold hover:bg-[#00174F] transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-blue-900/10 group"
                >
                  <span>{isCreatingUser ? 'Complete Registration' : 'Sign In'}</span>
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

      {/* RISE Portal Loader Overlay */}
      {showRiseLoader && (
        <div className="fixed inset-0 z-[100] bg-[#012169] flex flex-col items-center justify-center text-white overflow-hidden">
          {/* Animated Background Gradients */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-400/10 rounded-full blur-[120px] -mr-64 -mt-64 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-red-400/10 rounded-full blur-[100px] -ml-32 -mb-32" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center px-6">
            <div className="mb-12 relative">
              <div className="p-8 bg-white rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl animate-bounce gap-4">
                <img src={bofaFlag} alt="Bank of America" className="h-24 w-auto object-contain" />
                <div className="h-0.5 w-12 bg-[#E31837] rounded-full" />
                <span className="text-[#012169] font-black tracking-widest text-[10px] uppercase">App Governance</span>
              </div>
              <div className="absolute -inset-4 border-2 border-white/20 rounded-[3rem] animate-[spin_10s_linear_infinite]" />
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl font-black tracking-tight">Authenticating Session</h2>
              <div className="flex items-center justify-center gap-3 text-blue-200">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-lg font-medium animate-pulse">Tickets are loading from RISE portal...</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-12 w-64 h-1.5 bg-white/10 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-gradient-to-r from-blue-400 to-white animate-[progress_5s_ease-in-out_forwards]" />
            </div>

            <div className="mt-8 text-white/40 text-xs font-bold uppercase tracking-[0.3em]">
              Bank of America Global Technology
            </div>
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes progress {
              0% { width: 0%; }
              100% { width: 100%; }
            }
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-4px); }
              75% { transform: translateX(4px); }
            }
            .animate-shake {
              animation: shake 0.4s ease-in-out infinite;
            }
          `}} />
        </div>
      )}
    </div>
  );
}

