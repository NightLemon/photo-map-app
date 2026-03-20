import { Link, useNavigate } from 'react-router-dom';
import { useAlbums } from '../hooks/useAlbums';
import { useGeoMedia } from '../hooks/useMedia';
import { useTripMapData } from '../hooks/useTrips';
import { Plus, FolderOpen, MapPin, Loader2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { createAlbum, createAlbumFromCluster } from '../services/mediaService';
import { useQueryClient } from '@tanstack/react-query';
import { computeClusters } from '../utils/clusterMedia';
import type { MediaCluster } from '../types';

function ClusterCard({ cluster, onGenerate }: { cluster: MediaCluster; onGenerate: (c: MediaCluster) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (done || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onGenerate(cluster);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const startDay = cluster.startDate.slice(0, 10);
  const endDay = cluster.endDate.slice(0, 10);
  const dateLabel = startDay === endDay ? startDay : `${startDay} — ${endDay}`;
  const previews = cluster.photos.slice(0, 4);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Color bar */}
      <div className="h-1" style={{ backgroundColor: cluster.color }} />

      {/* Thumbnail strip */}
      <div className="flex h-24 bg-gray-100">
        {previews.map((p, i) => (
          <div key={p.id} className="flex-1 overflow-hidden" style={{ opacity: i >= 3 ? 0.5 : 1 }}>
            <img src={p.thumbnailUrl} alt={p.originalFilename} className="w-full h-full object-cover" />
          </div>
        ))}
        {cluster.photos.length > 4 && (
          <div className="w-10 flex items-center justify-center bg-gray-200 text-xs text-gray-600 font-medium">
            +{cluster.photos.length - 4}
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {cluster.tripName ? (
              <p className="text-sm font-semibold text-gray-900 truncate">{cluster.tripName}</p>
            ) : (
              <p className="text-sm font-semibold text-gray-500 truncate">未匹配行程</p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {cluster.photos.length} 张照片
            </p>
          </div>
          <button
            onClick={handleClick}
            disabled={loading || done}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              done
                ? 'bg-green-100 text-green-700 cursor-default'
                : loading
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : error
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 animate-spin" />生成中…</>
            ) : done ? (
              '已生成 ✓'
            ) : error ? (
              '失败，点击重试'
            ) : (
              <><Plus className="w-3 h-3" />一键生成相册</>
            )}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}

export default function AlbumsPage() {
  const { data: albums, isLoading } = useAlbums();
  const { data: geoMedia } = useGeoMedia();
  const { data: tripRoutes } = useTripMapData();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const clusters = useMemo(
    () => computeClusters(geoMedia ?? [], tripRoutes ?? []),
    [geoMedia, tripRoutes],
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAlbum({ name: newName, description: newDesc });
    queryClient.invalidateQueries({ queryKey: ['albums'] });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const handleGenerateFromCluster = async (cluster: MediaCluster) => {
    const album = await createAlbumFromCluster(cluster);
    queryClient.invalidateQueries({ queryKey: ['albums'] });
    navigate(`/albums/${album.id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的相册</h1>
          <p className="text-sm text-gray-500 mt-1">{albums?.length ?? 0} 个相册</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建相册
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-3">新建相册</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="相册名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <textarea
              placeholder="描述（可选）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                创建
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart clusters section */}
      {clusters.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base font-semibold text-gray-800">智能行程</h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              自动检测到 {clusters.length} 段行程
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                onGenerate={handleGenerateFromCluster}
              />
            ))}
          </div>
          <div className="border-t border-gray-200 mt-8" />
        </div>
      )}

      {/* Album grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : albums && albums.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/albums/${album.id}`}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow no-underline"
            >
              <div className="aspect-video bg-gray-100 relative overflow-hidden">
                {album.coverThumbnailUrl ? (
                  <img
                    src={album.coverThumbnailUrl}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="w-12 h-12 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {album.name}
                </h3>
                {album.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{album.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">{album.mediaCount} 个文件</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <FolderOpen className="w-16 h-16 mx-auto mb-4" />
          <p className="text-lg">还没有相册</p>
          <p className="text-sm mt-1">点击上方按钮创建第一个相册</p>
        </div>
      )}
    </div>
  );
}
