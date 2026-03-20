// src/test/setup.ts - 测试环境配置
import '@testing-library/jest-dom'

// 模拟 EventSource（SSE）
class MockEventSource {
  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState: number = 1 // OPEN

  constructor(url: string) {
    this.url = url
    // 模拟连接成功
    setTimeout(() => this.onopen?.(), 0)
  }

  addEventListener(event: string, handler: (event: any) => void) {
    // 简化处理
  }

  close() {
    this.readyState = 2 // CLOSED
  }

  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2
}

// @ts-ignore
global.EventSource = MockEventSource

// 模拟 WebSocket
class MockWebSocket {
  url: string
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: (() => void) | null = null
  readyState: number = 1 // OPEN

  constructor(url: string) {
    this.url = url
    setTimeout(() => this.onopen?.(), 0)
  }

  send(data: string) {
    // 模拟发送
  }

  close() {
    this.readyState = 2 // CLOSED
    this.onclose?.()
  }

  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
}

// @ts-ignore
global.WebSocket = MockWebSocket
