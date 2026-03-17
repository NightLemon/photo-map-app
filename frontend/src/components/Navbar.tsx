import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  MapPin,
  Image,
  Upload,
  FolderOpen,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';

const navItems = [
  { to: '/', label: '首页', icon: LayoutDashboard },
  { to: '/map', label: '地图', icon: MapPin },
  { to: '/gallery', label: '画廊', icon: Image },
  { to: '/upload', label: '上传', icon: Upload },
  { to: '/albums', label: '相册', icon: FolderOpen },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl no-underline">
            <MapPin className="w-6 h-6" />
            <span>旅行纳豆</span>
          </NavLink>

          {/* Nav Links */}
          <div className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full"
                />
                <span className="hidden md:inline text-sm font-medium text-gray-700">
                  {user.displayName}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="sm:hidden flex overflow-x-auto border-t border-gray-100 px-2 py-1 gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap no-underline ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-500'
              }`
            }
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
