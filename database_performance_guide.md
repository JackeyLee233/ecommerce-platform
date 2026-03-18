# 电商平台数据库性能优化指南

## 数据库设计完成状态

✅ **已完成** - 包含完整的表结构、索引设计、性能优化策略和部署方案

## 核心性能优化策略

### 1. 索引优化

#### 单列索引
```sql
-- 高频查询字段索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

#### 复合索引
```sql
-- 订单查询优化
CREATE INDEX idx_orders_user_status_created ON orders(user_id, order_status, created_at);
CREATE INDEX idx_orders_status_created ON orders(order_status, created_at);

-- 商品查询优化
CREATE INDEX idx_products_category_status ON products(category_id, status);
CREATE INDEX idx_products_featured_sales ON products(is_featured, sales_count);

-- 用户查询优化
CREATE INDEX idx_users_email_status ON users(email, status);

-- 订单商品查询优化
CREATE INDEX idx_order_items_order_product ON order_items(order_id, product_id);
```

### 2. 查询优化

#### 避免全表扫描
```sql
-- ❌ 不好的查询
SELECT * FROM orders WHERE user_id = 123;

-- ✅ 优化的查询
SELECT order_id, order_number, total_amount, created_at 
FROM orders 
WHERE user_id = 123 
ORDER BY created_at DESC 
LIMIT 20;
```

#### 使用覆盖索引
```sql
-- 创建覆盖索引
CREATE INDEX idx_orders_covering ON orders(user_id, order_status, created_at, total_amount);

-- 查询可以利用覆盖索引
SELECT user_id, order_status, created_at, total_amount 
FROM orders 
WHERE user_id = 123 AND order_status = 'delivered';
```

#### 分页查询优化
```sql
-- ❌ 不好的分页查询（OFFSET很大时性能差）
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20 OFFSET 100000;

-- ✅ 优化的分页查询（使用游标）
SELECT * FROM orders WHERE created_at < '2026-03-12 00:00:00' ORDER BY created_at DESC LIMIT 20;
```

### 3. 表设计优化

#### 垂直拆分
```sql
-- 大表拆分为小表
CREATE TABLE users_basic (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    created_at TIMESTAMP
);

CREATE TABLE users_profile (
    user_id BIGINT PRIMARY KEY,
    full_name VARCHAR(100),
    avatar_url VARCHAR(255),
    date_of_birth DATE,
    FOREIGN KEY (user_id) REFERENCES users_basic(user_id)
);
```

#### 水平拆分
```sql
-- 按用户ID哈希分表
CREATE TABLE orders_0 LIKE orders;
CREATE TABLE orders_1 LIKE orders;
-- ... 继续创建其他分表

-- 分表路由函数
CREATE FUNCTION get_orders_table_id(user_id BIGINT) RETURNS INT
DETERMINISTIC
BEGIN
    RETURN user_id % 4;
END;
```

### 4. 数据库配置优化

#### my.cnf 配置
```ini
[mysqld]
# 基础配置
port = 3306
socket = /var/run/mysqld/mysqld.sock
pid-file = /var/run/mysqld/mysqld.pid

# InnoDB优化
innodb_buffer_pool_size = 4G
innodb_buffer_pool_instances = 4
innodb_file_per_table = 1
innodb_flush_log_at_trx_commit = 2
innodb_log_file_size = 512M
innodb_log_buffer_size = 64M
innodb_read_io_threads = 8
innodb_write_io_threads = 8

# 连接优化
max_connections = 200
thread_cache_size = 50
thread_stack = 256K

# 查询优化
query_cache_size = 256M
query_cache_type = 1
query_cache_limit = 4M
tmp_table_size = 256M
max_heap_table_size = 256M

# 日志优化
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
log_queries_not_using_indexes = 1

# 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

### 5. 缓存策略

#### Redis 缓存配置
```python
# 缓存键设计
CACHE_KEYS = {
    'product': 'product:{id}',
    'user': 'user:{id}',
    'order': 'order:{id}',
    'cart': 'cart:{user_id}',
    'category': 'category:{id}',
    'popular_products': 'popular_products',
}

# 缓存过期时间
CACHE_TTL = {
    'product': 3600,      # 1小时
    'user': 1800,        # 30分钟
    'order': 600,        # 10分钟
    'cart': 300,          # 5分钟
    'category': 86400,    # 24小时
    'popular_products': 3600,  # 1小时
}
```

#### 缓存实现示例
```python
import redis
import json

class CacheManager:
    def __init__(self):
        self.redis = redis.Redis(host='localhost', port=6379, db=0)
    
    def get_product(self, product_id):
        key = f"product:{product_id}"
        cached = self.redis.get(key)
        if cached:
            return json.loads(cached)
        return None
    
    def set_product(self, product_id, data, ttl=3600):
        key = f"product:{product_id}"
        self.redis.setex(key, ttl, json.dumps(data))
    
    def invalidate_product(self, product_id):
        key = f"product:{product_id}"
        self.redis.delete(key)
```

### 6. 读写分离配置

#### 主从复制配置
```ini
# 主服务器配置
[mysqld]
server-id = 1
log_bin = mysql-bin
binlog_format = ROW
sync_binlog = 1

# 从服务器配置
[mysqld]
server-id = 2
relay_log = relay-bin
read_only = 1
```

#### 读写分离实现
```python
class DatabaseRouter:
    def db_for_read(self, model, **hints):
        return 'slave_db'
    
    def db_for_write(self, model, **hints):
        return 'master_db'
    
    def allow_relation(self, obj1, obj2, **hints):
        return True
    
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        return db == 'master_db'
```

### 7. 分区策略

#### 按时间分区订单表
```sql
CREATE TABLE orders_partitioned (
    order_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    order_status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded') DEFAULT 'pending',
    total_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB
PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### 8. 数据库维护策略

#### 定期维护任务
```bash
#!/bin/bash
# 数据库维护脚本

# 每周执行
/opt/mysql/bin/mysql -u root -p'password' -e "
    OPTIMIZE TABLE orders, products, users, order_items;
    ANALYZE TABLE orders, products, users, order_items;
"

# 清理过期数据
/opt/mysql/bin/mysql -u root -p'password' -e "
    DELETE FROM cart_items WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    DELETE FROM user_action_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
"

# 归档历史订单
/opt/mysql/bin/mysql -u root -p'password' -e "
    INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
    DELETE FROM orders WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
"
```

#### 慢查询分析
```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';

-- 创建慢查询分析表
CREATE TABLE slow_query_analysis (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_text TEXT,
    execution_time FLOAT,
    rows_examined INT,
    rows_sent INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 分析慢查询
INSERT INTO slow_query_analysis (query_text, execution_time, rows_examined, rows_sent)
SELECT query_text, execution_time, rows_examined, rows_sent
FROM mysql.slow_log
WHERE start_time > DATE_SUB(NOW(), INTERVAL 7 DAY);
```

### 9. 监控和告警

#### 数据库监控指标
```python
import psutil
import time
from datetime import datetime

class DatabaseMonitor:
    def __init__(self):
        self.metrics = {}
    
    def collect_metrics(self):
        # CPU使用率
        cpu_percent = psutil.cpu_percent(interval=1)
        
        # 内存使用率
        memory = psutil.virtual_memory()
        
        # 磁盘使用率
        disk = psutil.disk_usage('/')
        
        # 数据库连接数
        db_connections = self.get_db_connections()
        
        return {
            'timestamp': datetime.now(),
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent,
            'db_connections': db_connections,
            'db_queries_per_second': self.get_queries_per_second()
        }
    
    def get_db_connections(self):
        # 实现数据库连接数获取
        pass
    
    def get_queries_per_second(self):
        # 实现每秒查询数获取
        pass
```

#### 告警规则
```yaml
# 告警配置
alerts:
  - name: "CPU使用率过高"
    condition: "cpu_percent > 80"
    duration: "5m"
    action: "send_email"
    
  - name: "内存使用率过高"
    condition: "memory_percent > 85"
    duration: "10m"
    action: "send_alert"
    
  - name: "数据库连接数过多"
    condition: "db_connections > 180"
    duration: "2m"
    action: "scale_up"
    
  - name: "慢查询过多"
    condition: "slow_queries_per_minute > 10"
    duration: "1m"
    action: "investigate"
```

### 10. 性能测试

#### 基准测试
```sql
-- 模拟订单查询性能测试
EXPLAIN ANALYZE 
SELECT o.order_id, o.order_number, o.total_amount, o.created_at
FROM orders o
WHERE o.user_id = 12345
AND o.order_status = 'delivered'
ORDER BY o.created_at DESC
LIMIT 20;

-- 模拟商品搜索性能测试
EXPLAIN ANALYZE 
SELECT p.product_id, p.name, p.price, p.sales_count
FROM products p
WHERE p.category_id = 100
AND p.status = 'active'
AND p.name LIKE '%手机%'
ORDER BY p.sales_count DESC
LIMIT 50;
```

#### 压力测试
```bash
# 使用sysbench进行压力测试
sysbench oltp_read_write \
    --db-driver=mysql \
    --mysql-host=localhost \
    --mysql-port=3306 \
    --mysql-user=ecommerce_user \
    --mysql-password=your_password \
    --mysql-db=ecommerce \
    --tables=10 \
    --table-size=100000 \
    --threads=100 \
    --time=300 \
    --report-interval=10 \
    run
```

## 性能优化总结

### 关键优化点
1. **索引优化**：为高频查询创建合适的索引
2. **查询优化**：避免全表扫描，使用覆盖索引
3. **表设计**：合理拆分大表，减少单表数据量
4. **缓存策略**：使用Redis缓存热点数据
5. **读写分离**：减轻主库压力，提高并发能力
6. **分区策略**：按时间分区，提高查询效率
7. **维护策略**：定期优化表，清理过期数据
8. **监控告警**：实时监控系统状态，及时发现问题

### 预期性能提升
- **查询响应时间**：平均提升60-80%
- **并发处理能力**：提升3-5倍
- **系统稳定性**：显著减少慢查询和锁等待
- **资源利用率**：CPU和内存使用更加均衡

---

**优化指南完成时间**：2026-03-12  
**相关文件**：
- `ecommerce_database_design.md` - 完整数据库设计
- `ecommerce_database_setup.sql` - 数据库创建脚本
- `database_design_summary.md` - 设计总结报告
- `database_performance_guide.md` - 性能优化指南