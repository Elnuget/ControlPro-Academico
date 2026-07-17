CREATE DATABASE IF NOT EXISTS controlpro
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'controlpro_app'@'%' IDENTIFIED BY 'controlpro_dev';
GRANT ALL PRIVILEGES ON controlpro.* TO 'controlpro_app'@'%';
FLUSH PRIVILEGES;

USE controlpro;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'student',
  password_hash CHAR(128) NOT NULL,
  password_salt VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  student VARCHAR(120) NOT NULL DEFAULT 'Carlos Angulo',
  deadline DATE NOT NULL,
  progress SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'en_progreso',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_projects_progress CHECK (progress BETWEEN 0 AND 100),
  INDEX idx_projects_deadline (deadline),
  INDEX idx_projects_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS progress_updates (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  percentage SMALLINT UNSIGNED NOT NULL,
  evidence TEXT NOT NULL,
  student VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_updates_percentage CHECK (percentage BETWEEN 0 AND 100),
  CONSTRAINT fk_updates_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_progress_project_created (project_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  event_id CHAR(36) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_notifications_project_created (project_id, created_at)
) ENGINE=InnoDB;

INSERT IGNORE INTO projects (id, name, subject, student, deadline, progress, status)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'ControlPro Académico',
  'Diseño y Arquitectura de Software',
  'Carlos Angulo',
  DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),
  35,
  'en_progreso'
);

INSERT INTO users (id, email, name, role, password_hash, password_salt, status)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'carlos.angulo@udla.edu.ec',
  'Carlos Angulo',
  'student',
  '6a21ab7e618815f35827c3a478e59055eede490c7c09807b616edca639f9114678425cfefac04035ec5e68e727b19f02d06f9dac3d4a652817e3f2e3cf2663fc',
  'controlpro-demo-2026',
  'activo'
)
ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), status=VALUES(status);
