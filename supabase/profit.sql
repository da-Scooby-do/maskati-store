-- Making cost per product and the profit report for the owner dashboard.
-- Costs live in their own table so only owners can read them; customers never see them.

create table if not exists public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  cost numeric not null default 0 check (cost >= 0),
  updated_at timestamptz not null default now()
);
alter table public.product_costs enable row level security;
drop policy if exists "owners manage costs" on public.product_costs;
create policy "owners manage costs" on public.product_costs
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.product_costs from anon;

-- Profit per product and overall. Counts every order except cancelled and returned.
-- A routine sale is split across its products in proportion to their selling prices.
-- Uses today's making cost for past sales.
create or replace function public.admin_profit(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path to ''
as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  with live as (
    select o.id, o.discount from public.orders o
    where o.status not in ('cancelled', 'returned')
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at < p_to)
  ),
  lines as (
    select i.product_id, i.quantity::numeric as qty, i.line_total as rev
    from public.order_items i join live on live.id = i.order_id
    where i.bundle_id is null and i.product_id is not null
    union all
    select x.pid, i.quantity::numeric,
      coalesce(i.line_total * p.price / nullif(t.s, 0), i.line_total / cardinality(b.product_ids))
    from public.order_items i
    join live on live.id = i.order_id
    join public.bundles b on b.id = i.bundle_id
    cross join lateral unnest(b.product_ids) as x(pid)
    join public.products p on p.id = x.pid
    cross join lateral (select sum(p2.price) s from unnest(b.product_ids) y(id) join public.products p2 on p2.id = y.id) t
  ),
  per as (
    select p.id, p.name_en, p.name_ar, p.price, c.cost, p.sort_order,
      coalesce(sum(l.qty), 0) as sold, coalesce(sum(l.rev), 0) as revenue
    from public.products p
    left join public.product_costs c on c.product_id = p.id
    left join lines l on l.product_id = p.id
    group by p.id, c.cost
  )
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'name_en', name_en, 'name_ar', name_ar, 'price', price, 'cost', cost,
        'sold', sold, 'revenue', round(revenue, 2),
        'cost_total', case when cost is null then null else round(sold * cost, 2) end,
        'profit', case when cost is null then null else round(revenue - sold * cost, 2) end
      ) order by sort_order) from per), '[]'::jsonb),
    'revenue', round(coalesce((select sum(revenue) from per), 0), 2),
    'cost', round(coalesce((select sum(sold * cost) from per where cost is not null), 0), 2),
    'discounts', round(coalesce((select sum(discount) from live), 0), 2),
    'orders', (select count(*) from live),
    'missing_cost', (select count(*) from per where cost is null and sold > 0)
  ) into r;
  r := r || jsonb_build_object('profit', round((r->>'revenue')::numeric - (r->>'cost')::numeric - (r->>'discounts')::numeric, 2));
  return r;
end; $$;
revoke all on function public.admin_profit(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_profit(timestamptz, timestamptz) to authenticated;
