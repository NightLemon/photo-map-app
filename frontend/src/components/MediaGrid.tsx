import { Link } from 'react-router-dom';
import type { MediaItem } from '../types';
import { Play, MapPin } from 'lucide-react';

interface MediaGridProps {
  items: MediaItem[];
  emptyMessage?: string;
}

export default function MediaGrid({ items, emptyMessage = '暂无内容' }: MediaGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Image className="w-16 h-16 mb-4" />
        <p className="text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <Link
          key={item.id}
          to={`/media/${item.id}`}
          className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 no-underline"
        >
          {item.type === 'video' && !item.thumbnailUrl ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white transition-transform group-hover:scale-105">
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
                  <Play className="w-6 h-6" fill="white" />
                </div>
                <span className="text-xs text-white/80">视频文件</span>
              </div>
            </div>
          ) : (
            <img
              src={item.thumbnailUrl || item.url}
              alt={item.description || item.originalFilename}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Type badge */}
          {item.type === 'video' && (
            <div className="absolute top-2 left-2 bg-black/60 text-white rounded-full p-1">
              <Play className="w-3.5 h-3.5" fill="white" />
            </div>
          )}

          {/* Location badge */}
          {item.latitude != null && (
            <div className="absolute top-2 right-2 bg-blue-600/80 text-white rounded-full p-1">
              <MapPin className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="truncate font-medium">{item.description || item.originalFilename}</p>
            {item.takenAt && (
              <p className="text-white/70">{new Date(item.takenAt).toLocaleDateString('zh-CN')}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

function Image({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
    </svg>
  );
}
