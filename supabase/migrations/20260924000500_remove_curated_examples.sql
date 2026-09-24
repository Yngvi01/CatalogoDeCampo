-- Remove only the read-only demonstration data; personal records are untouched.
DELETE FROM public.curated_examples WHERE id = 'research';
