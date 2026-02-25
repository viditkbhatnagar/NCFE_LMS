'use client';

import { useEffect, useState, useCallback } from 'react';

interface FilePreviewMetadata {
  size?: number;
  uploadedAt?: string;
  learner?: { name: string; email: string };
  uploader?: { name: string; email: string };
  status?: string;
  description?: string;
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Base download URL, e.g. /api/v2/evidence/{id}/download */
  downloadUrl: string;
  fileName: string;
  fileType: string;
  label?: string;
  metadata?: FilePreviewMetadata;
}

type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'text' | 'other';

const OFFICE_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const TEXT_EXTENSIONS = ['txt', 'csv'];

function getFileCategory(fileType: string, fileName: string): FileCategory {
  const t = fileType.toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (t.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (t.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return 'video';
  if (t.startsWith('audio/') || ['mp3', 'wav'].includes(ext)) return 'audio';
  if (t === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (OFFICE_EXTENSIONS.includes(ext) ||
      t.includes('wordprocessingml') ||
      t.includes('spreadsheetml') ||
      t.includes('presentationml') ||
      t === 'application/msword') return 'office';
  if (TEXT_EXTENSIONS.includes(ext) ||
      t === 'text/plain' ||
      t === 'text/csv') return 'text';

  return 'other';
}

function getFriendlyFileType(fileType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    doc: 'Word Document (.doc)',
    docx: 'Word Document (.docx)',
    xls: 'Excel Spreadsheet (.xls)',
    xlsx: 'Excel Spreadsheet (.xlsx)',
    ppt: 'PowerPoint Presentation (.ppt)',
    pptx: 'PowerPoint Presentation (.pptx)',
    pdf: 'PDF Document (.pdf)',
    txt: 'Text File (.txt)',
    csv: 'CSV Spreadsheet (.csv)',
    jpg: 'JPEG Image (.jpg)',
    jpeg: 'JPEG Image (.jpeg)',
    png: 'PNG Image (.png)',
    gif: 'GIF Image (.gif)',
    webp: 'WebP Image (.webp)',
    mp4: 'MP4 Video (.mp4)',
    mov: 'QuickTime Video (.mov)',
    avi: 'AVI Video (.avi)',
    webm: 'WebM Video (.webm)',
    mkv: 'MKV Video (.mkv)',
    mp3: 'MP3 Audio (.mp3)',
    wav: 'WAV Audio (.wav)',
  };
  if (map[ext]) return map[ext];
  if (fileType.startsWith('image/')) return `Image (.${ext})`;
  if (fileType.startsWith('video/')) return `Video (.${ext})`;
  if (fileType.startsWith('audio/')) return `Audio (.${ext})`;
  return ext ? `${ext.toUpperCase()} File` : fileType;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'assessed':
      return 'bg-green-100 text-green-700';
    case 'submitted':
      return 'bg-blue-100 text-blue-700';
    case 'draft':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

export default function FilePreviewModal({
  isOpen,
  onClose,
  downloadUrl,
  fileName,
  fileType,
  label,
  metadata,
}: FilePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = getFileCategory(fileType, fileName);
  const previewable = category !== 'other';
  const displayName = label || fileName;

  const fetchSignedUrl = useCallback(async () => {
    if (!previewable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${downloadUrl}?preview=true&json=true`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.url) {
          setSignedUrl(data.url);

          if (category === 'text') {
            try {
              const textRes = await fetch(data.url);
              if (textRes.ok) {
                const text = await textRes.text();
                setTextContent(text);
              }
            } catch {
              setTextContent(null);
            }
          }
        } else {
          setSignedUrl(`${downloadUrl}?preview=true`);
        }
      } else {
        setSignedUrl(`${downloadUrl}?preview=true`);
      }
    } catch {
      setSignedUrl(`${downloadUrl}?preview=true`);
    } finally {
      setLoading(false);
    }
  }, [downloadUrl, previewable, category]);

  useEffect(() => {
    if (isOpen && previewable) {
      fetchSignedUrl();
    }
    return () => {
      setSignedUrl(null);
      setTextContent(null);
      setError(null);
    };
  }, [isOpen, fetchSignedUrl, previewable]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const officeViewerUrl = signedUrl
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(signedUrl)}`
    : null;

  const hasMetadata = metadata && (
    metadata.size || metadata.uploadedAt || metadata.learner || metadata.uploader || metadata.status || metadata.description
  );

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <p className="text-sm">{error}</p>
          <button
            onClick={handleDownload}
            className="text-sm text-primary hover:text-primary/80 underline"
          >
            Download instead
          </button>
        </div>
      );
    }

    if (signedUrl && category === 'image') {
      return (
        <img
          src={signedUrl}
          alt={displayName}
          className="max-w-full max-h-full object-contain"
          onError={() => setError('Failed to load image preview')}
        />
      );
    }

    if (signedUrl && category === 'video') {
      return (
        <video
          src={signedUrl}
          controls
          className="max-w-full max-h-full"
          onError={() => setError('Failed to load video preview')}
        >
          Your browser does not support video playback.
        </video>
      );
    }

    if (signedUrl && category === 'audio') {
      return (
        <div className="flex flex-col items-center gap-4 p-8">
          <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <audio
            src={signedUrl}
            controls
            className="w-full max-w-md"
            onError={() => setError('Failed to load audio preview')}
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      );
    }

    if (signedUrl && category === 'pdf') {
      return (
        <iframe
          src={signedUrl}
          className="w-full h-full"
          title={displayName}
        />
      );
    }

    if (officeViewerUrl && category === 'office') {
      return (
        <iframe
          src={officeViewerUrl}
          className="w-full h-full"
          title={displayName}
        />
      );
    }

    if (signedUrl && category === 'text') {
      if (textContent !== null) {
        return (
          <div className="w-full h-full overflow-auto p-6">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-white rounded-lg p-4 border border-gray-200 min-h-full">
              {textContent}
            </pre>
          </div>
        );
      }
      return (
        <iframe
          src={signedUrl}
          className="w-full h-full bg-white"
          title={displayName}
        />
      );
    }

    if (!previewable) {
      return (
        <div className="flex flex-col items-center gap-3 p-8 text-gray-500">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium">Preview not available for this file type</p>
          <p className="text-xs text-gray-400">{fileType}</p>
          <button
            onClick={handleDownload}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download File
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-6xl max-h-[90vh] mx-4 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
              title="Download"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Preview area (left) */}
          <div className={`flex-1 flex items-center justify-center bg-gray-100 overflow-auto min-h-[500px] ${hasMetadata ? '' : 'w-full'}`}>
            {renderPreview()}
          </div>

          {/* Metadata panel (right) */}
          {hasMetadata && (
            <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto shrink-0">
              <div className="p-5 space-y-5">
                {/* File title */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 leading-snug">
                    {displayName}
                  </h3>
                  {label && label !== fileName && (
                    <p className="text-xs text-gray-500 mt-1 break-all">{fileName}</p>
                  )}
                </div>

                {/* File type */}
                <p className="text-xs text-gray-500 break-all leading-relaxed">{getFriendlyFileType(fileType, fileName)}</p>

                {/* Size & Upload date */}
                <div className="space-y-3">
                  {metadata.size !== undefined && metadata.size > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Size:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatFileSize(metadata.size)}
                      </span>
                    </div>
                  )}

                  {metadata.uploadedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Uploaded:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatTimeAgo(metadata.uploadedAt)}
                      </span>
                    </div>
                  )}

                  {metadata.status && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getStatusColor(metadata.status)}`}>
                        {metadata.status}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {metadata.description && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Description</p>
                    <p className="text-sm text-gray-700">{metadata.description}</p>
                  </div>
                )}

                {/* Learner */}
                {metadata.learner && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Learner</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                        {getInitials(metadata.learner.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{metadata.learner.name}</p>
                        <p className="text-xs text-gray-500 truncate">{metadata.learner.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Uploader */}
                {metadata.uploader && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Uploader</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                        {getInitials(metadata.uploader.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{metadata.uploader.name}</p>
                        <p className="text-xs text-gray-500 truncate">{metadata.uploader.email}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
