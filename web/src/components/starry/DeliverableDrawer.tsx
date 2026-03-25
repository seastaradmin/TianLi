/**
 * 产物展示抽屉
 * 任务完成后从右侧滑出，显示产物和提供者信息
 */

import { AnimatePresence, motion } from 'framer-motion'
import { Download, File, FileText, Image, Play, X } from 'lucide-react'
import { memo } from 'react'

export interface DeliverableItem {
  id: string
  fileName: string
  fileType: string
  sizeBytes: number
  providerHeroId: string
  providerHeroName: string
  downloadUrl?: string
  previewUrl?: string
  createdAt: string
}

interface DeliverableDrawerProps {
  open: boolean
  onClose: () => void
  deliverables: DeliverableItem[]
  taskId?: string
  taskTitle?: string
}

/**
 * 根据文件类型返回图标
 */
function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase()
  if (['md', 'txt', 'doc', 'docx', 'pdf'].includes(type)) {
    return FileText
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(type)) {
    return Image
  }
  if (['mp4', 'mov', 'avi'].includes(type)) {
    return Play
  }
  return File
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export const DeliverableDrawer = memo(function DeliverableDrawer({
  open,
  onClose,
  deliverables,
  taskId,
  taskTitle,
}: DeliverableDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
          />
          
          {/* 抽屉面板 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '400px',
              maxWidth: '100vw',
              backgroundColor: '#1a1a2e',
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 头部 */}
            <div
              style={{
                padding: '20px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#ffffff',
                    marginBottom: '4px',
                  }}
                >
                  ✅ 任务完成
                </div>
                {taskTitle && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#888888',
                    }}
                  >
                    {taskTitle}
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888888',
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* 产物列表 */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
              }}
            >
              {deliverables.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    color: '#666666',
                    padding: '40px 20px',
                  }}
                >
                  暂无产物
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {deliverables.map((item) => {
                    const Icon = getFileIcon(item.fileType)
                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        {/* 文件信息 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            marginBottom: '12px',
                          }}
                        >
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon size={20} color="#ffffff" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#ffffff',
                                marginBottom: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.fileName}
                            </div>
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#888888',
                              }}
                            >
                              {item.fileType.toUpperCase()} · {formatFileSize(item.sizeBytes)}
                            </div>
                          </div>
                        </div>
                        
                        {/* 提供者信息 */}
                        <div
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            padding: '12px',
                            marginBottom: '12px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#666666',
                              marginBottom: '4px',
                            }}
                          >
                            提供者
                          </div>
                          <div
                            style={{
                              fontSize: '13px',
                              color: '#ffffff',
                              fontWeight: '500',
                            }}
                          >
                            🌟 {item.providerHeroName}
                          </div>
                        </div>
                        
                        {/* 操作按钮 */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          {item.downloadUrl && (
                            <a
                              href={item.downloadUrl}
                              download={item.fileName}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px 16px',
                                backgroundColor: '#4a90d9',
                                color: '#ffffff',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: '500',
                              }}
                            >
                              <Download size={16} />
                              下载
                            </a>
                          )}
                          {item.previewUrl && (
                            <a
                              href={item.previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px 16px',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: '500',
                              }}
                            >
                              <File size={16} />
                              预览
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* 反馈区域（可选） */}
            <div
              style={{
                padding: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  color: '#888888',
                  marginBottom: '8px',
                }}
              >
                对本次服务满意吗？
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                }}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    style={{
                      flex: 1,
                      padding: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '16px',
                      cursor: 'pointer',
                    }}
                  >
                    {'⭐'.repeat(rating)}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
})
