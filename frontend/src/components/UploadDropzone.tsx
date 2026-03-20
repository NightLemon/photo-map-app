import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, CheckCircle, AlertCircle, File, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import type { UploadProgress, ZipUploadResult } from '../types';
import { uploadMedia, uploadZip } from '../services/mediaService';

interface UploadDropzoneProps {
  onUploadComplete?: () => void;
}

interface ZipUploadState {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'success' | 'error';
  result?: ZipUploadResult;
  error?: string;
  errorsExpanded: boolean;
}

const MAX_MEDIA_SIZE = 100 * 1024 * 1024; // 100MB — must match backend max_upload_size_mb
const MAX_ZIP_SIZE = 500 * 1024 * 1024;   // 500MB — must match backend max_zip_size_mb

export default function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [zipUploads, setZipUploads] = useState<ZipUploadState[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const zipFiles = acceptedFiles.filter((f) => f.name.toLowerCase().endsWith('.zip'));
      const mediaFiles = acceptedFiles.filter((f) => !f.name.toLowerCase().endsWith('.zip'));

      // Handle ZIP files
      for (const zipFile of zipFiles) {
        if (zipFile.size > MAX_ZIP_SIZE) {
          setZipUploads((prev) => [
            ...prev,
            { file: zipFile, progress: 0, status: 'error', error: 'ZIP 文件超过 500MB 限制', errorsExpanded: false },
          ]);
          continue;
        }
        const zipState: ZipUploadState = {
          file: zipFile,
          progress: 0,
          status: 'uploading',
          errorsExpanded: false,
        };
        setZipUploads((prev) => [...prev, zipState]);

        try {
          const result = await uploadZip(zipFile, (pct) => {
            setZipUploads((prev) =>
              prev.map((z) =>
                z.file === zipFile
                  ? { ...z, progress: pct, status: pct < 100 ? 'uploading' : 'processing' }
                  : z,
              ),
            );
          });
          setZipUploads((prev) =>
            prev.map((z) =>
              z.file === zipFile
                ? { ...z, status: 'success', progress: 100, result }
                : z,
            ),
          );
        } catch {
          setZipUploads((prev) =>
            prev.map((z) =>
              z.file === zipFile
                ? { ...z, status: 'error', error: '上传失败' }
                : z,
            ),
          );
        }
      }

      // Handle regular media files
      if (mediaFiles.length > 0) {
        const oversized = mediaFiles.filter((f) => f.size > MAX_MEDIA_SIZE);
        const validMedia = mediaFiles.filter((f) => f.size <= MAX_MEDIA_SIZE);

        const newUploads: UploadProgress[] = [
          ...oversized.map((file) => ({
            file,
            progress: 0,
            status: 'error' as const,
            error: '文件超过 100MB 限制',
          })),
          ...validMedia.map((file) => ({
            file,
            progress: 0,
            status: 'pending' as const,
          })),
        ];

        setUploads((prev) => [...prev, ...newUploads]);

        const CONCURRENCY = 3;
        const queue = [...validMedia];

        const uploadOne = async (file: File) => {
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
        };

        const workers = Array.from({ length: Math.min(CONCURRENCY, mediaFiles.length) }, async () => {
          while (queue.length > 0) {
            const file = queue.shift();
            if (file) await uploadOne(file);
          }
        });

        await Promise.all(workers);
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
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
  });

  const completedCount = uploads.filter((u) => u.status === 'success').length;
  const totalCount = uploads.length;
  const allDone =
    (totalCount === 0 || completedCount === totalCount) &&
    zipUploads.every((z) => z.status === 'success' || z.status === 'error');

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
          支持 JPG, PNG, GIF, WebP, HEIC, MP4, MOV 等格式，或 ZIP 压缩包批量上传（最大 500MB）
        </p>
      </div>

      {/* ZIP upload list */}
      {zipUploads.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">ZIP 批量上传</h3>
          {zipUploads.map((z, i) => (
            <div key={`zip-${z.file.name}-${i}`} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-3">
                {z.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                ) : z.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <Archive className="w-5 h-5 text-blue-500 shrink-0 animate-pulse" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{z.file.name}</p>
                  <p className="text-xs text-gray-400">{(z.file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {z.status === 'uploading' && (
                  <div className="w-24">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${z.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-right mt-0.5">{z.progress}%</p>
                  </div>
                )}
                {z.status === 'processing' && (
                  <span className="text-xs text-blue-600 font-medium">处理中...</span>
                )}
                {z.status === 'error' && (
                  <span className="text-xs text-red-600 font-medium">{z.error}</span>
                )}
                {z.status === 'success' && z.result && (
                  <span className="text-xs text-green-600 font-medium">
                    成功 {z.result.succeeded}/{z.result.total} 张
                    {z.result.skipped > 0 && `，跳过 ${z.result.skipped} 个非媒体文件`}
                  </span>
                )}
              </div>

              {/* ZIP result details */}
              {z.status === 'success' && z.result && z.result.failed > 0 && (
                <div>
                  <button
                    onClick={() =>
                      setZipUploads((prev) =>
                        prev.map((item, idx) =>
                          idx === i ? { ...item, errorsExpanded: !item.errorsExpanded } : item,
                        ),
                      )
                    }
                    className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                  >
                    {z.errorsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {z.result.failed} 个文件跳过
                  </button>
                  {z.errorsExpanded && (
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {z.result.errors.map((e, j) => (
                        <li key={j} className="text-xs text-gray-500">
                          <span className="font-medium">{e.filename}</span> — {e.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Regular upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">
              上传进度 ({completedCount}/{totalCount})
            </h3>
            {allDone && (uploads.length > 0 || zipUploads.length > 0) && (
              <button
                onClick={() => { setUploads([]); setZipUploads([]); }}
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
              {upload.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : upload.status === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              ) : (
                <File className="w-5 h-5 text-gray-400 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{upload.file.name}</p>
                <p className="text-xs text-gray-400">
                  {(upload.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>

              {upload.status === 'uploading' && (
                <div className="w-24">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-0.5">{upload.progress}%</p>
                </div>
              )}

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

      {/* Clear button when only ZIPs and no media uploads */}
      {uploads.length === 0 && zipUploads.length > 0 && allDone && (
        <div className="flex justify-end">
          <button
            onClick={() => setZipUploads([])}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            清除列表
          </button>
        </div>
      )}
    </div>
  );
}
