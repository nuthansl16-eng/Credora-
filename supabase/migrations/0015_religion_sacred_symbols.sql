-- 0015_religion_sacred_symbols.sql
-- Optional, admin-curated traditional/sacred symbol metadata for richer public cards.
alter table public.religions
  add column if not exists sacred_symbol text,
  add column if not exists sacred_symbol_label text;

alter table public.religions
  add constraint religions_sacred_symbol_length
  check (sacred_symbol is null or length(sacred_symbol) between 1 and 32),
  add constraint religions_sacred_symbol_label_length
  check (sacred_symbol_label is null or length(sacred_symbol_label) between 1 and 120);
