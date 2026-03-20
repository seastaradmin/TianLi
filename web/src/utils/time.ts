// utils/time.ts

/**
 * 格式化当前时间为 HH:MM:SS 格式
 */
export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * 格式化时间为相对时间（如 "刚刚", "5 分钟前"）
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return date.toLocaleDateString('zh-CN')
}

/**
 * 解析时间字符串为 Date 对象
 */
export function parseTime(timeStr: string): Date {
  return new Date(timeStr)
}
