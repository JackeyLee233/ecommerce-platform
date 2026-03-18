# 电商平台数据库设计

## 数据库概述

本设计为电商平台的核心数据库结构，涵盖用户管理、商品管理、订单处理、支付系统等核心业务模块。

## 核心表结构设计

### 1. 用户相关表

#### users (用户主表)
```sql
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    full_name VARCHAR(100),
    avatar_url VARCHAR(255),
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    date_of_birth DATE,
    registration_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_time DATETIME,
    status ENUM('active', 'inactive', 'banned', 'pending') DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_status (status),
    INDEX idx_registration_time (registration_time)
) ENGINE=InnoDB;
```

#### user_addresses (用户地址表)
```sql
CREATE TABLE user_addresses (
    address_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(50) NOT NULL,
    detail_address TEXT NOT NULL,
    postal_code VARCHAR(10),
    is_default BOOLEAN DEFAULT FALSE,
    address_type ENUM('home', 'office', 'other') DEFAULT 'home',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_default (is_default)
) ENGINE=InnoDB;
```

#### user_preferences (用户偏好表)
```sql
CREATE TABLE user_preferences (
    preference_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT UNIQUE NOT NULL,
    language VARCHAR(10) DEFAULT 'zh-CN',
    currency VARCHAR(10) DEFAULT 'CNY',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    newsletter_subscription BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 2. 商品相关表

#### categories (商品分类表)
```sql
CREATE TABLE categories (
    category_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    parent_id BIGINT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(category_id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id),
    INDEX idx_slug (slug),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;
```

#### products (商品主表)
```sql
CREATE TABLE products (
    product_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    brand_id BIGINT,
    category_id BIGINT NOT NULL,
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    weight DECIMAL(10,2),
    dimensions JSON,
    status ENUM('active', 'inactive', 'draft', 'out_of_stock') DEFAULT 'active',
    is_featured BOOLEAN DEFAULT FALSE,
    is_new BOOLEAN DEFAULT FALSE,
    views_count INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE RESTRICT,
    FOREIGN KEY (brand_id) REFERENCES brands(brand_id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_slug (slug),
    INDEX idx_category_id (category_id),
    INDEX idx_status (status),
    INDEX idx_is_featured (is_featured),
    INDEX idx_sales_count (sales_count)
) ENGINE=InnoDB;
```

#### product_variants (商品变体表)
```sql
CREATE TABLE product_variants (
    variant_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 0,
    weight DECIMAL(10,2),
    dimensions JSON,
    attributes JSON,
    status ENUM('active', 'inactive', 'out_of_stock') DEFAULT 'active',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_sku (sku),
    INDEX idx_price (price),
    INDEX idx_stock_quantity (stock_quantity),
    INDEX idx_status (status)
) ENGINE=InnoDB;
```

#### product_images (商品图片表)
```sql
CREATE TABLE product_images (
    image_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    product_id BIGINT NOT NULL,
    variant_id BIGINT,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(200),
    sort_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE,
    INDEX idx_product_id (product_id),
    INDEX idx_variant_id (variant_id),
    INDEX idx_is_primary (is_primary)
) ENGINE=InnoDB;
```

### 3. 订单相关表

#### orders (订单主表)
```sql
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id BIGINT NOT NULL,
    order_status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded') DEFAULT 'pending',
    shipping_status ENUM('pending', 'processing', 'shipped', 'delivered', 'failed') DEFAULT 'pending',
    total_amount DECIMAL(12,2) NOT NULL,
    subtotal_amount DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    coupon_code VARCHAR(50),
    currency VARCHAR(10) DEFAULT 'CNY',
    shipping_address JSON,
    billing_address JSON,
    notes TEXT,
    estimated_delivery_date DATE,
    actual_delivery_date DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    INDEX idx_order_number (order_number),
    INDEX idx_user_id (user_id),
    INDEX idx_order_status (order_status),
    INDEX idx_payment_status (payment_status),
    INDEX idx_shipping_status (shipping_status),
    INDEX idx_created_at (created_at),
    INDEX idx_total_amount (total_amount)
) ENGINE=InnoDB;
```

#### order_items (订单商品表)
```sql
CREATE TABLE order_items (
    item_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id),
    INDEX idx_variant_id (variant_id)
) ENGINE=InnoDB;
```

#### order_shipping (订单物流表)
```sql
CREATE TABLE order_shipping (
    shipping_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT UNIQUE NOT NULL,
    tracking_number VARCHAR(100),
    shipping_company VARCHAR(100),
    shipping_method VARCHAR(50),
    shipping_cost DECIMAL(10,2),
    estimated_delivery DATE,
    actual_delivery DATETIME,
    shipping_address JSON,
    status ENUM('pending', 'processing', 'shipped', 'delivered', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id),
    INDEX idx_tracking_number (tracking_number),
    INDEX idx_status (status)
) ENGINE=InnoDB;
```

### 4. 支付相关表

#### payments (支付记录表)
```sql
CREATE TABLE payments (
    payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_gateway VARCHAR(50) NOT NULL,
    transaction_id VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'CNY',
    status ENUM('pending', 'success', 'failed', 'cancelled', 'refunded') DEFAULT 'pending',
    payment_time DATETIME,
    refund_time DATETIME,
    refund_amount DECIMAL(12,2) DEFAULT 0,
    refund_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
    INDEX idx_order_id (order_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_status (status),
    INDEX idx_payment_time (payment_time)
) ENGINE=InnoDB;
```

#### payment_methods (支付方式表)
```sql
CREATE TABLE payment_methods (
    method_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB;
```

### 5. 购物车表

#### cart_items (购物车商品表)
```sql
CREATE TABLE cart_items (
    cart_item_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    variant_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product_variant (user_id, product_id, variant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_product_id (product_id),
    INDEX idx_variant_id (variant_id),
    INDEX idx_added_at (added_at)
) ENGINE=InnoDB;
```

## 性能优化方案

### 1. 索引优化

#### 复合索引设计
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

### 2. 分区策略

#### 按时间分区订单表
```sql
CREATE TABLE orders_partitioned LIKE orders;
ALTER TABLE orders_partitioned PARTITION BY RANGE (YEAR(created_at)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p2026 VALUES LESS THAN (2027),
    PARTITION pmax VALUES LESS THAN MAXVALUE
);
```

### 3. 数据库优化配置

#### 主配置优化
```ini
# my.cnf 优化配置
[mysqld]
# 缓冲池设置
innodb_buffer_pool_size = 4G
innodb_buffer_pool_instances = 4

# 连接设置
max_connections = 200
thread_cache_size = 50

# 查询缓存
query_cache_size = 256M
query_cache_type = 1

# InnoDB优化
innodb_flush_log_at_trx_commit = 2
innodb_log_file_size = 512M
innodb_log_buffer_size = 64M

# 其他优化
tmp_table_size = 256M
max_heap_table_size = 256M
```

### 4. 查询优化建议

#### 慢查询监控
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
```

### 5. 数据库维护策略

#### 定期维护任务
```sql
-- 优化表
OPTIMIZE TABLE orders, products, users;

-- 分析表
ANALYZE TABLE orders, products, users, order_items;

-- 清理过期数据
DELETE FROM cart_items WHERE updated_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- 归档历史订单
INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
DELETE FROM orders WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

## 数据库扩展设计

### 1. 读写分离配置

#### 主从复制设置
```sql
-- 主服务器配置
server-id = 1
log_bin = mysql-bin
binlog_format = ROW
sync_binlog = 1

-- 从服务器配置
server-id = 2
relay_log = relay-bin
read_only = 1
```

### 2. 分库分表策略

#### 按用户ID分表
```sql
-- 创建用户分表
CREATE TABLE users_0 LIKE users;
CREATE TABLE users_1 LIKE users;
-- ... 继续创建其他分表

-- 创建分表路由视图
CREATE VIEW users_all AS
SELECT * FROM users_0 UNION ALL
SELECT * FROM users_1;
```

### 3. 缓存策略

#### Redis缓存配置
```python
# 商品缓存
PRODUCT_CACHE_KEY = "product:{product_id}"
PRODUCT_CACHE_TTL = 3600  # 1小时

# 用户缓存
USER_CACHE_KEY = "user:{user_id}"
USER_CACHE_TTL = 1800  # 30分钟

# 购物车缓存
CART_CACHE_KEY = "cart:{user_id}"
CART_CACHE_TTL = 600  # 10分钟
```

## 总结

本数据库设计采用以下优化策略：

1. **合理的表结构设计**：遵循数据库范式，避免数据冗余
2. **全面的索引策略**：为高频查询字段创建索引，提高查询性能
3. **分区设计**：对大表进行分区，提高查询和维护效率
4. **读写分离**：减轻主数据库压力，提高系统并发能力
5. **缓存策略**：使用Redis缓存热点数据，减少数据库访问
6. **定期维护**：制定数据库维护计划，保证系统长期稳定运行

此设计能够支持电商平台的核心业务需求，并具备良好的扩展性和性能表现。