import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMediaById } from '../hooks/useMedia';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  HardDrive,
  Maximize2,
  Trash2,
  Play,
} from 'lucide-react';
import { deleteMedia } from '../services/mediaService';
import { useQueryClient } from '@tanstack/react-query';

export default function MediaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: media, isLoading } = useMediaById(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!media) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
        <p>文件不存在</p>
        <Link to="/gallery" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">
          返回画廊
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这个文件吗？')) return;
    await deleteMedia(media.id);
    queryClient.invalidateQueries({ queryKey: ['media'] });
    queryClient.invalidateQueries({ queryKey: ['geoMedia'] });
    navigate('/gallery');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    return `${(bytes / 1_000).toFixed(0)} KB`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        to="/gallery"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 no-underline"
      >
        <ArrowLeft className="w-4 h-4" />
        返回画廊
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main viewer */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-xl overflow-hidden relative group">
            {media.type === 'video' ? (
              <video
                controls
                playsInline
                poster={media.thumbnailUrl || undefined}
                src={media.url}
                className="w-full max-h-[70vh] bg-gray-950"
              />
            ) : (
              <div className="flex items-center justify-center min-h-[400px]">
                <img
                  src={media.url}
                  alt={media.description || media.originalFilename}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mt-4">
            <h1 className="text-xl font-semibold text-gray-900">
              {media.description || media.originalFilename}
            </h1>
            {media.description && (
              <p className="text-sm text-gray-500 mt-1">{media.originalFilename}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Location */}
          {media.latitude != null && media.longitude != null && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-blue-600" />
                位置信息
              </h3>
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <p className="text-gray-700">
                  纬度: {media.latitude.toFixed(4)}
                </p>
                <p className="text-gray-700">
                  经度: {media.longitude.toFixed(4)}
                </p>
              </div>
              <Link
                to="/map"
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 no-underline"
              >
                在地图上查看 <ArrowLeft className="w-3 h-3 rotate-180" />
              </Link>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">文件信息</h3>
            <div className="space-y-2.5">
              {media.takenAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    {new Date(media.takenAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{formatFileSize(media.sizeBytes)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Maximize2 className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {media.width} x {media.height}
                </span>
              </div>
              {media.durationSeconds && (
                <div className="flex items-center gap-2 text-sm">
                  <Play className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{media.durationSeconds} 秒</span>
                </div>
              )}
              <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                {media.mimeType} · {media.originalFilename}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">操作</h3>
            <div className="space-y-2">
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除文件
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
