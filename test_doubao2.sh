#!/bin/bash

echo "=================================="
echo "测试 Doubao 大模型 API"
echo "=================================="

API_KEY="660d27e6-e65f-4a33-8fea-87101d33c210"
BASE_URL="https://ark.cn-beijing.volces.com/api/v1"

echo ""
echo "尝试：使用豆包大模型 (doubao-lite)..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-lite",
    "messages": [
      {"role": "user", "content": "你好，请做个自我介绍"}
    ],
    "max_tokens": 200
  }' | python3 -m json.tool 2>&1

echo ""
echo "尝试：使用豆包-Pro 模型..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-pro",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 100
  }' | python3 -m json.tool 2>&1
