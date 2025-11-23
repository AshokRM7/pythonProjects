import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Mail, Settings, ShieldCheck } from 'lucide-react';

const Layout = ({ children }) => {
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800';
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-lg">
                <div className="p-6 border-b border-slate-700 flex items-center space-x-3">
                    <ShieldCheck className="w-8 h-8 text-blue-400" />
                    <span className="text-xl font-bold tracking-wide">IAM Gov</span>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <Link
                        to="/"
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}
                    >
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </Link>

                    <Link
                        to="/logs"
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive('/logs')}`}
                    >
                        <Mail className="w-5 h-5" />
                        <span className="font-medium">Email Logs</span>
                    </Link>
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center space-x-3 text-slate-400 px-4 py-2">
                        <Settings className="w-5 h-5" />
                        <span className="text-sm">Settings</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
