ALTER TABLE fiorix_bi_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON fiorix_bi_data;
CREATE POLICY "allow all" ON fiorix_bi_data FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE fiorix_bi_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow all" ON fiorix_bi_imports;
CREATE POLICY "allow all" ON fiorix_bi_imports FOR ALL USING (true) WITH CHECK (true);
