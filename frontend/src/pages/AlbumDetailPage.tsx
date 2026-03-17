import { useParams, Link } from 'react-router-dom';
import { useAlbumById, useAlbumMedia } from '../hooks/useAlbums';
import MediaGrid from '../components/MediaGrid';
import { ArrowLeft } from 'lucide-react';

export default function AlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: album, isLoading: albumLoading } = useAlbumById(id);
  const { data: media, isLoading: mediaLoading } = useAlbumMedia(id);

  if (albumLoading || mediaLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-500">
        <p>相册不存在</p>
        <Link to="/albums" className="text-blue-600 hover:text-blue-700 mt-2 inline-block">
          返回相册列表
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/albums"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3 no-underline"
        >
          <ArrowLeft className="w-4 h-4" />
          返回相册列表
        </Link>

        {/* Album cover */}
        {album.coverThumbnailUrl && (
          <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-gray-100">
            <img src={album.coverThumbnailUrl} alt={album.name} className="w-full h-full object-cover" />
          </div>
        )}

        <h1 className="text-2xl font-bold text-gray-900">{album.name}</h1>
        {album.description && <p className="text-gray-500 mt-1">{album.description}</p>}
        <p className="text-sm text-gray-400 mt-1">{album.mediaCount} 个文件</p>
      </div>

      {/* Media grid */}
      <MediaGrid items={media ?? []} emptyMessage="这个相册还没有内容" />
    </div>
  );
}
