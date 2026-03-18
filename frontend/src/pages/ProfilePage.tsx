import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useUserStats } from '../hooks/useTrips';
import { updateProfile } from '../services/tripService';
import { MapPin, Image, FolderOpen, Navigation, Globe, Edit3, Check, X } from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { data: stats } = useUserStats();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ bio, location, website });
      setUser({ ...user, ...updated }, useAuthStore.getState().token ?? '');
      setEditing(false);
    } catch (e) {
      console.error('Failed to update profile:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setBio(user.bio ?? '');
    setLocation(user.location ?? '');
    setWebsite(user.website ?? '');
    setEditing(false);
  };

  const statCards = [
    { label: '照片/视频', value: stats?.mediaCount ?? 0, icon: Image, color: 'bg-blue-50 text-blue-600' },
    { label: '已定位', value: stats?.geoCount ?? 0, icon: MapPin, color: 'bg-green-50 text-green-600' },
    { label: '相册', value: stats?.albumCount ?? 0, icon: FolderOpen, color: 'bg-purple-50 text-purple-600' },
    { label: '旅行', value: stats?.tripCount ?? 0, icon: Navigation, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Banner */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-sky-400" />

        {/* Avatar + Info */}
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-12 mb-4">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`}
              alt={user.displayName}
              className="w-24 h-24 rounded-full border-4 border-white bg-gray-100 object-cover"
            />
            <div className="flex-1 pb-1">
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName || '未命名用户'}</h1>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                编辑资料
              </button>
            )}
          </div>

          {/* Editable Fields */}
          {editing ? (
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人简介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="介绍一下自己..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">常住城市</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="如：上海"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">个人网站</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-4 h-4" />
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {user.bio && <p className="text-sm text-gray-700">{user.bio}</p>}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {user.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {user.location}
                  </span>
                )}
                {user.website && (
                  <a
                    href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 no-underline"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {user.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
              {!user.bio && !user.location && !user.website && (
                <p className="text-sm text-gray-400 italic">还没有填写个人资料，点击"编辑资料"添加</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">账号信息</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">注册时间</span>
            <span className="text-gray-700">{new Date(user.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">用户 ID</span>
            <span className="text-gray-400 font-mono text-xs">{user.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
