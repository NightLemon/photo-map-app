import { Link } from 'react-router-dom';
import { useMediaList } from '../hooks/useMedia';
import { useAlbums } from '../hooks/useAlbums';
import { MapPin, Image, FolderOpen, Upload, ArrowRight, Play } from 'lucide-react';

export default function DashboardPage() {
  const { data: mediaData } = useMediaList({ pageSize: 8 });
  const { data: albums } = useAlbums();

  const totalMedia = mediaData?.total ?? 0;
  const geoMedia = mediaData?.items.filter((m) => m.latitude != null).length ?? 0;
  const recentMedia = mediaData?.items.slice(0, 4) ?? [];

  const stats = [
    { label: '总媒体数', value: totalMedia, icon: Image, color: 'bg-blue-50 text-blue-600' },
    { label: '已定位', value: geoMedia, icon: MapPin, color: 'bg-green-50 text-green-600' },
    { label: '相册', value: albums?.length ?? 0, icon: FolderOpen, color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">欢迎来到 PhotoMap</h1>
        <p className="text-gray-500 mt-1">管理你的照片和视频，在地图上追踪你的足迹</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link
          to="/upload"
          className="flex items-center gap-4 bg-blue-600 text-white rounded-xl p-4 hover:bg-blue-700 transition-colors no-underline"
        >
          <Upload className="w-8 h-8" />
          <div>
            <p className="font-medium">上传文件</p>
            <p className="text-sm text-blue-200">拖拽照片或视频</p>
          </div>
        </Link>
        <Link
          to="/map"
          className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all no-underline text-gray-900"
        >
          <MapPin className="w-8 h-8 text-green-600" />
          <div>
            <p className="font-medium">查看地图</p>
            <p className="text-sm text-gray-500">浏览照片足迹</p>
          </div>
        </Link>
        <Link
          to="/gallery"
          className="flex items-center gap-4 bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all no-underline text-gray-900"
        >
          <Image className="w-8 h-8 text-purple-600" />
          <div>
            <p className="font-medium">画廊浏览</p>
            <p className="text-sm text-gray-500">查看所有媒体</p>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent uploads */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">最近上传</h2>
          <Link to="/gallery" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 no-underline">
            查看全部 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {recentMedia.map((item) => (
            <Link
              key={item.id}
              to={`/media/${item.id}`}
              className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 no-underline"
            >
              {item.type === 'video' && !item.thumbnailUrl ? (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white group-hover:scale-105 transition-transform">
                  <Play className="w-8 h-8" fill="white" />
                </div>
              ) : (
                <img
                  src={item.thumbnailUrl || item.url}
                  alt={item.description}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
              )}
              {item.latitude != null && (
                <div className="absolute top-2 right-2 bg-blue-600/80 text-white rounded-full p-1">
                  <MapPin className="w-3 h-3" />
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent albums */}
      {albums && albums.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">我的相册</h2>
            <Link to="/albums" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 no-underline">
              查看全部 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {albums.slice(0, 3).map((album) => (
              <Link
                key={album.id}
                to={`/albums/${album.id}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow no-underline"
              >
                <div className="aspect-video bg-gray-100">
                  {album.coverThumbnailUrl && (
                    <img src={album.coverThumbnailUrl} alt={album.name} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-gray-900">{album.name}</p>
                  <p className="text-sm text-gray-500">{album.mediaCount} 个文件</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
