-- 仅用于空的演示数据库；先执行 schema.sql。非幂等迁移，不覆盖既有记录。
SET NAMES utf8mb4;
SET time_zone = '+00:00';

INSERT INTO users (id, display_name) VALUES
  ('demo-a', '演示用户 A'),
  ('demo-b', '演示用户 B');

INSERT INTO templates
  (id, title, category, description, cover_key, required_image_count, accepted_mime_types, max_file_size_bytes)
VALUES
  ('demo-postcard', '旅行明信片', '创意图片',
   '上传两张图片，模拟制作旅行明信片；演示结果为第一张图片的副本。',
   'demo-covers/postcard.png', 2, JSON_ARRAY('image/jpeg','image/png'), 5242880),
  ('demo-avatar', '头像相框', '创意图片',
   '上传一张图片，演示三阶段处理；结果为原图副本。',
   'demo-covers/avatar.png', 1, JSON_ARRAY('image/jpeg','image/png'), 5242880),
  ('demo-life-cover', '生活封面', '生活记录',
   '上传一张图片，模拟制作生活记录封面；结果为原图副本。',
   'demo-covers/life.png', 1, JSON_ARRAY('image/jpeg','image/png'), 5242880);

-- 对应封面文件由后续实现以自制或合法来源图片打包到 Java classpath。
-- 本文档交付未附这三个 PNG，种子行存在不等于图片已可访问。
