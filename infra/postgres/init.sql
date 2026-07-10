CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  subject VARCHAR(120) NOT NULL,
  student VARCHAR(120) NOT NULL DEFAULT 'Carlos Angulo',
  deadline DATE NOT NULL,
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status VARCHAR(30) NOT NULL DEFAULT 'en_progreso',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  percentage SMALLINT NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  evidence TEXT NOT NULL,
  student VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  recipient VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  event_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_progress_project_created ON progress_updates(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project_created ON notifications(project_id, created_at DESC);

INSERT INTO projects (id, name, subject, student, deadline, progress, status)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'ControlPro Académico',
  'Diseño y Arquitectura de Software',
  'Carlos Angulo',
  CURRENT_DATE + INTERVAL '14 days',
  35,
  'en_progreso'
)
ON CONFLICT (id) DO NOTHING;

