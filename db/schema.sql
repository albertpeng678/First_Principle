-- 登入用戶的練習 session
CREATE TABLE practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('入門', '進階', '困難')),
  status        TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  issue_json    JSONB NOT NULL,
  conversation  JSONB NOT NULL DEFAULT '[]',
  current_phase TEXT NOT NULL DEFAULT 'reframe'
                  CHECK (current_phase IN ('reframe', 'drill', 'submit', 'done')),
  turn_count    INTEGER NOT NULL DEFAULT 0,
  final_definition TEXT,
  scores_json   JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 訪客 session
CREATE TABLE guest_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      TEXT NOT NULL,
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('入門', '進階', '困難')),
  status        TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  issue_json    JSONB NOT NULL,
  conversation  JSONB NOT NULL DEFAULT '[]',
  current_phase TEXT NOT NULL DEFAULT 'reframe'
                  CHECK (current_phase IN ('reframe', 'drill', 'submit', 'done')),
  turn_count    INTEGER NOT NULL DEFAULT 0,
  final_definition TEXT,
  scores_json   JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER practice_sessions_updated_at
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER guest_sessions_updated_at
  BEFORE UPDATE ON guest_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own sessions"
  ON practice_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "no direct access"
  ON guest_sessions FOR ALL
  USING (false);
