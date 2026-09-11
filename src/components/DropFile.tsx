import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X, FileText, UploadCloud, Film } from 'lucide-react';
import './comp_css/DropFile.css';

// --- HELPER FUNCTIONS ---
const isVideoFile = (file: any): boolean => {
  const name = file.name?.toLowerCase() || '';
  const type = file.type?.toLowerCase() || '';
  return (
    type.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.webm') ||
    name.endsWith('.ogg')
  );
};

// const isGifFile = (file: any): boolean => {
//   const name = file.name?.toLowerCase() || '';
//   const type = file.type?.toLowerCase() || '';
//   return type === 'image/gif' || name.endsWith('.gif');
// };

const FileItem = ({ file, onRemove, onClick }: { file: any; onRemove: () => void; onClick: () => void }) => {
  const [preview, setPreview] = React.useState<string | null>(null);

  useEffect(() => {
    // Generate preview URL for local images and videos
    if (file instanceof File && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (file.isRemote && file.previewUrl) {
      setPreview(file.previewUrl);
    }
  }, [file, file.previewUrl]);

  const isMedia = !file.name?.toLowerCase().endsWith('.pdf');
  const isLoadingRemote = file.isRemote && isMedia && !preview;

  return (
    <div className="attachment-item">
      {!file.isRemote && (
        <div className="unsaved-indicator-files" title="Not yet uploaded">
          !
        </div>
      )}
      <div className="file-info-clickable" onClick={() => onClick()} role="button">
        <div className="file-preview-wrapper">
          {isLoadingRemote ? (
            <div className="gradient-spinner">
              <div className="spinner-inner"></div>
            </div>
          ) : preview && !isVideoFile(file) ? (
            <img src={preview} alt="preview" className="file-img-preview" />
          ) : isVideoFile(file) ? (
            <Film size={18} className="doc-navy" />
          ) : file.name?.toLowerCase().endsWith('.pdf') ? (
            <FileText size={18} className="doc-red" />
          ) : (
            <Paperclip size={18} className="doc-navy" />
          )}
        </div>
        <div className="file-details">
          <span className="file-name">{file.name}</span>
          <span className="file-size">
            {file.isRemote ? `ID: ${file.id}` : `${(file.size / 1024).toFixed(1)} KB`} {!file.isRemote ? '(unsaved)' : ''}
          </span>
        </div>
      </div>

      <button type="button" className="btn-remove-file" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
        <X size={14} />
      </button>
    </div>
  );
};

export interface CustomFileAttachmentRef {
  getFilesToUpload: () => File[];
  getFilesToDelete: () => number[];
}

interface CustomFileAttachmentProps {
  files?: any[];
  onFilesChange?: (files: any[]) => void;
  onFileClick?: (file: any) => void;
  label?: string;
  disabled?: boolean;
  allowedFileTypes?: string[];
}

const CustomFileAttachment = forwardRef<CustomFileAttachmentRef, CustomFileAttachmentProps>(
  ({ files = [], onFilesChange, onFileClick, label, disabled = false, allowedFileTypes = [] }, ref) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
    const [viewingFile, setViewingFile] = useState<{ url: string; name: string; type: string; isVideo: boolean; isPdf: boolean } | null>(null);
    const acceptFile_String = allowedFileTypes.join(',');

    useImperativeHandle(ref, () => ({
      getFilesToUpload: () => files.filter((file: any) => !file.isRemote && file instanceof File),
      getFilesToDelete: () => deletedFileIds
    }));

    const handleDragOver = (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    const processFiles = (incomingFiles: File[]) => {
      let filtered = incomingFiles;

      if (allowedFileTypes && allowedFileTypes.length > 0) {
        filtered = filtered.filter(file => {
          const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
          return allowedFileTypes.includes(file.type) || allowedFileTypes.includes(extension);
        });
      }

      const validFiles = filtered.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} exceeds the 10MB limit and was not attached.`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesChange && onFilesChange([...files, ...validFiles]);
      }
    };

    const handleDrop = (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFiles(Array.from(e.dataTransfer.files));
        e.dataTransfer.clearData();
      }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.target.files) {
        processFiles(Array.from(e.target.files));
      }
      e.target.value = '';
    };

    const removeFile = (indexToRemove: number) => {
      if (disabled) return;
      const fileToRemove = files[indexToRemove];
      if (fileToRemove && fileToRemove.isRemote && fileToRemove.id) {
        setDeletedFileIds(prev => [...prev, fileToRemove.id]);
      }

      const updatedFiles = files.filter((_: any, index: number) => index !== indexToRemove);
      onFilesChange && onFilesChange(updatedFiles);
    };

    const triggerInput = () => {
      if (disabled) return;
      fileInputRef.current?.click();
    };

    // 1. Helper to determine real MIME type from extension
    const getRealMimeType = (fileName: string = '', fallbackType: string = ''): string => {
      const ext = fileName.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'ogv': case 'ogg': return 'video/ogg';
        case 'gif': return 'image/gif';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'pdf': return 'application/pdf';
        default: return fallbackType || 'application/octet-stream';
      }
    };

    // 2. Updated file viewing handler
    const handleViewFile = (file: any) => {
      let url = file.previewUrl || file.data;
      const realMime = getRealMimeType(file.name, file.type);
      const isVid = realMime.startsWith('video/') || isVideoFile(file);
      const isPdf = file.name?.toLowerCase().endsWith('.pdf');

      // Handle local browser File instance
      if (!url && file instanceof File) {
        url = URL.createObjectURL(file);
      }
      // Handle Base64 Data URIs with corrupted/wrong headers (e.g., image/jpeg on an .mp4 file)
      else if (typeof url === 'string') {
        if (url.startsWith('data:')) {
          // Strip out whatever bad data URI header exists and rebuild it with the real MIME type
          const base64Data = url.split(',')[1];
          if (base64Data) {
            url = `data:${realMime};base64,${base64Data}`;
          }
        } else if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('blob:')) {
          // Clean raw Base64 string without header
          url = `data:${realMime};base64,${url}`;
        }
      }

      if (url) {
        setViewingFile({
          url,
          name: file.name,
          type: realMime,
          isVideo: isVid,
          isPdf
        });
      } else {
        console.warn("Could not resolve playable URL for file:", file);
      }
    };

    const [initialScale, setInitialScale] = useState(1);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!viewingFile) {
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        setInitialScale(1);
      }
    }, [viewingFile]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      const img = e.currentTarget;
      const container = imageContainerRef.current;

      if (container) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Available dimensions (leaving a light padding)
        const padding = 32;
        const availWidth = containerWidth - padding;
        const availHeight = containerHeight - padding;

        // Calculate fit-to-screen scale factor
        const scaleX = availWidth / img.naturalWidth;
        const scaleY = availHeight / img.naturalHeight;

        // Standard "contain" behavior: pick the smaller scale factor, capped at 1 (don't stretch small images)
        const fitScale = Math.min(scaleX, scaleY, 1);

        setInitialScale(fitScale);
        setZoom(fitScale); // Start at fit scale
        setPosition({ x: 0, y: 0 }); // Center image
      }
    };

    // --- File Viewer Modal State ---
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const dragStart = useRef<{ x: number; y: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (viewingFile?.isPdf || viewingFile?.isVideo) return; // Disable drag for non-image types
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !dragStart.current || viewingFile?.isPdf || viewingFile?.isVideo) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
      if (viewingFile?.isPdf || viewingFile?.isVideo) return;
      e.preventDefault();
      setZoom(prev => {
        let next = prev + (e.deltaY < 0 ? 0.1 : -0.1);
        return Math.max(0.5, Math.min(3, next));
      });
    };

    useEffect(() => {
      if (!viewingFile) {
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      }
    }, [viewingFile]);

    return (
      <>
        <div className="file-attachment-container">
          {label && <label className="input-label-navy">{label}</label>}

          <div
            className={`gradient-input-wrapper file-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
            onClick={disabled ? undefined : triggerInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={disabled ? { cursor: 'not-allowed', opacity: 0.6, pointerEvents: 'auto' } : {}}
          >
            <div className="input-inner-container zone-content">
              <UploadCloud size={24} className="navy-icon-dim" />
              <div className="zone-text">
                <span className="main-text">
                  {disabled ? "File upload disabled" : (isDragging ? "Drop to Upload" : "Click or Drag to Attach Files")}
                </span>
                <span className="sub-text">PDF, PNG, JPG, GIF, MP4, WebM (Max 10MB)</span>
              </div>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={acceptFile_String || ".pdf,.png,.jpg,.jpeg,.gif,.mp4,.webm,.doc,.docx,.xls,.xlsx,.txt,.csv"}
                style={{ display: 'none' }}
                disabled={disabled}
              />
            </div>
          </div>

          {files.length > 0 && (
            <div className="attachment-list shadow-gentle">
              {files.map((file: any, index: number) => (
                <FileItem
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => removeFile(index)}
                  onClick={() => {
                    if (onFileClick) onFileClick(file);
                    handleViewFile(file);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {viewingFile && createPortal(
          <div className="modal-overlay-global" onClick={() => setViewingFile(null)}>
            <div className="modal-content-global shadow-gentle animate-pop-in" onClick={e => e.stopPropagation()}>

              <div className="modal-header-global">
                <div className="header-left">
                  <span className="text-bold">{viewingFile.name}</span>
                </div>

                {/* TOOLBAR FOR IMAGES & GIFS ONLY */}
                {!viewingFile.isPdf && !viewingFile.isVideo && (
                  <div className="modal-toolbar">
                    <button className="tool-btn" title="Zoom Out" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))}>-</button>
                    <span className="tool-label">{Math.round(zoom * 100)}%</span>
                    <button className="tool-btn" title="Zoom In" onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}>+</button>
                    <div className="tool-divider">|</div>
                    <button className="tool-btn" title="Rotate Right" onClick={() => setRotation(prev => prev + 90)}>↻</button>
                    <button className="tool-btn" title="Rotate Left" onClick={() => setRotation(prev => prev - 90)}>↺</button>
                    <button
                      className="tool-btn"
                      onClick={() => {
                        setZoom(initialScale);
                        setRotation(0);
                        setPosition({ x: 0, y: 0 });
                      }}
                    >
                      Reset
                    </button>
                  </div>
                )}

                <button className="modal-close-x" onClick={() => setViewingFile(null)}>✕</button>
              </div>

              <div
                ref={imageContainerRef}
                className="modal-body-global"
                style={{
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: (!viewingFile.isPdf && !viewingFile.isVideo) ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#1a1a1a'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                {viewingFile.isPdf ? (
                  <iframe
                    src={viewingFile.url}
                    width="100%"
                    height="100%"
                    title="PDF Preview"
                    style={{ border: 'none' }}
                  />
                ) : viewingFile.isVideo ? (
                  <video
                    src={viewingFile.url}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      maxWidth: '98%',
                      maxHeight: '98%',
                      outline: 'none',
                      borderRadius: '8px'
                    }}
                  />
                ) : (
                  <img
                    src={viewingFile.url}
                    alt="Preview"
                    draggable={false}
                    onLoad={handleImageLoad}
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                      maxWidth: '98%',
                      maxHeight: '98%',
                      userSelect: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                    }}
                  />
                )}
              </div>

            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
);

export default CustomFileAttachment;