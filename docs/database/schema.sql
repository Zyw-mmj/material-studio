-- 技术设计草案；目标 MySQL 8.4 / InnoDB。
-- 在空数据库执行；不 DROP、不覆盖现有业务表。尚未进行真实 MySQL 执行验证。
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE users (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE templates (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(128) NOT NULL,
  category VARCHAR(64) NOT NULL,
  description VARCHAR(512) NOT NULL,
  cover_key VARCHAR(255) NOT NULL,
  required_image_count SMALLINT UNSIGNED NOT NULL,
  accepted_mime_types JSON NOT NULL,
  max_file_size_bytes BIGINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_template_category (active, category, id),
  CONSTRAINT chk_template_count CHECK (required_image_count BETWEEN 1 AND 2),
  CONSTRAINT chk_template_size CHECK (max_file_size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT chk_template_types CHECK (JSON_TYPE(accepted_mime_types) = 'ARRAY')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE assets (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  storage_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NOT NULL,
  height INT UNSIGNED NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_asset_owner (id, user_id),
  UNIQUE KEY uk_asset_storage (storage_key),
  KEY idx_asset_user_created (user_id, created_at, id),
  CONSTRAINT fk_asset_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_asset_type CHECK (mime_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT chk_asset_size CHECK (size_bytes BETWEEN 1 AND 5242880),
  CONSTRAINT chk_asset_dimensions CHECK (
    width BETWEEN 1 AND 8192 AND height BETWEEN 1 AND 8192
    AND CAST(width AS UNSIGNED) * CAST(height AS UNSIGNED) <= 25000000
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE generation_tasks (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  template_title VARCHAR(128) NOT NULL,
  template_snapshot JSON NOT NULL,
  client_request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  simulation_json JSON NOT NULL,
  status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  current_step VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NULL,
  result_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  result_mime_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  result_size_bytes BIGINT UNSIGNED NULL,
  error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  error_message VARCHAR(512) NULL,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_task_owner (id, user_id),
  UNIQUE KEY uk_task_request (user_id, client_request_id),
  KEY idx_task_user_created (user_id, created_at DESC, id DESC),
  KEY idx_task_user_status_created (user_id, status, created_at DESC, id DESC),
  KEY idx_task_template_created (user_id, template_id, created_at DESC, id DESC),
  KEY idx_task_status (status, id),
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_task_template FOREIGN KEY (template_id) REFERENCES templates (id),
  CONSTRAINT chk_task_status CHECK (status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  CONSTRAINT chk_task_step CHECK (current_step IS NULL OR current_step IN ('VALIDATE','GENERATE','FINALIZE')),
  CONSTRAINT chk_task_lifecycle CHECK (
    (status = 'QUEUED' AND current_step IS NULL AND started_at IS NULL AND finished_at IS NULL)
    OR (status = 'RUNNING' AND current_step IS NOT NULL AND started_at IS NOT NULL AND finished_at IS NULL)
    OR (status = 'SUCCEEDED' AND current_step IS NOT NULL AND current_step = 'FINALIZE' AND started_at IS NOT NULL AND finished_at IS NOT NULL)
    OR (status = 'FAILED' AND finished_at IS NOT NULL)
  ),
  CONSTRAINT chk_task_result CHECK (
    (status = 'SUCCEEDED' AND result_key IS NOT NULL
      AND result_mime_type IS NOT NULL AND result_mime_type IN ('image/jpeg','image/png')
      AND result_size_bytes IS NOT NULL AND result_size_bytes > 0)
    OR (status <> 'SUCCEEDED' AND result_key IS NULL AND result_mime_type IS NULL AND result_size_bytes IS NULL)
  ),
  CONSTRAINT chk_task_error CHECK (
    (status = 'FAILED' AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR (status <> 'FAILED' AND error_code IS NULL AND error_message IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_assets (
  task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  asset_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (task_id, position),
  UNIQUE KEY uk_task_asset (task_id, asset_id),
  KEY idx_task_asset_owner (task_id, user_id),
  KEY idx_asset_task_owner (asset_id, user_id),
  CONSTRAINT fk_task_asset_task FOREIGN KEY (task_id, user_id) REFERENCES generation_tasks (id, user_id),
  CONSTRAINT fk_task_asset_asset FOREIGN KEY (asset_id, user_id) REFERENCES assets (id, user_id),
  CONSTRAINT chk_asset_position CHECK (position BETWEEN 1 AND 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_steps (
  task_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  step_name VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  step_order SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  error_message VARCHAR(512) NULL,
  PRIMARY KEY (task_id, step_name),
  UNIQUE KEY uk_task_step_order (task_id, step_order),
  CONSTRAINT fk_step_task FOREIGN KEY (task_id) REFERENCES generation_tasks (id),
  CONSTRAINT chk_step_order CHECK (
    (step_name = 'VALIDATE' AND step_order = 1)
    OR (step_name = 'GENERATE' AND step_order = 2)
    OR (step_name = 'FINALIZE' AND step_order = 3)
  ),
  CONSTRAINT chk_step_status CHECK (status IN ('PENDING','RUNNING','SUCCEEDED','FAILED','SKIPPED')),
  CONSTRAINT chk_step_times CHECK (
    (status IN ('PENDING','SKIPPED') AND started_at IS NULL AND finished_at IS NULL)
    OR (status = 'RUNNING' AND started_at IS NOT NULL AND finished_at IS NULL)
    OR (status IN ('SUCCEEDED','FAILED') AND started_at IS NOT NULL AND finished_at IS NOT NULL)
  ),
  CONSTRAINT chk_step_error CHECK (
    (status = 'FAILED' AND error_code IS NOT NULL AND error_message IS NOT NULL)
    OR (status <> 'FAILED' AND error_code IS NULL AND error_message IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
