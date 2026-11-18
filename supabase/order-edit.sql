-- Owner edits an order from the dashboard: customer, phone, address, items, prices, delivery fee, discount, payment.
-- Stock follows the change: the old items go back, the new items come out (refused if there isn't enough).
-- Cancelled and returned orders can't be edited (their stock is already back).
-- Bosta is not updated here: an order already handed to Bosta keeps Bosta's copy until changed there.

create or replace function public.admin_update_order(p_order uuid, payload jsonb)
returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  o public.orders; v_zone public.shipping_zones; v_item jsonb; v_qty int; v_price numeric(10,2);
  v_prod public.products; v_bundle public.bundles; v_subtotal numeric(10,2) := 0;
  v_ship numeric(10,2); v_discount numeric(10,2); v_parts jsonb; v_address text; v_changes text[] := '{}';
  v_old_items text; v_new_items text;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'not_found'; end if;
  if o.status in ('cancelled', 'returned') then raise exception 'locked'; end if;

  if char_length(trim(coalesce(payload->>'customer_name', ''))) < 2 then raise exception 'invalid_name'; end if;
  if char_length(regexp_replace(coalesce(payload->>'phone', ''), '[^0-9]', '', 'g')) < 8 then raise exception 'invalid_phone'; end if;
  select * into v_zone from public.shipping_zones where id = (payload->>'shipping_zone_id')::int;
  if not found then raise exception 'invalid_zone'; end if;
  if nullif(payload->>'district_id', '') is not null and not exists (
    select 1 from public.bosta_districts d where d.district_id = payload->>'district_id' and d.city_id = v_zone.bosta_city_id
  ) then raise exception 'invalid_district'; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then raise exception 'empty_cart'; end if;

  -- address: the parts when given, else the one line
  v_parts := jsonb_strip_nulls(jsonb_build_object(
    'street', nullif(trim(payload#>>'{address_parts,street}'), ''), 'area', nullif(trim(payload#>>'{address_parts,area}'), ''),
    'building', nullif(trim(payload#>>'{address_parts,building}'), ''), 'apartment', nullif(trim(payload#>>'{address_parts,apartment}'), ''),
    'landmark', nullif(trim(payload#>>'{address_parts,landmark}'), '')));
  if v_parts = '{}'::jsonb then v_parts := null; end if;
  v_address := left(coalesce(nullif(public._address_line(coalesce(v_parts, '{}'::jsonb)), ''), trim(coalesce(payload->>'address', ''))), 300);
  if char_length(v_address) < 3 then raise exception 'invalid_address'; end if;

  select string_agg(split_part(name, ' / ', 2) || ' x' || quantity || ' @' || unit_price, ', ' order by name) into v_old_items
    from public.order_items where order_id = o.id;

  -- items: put the old stock back, write the new lines, take the new stock out
  perform public._order_stock(o.id, 1);
  delete from public.order_items where order_id = o.id;
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := greatest(1, least(50, coalesce((v_item->>'quantity')::int, 1)));
    if v_item->>'type' = 'bundle' then
      select * into v_bundle from public.bundles where id = (v_item->>'id')::uuid;
      if not found then raise exception 'item_unavailable'; end if;
      v_price := greatest(0, coalesce(nullif(v_item->>'unit_price', '')::numeric, v_bundle.price));
      insert into public.order_items (order_id, bundle_id, name, unit_price, quantity, line_total)
      values (o.id, v_bundle.id, v_bundle.name_ar || ' / ' || v_bundle.name_en, v_price, v_qty, v_price * v_qty);
    else
      select * into v_prod from public.products where id = (v_item->>'id')::uuid;
      if not found then raise exception 'item_unavailable'; end if;
      v_price := greatest(0, coalesce(nullif(v_item->>'unit_price', '')::numeric, v_prod.price));
      insert into public.order_items (order_id, product_id, name, unit_price, quantity, line_total)
      values (o.id, v_prod.id, v_prod.name_ar || ' / ' || v_prod.name_en, v_price, v_qty, v_price * v_qty);
    end if;
    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;
  perform public._order_stock(o.id, -1);

  select string_agg(split_part(name, ' / ', 2) || ' x' || quantity || ' @' || unit_price, ', ' order by name) into v_new_items
    from public.order_items where order_id = o.id;

  v_ship := greatest(0, coalesce((payload->>'shipping_fee')::numeric, o.shipping_fee));
  v_discount := least(greatest(0, coalesce((payload->>'discount')::numeric, o.discount)), v_subtotal);

  -- a short list of what changed, for the order history
  if trim(payload->>'customer_name') is distinct from o.customer_name then v_changes := array_append(v_changes, 'name'); end if;
  if regexp_replace(payload->>'phone', '[^0-9+]', '', 'g') is distinct from o.phone then v_changes := array_append(v_changes, 'mobile'); end if;
  if nullif(regexp_replace(coalesce(payload->>'whatsapp', ''), '[^0-9+]', '', 'g'), '') is distinct from o.whatsapp then v_changes := array_append(v_changes, 'WhatsApp'); end if;
  if nullif(trim(coalesce(payload->>'email', '')), '') is distinct from o.email then v_changes := array_append(v_changes, 'email'); end if;
  if v_zone.id is distinct from o.shipping_zone_id or nullif(payload->>'district_id', '') is distinct from o.district_id or v_address is distinct from o.address then v_changes := array_append(v_changes, 'address'); end if;
  if v_new_items is distinct from v_old_items then v_changes := array_append(v_changes, 'items'); end if;
  if v_ship <> o.shipping_fee then v_changes := array_append(v_changes, 'delivery fee'); end if;
  if v_discount <> o.discount then v_changes := array_append(v_changes, 'discount'); end if;
  if coalesce(nullif(payload->>'payment_method', ''), o.payment_method) <> o.payment_method then v_changes := array_append(v_changes, 'payment'); end if;
  if left(nullif(trim(coalesce(payload->>'notes', '')), ''), 500) is distinct from o.notes then v_changes := array_append(v_changes, 'notes'); end if;

  update public.orders set
    customer_name = trim(payload->>'customer_name'),
    phone = regexp_replace(payload->>'phone', '[^0-9+]', '', 'g'),
    whatsapp = nullif(regexp_replace(coalesce(payload->>'whatsapp', ''), '[^0-9+]', '', 'g'), ''),
    email = nullif(trim(coalesce(payload->>'email', '')), ''),
    shipping_zone_id = v_zone.id, governorate = v_zone.name_ar,
    city = case when v_zone.id = o.shipping_zone_id then o.city else left(v_zone.name_en, 80) end,
    district_id = nullif(payload->>'district_id', ''),
    district_name = (select coalesce(name_ar, name_en) from public.bosta_districts where district_id = nullif(payload->>'district_id', '')),
    address = v_address, address_parts = v_parts,
    notes = left(nullif(trim(coalesce(payload->>'notes', '')), ''), 500),
    payment_method = coalesce(nullif(payload->>'payment_method', ''), o.payment_method),
    subtotal = v_subtotal, shipping_fee = v_ship, discount = v_discount, total = v_subtotal - v_discount + v_ship,
    updated_at = now()
  where id = o.id;

  if array_length(v_changes, 1) > 0 then
    insert into public.order_status_history (order_id, status, note, email_status)
    values (o.id, o.status, 'Edited by the owner: ' || array_to_string(v_changes, ', ')
      || case when 'items' = any(v_changes) then ' (was: ' || coalesce(v_old_items, '-') || ')' else '' end, 'skipped');
  end if;

  return jsonb_build_object('total', v_subtotal - v_discount + v_ship, 'changes', to_jsonb(v_changes),
    'with_bosta', o.bosta_delivery_id is not null);
end; $$;
revoke all on function public.admin_update_order(uuid, jsonb) from public, anon;
grant execute on function public.admin_update_order(uuid, jsonb) to authenticated;
