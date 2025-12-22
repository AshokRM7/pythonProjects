import {
  ChartArea,
  HelpCircle,
  LogOut,
  Settings,
  User,
  UserCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Container } from "../reusable/Container";

export function Header() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="bg-white backdrop-blur-lg border-b border-border-default shadow-sm relative z-10">
      <Container className="py-2">
        <div className="flex items-center justify-between">
          <span className="flex gap-2 items-center">
            <ChartArea height={40} width={40} className="text-icon-secondary" />
            <span className="text-2xl mb-1 font-medium bg-linear-to-r from-gradient-primary-start to-gradient-primary-end bg-clip-text text-transparent">
              Incident Intel
            </span>
          </span>

          {/* Profile Dropdown */}

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-2 rounded-full hover:bg-hover-bg transition-all hover:shadow-md align-center cursor-pointer"
            >
              John
              <div className="bg-linear-to-r from-profile-gradient-start to-profile-gradient-end w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-shadow">
                <User className="w-6 h-6" />
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-profile-border">
                  <p className="text-gray-900">John Doe</p>
                  <p className="text-sm text-gray-500">john.doe@example.com</p>
                </div>
                <div>
                  <button
                    className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-profile-hover flex items-center gap-3 transition-colors rounded-lg mx-1 cursor-pointer"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <UserCircle className="w-5 h-5 text-icon-secondary" />
                    <span>Profile</span>
                  </button>
                </div>

                <button
                  className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-profile-hover flex items-center gap-3 transition-colors rounded-lg mx-1 cursor-pointer"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <Settings className="w-5 h-5 text-icon-secondary shrink-0" />
                  <span className="truncate">Settings</span>
                </button>

                <button
                  className="w-full px-4 py-2.5 text-left text-gray-700 hover:bg-profile-hover flex items-center gap-3 transition-colors mx-1 cursor-pointer"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  <HelpCircle className="w-5 h-5 text-icon-secondary" />
                  <span>Help</span>
                </button>

                <div className="border-t border-profile-border mt-2 pt-2">
                  <button
                    className="w-full px-4 py-2.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors rounded-lg mx-1 cursor-pointer"
                    onClick={() => {
                      setIsDropdownOpen(false);
                    }}
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
