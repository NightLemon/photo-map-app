import UploadDropzone from '../components/UploadDropzone';
import { useQueryClient } from '@tanstack/react-query';

export default function UploadPage() {
  const queryClient = useQueryClient();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">上传文件</h1>
        <p className="text-sm text-gray-500 mt-1">
          上传照片或视频，系统会自动提取 EXIF 定位信息并标记在地图上
        </p>
      </div>

      <UploadDropzone
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['media'] });
          queryClient.invalidateQueries({ queryKey: ['geoMedia'] });
        }}
      />

      {/* Tips */}
      <div className="mt-8 bg-blue-50 rounded-xl p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">提示</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>照片中包含 GPS 信息时，会自动在地图上标记位置</li>
          <li>支持批量拖入多个文件，最多同时上传 3 个</li>
          <li>支持 ZIP 压缩包批量导入，最大 500MB，ZIP 内非图片/视频文件会自动跳过</li>
          <li>视频文件当前可上传和播放，缩略图生成功能仍在完善</li>
          <li>上传后可以在媒体详情页手动修改定位</li>
        </ul>
      </div>
    </div>
  );
}
