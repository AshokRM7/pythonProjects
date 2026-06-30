import React from 'react';
import { Shield, LogOut, Bell, Settings, Search, LayoutGrid, HelpCircle } from 'lucide-react';
import accentureFlag from '../assets/accenture-logo.png';


interface HeaderProps {
  currentUser: string;
  onSignOut: () => void;
  onSearch?: (query: string) => void;
  searchValue?: string;
}


export default function Header({ currentUser, onSignOut, onSearch, searchValue }: HeaderProps) {
  // State for Dropdowns
  const [isAppsOpen, setIsAppsOpen] = React.useState(false);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);

  const appsRef = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLButtonElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const settingsRef = React.useRef<HTMLButtonElement>(null);
  const helpRef = React.useRef<HTMLButtonElement>(null);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (appsRef.current && !appsRef.current.contains(event.target as Node)) setIsAppsOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setIsSettingsOpen(false);
      if (helpRef.current && !helpRef.current.contains(event.target as Node)) setIsHelpOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const apps = [
    { name: 'Jira', icon: '🔷', color: 'bg-blue-100' },
    { name: 'Slack', icon: '💬', color: 'bg-green-100' },
    { name: 'GitHub', icon: '😺', color: 'bg-gray-100' },
    { name: 'Drive', icon: '📁', color: 'bg-yellow-100' },
    { name: 'Mail', icon: '✉️', color: 'bg-red-100' },
    { name: 'Calendar', icon: '📅', color: 'bg-purple-100' }
  ];

  return (
    <header className="bg-white/95 backdrop-blur-md border-t-4 border-[#E31837] border-b border-gray-200 shadow-sm sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-[95%] mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo and App Name */}
          <div className="flex items-center gap-6 group cursor-pointer" onClick={() => window.location.href = '/'}>
            <div className="flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <img
                src={accentureFlag}
                alt="Accenture"
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="hidden sm:block h-10 w-px bg-gray-200" />
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xl font-black text-[#012169] tracking-tight leading-none">
                Application Governance
              </span>
              <span className="text-[#E31837] font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
                Internal Access Portal
              </span>
            </div>
          </div>


          {/* User Actions */}
          <div className="flex items-center gap-2 sm:gap-4 relative" ref={appsRef}>
            {/* New Options: Apps & Help */}
            <div className="relative">
              <button
                onClick={() => setIsAppsOpen(!isAppsOpen)}
                className={`hidden sm:flex p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 ${isAppsOpen ? 'bg-blue-50 text-blue-600' : ''}`}
                title="Apps"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>

              {/* Apps Dropdown */}
              {isAppsOpen && (
                <div className="absolute top-12 right-0 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 animate-in fade-in zoom-in-95 duration-200 z-[60]">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Connected Apps</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {apps.map((app) => (
                      <div key={app.name} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">
                        <div className={`w-10 h-10 ${app.color} rounded-lg flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                          {app.icon}
                        </div>
                        <span className="text-xs text-gray-600 font-medium">{app.name}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-100 text-center">
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All Integrations</button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                ref={helpRef}
                onClick={() => setIsHelpOpen(!isHelpOpen)}
                className={`hidden sm:flex p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 ${isHelpOpen ? 'bg-blue-50 text-blue-600' : ''}`}
                title="Help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Help Dropdown */}
              {isHelpOpen && (
                <div className="absolute top-12 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in zoom-in-95 duration-200 z-[60]">
                  <div className="px-4 py-2 border-b border-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Help & Support</div>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>📚</span> Documentation
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>🎬</span> Video Tutorials
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>⌨️</span> Keyboard Shortcuts
                  </button>
                  <div className="border-t border-gray-50 mt-1 pt-1">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                      <span>💬</span> Contact Support
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 hidden sm:block mx-1"></div>

            <div className="relative">
              <button
                ref={notifRef}
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 group ${isNotifOpen ? 'bg-blue-50 text-blue-600' : ''}`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-white"></span>
                </span>
              </button>

              {isNotifOpen && (
                <div className="absolute top-12 right-0 w-80 bg-white rounded-xl shadow-xl border border-gray-100 p-0 animate-in fade-in zoom-in-95 duration-200 z-[60] overflow-hidden">
                  <div className="p-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                    <button className="text-xs text-blue-600 font-medium hover:text-blue-700">Mark all read</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors flex gap-3">
                        <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0"></div>
                        <div>
                          <p className="text-sm text-gray-800 font-medium line-clamp-1">New high priority ticket assigned</p>
                          <p className="text-xs text-gray-500 mt-0.5">REQ-102{i} • Just now</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 text-center border-t border-gray-50">
                    <button className="text-xs text-gray-500 hover:text-gray-700 font-medium py-1">View History</button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                ref={settingsRef}
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 animate-spin-slow-on-hover ${isSettingsOpen ? 'bg-blue-50 text-blue-600' : ''}`}
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Dropdown */}
              {isSettingsOpen && (
                <div className="absolute top-12 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in zoom-in-95 duration-200 z-[60]">
                  <div className="px-4 py-2 border-b border-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">Settings</div>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>⚙️</span> General Settings
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>🔔</span> Notification Prefs
                  </button>
                  <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                    <span>🌙</span> Dark Mode
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={profileRef}>
              <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200 ml-2 cursor-pointer" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-gray-900 leading-none mb-1">{currentUser}</p>
                  <p className="text-xs text-gray-500 font-medium">Administrator</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-md ring-2 ring-white hover:ring-blue-100 transition-all">
                  {currentUser.charAt(0).toUpperCase()}
                </div>
              </div>

              {isProfileOpen && (
                <div className="absolute top-14 right-0 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1 animate-in fade-in zoom-in-95 duration-200 z-[60]">
                  <div className="px-4 py-3 border-b border-gray-50 md:hidden">
                    <p className="text-sm font-semibold text-gray-900">{currentUser}</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                  </div>

                  <div className="py-1">
                    <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center gap-2">
                      <span>👤</span> Profile Settings
                    </button>
                  </div>

                  <div className="border-t border-gray-50 py-1">
                    <button
                      onClick={onSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
