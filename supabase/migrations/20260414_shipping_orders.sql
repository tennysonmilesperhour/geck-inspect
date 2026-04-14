-- Shipping orders — tracks shipments booked through the Zero's Geckos
-- integration. One row per shipment. Status updated via webhook or
-- manual polling.

create table if not exists public.shipping_orders (
  id            uuid primary key default gen_random_uuid(),
  shipment_id   text,                           -- ID from ShipZeros API
  tracking_number text,
  label_url     text,
  carrier       text default 'FedEx',
  service       text,
  status        text default 'label_created'
    check (status in (
      'label_created', 'picked_up', 'in_transit',
      'out_for_delivery', 'delivered', 'arrival_confirmed',
      'cancelled'
    )),
  price         numeric(10,2),

  -- Sender / recipient summary (full addresses live in the ShipZeros
  -- system; we store enough for the order-list UI).
  sender_name       text,
  sender_zip        text,
  recipient_name    text,
  recipient_city    text,
  recipient_state   text,
  recipient_zip     text,

  -- Gecko linkage — array of gecko UUIDs shipped in this box.
  gecko_ids         uuid[] default '{}',

  estimated_delivery date,
  notes             text,

  -- Standard audit columns matching the rest of the schema.
  created_by    text,
  created_date  timestamptz default now(),
  updated_date  timestamptz default now()
);

-- Indexes
create index if not exists idx_shipping_orders_created_by
  on public.shipping_orders (created_by);

create index if not exists idx_shipping_orders_status
  on public.shipping_orders (status);

create index if not exists idx_shipping_orders_tracking
  on public.shipping_orders (tracking_number);

-- RLS
alter table public.shipping_orders enable row level security;

-- Users can read their own orders
create policy "Users can view own shipping orders"
  on public.shipping_orders for select
  using (created_by = (auth.jwt() ->> 'email'));

-- Users can insert their own orders
create policy "Users can create shipping orders"
  on public.shipping_orders for insert
  with check (created_by = (auth.jwt() ->> 'email'));

-- Users can update their own orders (status changes, arrival confirmation)
create policy "Users can update own shipping orders"
  on public.shipping_orders for update
  using (created_by = (auth.jwt() ->> 'email'));
