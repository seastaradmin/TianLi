#!/bin/bash
# 天理后端服务启动脚本

echo "======================================"
echo "天理 Harness 后端服务"
echo "======================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误：未找到 Python3"
    exit 1
fi

echo "✅ Python3: $(python3 --version)"

# 检查 uvicorn
if ! python3 -m uvicorn --version &> /dev/null; then
    echo "⚠️  安装 uvicorn..."
    pip3 install uvicorn fastapi pymysql --break-system-packages -q
fi

echo "✅ Uvicorn: $(python3 -m uvicorn --version)"

# 检查数据库
echo ""
echo "📊 检查数据库连接..."
python3 -c "
from tianli_harness.core.db_connector import get_feedback_database
db = get_feedback_database()
weights = db.get_hero_weights()
print(f'✅ 数据库：tianli_feedback')
print(f'✅ 权重配置：{len(weights)} 个')
" 2>/dev/null || echo "⚠️  数据库可能未初始化，运行：python3 database/setup_database.py"

# 启动服务
echo ""
echo "======================================"
echo "启动后端服务..."
echo "======================================"
echo ""
echo "📡 API 地址：http://localhost:8000"
echo "📚 API 文档：http://localhost:8000/docs"
echo "💚 健康检查：http://localhost:8000/api/health"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

python3 -m uvicorn backend_server:app --reload --host 0.0.0.0 --port 8000
