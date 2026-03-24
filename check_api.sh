#!/bin/bash

echo "=================================="
echo "测试 Volcengine Ark API 连接"
echo "=================================="

API_KEY="660d27e6-e65f-4a33-8fea-87101d33c210"
API_URL="https://ark.cn-beijing.volces.com/api/coding"

echo ""
echo "尝试 1: 基础连接测试..."
curl -v -X POST "$API_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-coding-pro",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 50
  }' 2>&1 | grep -E "(HTTP|error|Error|choices|message)" | head -20

echo ""
echo "尝试 2: 检查 API 文档格式..."
echo "Volcengine Ark API 格式可能不同，请检查文档："
echo "https://www.volcengine.com/docs/82379"

echo ""
echo "尝试 3: 测试其他可能的端点..."
curl -s -X POST "$API_URL/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"doubao-coding-pro","messages":[{"role":"user","content":"Hello"}],"max_tokens":50}' 2>&1 | head -50
