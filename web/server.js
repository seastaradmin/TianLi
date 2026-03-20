// server.js - 简单的 SSE 测试服务器
// 用于开发时测试实时日志推送功能
// 运行：node server.js

const http = require('http')

const PORT = 3456

// 模拟日志生成器
function generateMockLog(id) {
  const modules = [
    'FETCH_DNA', 'AGENT_REASON', 'TIANJIE-L1', 'TIANJIE-L2',
    'EXECUTE', 'OPENCLAW', 'HARNESS', 'VALIDATOR'
  ]
  const levels = ['INFO', 'INFO', 'INFO', 'DEBUG', 'WARN']
  const messages = [
    '🧬 Fetch DNA - 获取 Hero Prompt',
    '✅ 获取成功 (42 字符)',
    '🧠 Agent Reasoning - 第 1 轮推理',
    '检查：Write',
    '✅ 通过',
    '⊘ 跳过采样',
    '⚡ 执行工具：Write',
    '✍️ 已写入：novel/chapter_1.md',
    '🔍 天劫审查中...',
    '⚠️ 检测到敏感词，触发天劫',
    '🛑 早期退出 (Early Exit)',
    '📊 完成第 1 轮迭代',
  ]

  return {
    id: id || Date.now(),
    time: new Date().toLocaleTimeString('zh-CN'),
    level: levels[Math.floor(Math.random() * levels.length)],
    module: modules[Math.floor(Math.random() * modules.length)],
    msg: messages[Math.floor(Math.random() * messages.length)]
  }
}

const clients = new Set()

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/api/logs' || req.url === '/api/events') {
    console.log(`[${new Date().toLocaleTimeString()}] Client connected`)
    clients.add(res)

    // 发送初始连接消息
    res.write(`event: status\ndata: ${JSON.stringify('connected')}\n\n`)

    // 定期发送模拟日志
    let logId = 1
    const interval = setInterval(() => {
      if (!clients.has(res)) {
        clearInterval(interval)
        return
      }

      const log = generateMockLog(logId++)
      res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`)

      // 随机发送统计更新
      if (Math.random() > 0.7) {
        const stats = {
          status: 'running',
          totalSteps: Math.floor(logId / 3),
          earlyExits: Math.floor(logId / 10),
          l1Passes: Math.floor(logId / 2),
          l2Checks: Math.floor(logId / 5)
        }
        res.write(`event: stats\ndata: ${JSON.stringify(stats)}\n\n`)
      }
    }, 1000)

    req.on('close', () => {
      console.log(`[${new Date().toLocaleTimeString()}] Client disconnected`)
      clients.delete(res)
      clearInterval(interval)
    })

    req.on('error', () => {
      clients.delete(res)
      clearInterval(interval)
    })
  } else if (req.url === '/api/start') {
    // 广播开始消息
    broadcast({ type: 'status', data: 'running' })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  } else if (req.url === '/api/stop') {
    // 广播停止消息
    broadcast({ type: 'status', data: 'idle' })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true }))
  } else if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'running',
      clients: clients.size
    }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

function broadcast(message) {
  const data = `event: ${message.type}\ndata: ${JSON.stringify(message.data)}\n\n`
  clients.forEach(client => {
    client.write(data)
  })
}

server.listen(PORT, () => {
  console.log(`🚀 SSE Server running at http://localhost:${PORT}`)
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/logs`)
  console.log(`🎮 Control: http://localhost:${PORT}/api/start, /api/stop`)
  console.log(`ℹ️  Status: http://localhost:${PORT}/api/status`)
})
