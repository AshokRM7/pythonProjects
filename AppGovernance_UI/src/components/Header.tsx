import { LogOut, User, Bell, Menu } from 'lucide-react';
import { User as UserType } from '../App';
import boaLogo from '../assets/boa-logo.png';

interface HeaderProps {
  user: UserType;
  onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="bg-blue-900" style={{ backgroundColor: '#012169' }}>
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <img src={boaLogo} alt="Bank of America" className="h-8" />
            <nav className="hidden md:flex items-center gap-6 text-sm text-white">
              <a href="#" className="hover:text-red-500 transition-colors">Home</a>
              <a href="#" className="hover:text-red-500 transition-colors">Deliverables</a>
              <a href="#" className="hover:text-red-500 transition-colors">Reports</a>
              <a href="#" className="hover:text-red-500 transition-colors">Help</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-white hover:text-red-500 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full text-xs flex items-center justify-center">
                3
              </span>
            </button>
            <button className="md:hidden text-white">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-gray-900">App Governance Portal</h1>
          <p className="text-sm text-gray-600">Identity Access Management Deliverables</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center" style={{ backgroundColor: '#012169' }}>
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
