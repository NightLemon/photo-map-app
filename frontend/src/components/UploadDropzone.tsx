import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, File } from 'lucide-react';
import type { UploadProgress } from '../types';
import { uploadMedia } from '../services/mediaService';

interface UploadDropzoneProps {
  onUploadComplete?: () => void;
}

export default function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newUploads: UploadProgress[] = acceptedFiles.map((file) => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'uploading' as const } : u,
          ),
        );

        try {
          const result = await uploadMedia(file, (pct) => {
            setUploads((prev) =>
              prev.map((u) => (u.file === file ? { ...u, progress: pct } : u)),
            );
          });

          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? { ...u, status: 'success' as const, progress: 100, mediaId: result.id }
                : u,
            ),
          );
        } catch {
          setUploads((prev) =>
            prev.map((u) =>
              u.file === file
                ? { ...u, status: 'error' as const, error: '上传失败' }
                : u,
            ),
          );
        }
      }

      onUploadComplete?.();
    },
    [onUploadComplete],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'],
      'video/*': ['.mp4', '.mov', '.avi', '.mkv'],
    },
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const completedCount = uploads.filter((u) => u.status === 'success').length;
  const totalCount = uploads.length;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload
          className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`}
        />
        <p className="text-lg font-medium text-gray-700">
          {isDragActive ? '放开以上传文件' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="text-sm text-gray-400 mt-2">
          支持 JPG, PNG, GIF, WebP, HEIC, MP4, MOV 等格式，单文件最大 100MB
        </p>
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              上传进度 ({completedCount}/{totalCount})
            </h3>
            {completedCount === totalCount && totalCount > 0 && (
              <button
                onClick={() => setUploads([])}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                清除列表
              </button>
            )}
          </div>

          {uploads.map((upload, i) => (
            <div
              key={`${upload.file.name}-${i}`}
              className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 p-3"
            >
              {/* Icon */}
              {upload.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : upload.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              ) : (
                <File className="w-5 h-5 text-gray-400 shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {upload.file.name}
                </p>
                <p className="text-xs text-gray-400">
                  {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              {/* Progress */}
              {upload.status === 'uploading' && (
                <div className="w-24">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-0.5">
                    {upload.progress}%
                  </p>
                </div>
              )}

              {/* Status text */}
              {upload.status === 'success' && (
                <span className="text-xs text-green-600 font-medium">完成</span>
              )}
              {upload.status === 'error' && (
                <span className="text-xs text-red-600 font-medium">{upload.error}</span>
              )}
              {upload.status === 'pending' && (
                <span className="text-xs text-gray-400">等待中...</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
