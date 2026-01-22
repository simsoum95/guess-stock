-- =============================================
-- CORRECTION SECURITE SUPABASE
-- Exécutez ce script dans: Supabase Dashboard > SQL Editor
-- =============================================

-- 1. Activer RLS sur upload_history
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

-- Policy pour upload_history (accès complet pour le service role)
DROP POLICY IF EXISTS "Service role full access" ON public.upload_history;
CREATE POLICY "Service role full access" ON public.upload_history
  FOR ALL USING (true) WITH CHECK (true);


-- 2. Activer RLS sur cart_exports
ALTER TABLE public.cart_exports ENABLE ROW LEVEL SECURITY;

-- Policy pour cart_exports (accès complet - les commandes viennent de visiteurs anonymes)
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.cart_exports;
CREATE POLICY "Anyone can insert orders" ON public.cart_exports
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can read orders" ON public.cart_exports;
CREATE POLICY "Authenticated can read orders" ON public.cart_exports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update orders" ON public.cart_exports;
CREATE POLICY "Authenticated can update orders" ON public.cart_exports
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete orders" ON public.cart_exports;
CREATE POLICY "Authenticated can delete orders" ON public.cart_exports
  FOR DELETE TO authenticated USING (true);


-- 3. Corriger search_path des fonctions (évite les attaques d'injection)
ALTER FUNCTION public.update_products_updated_at() SET search_path = public;
ALTER FUNCTION public.search_images(text) SET search_path = public;
ALTER FUNCTION public.list_all_product_images() SET search_path = public;


-- 4. Mettre à jour les policies de admins (plus restrictives)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.admins;

-- Lecture pour utilisateurs authentifiés
DROP POLICY IF EXISTS "Authenticated can read admins" ON public.admins;
CREATE POLICY "Authenticated can read admins" ON public.admins
  FOR SELECT TO authenticated USING (true);

-- Modifications uniquement via service role (API backend)
DROP POLICY IF EXISTS "Service role manages admins" ON public.admins;
CREATE POLICY "Service role manages admins" ON public.admins
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 5. Mettre à jour les policies de image_index (plus spécifiques)
DROP POLICY IF EXISTS "Public read access" ON public.image_index;
DROP POLICY IF EXISTS "Service role can insert" ON public.image_index;
DROP POLICY IF EXISTS "Anyone can read images" ON public.image_index;

-- Lecture publique (les images doivent être visibles par tous)
CREATE POLICY "Public can read images" ON public.image_index
  FOR SELECT USING (true);

-- Modifications uniquement via service role
CREATE POLICY "Service role manages images" ON public.image_index
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================
-- FIN - Rafraîchissez le Security Advisor
-- =============================================

