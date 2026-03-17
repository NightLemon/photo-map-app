import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { MapPin, Camera, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-sky-50">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Logo */}
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-8 h-8 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">PhotoMap</h1>
          <p className="text-gray-500 mb-8">照片与视频的地图管理平台</p>

          {/* Features */}
          <div className="text-left space-y-3 mb-8">
            {[
              { icon: '🗺️', text: '将照片 Pin 到世界地图上' },
              { icon: '📸', text: '管理你的照片和视频库' },
              { icon: '📁', text: '创建相册，整理回忆' },
              { icon: '☁️', text: 'Azure 云端安全存储' },
            ].map((feature) => (
              <div key={feature.text} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="text-lg">{feature.icon}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Login Button */}
          <button
            onClick={login}
            disabled={isLoading}
            className="w-full bg-blue-600 text-white rounded-xl py-3 px-4 font-medium text-base hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Camera className="w-5 h-5" />
            )}
            {isLoading ? '登录中...' : '登录 / 注册'}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            使用 Auth0 安全认证登录
          </p>
        </div>
      </div>
    </div>
  );
}
