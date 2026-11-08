-- Refresh PostgREST after the contributor and acquisition tables become visible.
notify pgrst, 'reload schema';
