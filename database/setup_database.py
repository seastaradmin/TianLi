#!/usr/bin/env python3
"""
天理反馈数据库初始化脚本

用法:
    python3 setup_database.py

配置:
    - User: root
    - Password: (empty)
    - Host: localhost
    - Port: 3306
"""

import pymysql
from pathlib import Path
import sys


def read_sql_file(file_path):
    """读取 SQL 文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()


def execute_sql_script(cursor, sql_script):
    """执行 SQL 脚本（支持多条语句）"""
    statements = []
    current_statement = []
    
    for line in sql_script.split('\n'):
        if line.strip().startswith('--'):
            continue
        
        current_statement.append(line)
        
        if line.strip().endswith(';'):
            statements.append('\n'.join(current_statement))
            current_statement = []
    
    results = []
    for statement in statements:
        if statement.strip():
            try:
                cursor.execute(statement)
                results.append({
                    'status': 'success',
                    'statement': statement[:100] + '...' if len(statement) > 100 else statement
                })
            except Exception as e:
                results.append({
                    'status': 'error',
                    'statement': statement[:100] + '...',
                    'error': str(e)
                })
    
    return results


def main():
    """主函数"""
    print("="*70)
    print("天理反馈数据库初始化")
    print("="*70)
    
    config = {
        'user': 'root',
        'password': '',
        'host': 'localhost',
        'port': 3306,
        'charset': 'utf8mb4',
    }
    
    sql_file = Path(__file__).parent / 'feedback_schema.sql'
    
    if not sql_file.exists():
        print(f"❌ SQL 文件不存在：{sql_file}")
        sys.exit(1)
    
    print(f"\n📄 SQL 文件：{sql_file}")
    print(f"📊 数据库配置：{config['user']}@{config['host']}:{config['port']}")
    
    connection = None
    
    try:
        print("\n🔌 连接 MySQL...")
        connection = pymysql.connect(
            user=config['user'],
            password=config['password'],
            host=config['host'],
            port=config['port'],
            charset=config['charset']
        )
        cursor = connection.cursor()
        print("✅ 连接成功")
        
        print("\n📖 读取 SQL 文件...")
        sql_script = read_sql_file(sql_file)
        print(f"✅ 读取成功 ({len(sql_script)} 字节)")
        
        print("\n⚙️  执行 SQL 脚本...")
        results = execute_sql_script(cursor, sql_script)
        
        success_count = sum(1 for r in results if r['status'] == 'success')
        error_count = sum(1 for r in results if r['status'] == 'error')
        
        print(f"\n✅ 成功：{success_count} 条语句")
        if error_count > 0:
            print(f"❌ 失败：{error_count} 条语句")
        
        connection.commit()
        print("\n💾 事务已提交")
        
        print("\n🔍 验证数据库...")
        cursor.execute("SHOW DATABASES LIKE 'tianli_feedback'")
        if cursor.fetchone():
            print("✅ 数据库 tianli_feedback 创建成功")
        
        cursor.execute("USE tianli_feedback")
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print(f"✅ 创建 {len(tables)} 个表:")
        for table in tables:
            print(f"   - {table[0]}")
        
        print("\n" + "="*70)
        print("🎉 数据库初始化完成！")
        print("="*70)
        
    except Exception as e:
        print(f"\n❌ 数据库错误：{e}")
        sys.exit(1)
    
    finally:
        if connection:
            connection.close()
            print("\n🔌 连接已关闭")


if __name__ == "__main__":
    main()
