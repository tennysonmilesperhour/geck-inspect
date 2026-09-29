-- send-breeder-inquiry now rate-limits by buyer email, by network and by
-- breeder. The network is stored as a keyed hash of the sender's IP, never
-- the address itself. Indexes keep the rolling-window counts cheap.
alter table public.breeder_inquiries
  add column if not exists sender_ip_hash text;

create index if not exists breeder_inquiries_buyer_created_idx
  on public.breeder_inquiries (buyer_email, created_at desc);
create index if not exists breeder_inquiries_ip_created_idx
  on public.breeder_inquiries (sender_ip_hash, created_at desc)
  where sender_ip_hash is not null;
create index if not exists breeder_inquiries_breeder_created_idx
  on public.breeder_inquiries (breeder_email, created_at desc);
