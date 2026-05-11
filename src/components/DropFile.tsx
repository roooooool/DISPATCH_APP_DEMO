import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Paperclip, X, FileText, UploadCloud } from 'lucide-react';
import './comp_css/DropFile.css';





const FileItem = ({ file, onRemove, onClick }: { file: any; onRemove: () => void; onClick: () => void }) => {
  const [preview, setPreview] = React.useState<string | null>(null);

  useEffect(() => {
    if (file instanceof File && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } 
    else if (file.isRemote && file.previewUrl) {
      setPreview(file.previewUrl);
    }
  }, [file, file.previewUrl]);

  // Determine if we are currently waiting for a remote image preview
  const isImage = !file.name?.toLowerCase().endsWith('.pdf');
  const isLoadingRemote = file.isRemote && isImage && !preview;



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
          ) : preview ? (
            <img src={preview} alt="preview" className="file-img-preview" />
          ) : (
            // Robust file-type icons
            file.name?.toLowerCase().endsWith('.pdf') ? (
              <FileText size={18} className="doc-red" />
            ) : file.name?.toLowerCase().endsWith('.png') || 
              file.name?.toLowerCase().endsWith('.jpg') || 
              file.name?.toLowerCase().endsWith('.jpeg') ? (
              <Paperclip size={18} className="doc-navy" />
            ) : (
              // Fallback for general documents / files
              <FileText size={18} className="doc-navy" />
            )
          )}
        </div>
        <div className="file-details">
          <span className="file-name">{file.name}</span>
          <span className="file-size">
            {file.isRemote ? `ID: ${file.id}` : `${(file.size / 1024).toFixed(1)} KB`} {!file.isRemote ? '(unsaved)':''}
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
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string, type: string; } | null>(null);
  const acceptFile_String = allowedFileTypes.join(',');

  useImperativeHandle(ref, () => ({
    getFilesToUpload: () => {
      // Return only files that are new (not remote)
      return files.filter((file: any) => !file.isRemote && file instanceof File);
    },
    getFilesToDelete: () => {
      return deletedFileIds;
    }
  }));


  // 1. Prevent browser from opening the file
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

  // 2. Capture the dropped files
  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      let droppedFiles = Array.from(e.dataTransfer.files);

      // 1. Filter by allowed types (if configured)
      if (allowedFileTypes && allowedFileTypes.length > 0) {
        droppedFiles = droppedFiles.filter(file => {
          const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
          const isAllowedType = allowedFileTypes.includes(file.type) || 
                                allowedFileTypes.includes(extension);
          return isAllowedType;
        });
      }

      // 2. Filter by max file size (10MB)
      const validFiles = droppedFiles.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} exceeds the 10MB limit and was not attached.`);
          return false;
        }
        return true;
      });

      // 3. Update parent state
      if (validFiles.length > 0) {
        onFilesChange && onFilesChange([...files, ...validFiles]);
      }

      e.dataTransfer.clearData();
    }
  };

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files) {
      let newFiles = Array.from(e.target.files);

      if (allowedFileTypes.length > 0) {
        newFiles = newFiles.filter(file => {
          const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
          
          // Check if file type or extension is included in the allowed types
          const isAllowedType = allowedFileTypes.includes(file.type) || 
                                allowedFileTypes.includes(extension);

          return isAllowedType;
        });
      }

      const validFiles = newFiles.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} exceeds the 10MB limit and was not attached.`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesChange && onFilesChange([...files, ...validFiles]);
      }
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



  const handleViewFile = (file: any) => {
    console.log("Attempting to view file:", file);
    if (file.previewUrl) {
      setViewingFile({ 
        url: file.previewUrl, 
        name: file.name, 
        type: file.type 
      });
    } else if (!file.isRemote && file instanceof File) {
      const url = URL.createObjectURL(file);
      setViewingFile({ url, name: file.name, type: file.type });
    }
  };


  // --- File Viewer Modal State ---
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  // Mouse event handlers for drag
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStart.current = {
          x: e.clientX - position.x,
          y: e.clientY - position.y,
      };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !dragStart.current) return;
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
      e.preventDefault();
      setZoom(prev => {
          let next = prev + (e.deltaY < 0 ? 0.1 : -0.1);
          return Math.max(0.5, Math.min(3, next));
      });
  };

  // Reset modal state when closing
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
          /* 3. Attach the Listeners */
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
              <span className="sub-text">PDF, PNG, JPG (Max 10MB)</span>
            </div>
            <input
              type="file"
              multiple
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={acceptFile_String || ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt,.csv"} // <-- Add acceptable formats
              style={{ display: 'none' }}
              disabled={disabled}
            />
          </div>
        </div>

        {/* Attachment List remains the same */}
        {files.length > 0 && (
          <div className="attachment-list shadow-gentle">
              {files.map((file: any, index: number) => (
              <FileItem 
                  key={`${file.name}-${index}`} 
                  file={file} 
                  onRemove={() => removeFile(index)} 
                  onClick={() => {if (onFileClick) onFileClick(file); console.log('file clicked');  handleViewFile(file);} }
              />
              ))}
          </div>
        )}
      </div>

      {/* RENDER MODAL OUTSIDE THE CONTAINER USING PORTAL */}
      {viewingFile && createPortal(
        <div className="modal-overlay-global" onClick={() => setViewingFile(null)}>
          <div className="modal-content-global shadow-gentle animate-pop-in" onClick={e => e.stopPropagation()}>
            
            <div className="modal-header-global">
              <div className="header-left">
                <span className="text-bold">{viewingFile.name}</span>
              </div>

              {/* TOOLBAR FOR IMAGES */}
              {!viewingFile.url.toLowerCase().endsWith('.pdf') && (
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
                      setZoom(1); 
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
              className="modal-body-global" 
              style={{ 
                overflow: 'hidden', 
                position: 'relative',
                cursor: isDragging ? 'grabbing' : 'grab',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#1a1a1a' // Darker background helps focus on the image
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel} // Added mousewheel support
            >
              {viewingFile.url.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={viewingFile.url} 
                  width="100%" 
                  height="100%"  /* Changed from 80vh to 100% to fill the new container */
                  title="PDF Preview" 
                  style={{ border: 'none' }}
                />
              ) : (
                <img 
                  src={viewingFile.url} 
                  alt="Preview" 
                  draggable={false}
                  style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out', // Faster transition for scroll feel
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
});

export default CustomFileAttachment;