import { Link } from 'react-router-dom';
import { useAlbums } from '../hooks/useAlbums';
import { Plus, FolderOpen } from 'lucide-react';
import { useState } from 'react';
import { createAlbum } from '../services/mediaService';
import { useQueryClient } from '@tanstack/react-query';

export default function AlbumsPage() {
  const { data: albums, isLoading } = useAlbums();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createAlbum({ name: newName, description: newDesc });
    queryClient.invalidateQueries({ queryKey: ['albums'] });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
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
