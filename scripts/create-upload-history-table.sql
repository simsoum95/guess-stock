-- Table pour l'historique des uploads Excel
-- À exécuter dans la console SQL de Supabase

CREATE TABLE IF NOT EXISTS upload_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stats JSONB NOT NULL DEFAULT '{}',
  changes JSONB DEFAULT '[]',
  inserted_products JSONB DEFAULT '[]',
  zeroed_products JSONB DEFAULT '[]',
  snapshot_before JSONB DEFAULT '[]',
  sync_stock_enabled BOOLEAN DEFAULT FALSE,
  restored_at TIMESTAMP WITH TIME ZONE
);

-- Index pour la recherche par date
CREATE INDEX IF NOT EXISTS idx_upload_history_uploaded_at ON upload_history (uploaded_at DESC);

-- Désactiver RLS pour permettre l'accès depuis le serveur
ALTER TABLE upload_history DISABLE ROW LEVEL SECURITY;

-- Ou activer RLS avec une politique pour les admins
-- ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Admins can manage upload history" ON upload_history
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

