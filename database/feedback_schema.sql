-- ============================================
-- 天理 Harness 反馈数据库
-- 用于收集分发和执行的反馈数据
-- ============================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS tianli_feedback 
DEFAULT CHARACTER SET utf8mb4 
DEFAULT COLLATE utf8mb4_unicode_ci;

USE tianli_feedback;

-- ============================================
-- 1. 分发决策记录表
-- 记录每次任务分发的决策
-- ============================================
CREATE TABLE IF NOT EXISTS dispatch_decisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100),
    user_input TEXT NOT NULL,
    task_tags JSON,
    
    -- 分发的 Hero
    selected_hero_ids JSON NOT NULL,
    primary_hero_id VARCHAR(100) NOT NULL,
    consult_hero_ids JSON,
    
    -- 分数和原因
    candidate_scores JSON,
    dispatch_reason TEXT,
    
    -- 分发策略
    dispatch_mode VARCHAR(50) DEFAULT 'hybrid',
    collaboration_mode VARCHAR(50) DEFAULT 'primary_consult',
    fallback_used BOOLEAN DEFAULT FALSE,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_task_id (task_id),
    INDEX idx_session_id (session_id),
    INDEX idx_hero_id (primary_hero_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. 任务执行结果表
-- 记录任务执行的结果
-- ============================================
CREATE TABLE IF NOT EXISTS task_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    dispatch_id BIGINT,
    
    -- 执行状态
    status VARCHAR(50) NOT NULL,  -- completed, early_exit, failed
    current_status VARCHAR(50),
    
    -- 执行指标
    execution_time_ms INT,
    total_tokens INT,
    
    -- 审计结果
    l1_passed BOOLEAN,
    l2_passed BOOLEAN,
    l2_score DECIMAL(3,2),
    
    -- 审计违规
    violations JSON,
    
    -- 进化补丁
    evolution_patch TEXT,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (dispatch_id) REFERENCES dispatch_decisions(id),
    INDEX idx_task_id (task_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. 用户反馈表
-- 收集用户对任务的评分和反馈
-- ============================================
CREATE TABLE IF NOT EXISTS user_feedback (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    dispatch_id BIGINT,
    
    -- 用户评分
    rating TINYINT,  -- 1-5 星
    success BOOLEAN,  -- 是否成功
    
    -- 反馈内容
    feedback_text TEXT,
    feedback_type VARCHAR(50),  -- positive, negative, suggestion
    
    -- 标签
    tags JSON,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (dispatch_id) REFERENCES dispatch_decisions(id),
    INDEX idx_task_id (task_id),
    INDEX idx_rating (rating),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. Hero 性能统计表
-- 统计每个 Hero 的表现
-- ============================================
CREATE TABLE IF NOT EXISTS hero_performance (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    hero_id VARCHAR(100) NOT NULL,
    
    -- 统计周期
    stat_date DATE NOT NULL,
    
    -- 执行次数
    total_tasks INT DEFAULT 0,
    successful_tasks INT DEFAULT 0,
    failed_tasks INT DEFAULT 0,
    
    -- 平均指标
    avg_execution_time_ms DECIMAL(10,2),
    avg_l1_pass_rate DECIMAL(5,4),
    avg_l2_pass_rate DECIMAL(5,4),
    avg_l2_score DECIMAL(3,2),
    
    -- 用户评分
    avg_user_rating DECIMAL(3,2),
    total_feedbacks INT DEFAULT 0,
    
    -- 权重调整
    current_weight DECIMAL(5,4) DEFAULT 1.0,
    weight_adjustment DECIMAL(5,4) DEFAULT 0.0,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_hero_date (hero_id, stat_date),
    INDEX idx_hero_id (hero_id),
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. 匹配权重配置表
-- 存储动态学习的权重
-- ============================================
CREATE TABLE IF NOT EXISTS matching_weights (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    weight_name VARCHAR(100) NOT NULL UNIQUE,
    
    -- 权重值
    weight_value DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    
    -- 元数据
    description TEXT,
    min_value DECIMAL(5,4) DEFAULT 0.0,
    max_value DECIMAL(5,4) DEFAULT 10.0,
    
    -- 学习信息
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    update_count INT DEFAULT 0,
    
    INDEX idx_weight_name (weight_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. A/B 测试记录表
-- 记录不同分发策略的效果
-- ============================================
CREATE TABLE IF NOT EXISTS ab_test_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    test_name VARCHAR(100) NOT NULL,
    
    -- 策略信息
    strategy_name VARCHAR(100) NOT NULL,
    strategy_config JSON,
    
    -- 流量分配
    traffic_split DECIMAL(5,4) DEFAULT 0.0,
    
    -- 结果指标
    total_tasks INT DEFAULT 0,
    success_rate DECIMAL(5,4),
    avg_user_rating DECIMAL(3,2),
    avg_execution_time_ms DECIMAL(10,2),
    
    -- 统计周期
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- 状态
    status VARCHAR(50) DEFAULT 'running',  -- running, completed, paused
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_test_name (test_name),
    INDEX idx_strategy_name (strategy_name),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. 同义词映射表
-- 用于增强语义匹配
-- ============================================
CREATE TABLE IF NOT EXISTS synonym_mappings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    
    -- 同义词列表
    synonyms JSON NOT NULL,
    
    -- 类别
    category VARCHAR(50),  -- tool, capability, task_type
    
    -- 使用统计
    usage_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    
    -- 时间戳
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_keyword (keyword),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. 对话历史消息表
-- 持久化任务级关键消息，支持跨重启查看
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(100) NOT NULL,
    `round` INT DEFAULT 0,
    role VARCHAR(20) NOT NULL,  -- user, assistant
    content LONGTEXT NOT NULL,
    hero_id VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_task_created_at (task_id, created_at),
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 初始化数据
-- ============================================

-- 插入默认权重配置
INSERT INTO matching_weights (weight_name, weight_value, description, min_value, max_value) VALUES
('tag_match', 1.25, 'Tags 匹配权重', 0.0, 10.0),
('capability_match', 1.50, 'Capabilities 匹配权重', 0.0, 10.0),
('tool_match', 1.00, 'Tools 匹配权重', 0.0, 10.0),
('routing_priority', 1.00, 'Routing Priority 基础分', 0.0, 10.0),
('default_hero_bonus', 0.25, '默认 Hero 加分', 0.0, 10.0);

-- 插入默认同义词
INSERT INTO synonym_mappings (keyword, synonyms, category) VALUES
('ppt', '["presentation", "幻灯片", "演示文稿", "deck"]', 'task_type'),
('bug', '["问题", "错误", "缺陷", "issue", "error"]', 'task_type'),
('feature', '["功能", "特性", "需求", "functionality"]', 'task_type'),
('fix', '["修复", "解决", "repair", "debug"]', 'tool'),
('create', '["创建", "生成", "build", "generate", "写"]', 'tool'),
('design', '["设计", "ui", "ux", "界面", "visual"]', 'capability'),
('test', '["测试", "testing", "qa", "quality"]', 'capability');

-- ============================================
-- 视图：Hero 综合表现
-- ============================================
CREATE OR REPLACE VIEW hero_performance_summary AS
SELECT 
    hp.hero_id,
    hp.stat_date,
    hp.total_tasks,
    hp.successful_tasks,
    hp.failed_tasks,
    ROUND(hp.successful_tasks * 100.0 / NULLIF(hp.total_tasks, 0), 2) AS success_rate,
    hp.avg_execution_time_ms,
    hp.avg_l1_pass_rate,
    hp.avg_l2_pass_rate,
    hp.avg_user_rating,
    hp.current_weight,
    hp.weight_adjustment
FROM hero_performance hp
ORDER BY hp.stat_date DESC, hp.total_tasks DESC;

-- ============================================
-- 存储过程：更新 Hero 权重
-- ============================================
DELIMITER //

CREATE PROCEDURE update_hero_weight(
    IN p_hero_id VARCHAR(100),
    IN p_success_rate DECIMAL(5,4),
    IN p_avg_rating DECIMAL(3,2)
)
BEGIN
    DECLARE current_weight DECIMAL(5,4);
    DECLARE new_weight DECIMAL(5,4);
    DECLARE adjustment DECIMAL(5,4);
    
    -- 获取当前权重
    SELECT current_weight INTO current_weight
    FROM hero_performance
    WHERE hero_id = p_hero_id
    ORDER BY stat_date DESC
    LIMIT 1;
    
    -- 计算新权重
    -- 成功率 > 80% 且评分 > 4.0，增加权重
    IF p_success_rate > 0.8 AND p_avg_rating > 4.0 THEN
        adjustment := 0.05;
    -- 成功率 < 50% 或评分 < 3.0，降低权重
    ELSEIF p_success_rate < 0.5 OR p_avg_rating < 3.0 THEN
        adjustment := -0.05;
    ELSE
        adjustment := 0.0;
    END IF;
    
    -- 更新权重
    UPDATE hero_performance
    SET weight_adjustment = adjustment,
        current_weight = current_weight + adjustment
    WHERE hero_id = p_hero_id
    AND stat_date = CURDATE();
    
END //

DELIMITER ;

-- ============================================
-- 注释说明
-- ============================================
ALTER DATABASE tianli_feedback COMMENT = '天理 Harness 反馈数据库 - 用于收集分发和执行的反馈数据，支持动态权重学习和 A/B 测试';
