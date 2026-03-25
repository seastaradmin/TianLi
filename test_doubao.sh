#!/bin/bash

echo "=================================="
echo "测试 Doubao-Seed-2.0-Code 模型"
echo "=================================="

API_KEY="660d27e6-e65f-4a33-8fea-87101d33c210"
BASE_URL="https://ark.cn-beijing.volces.com/api/v1"

echo ""
echo "尝试 1: 使用 doubao-seed-2.0-code 模型..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-seed-2.0-code",
    "messages": [
      {"role": "user", "content": "Hello, are you available?"}
    ],
    "max_tokens": 100
  }' | python3 -m json.tool 2>&1 | head -50

echo ""
echo "尝试 2: 使用 seed-code-1.5 模型..."
curl -s -X POST "$BASE_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seed-code-1.5",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 100
  }' | python3 -m json.tool 2>&1 | head -50

echo ""
echo "尝试 3: 列出可用模型..."
curl -s -X GET "$BASE_URL/models" \
  -H "Authorization: Bearer $API_KEY" | python3 -m json.tool 2>&1 | head -100
