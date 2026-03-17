import MapView from '../components/MapView';

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-4rem)] sm:h-[calc(100vh-4rem)] flex flex-col">
      <div className="px-4 sm:px-6 lg:px-8 py-3 bg-white border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">照片地图</h1>
        <p className="text-sm text-gray-500">在世界地图上浏览你的照片足迹</p>
      </div>
      <div className="flex-1 p-4">
        <MapView />
      </div>
    </div>
  );
}
