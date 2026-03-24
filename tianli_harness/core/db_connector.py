"""
Database Connector for TianLi Feedback Database

Connects to MySQL database and provides methods to store:
- Dispatch decisions
- Task results
- User feedback
- Hero performance
"""

import json
import logging
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from pathlib import Path

try:
    import pymysql
    from pymysql.err import Error
except ImportError:
    pymysql = None
    Error = Exception

logger = logging.getLogger(__name__)


class FeedbackDatabase:
    """Database connector for TianLi feedback system"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize database connection
        
        Args:
            config: Database configuration dict with keys:
                - host: Database host (default: localhost)
                - port: Database port (default: 3306)
                - user: Database user (default: root)
                - password: Database password (default: empty)
                - database: Database name (default: tianli_feedback)
        """
        self.config = config or {
            'host': 'localhost',
            'port': 3306,
            'user': 'root',
            'password': '',
            'database': 'tianli_feedback',
            'charset': 'utf8mb4'
        }
        
        self.connection = None
        self._connect()
    
    def _connect(self):
        """Establish database connection"""
        if pymysql is None:
            logger.warning("pymysql not installed. Database operations will be skipped.")
            return
        
        try:
            self.connection = pymysql.connect(**self.config)
            logger.info(f"Connected to database: {self.config['database']}")
        except Error as e:
            logger.warning(f"Failed to connect to database: {e}")
            self.connection = None
    
    def _ensure_connection(self):
        """Ensure database connection is active"""
        if self.connection is None:
            self._connect()
        elif not self.connection.open:
            self._connect()
    
    def log_dispatch_decision(
        self,
        task_id: str,
        session_id: Optional[str],
        user_input: str,
        task_tags: List[str],
        selected_hero_ids: List[str],
        primary_hero_id: str,
        consult_hero_ids: Optional[List[str]],
        candidate_scores: Dict[str, float],
        dispatch_reason: str,
        dispatch_mode: str = 'hybrid',
        collaboration_mode: str = 'primary_consult',
        fallback_used: bool = False
    ) -> Optional[int]:
        """
        Log a dispatch decision to database
        
        Returns:
            dispatch_id if successful, None otherwise
        """
        self._ensure_connection()
        if self.connection is None:
            return None
        
        try:
            cursor = self.connection.cursor()
            
            sql = """
                INSERT INTO dispatch_decisions (
                    task_id, session_id, user_input, task_tags,
                    selected_hero_ids, primary_hero_id, consult_hero_ids,
                    candidate_scores, dispatch_reason,
                    dispatch_mode, collaboration_mode, fallback_used
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            cursor.execute(sql, (
                task_id,
                session_id,
                user_input,
                json.dumps(task_tags),
                json.dumps(selected_hero_ids),
                primary_hero_id,
                json.dumps(consult_hero_ids) if consult_hero_ids else None,
                json.dumps(candidate_scores),
                dispatch_reason,
                dispatch_mode,
                collaboration_mode,
                fallback_used
            ))
            
            self.connection.commit()
            dispatch_id = cursor.lastrowid
            cursor.close()
            
            logger.info(f"Logged dispatch decision: {task_id} -> {primary_hero_id}")
            return dispatch_id
            
        except Error as e:
            logger.error(f"Failed to log dispatch decision: {e}")
            return None
    
    def log_task_result(
        self,
        task_id: str,
        dispatch_id: Optional[int],
        status: str,
        current_status: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        total_tokens: Optional[int] = None,
        l1_passed: Optional[bool] = None,
        l2_passed: Optional[bool] = None,
        l2_score: Optional[float] = None,
        violations: Optional[List[Dict]] = None,
        evolution_patch: Optional[str] = None
    ) -> bool:
        """
        Log a task execution result
        
        Returns:
            True if successful, False otherwise
        """
        self._ensure_connection()
        if self.connection is None:
            return False
        
        try:
            cursor = self.connection.cursor()
            
            sql = """
                INSERT INTO task_results (
                    task_id, dispatch_id, status, current_status,
                    execution_time_ms, total_tokens,
                    l1_passed, l2_passed, l2_score,
                    violations, evolution_patch
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            cursor.execute(sql, (
                task_id,
                dispatch_id,
                status,
                current_status,
                execution_time_ms,
                total_tokens,
                l1_passed,
                l2_passed,
                l2_score,
                json.dumps(violations) if violations else None,
                evolution_patch
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Logged task result: {task_id} - {status}")
            return True
            
        except Error as e:
            logger.error(f"Failed to log task result: {e}")
            return False
    
    def log_user_feedback(
        self,
        task_id: str,
        dispatch_id: Optional[int],
        rating: Optional[int] = None,
        success: Optional[bool] = None,
        feedback_text: Optional[str] = None,
        feedback_type: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        Log user feedback
        
        Returns:
            True if successful, False otherwise
        """
        self._ensure_connection()
        if self.connection is None:
            return False
        
        try:
            cursor = self.connection.cursor()
            
            sql = """
                INSERT INTO user_feedback (
                    task_id, dispatch_id, rating, success,
                    feedback_text, feedback_type, tags
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            cursor.execute(sql, (
                task_id,
                dispatch_id,
                rating,
                success,
                feedback_text,
                feedback_type,
                json.dumps(tags) if tags else None
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Logged user feedback for task: {task_id}")
            return True
            
        except Error as e:
            logger.error(f"Failed to log user feedback: {e}")
            return False
    
    def update_hero_performance(
        self,
        hero_id: str,
        success: bool,
        execution_time_ms: Optional[int] = None,
        l1_passed: Optional[bool] = None,
        l2_passed: Optional[bool] = None,
        l2_score: Optional[float] = None,
        user_rating: Optional[int] = None
    ) -> bool:
        """
        Update hero performance statistics (daily aggregation)
        
        Returns:
            True if successful, False otherwise
        """
        self._ensure_connection()
        if self.connection is None:
            return False
        
        try:
            cursor = self.connection.cursor()
            
            today = date.today()
            
            # Check if record exists for today
            cursor.execute("""
                SELECT id, total_tasks, successful_tasks, failed_tasks
                FROM hero_performance
                WHERE hero_id = %s AND stat_date = %s
            """, (hero_id, today))
            
            row = cursor.fetchone()
            
            if row:
                # Update existing record
                perf_id, total, success_count, failed_count = row
                success_count += 1 if success else 0
                failed_count += 0 if success else 1
                total += 1
                
                # Calculate averages (simplified - would need more complex logic for true averages)
                sql = """
                    UPDATE hero_performance
                    SET total_tasks = %s,
                        successful_tasks = %s,
                        failed_tasks = %s,
                        current_weight = current_weight + %s
                    WHERE id = %s
                """
                
                # Adjust weight based on success
                weight_change = 0.01 if success else -0.01
                
                cursor.execute(sql, (total, success_count, failed_count, weight_change, perf_id))
            else:
                # Insert new record
                sql = """
                    INSERT INTO hero_performance (
                        hero_id, stat_date, total_tasks, successful_tasks, failed_tasks
                    ) VALUES (%s, %s, %s, %s, %s)
                """
                
                cursor.execute(sql, (
                    hero_id,
                    today,
                    1,
                    1 if success else 0,
                    0 if success else 1
                ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Updated hero performance: {hero_id}")
            return True
            
        except Error as e:
            logger.error(f"Failed to update hero performance: {e}")
            return False
    
    def get_hero_weights(self) -> Dict[str, Dict[str, float]]:
        """
        Get current matching weights from database
        
        Returns:
            Dict of weight configurations
        """
        self._ensure_connection()
        if self.connection is None:
            return {}
        
        try:
            cursor = self.connection.cursor(pymysql.cursors.DictCursor)
            
            cursor.execute("""
                SELECT weight_name, weight_value, min_value, max_value
                FROM matching_weights
            """)
            
            weights = {}
            for row in cursor.fetchall():
                weights[row['weight_name']] = {
                    'value': float(row['weight_value']),
                    'min': float(row['min_value']),
                    'max': float(row['max_value'])
                }
            
            cursor.close()
            return weights
            
        except Error as e:
            logger.error(f"Failed to get hero weights: {e}")
            return {}
    
    def get_synonyms(self, keyword: str) -> List[str]:
        """
        Get synonyms for a keyword
        
        Returns:
            List of synonyms
        """
        self._ensure_connection()
        if self.connection is None:
            return []
        
        try:
            cursor = self.connection.cursor()
            
            cursor.execute("""
                SELECT synonyms
                FROM synonym_mappings
                WHERE keyword = %s
            """, (keyword,))
            
            row = cursor.fetchone()
            if row:
                return json.loads(row[0])
            
            return []
            
        except Error as e:
            logger.error(f"Failed to get synonyms: {e}")
            return []
    
    def close(self):
        """Close database connection"""
        if self.connection and self.connection.open:
            self.connection.close()
            logger.info("Database connection closed")


# Global database instance
_db_instance: Optional[FeedbackDatabase] = None


def get_feedback_database(config: Optional[Dict[str, Any]] = None) -> FeedbackDatabase:
    """Get or create global database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = FeedbackDatabase(config)
    return _db_instance


def reset_feedback_database():
    """Reset global database instance (for testing)"""
    global _db_instance
    if _db_instance:
        _db_instance.close()
    _db_instance = None
