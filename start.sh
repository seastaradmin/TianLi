#!/bin/bash
# 天理 Harness 一键启动脚本 - 清理端口 + 启动前后端

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 端口配置
BACKEND_PORT=8000
FRONTEND_PORT=1421

echo ""
echo "======================================"
echo "  天理 Harness 一键启动"
echo "======================================"
echo ""

# 清理端口函数
kill_port() {
    local port=$1
    local name=$2
    
    # 查找占用端口的进程
    local pid=$(lsof -ti:$port 2>/dev/null || true)
    
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}🔧 清理端口 $port ($name) - PID: $pid${NC}"
        kill -9 $pid 2>/dev/null || true
        sleep 0.5
        echo -e "${GREEN}✅ 端口 $port 已释放${NC}"
    else
        echo -e "${GREEN}✅ 端口 $port 空闲${NC}"
    fi
}

# 清理端口
echo -e "${BLUE}📡 检查端口占用...${NC}"
kill_port $BACKEND_PORT "后端 API"
kill_port $FRONTEND_PORT "前端 Dev"
echo ""

# 检查 Python
echo -e "${BLUE}🐍 检查 Python 环境...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ 错误：未找到 Python3${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python3: $(python3 --version)${NC}"

# 检查 uvicorn
if ! python3 -m uvicorn --version &> /dev/null; then
    echo -e "${YELLOW}⚠️  安装 uvicorn...${NC}"
    pip3 install uvicorn fastapi pymysql --break-system-packages -q
fi
echo -e "${GREEN}✅ Uvicorn: $(python3 -m uvicorn --version)${NC}"

# 检查 Node.js
echo ""
echo -e "${BLUE}📦 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 错误：未找到 Node.js${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node --version)${NC}"
echo -e "${GREEN}✅ npm: $(npm --version)${NC}"

# 检查前端依赖
if [ ! -d "web/node_modules" ]; then
    echo ""
    echo -e "${YELLOW}📦 安装前端依赖...${NC}"
    cd web && npm install && cd ..
    echo -e "${GREEN}✅ 前端依赖安装完成${NC}"
fi

# 检查数据库
echo ""
echo -e "${BLUE}📊 检查数据库连接...${NC}"
python3 -c "
from tianli_harness.core.db_connector import get_feedback_database
db = get_feedback_database()
weights = db.get_hero_weights()
print(f'✅ 数据库：tianli_feedback')
print(f'✅ 权重配置：{len(weights)} 个')
" 2>/dev/null || echo -e "${YELLOW}⚠️  数据库可能未初始化${NC}"

# 启动后端（后台运行）
echo ""
echo "======================================"
echo -e "${BLUE}  启动服务${NC}"
echo "======================================"
echo ""

echo -e "${GREEN}🚀 启动后端服务 (端口 $BACKEND_PORT)...${NC}"
python3 -m uvicorn backend_server:app --reload --host 0.0.0.0 --port $BACKEND_PORT &
BACKEND_PID=$!
echo -e "${GREEN}✅ 后端 PID: $BACKEND_PID${NC}"

# 等待后端启动
sleep 2

# 启动前端（后台运行）
echo ""
echo -e "${GREEN}🚀 启动前端服务 (端口 $FRONTEND_PORT)...${NC}"
cd web && npm run dev &
FRONTEND_PID=$!
cd ..
echo -e "${GREEN}✅ 前端 PID: $FRONTEND_PID${NC}"

echo ""
echo "======================================"
echo -e "${GREEN}  服务已启动${NC}"
echo "======================================"
echo ""
echo -e "📡 后端 API：${BLUE}http://localhost:$BACKEND_PORT${NC}"
echo -e "📚 API 文档：${BLUE}http://localhost:$BACKEND_PORT/docs${NC}"
echo -e "🌐 前端界面：${BLUE}http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

# 捕获退出信号，清理进程
trap "echo ''; echo '🛑 停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; echo '✅ 服务已停止'; exit 0" SIGINT SIGTERM

# 等待任意子进程退出
wait
