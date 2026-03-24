#!/bin/bash

echo "=================================="
echo "测试新的 API 配置"
echo "=================================="
echo "API Key: 13074963-a8bb-4f23-a325-d314e327d552"
echo "URL: https://ark.cn-beijing.volces.com/api/coding/v3"
echo "=================================="

API_KEY="13074963-a8bb-4f23-a325-d314e327d552"
BASE_URL="https://ark.cn-beijing.volces.com/api/coding/v3"

echo ""
echo "尝试 1: 测试连接..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seed-2.0-code",
    "messages": [
      {"role": "user", "content": "你好，请做个自我介绍"}
    ],
    "max_tokens": 200
  }' | python3 -m json.tool 2>&1 | head -50

echo ""
echo "尝试 2: 生成落地页代码..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seed-2.0-code",
    "messages": [
      {"role": "system", "content": "You are a UI/UX Design Expert. Generate React + Tailwind landing page code."},
      {"role": "user", "content": "做个网站落地页，包含 Hero 区域、特性展示、价格方案。使用 React + Tailwind CSS。输出完整代码。"}
    ],
    "max_tokens": 8192
  }' > /tmp/landing_page_response.json 2>&1

# 检查响应
if [ -s /tmp/landing_page_response.json ]; then
    echo "✅ 收到响应！"
    echo ""
    echo "响应内容:"
    cat /tmp/landing_page_response.json | python3 -m json.tool 2>&1 | head -100
    
    # 提取代码
    echo ""
    echo "提取的代码:"
    cat /tmp/landing_page_response.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'][:2000])" 2>&1
else
    echo "❌ 没有收到响应"
fi
