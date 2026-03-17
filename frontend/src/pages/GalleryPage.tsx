import { useState } from 'react';
import { useMediaList } from '../hooks/useMedia';
import MediaGrid from '../components/MediaGrid';
import { Filter, Image, Video, MapPin } from 'lucide-react';

type FilterType = 'all' | 'photo' | 'video' | 'located';

export default function GalleryPage() {
  const [filter, setFilter] = useState<FilterType>('all');

  const params =
    filter === 'photo'
      ? { type: 'photo' }
      : filter === 'video'
        ? { type: 'video' }
        : filter === 'located'
          ? { hasLocation: true }
          : undefined;

  const { data, isLoading } = useMediaList(params);

  const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: '全部', icon: null },
    { key: 'photo', label: '照片', icon: <Image className="w-3.5 h-3.5" /> },
    { key: 'video', label: '视频', icon: <Video className="w-3.5 h-3.5" /> },
    { key: 'located', label: '已定位', icon: <MapPin className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">媒体画廊</h1>
          <p className="text-sm text-gray-500 mt-1">
            共 {data?.total ?? 0} 个文件
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
          <Filter className="w-4 h-4 text-gray-400 mx-2" />
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <MediaGrid items={data?.items ?? []} emptyMessage="暂无媒体文件" />
      )}
    </div>
  );
}
