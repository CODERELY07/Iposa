-- Paste this whole file into the Supabase SQL Editor and run it top to
-- bottom in one go. Every statement is idempotent (IF NOT EXISTS / OR
-- REPLACE / DROP ... IF EXISTS), so it's also safe to re-run after future
-- edits to this file — it upgrades in place rather than erroring out.
--
-- One platform, one tenant model: every business owner works entirely under
-- /sell — POS, product catalog (with optional recipes/cost tracking),
-- ingredients, sales history, analytics, online orders, and shop settings —
-- all scoped to their own `business_id`. There is exactly one operator per
-- business for now (the owner); no per-business staff accounts yet.
--
-- The old single-tenant `products` table (and the assumption of one shared
-- internal POS for one company) is gone. `store_products` is now the one
-- and only product catalog: the same row is what's sold in-person via POS
-- AND what's listed on the public marketplace (via `is_active`) — one stock
-- number, not two that can drift apart.

-- =============================================================================
-- SECTION 1 — PROFILES & ROLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  role text DEFAULT 'customer'::text,
  created_at timestamp without time zone DEFAULT now(),
  manager_pin text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 'admin' / 'staff' / 'cashier' are kept in the check constraint only for
-- backwards compatibility with any pre-existing rows; nothing in the app
-- assigns them anymore. A business owner is 'business_admin'; the
-- marketplace operator is 'super_admin'; a promoter is 'affiliate';
-- everyone else is 'customer'.
--
-- Re-adding a CHECK constraint re-validates every existing row, so a single
-- stray/legacy value (a manual edit, an old experiment, a row from before
-- this list existed) would abort the whole script with "check constraint ...
-- is violated by some row" on every future re-run. Coerce anything outside
-- the allowed set back to the 'customer' default first so this section stays
-- truly idempotent; if that's ever unexpected for a specific user, fix their
-- role by hand afterward.
UPDATE public.profiles
SET role = 'customer'
WHERE role IS NOT NULL
  AND role NOT IN ('admin', 'staff', 'cashier', 'super_admin', 'business_admin', 'customer', 'affiliate');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'cashier', 'super_admin', 'business_admin', 'customer', 'affiliate'));
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'customer';

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- SECTION 2 — BUSINESSES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  banner_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Chosen once at registration (see register_business() below) and read by
  -- the whole /sell dashboard (nav labels, product/service catalog UI, POS,
  -- analytics) to decide which costing model applies — see
  -- lib/business/type-meta.ts on the app side for exactly what each value
  -- changes. All three types still share the same store_products table and
  -- the same process_sale()/analytics math; only the vocabulary and which
  -- features are shown differ. 'retail' is the default for pre-existing rows
  -- created before this column existed, since standalone cost_price (no
  -- recipe) is what they were already using.
  --
  -- 'services' replaced the earlier, narrower 'print_shop' value: printing
  -- is just one kind of service business among many (repairs, salons,
  -- cleaning...), so instead of a fixed type per trade, a services business
  -- builds its own catalog of named services (see store_products.track_stock
  -- below) rather than getting a different fixed type per trade.
  business_type text NOT NULL DEFAULT 'retail' CHECK (business_type IN ('restaurant', 'services', 'retail')),
  rejection_reason text,
  -- Set from Shop Settings via MapLocationPicker (the same free
  -- Leaflet/OpenStreetMap+Nominatim flow checkout uses for a delivery pin —
  -- see components/marketplace/MapLocationPicker.tsx) rather than at
  -- registration: a business may not know this until it fills out Shop
  -- Settings. Nullable here (existing rows predate this, and registration
  -- doesn't collect it) but location_lat/lng are enforced as required by the
  -- app layer — see BusinessLocationForm/updateBusinessLocationAction —
  -- since checkout always lets a customer choose 'pickup' for any business,
  -- there's no per-business case where the pin is genuinely optional.
  -- store_orders' own shipping_lat/lng are a separate, per-order concept and
  -- unaffected.
  address text,
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Additive, in case an earlier run of this script already created this table
-- without the column — ADD COLUMN with a DEFAULT back-fills existing rows
-- instead of erroring, so this is safe to re-run even with live data.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'retail';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS location_lat numeric(9,6);
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS location_lng numeric(9,6);
-- Drop the old CHECK before migrating data, since a stricter constraint
-- would otherwise reject the UPDATE below on a database still holding the
-- retired 'print_shop' value.
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_business_type_check;
UPDATE public.businesses SET business_type = 'services' WHERE business_type = 'print_shop';
ALTER TABLE public.businesses ADD CONSTRAINT businesses_business_type_check
  CHECK (business_type IN ('restaurant', 'services', 'retail'));

CREATE INDEX IF NOT EXISTS businesses_status_idx ON public.businesses(status);

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only a super_admin may change `status` (approve/reject), enforced at the
-- row level even if a business owner's UPDATE policy would otherwise let
-- them touch their own row (defense in depth alongside the RPC below).
CREATE OR REPLACE FUNCTION public.protect_business_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can change a business status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_business_status ON public.businesses;
CREATE TRIGGER trg_protect_business_status
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.protect_business_status();

-- Same defense-in-depth as protect_business_status() above, for
-- business_type: it's meant to be a one-time choice made at registration
-- (see register_business()) that the rest of /sell is built around, not a
-- field an owner can silently flip via a direct table update — the generic
-- owner UPDATE policy below has no column-level restriction on its own, so
-- without this trigger `supabase.from('businesses').update({business_type})`
-- would otherwise succeed. A super_admin can still correct a wrong choice by
-- request.
CREATE OR REPLACE FUNCTION public.protect_business_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_type IS DISTINCT FROM OLD.business_type AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can change a business''s type once registered';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_business_type ON public.businesses;
CREATE TRIGGER trg_protect_business_type
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.protect_business_type();

-- =============================================================================
-- SECTION 3 — SHARED CATEGORY TAXONOMY
-- Global, not business-scoped: this is what lets the marketplace filter
-- "all shops" by one consistent category list. Any approved business owner
-- can add a new category (needed to categorize their own products); only a
-- super_admin can rename or delete one, since a shared list is easy for one
-- shop to break for everyone else.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- SECTION 4 — THE UNIFIED PRODUCT CATALOG
-- One row per product (or, for a 'services' business, per named service —
-- same table either way) per business. `price`/`stock` are what both POS
-- and the marketplace read. `cost_price` and/or `recipes` (below) are
-- optional — a row with no recipe rows just uses cost_price directly for
-- margin reporting; a row with recipe rows derives its cost (and its live
-- sellable stock) from ingredient consumption instead. `track_stock` opts a
-- row out of stock accounting entirely — for a service like "Photocopy" or
-- "Battery replacement", there's no finite count to run out of, so it's
-- always treated as available (see process_sale()/place_order() below)
-- regardless of whatever `stock` happens to hold.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.store_products (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id bigint REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  sku text,
  description text,
  image_url text,
  cost_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  track_stock boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug)
);
-- Additive, in case an earlier version of this script already created the
-- table without these columns.
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS cost_price numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.store_products ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS store_products_business_id_idx ON public.store_products(business_id);
CREATE INDEX IF NOT EXISTS store_products_category_id_idx ON public.store_products(category_id);
CREATE INDEX IF NOT EXISTS store_products_is_active_idx ON public.store_products(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS store_products_business_sku_idx ON public.store_products(business_id, sku) WHERE sku IS NOT NULL;

DROP TRIGGER IF EXISTS trg_store_products_updated_at ON public.store_products;
CREATE TRIGGER trg_store_products_updated_at
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- ingredients (raw stock, one pool per business) ----
CREATE TABLE IF NOT EXISTS public.ingredients (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  cost_per_unit numeric NOT NULL DEFAULT 0.0000,
  unit_type text NOT NULL DEFAULT 'grams'::text,
  current_stock numeric NOT NULL DEFAULT 0.00,
  min_stock_alert numeric NOT NULL DEFAULT 10.00,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive, in case an earlier run of this script created `ingredients`
-- before it was business-scoped.
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.ingredients DROP CONSTRAINT IF EXISTS ingredients_sku_key;

CREATE INDEX IF NOT EXISTS ingredients_business_id_idx ON public.ingredients(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS ingredients_business_sku_idx ON public.ingredients(business_id, sku) WHERE sku IS NOT NULL;

-- ---- recipes (bill of materials: how much of which ingredient a product consumes) ----
CREATE TABLE IF NOT EXISTS public.recipes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  ingredient_id bigint NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity_used numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive: repoint an earlier run's FK (which referenced the now-dropped
-- `products` table) at `store_products` instead.
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_product_id_fkey;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.store_products(id) ON DELETE CASCADE;
ALTER TABLE public.recipes DROP CONSTRAINT IF EXISTS recipes_ingredient_id_fkey;
ALTER TABLE public.recipes ADD CONSTRAINT recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS recipes_product_id_idx ON public.recipes(product_id);
CREATE INDEX IF NOT EXISTS recipes_ingredient_id_idx ON public.recipes(ingredient_id);

-- A recipe can't link a product from one business to an ingredient from
-- another — both sides of the schema are now multi-tenant, so this is a
-- real data-integrity risk without the check.
CREATE OR REPLACE FUNCTION public.validate_recipe_business()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_product_business uuid;
  v_ingredient_business uuid;
BEGIN
  SELECT business_id INTO v_product_business FROM public.store_products WHERE id = NEW.product_id;
  SELECT business_id INTO v_ingredient_business FROM public.ingredients WHERE id = NEW.ingredient_id;
  IF v_product_business IS DISTINCT FROM v_ingredient_business THEN
    RAISE EXCEPTION 'Recipe product and ingredient must belong to the same business';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_recipe_business ON public.recipes;
CREATE TRIGGER trg_validate_recipe_business
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_business();

-- ---- inventory_logs (manual stock adjustments to ingredients) ----
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ingredient_id bigint REFERENCES public.ingredients(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  type text CHECK (type = ANY (ARRAY['in'::text, 'out'::text, 'waste'::text])),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive, in case an earlier run of this script created `inventory_logs`
-- before it was business-scoped.
ALTER TABLE public.inventory_logs ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS inventory_logs_business_id_idx ON public.inventory_logs(business_id);

-- ---- operating_expenses (fixed monthly bills, for net-profit analytics) ----
CREATE TABLE IF NOT EXISTS public.operating_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  billing_period date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive, in case an earlier run of this script created
-- `operating_expenses` before it was business-scoped.
ALTER TABLE public.operating_expenses ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
-- Additive, for installs from before the Expenses page (which lets an owner
-- attach a free-text note to a bill, e.g. "Meralco - March, includes late fee").
ALTER TABLE public.operating_expenses ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX IF NOT EXISTS operating_expenses_business_id_idx ON public.operating_expenses(business_id);

-- =============================================================================
-- SECTION 5 — IN-PERSON POS SALES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  total numeric NOT NULL,
  payment numeric NOT NULL,
  change numeric NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Additive, in case an earlier run of this script created `sales` before it
-- was business-scoped.
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sales_business_id_idx ON public.sales(business_id);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id bigint NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.store_products(id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  selling_price numeric NOT NULL,
  computed_cogs numeric NOT NULL,
  -- Set only for an ad-hoc "custom item" line rung up with no catalog entry
  -- (product_id IS NULL) — see process_sale() below. NULL for every ordinary
  -- catalog line, which gets its name by joining store_products instead.
  custom_name text
);
-- Additive, in case an earlier run of this script created `sale_items`
-- before custom (non-catalog) line items existed.
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS custom_name text;
-- Additive: repoint an earlier run's FKs — `product_id` referenced the
-- now-dropped `products` table, and `sale_id` had no ON DELETE behavior
-- (voiding a sale relied on cascade + the stock-restore trigger below).
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.store_products(id) ON DELETE SET NULL;
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items(sale_id);

-- Voiding a sale (deleting its row) cascades to its sale_items; restore the
-- stock/ingredients that sale consumed as each item row disappears.
CREATE OR REPLACE FUNCTION public.restore_stock_on_sale_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.product_id IS NULL THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM public.recipes WHERE product_id = OLD.product_id) THEN
    UPDATE public.ingredients i
    SET current_stock = i.current_stock + (r.quantity_used * OLD.quantity)
    FROM public.recipes r
    WHERE r.ingredient_id = i.id AND r.product_id = OLD.product_id;
  ELSE
    -- Mirrors process_sale()'s own decrement condition exactly
    -- (`p.track_stock AND NOT EXISTS(recipes)`, checked above) — an
    -- untracked service (track_stock = false, see
    -- store_products.track_stock) was never decremented at sale time, so
    -- voiding its sale must not add quantity back onto its stock column
    -- either. Without this check a voided service sale would leave a
    -- phantom nonzero stock value on a product that's supposed to always
    -- read as 0/unused.
    UPDATE public.store_products
    SET stock = stock + OLD.quantity
    WHERE id = OLD.product_id
      AND track_stock;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_sale_item_delete ON public.sale_items;
CREATE TRIGGER trg_restore_stock_on_sale_item_delete
  AFTER DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_sale_item_delete();

-- =============================================================================
-- SECTION 6 — ONLINE MARKETPLACE ORDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'awaiting_confirmation': the business set this directly to open the
  -- customer's confirmation window — see SECTION 11 for why that alone
  -- never finalizes anything, and why the business can't then reverse it.
  -- 'disputed': the customer rejected that claim, or reported a 'cancelled'
  -- order they actually received (see report_cancelled_order() in SECTION
  -- 13) — either way it's routed to super_admin.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'awaiting_confirmation', 'completed', 'disputed', 'cancelled')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  shipping_name text,
  shipping_phone text,
  -- 'pickup' orders carry no address at all — the customer collects
  -- in person, so place_order() below only requires this for 'delivery'.
  fulfillment_method text NOT NULL DEFAULT 'delivery' CHECK (fulfillment_method IN ('delivery', 'pickup')),
  shipping_address text,
  -- Optional: set only when the customer confirmed their drop-off pin on
  -- the checkout map (see MapLocationPicker on the app side, which geocodes
  -- via OpenStreetMap/Nominatim — no Google Maps billing involved). Never
  -- required — shipping_address alone is always enough to fulfill a
  -- delivery order.
  shipping_lat numeric(9,6),
  shipping_lng numeric(9,6),
  notes text,
  -- Stamped automatically (trg_stamp_awaiting_confirmation, SECTION 11) the
  -- moment status first becomes 'awaiting_confirmation'; auto_confirm_stale_orders()
  -- uses it to finalize the order on its own once order_confirmation_window()
  -- has passed with no customer response.
  awaiting_confirmation_at timestamptz,
  -- Filled in by dispute_order_completion() or report_cancelled_order() —
  -- the customer's own account of what went wrong, shown to super_admin
  -- when resolving the dispute. disputed_from_cancellation (SECTION 13)
  -- tells the two cases apart.
  dispute_reason text,
  -- Required (see trg_enforce_order_status_rules, SECTION 11) whenever a
  -- business cancels an order directly — shown to the customer so a silent
  -- cancel-but-deliver-anyway at least leaves a visible discrepancy. Left
  -- NULL for a super_admin force-refund via admin_resolve_order(), which
  -- bypasses this requirement.
  cancellation_reason text,
  -- true when this order's 'disputed' status came from a customer
  -- reporting a 'cancelled' order they actually received (SECTION 13),
  -- rather than from the normal dispute_order_completion() path. Powers
  -- the per-business repeat-report signal in business_cancellation_reports.
  disputed_from_cancellation boolean NOT NULL DEFAULT false,
  -- Snapshotted onto the order (not just computed on the fly) at the same
  -- moment the order is finalized as 'completed' — see
  -- sync_order_finalization() in SECTION 11 — so a later change to
  -- platform_fee_rate() never retroactively rewrites what an already-settled
  -- order actually owed.
  platform_fee_rate numeric(5,2),
  platform_fee_amount numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_orders_business_id_idx ON public.store_orders(business_id);
CREATE INDEX IF NOT EXISTS store_orders_customer_id_idx ON public.store_orders(customer_id);

-- Upgrade path for a database that already ran an earlier version of this
-- file (CREATE TABLE IF NOT EXISTS above is a no-op against it): add the new
-- columns and widen the status check constraint to match. Both statements
-- are safe to re-run.
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS awaiting_confirmation_at timestamptz;
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS platform_fee_rate numeric(5,2);
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS platform_fee_amount numeric(10,2);
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery';
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS shipping_lat numeric(9,6);
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS shipping_lng numeric(9,6);
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS disputed_from_cancellation boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_orders DROP CONSTRAINT IF EXISTS store_orders_fulfillment_method_check;
ALTER TABLE public.store_orders ADD CONSTRAINT store_orders_fulfillment_method_check
  CHECK (fulfillment_method IN ('delivery', 'pickup'));
ALTER TABLE public.store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check;
ALTER TABLE public.store_orders ADD CONSTRAINT store_orders_status_check
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'awaiting_confirmation', 'completed', 'disputed', 'cancelled'));

DROP TRIGGER IF EXISTS trg_store_orders_updated_at ON public.store_orders;
CREATE TRIGGER trg_store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id bigint REFERENCES public.store_products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal numeric(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS store_order_items_order_id_idx ON public.store_order_items(order_id);

-- ---- public read view for the marketplace feed ----
-- CREATE OR REPLACE (not DROP + CREATE) so re-running this block against an
-- already-deployed database is enough to push a logic change live — no
-- manual DROP step, no risk of leaving the view missing if something after
-- the DROP fails. This matters in practice: this project has no migration
-- runner, so `database_schema.sql` only ever takes effect on Supabase when
-- someone pastes it into the SQL editor and runs it by hand.
--
-- Deliberately NOT security_invoker — `ingredients` and `recipes` are
-- locked down to their owning business only (see "ingredients_owner_all" /
-- "recipes_owner_all" below: USING (... b.owner_id = auth.uid() ...)), so a
-- shopper has zero row-level access to either table. Under
-- security_invoker, the recipe_stock LATERAL join below would run with the
-- *querying shopper's* RLS permissions, see zero ingredient/recipe rows,
-- and always compute recipe_stock.available = NULL — silently falling back
-- to sp.stock, which is hardcoded to 0 for any recipe-based dish (see the
-- comment on the `stock` column below). That reads as every restaurant
-- dish being permanently out of stock to every customer, no matter how
-- well-stocked its ingredients actually are, while the owner's own admin
-- session (which does have RLS access to its own ingredients/recipes)
-- shows the correct count — exactly the split symptom this view exists to
-- avoid. Running the view as its owner (the default — no security_invoker)
-- is the standard, safe pattern for exposing a computed aggregate through a
-- view over RLS-protected tables: the SELECT list below never surfaces raw
-- ingredient names, costs, or recipe rows, only the final integer. Set
-- explicitly to false (not just omitted) since CREATE OR REPLACE VIEW isn't
-- guaranteed to reset an option a previously-deployed view already had set
-- to true — re-running this block must actually flip it, not leave it stuck.
CREATE OR REPLACE VIEW public.marketplace_products
WITH (security_invoker = false) AS
SELECT
  sp.id,
  sp.name,
  sp.slug,
  sp.description,
  sp.image_url,
  sp.price,
  -- A recipe-based product's own `stock` column is hardcoded to 0 by
  -- convention (see saveProductAction in app/sell/products/actions.ts) —
  -- its real sellable count is derived live from ingredient supply instead,
  -- the same computation place_order()/process_sale()/POS/the seller's own
  -- Products page all already use. Without this, every recipe-based dish
  -- (any restaurant menu item with a recipe attached) would read as
  -- permanently out of stock to shoppers — and have Add to Cart/Buy Now
  -- disabled on its product page — even with fully stocked ingredients.
  -- recipe_stock.available is NULL for a product with no recipe rows
  -- (aggregates over zero rows), so COALESCE leaves standalone/retail/
  -- service products exactly as before.
  COALESCE(recipe_stock.available, sp.stock) AS stock,
  sp.track_stock,
  sp.category_id,
  c.name AS category_name,
  c.slug AS category_slug,
  sp.business_id,
  b.name AS business_name,
  b.slug AS business_slug,
  b.logo_url AS business_logo_url,
  -- Powers the "browse by type" section on the marketplace home page — see
  -- lib/business/type-meta.ts on the app side for what each value means.
  b.business_type,
  sp.created_at
FROM public.store_products sp
JOIN public.businesses b ON b.id = sp.business_id AND b.status = 'approved'
LEFT JOIN public.categories c ON c.id = sp.category_id
LEFT JOIN LATERAL (
  SELECT FLOOR(MIN(
    CASE WHEN r.quantity_used > 0 THEN i.current_stock / r.quantity_used ELSE 0 END
  ))::integer AS available
  FROM public.recipes r
  JOIN public.ingredients i ON i.id = r.ingredient_id
  WHERE r.product_id = sp.id
) recipe_stock ON true
WHERE sp.is_active = true;

GRANT SELECT ON public.marketplace_products TO anon, authenticated;

-- =============================================================================
-- SECTION 7 — RPCs (all privilege-sensitive writes go through these)
-- =============================================================================

-- A logged-in customer registers a storefront. Flips their own role to
-- business_admin and creates a `pending` business in one atomic step.
-- Signature gained p_business_type (a required choice on the registration
-- form — see RegisterBusinessForm) after the original 3-arg version below,
-- so the old overload is dropped explicitly instead of just CREATE OR
-- REPLACE-d: a different argument list makes Postgres treat it as a
-- separate overload rather than a replacement, and this file needs to stay
-- safe to re-run against a database that already has the 3-arg version.
DROP FUNCTION IF EXISTS public.register_business(text, text, text);

CREATE OR REPLACE FUNCTION public.register_business(
  p_name text,
  p_slug text,
  p_description text DEFAULT NULL,
  p_business_type text DEFAULT 'retail'
)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_business public.businesses;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_role = 'super_admin' THEN
    RAISE EXCEPTION 'Super admins cannot register a storefront';
  END IF;

  IF EXISTS (SELECT 1 FROM public.businesses WHERE owner_id = v_uid) THEN
    RAISE EXCEPTION 'You already have a registered business';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF p_business_type NOT IN ('restaurant', 'services', 'retail') THEN
    RAISE EXCEPTION 'Invalid business type: %', p_business_type;
  END IF;

  UPDATE public.profiles SET role = 'business_admin' WHERE id = v_uid;

  INSERT INTO public.businesses (owner_id, name, slug, description, status, business_type)
  VALUES (v_uid, trim(p_name), p_slug, p_description, 'pending', p_business_type)
  RETURNING * INTO v_business;

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_business(text, text, text, text) TO authenticated;

-- A super_admin approves or rejects a pending business.
CREATE OR REPLACE FUNCTION public.set_business_status(p_business_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business public.businesses;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can review business applications';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.businesses
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END
  WHERE id = p_business_id
  RETURNING * INTO v_business;

  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_business_status(uuid, text, text) TO authenticated;

-- A super_admin corrects a business's type after registration (see
-- protect_business_type() above — an owner cannot do this themselves once
-- registered). Reconciles every existing store_products row's track_stock
-- to match the new type (see lib/business/type-meta.ts's tracksStock),
-- since that flag is what POS/checkout actually key off of and would
-- otherwise silently disagree with the business's new type. A row moved
-- into a type that doesn't track stock also has its stock zeroed, matching
-- what saveProductAction() already does for every new/edited row on such a
-- business. Pre-existing ingredients/recipes rows are left untouched either
-- way — they just become inert (hidden from nav) rather than deleted, so a
-- mis-set type can be corrected again without losing data.
CREATE OR REPLACE FUNCTION public.set_business_type(p_business_id uuid, p_business_type text)
RETURNS public.businesses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business public.businesses;
  v_tracks_stock boolean;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can change a business''s type';
  END IF;

  IF p_business_type NOT IN ('restaurant', 'services', 'retail') THEN
    RAISE EXCEPTION 'Invalid business type: %', p_business_type;
  END IF;

  -- Mirrors BUSINESS_TYPE_META[type].tracksStock in lib/business/type-meta.ts.
  v_tracks_stock := p_business_type <> 'services';

  UPDATE public.businesses
  SET business_type = p_business_type
  WHERE id = p_business_id
  RETURNING * INTO v_business;

  IF v_business IS NULL THEN
    RAISE EXCEPTION 'Business not found';
  END IF;

  UPDATE public.store_products
  SET track_stock = v_tracks_stock,
      stock = CASE WHEN v_tracks_stock THEN stock ELSE 0 END
  WHERE business_id = p_business_id
    AND track_stock IS DISTINCT FROM v_tracks_stock;

  RETURN v_business;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_business_type(uuid, text) TO authenticated;

-- A customer checks out on the marketplace. Splits the cart by business
-- (one order per shop), validates stock/availability, and decrements stock
-- — all in one transaction so a half-placed multi-vendor order can't happen.
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_notes text DEFAULT NULL
)
RETURNS SETOF public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_order_ids uuid[] := '{}';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  CREATE TEMPORARY TABLE _cart_items (
    product_id bigint,
    quantity integer
  ) ON COMMIT DROP;

  INSERT INTO _cart_items (product_id, quantity)
  SELECT (elem->>'product_id')::bigint, (elem->>'quantity')::integer
  FROM jsonb_array_elements(p_items) AS elem;

  IF EXISTS (SELECT 1 FROM _cart_items WHERE quantity <= 0 OR product_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid quantity in cart';
  END IF;

  -- Lock the rows we're about to sell against concurrent checkouts.
  PERFORM 1 FROM public.store_products p
    JOIN _cart_items c ON c.product_id = p.id
    FOR UPDATE OF p;

  PERFORM 1 FROM public.ingredients i
    JOIN public.recipes r ON r.ingredient_id = i.id
    JOIN _cart_items c ON c.product_id = r.product_id
    FOR UPDATE OF i;

  -- Standalone products are checked against their own stock. Recipe-based
  -- products are skipped here — their `stock` column is always kept at 0 by
  -- convention, so checking it directly would reject every recipe-based order.
  -- Untracked rows (services — see store_products.track_stock) skip this
  -- check entirely: there's no finite count to run out of.
  IF EXISTS (
    SELECT 1
    FROM _cart_items c
    LEFT JOIN public.store_products p ON p.id = c.product_id
    LEFT JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id IS NULL
       OR p.is_active = false
       OR b.status <> 'approved'
       OR (p.track_stock AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id) AND p.stock < c.quantity)
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  -- Recipe-based products are checked against ingredient supply instead,
  -- aggregated per ingredient (see process_sale() for why this can't be
  -- checked per-product independently).
  IF EXISTS (
    SELECT r.ingredient_id
    FROM _cart_items c
    JOIN public.recipes r ON r.product_id = c.product_id
    JOIN public.ingredients i ON i.id = r.ingredient_id
    GROUP BY r.ingredient_id, i.current_stock
    HAVING SUM(r.quantity_used * c.quantity) > i.current_stock
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  FOR v_business_id IN
    SELECT DISTINCT p.business_id
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
  LOOP
    SELECT COALESCE(SUM(c.quantity * p.price), 0)
      INTO v_subtotal
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id
      WHERE p.business_id = v_business_id;

    INSERT INTO public.store_orders (business_id, customer_id, status, subtotal, total, shipping_name, shipping_phone, shipping_address, notes)
    VALUES (v_business_id, v_uid, 'pending', v_subtotal, v_subtotal, p_shipping_name, p_shipping_phone, p_shipping_address, p_notes)
    RETURNING id INTO v_order_id;

    INSERT INTO public.store_order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    SELECT v_order_id, p.id, p.name, c.quantity, p.price, c.quantity * p.price
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
    WHERE p.business_id = v_business_id;

    UPDATE public.store_products p
    SET stock = p.stock - c.quantity
    FROM _cart_items c
    WHERE p.id = c.product_id
      AND p.business_id = v_business_id
      AND p.track_stock
      AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id);

    UPDATE public.ingredients i
    SET current_stock = i.current_stock - agg.total_used
    FROM (
      SELECT r.ingredient_id, SUM(r.quantity_used * c.quantity) AS total_used
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id AND p.business_id = v_business_id
      JOIN public.recipes r ON r.product_id = c.product_id
      GROUP BY r.ingredient_id
    ) agg
    WHERE i.id = agg.ingredient_id;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN QUERY SELECT * FROM public.store_orders WHERE id = ANY(v_order_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text) TO authenticated;

-- A business owner rings up an in-person POS sale for their own business.
-- Business is derived from the caller (owner-only model — no per-business
-- staff accounts yet), never trusted from the client. Recipe-based products
-- decrement their ingredients; standalone products decrement their own
-- stock directly.
--
-- Each line in p_items is either a catalog line (product_id set — the
-- ordinary case for every business type) or an ad-hoc "custom item" line
-- (product_id NULL, custom_name + custom_price required) for made-to-order
-- work that was never worth adding to the catalog — a print shop's one-off
-- oddly-sized job is the motivating case, but any business type can use it.
-- A custom line skips every stock/ingredient check below (there's no catalog
-- entry to check against) and costs exactly custom_cost per unit (0 if
-- omitted, i.e. pure margin) instead of a recipe or cost_price lookup.
CREATE OR REPLACE FUNCTION public.process_sale(p_total numeric, p_payment numeric, p_change numeric, p_items jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_sale_id bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_business_id FROM public.businesses WHERE owner_id = v_uid AND status = 'approved';
  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'No approved business found for this account';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  CREATE TEMPORARY TABLE _sale_items (
    product_id bigint,
    quantity integer,
    price numeric(10,2),
    subtotal numeric(10,2),
    custom_name text,
    custom_cost numeric(10,2)
  ) ON COMMIT DROP;

  INSERT INTO _sale_items (product_id, quantity, price, subtotal, custom_name, custom_cost)
  SELECT
    (elem->>'product_id')::bigint,
    (elem->>'quantity')::integer,
    (elem->>'price')::numeric,
    (elem->>'subtotal')::numeric,
    NULLIF(elem->>'custom_name', ''),
    COALESCE((elem->>'custom_cost')::numeric, 0)
  FROM jsonb_array_elements(p_items) AS elem;

  IF EXISTS (SELECT 1 FROM _sale_items WHERE quantity <= 0 OR (product_id IS NULL AND custom_name IS NULL)) THEN
    RAISE EXCEPTION 'Invalid quantity or missing item details in cart';
  END IF;

  -- The client already refuses to open a negative price/cost into the cart,
  -- but that's only a UI courtesy — nothing stops a direct RPC call with a
  -- crafted p_items. A negative custom price/cost has no legitimate use (a
  -- discount belongs in price, not below zero) and would otherwise let an
  -- owner quietly deflate reported revenue or inflate reported profit in
  -- their own books, so it's rejected here regardless of who calls this.
  IF EXISTS (SELECT 1 FROM _sale_items WHERE product_id IS NULL AND (price < 0 OR custom_cost < 0)) THEN
    RAISE EXCEPTION 'Custom item price and cost cannot be negative';
  END IF;

  PERFORM 1 FROM public.store_products p
    JOIN _sale_items c ON c.product_id = p.id
    WHERE p.business_id = v_business_id
    FOR UPDATE OF p;

  PERFORM 1 FROM public.ingredients i
    JOIN public.recipes r ON r.ingredient_id = i.id
    JOIN _sale_items c ON c.product_id = r.product_id
    FOR UPDATE OF i;

  -- Standalone products are checked against their own stock. Recipe-based
  -- products are skipped here — their `stock` column is always kept at 0
  -- by convention (the client hardcodes it when a recipe is attached), so
  -- checking it directly would reject every recipe-based sale. Ad-hoc
  -- custom lines (product_id IS NULL) skip this check entirely — there's no
  -- catalog stock to check. Untracked rows (services — see
  -- store_products.track_stock) skip it too: there's no finite count to run
  -- out of, e.g. a "Photocopy" or "Battery replacement" service.
  IF EXISTS (
    SELECT 1 FROM _sale_items c
    LEFT JOIN public.store_products p ON p.id = c.product_id AND p.business_id = v_business_id
    WHERE c.product_id IS NOT NULL
      AND (p.id IS NULL
       OR (p.track_stock AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id) AND p.stock < c.quantity))
  ) THEN
    RAISE EXCEPTION 'One or more items are unavailable in the requested quantity';
  END IF;

  -- Recipe-based products are checked against ingredient supply instead,
  -- aggregated per ingredient — two different products in the same sale
  -- that both consume the same ingredient must be checked against their
  -- combined total, not independently. Custom lines never join a recipe
  -- (product_id NULL), so they're naturally excluded here already.
  IF EXISTS (
    SELECT r.ingredient_id
    FROM _sale_items c
    JOIN public.recipes r ON r.product_id = c.product_id
    JOIN public.ingredients i ON i.id = r.ingredient_id
    GROUP BY r.ingredient_id, i.current_stock
    HAVING SUM(r.quantity_used * c.quantity) > i.current_stock
  ) THEN
    RAISE EXCEPTION 'Not enough ingredient stock for one or more recipe-based items';
  END IF;

  INSERT INTO public.sales (business_id, total, payment, change, created_by)
  VALUES (v_business_id, p_total, p_payment, p_change, v_uid)
  RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (sale_id, product_id, quantity, selling_price, computed_cogs, custom_name)
  SELECT
    v_sale_id,
    c.product_id,
    c.quantity,
    c.price,
    CASE
      -- A custom line has no store_products/recipes row to look up (and
      -- COALESCE-ing two NULL subqueries would otherwise insert a NULL into
      -- a NOT NULL column) — its cost is exactly what was entered for it.
      WHEN c.product_id IS NULL THEN c.custom_cost * c.quantity
      ELSE COALESCE(
        (SELECT SUM(r.quantity_used * i.cost_per_unit)
           FROM public.recipes r JOIN public.ingredients i ON i.id = r.ingredient_id
           WHERE r.product_id = c.product_id),
        (SELECT cost_price FROM public.store_products WHERE id = c.product_id)
      ) * c.quantity
    END,
    c.custom_name
  FROM _sale_items c;

  -- Standalone products decrement their own stock directly (a custom line's
  -- NULL product_id never matches here, so it's naturally skipped; an
  -- untracked service is excluded by the track_stock check so its stock
  -- column — always 0 by default — never goes negative)...
  UPDATE public.store_products p
  SET stock = p.stock - c.quantity
  FROM _sale_items c
  WHERE p.id = c.product_id
    AND p.business_id = v_business_id
    AND p.track_stock
    AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id);

  -- ...recipe-based products decrement the combined ingredient totals they
  -- consumed. Pre-aggregated by ingredient first: a plain UPDATE ... FROM
  -- with multiple matching source rows (e.g. two cart items sharing an
  -- ingredient) only applies one arbitrary match per target row, not the
  -- sum of all of them.
  UPDATE public.ingredients i
  SET current_stock = i.current_stock - agg.total_used
  FROM (
    SELECT r.ingredient_id, SUM(r.quantity_used * c.quantity) AS total_used
    FROM _sale_items c
    JOIN public.recipes r ON r.product_id = c.product_id
    GROUP BY r.ingredient_id
  ) agg
  WHERE i.id = agg.ingredient_id;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(numeric, numeric, numeric, jsonb) TO authenticated;

-- Lets a user set their own POS void-confirmation PIN. Deliberately narrow
-- (touches only manager_pin) instead of a general "update own profile" RLS
-- policy, which would have no way to stop a user also rewriting their own
-- `role` column to something like 'super_admin'.
CREATE OR REPLACE FUNCTION public.update_manager_pin(p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  UPDATE public.profiles SET manager_pin = p_pin WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_manager_pin(text) TO authenticated;

-- New auth.users get a profiles row automatically, defaulting to 'customer'.
-- Safe to keep even if your Supabase project already has an equivalent
-- trigger — ON CONFLICT DO NOTHING makes this a no-op in that case.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- SECTION 8 — ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.current_user_role() = 'super_admin');

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "categories_write_super_admin" ON public.categories;
CREATE POLICY "categories_write_super_admin" ON public.categories FOR ALL
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');
DROP POLICY IF EXISTS "categories_insert_business_admin" ON public.categories;
CREATE POLICY "categories_insert_business_admin" ON public.categories FOR INSERT
  WITH CHECK (public.current_user_role() = 'business_admin');

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_select_public_or_own" ON public.businesses;
CREATE POLICY "businesses_select_public_or_own" ON public.businesses FOR SELECT
  USING (
    status = 'approved'
    OR owner_id = auth.uid()
    OR public.current_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "businesses_update_own_or_super_admin" ON public.businesses;
CREATE POLICY "businesses_update_own_or_super_admin" ON public.businesses FOR UPDATE
  USING (owner_id = auth.uid() OR public.current_user_role() = 'super_admin')
  WITH CHECK (owner_id = auth.uid() OR public.current_user_role() = 'super_admin');
-- Row creation/status transitions happen only via register_business() /
-- set_business_status() (SECURITY DEFINER), so there is no direct INSERT policy.

-- ---- store_products: publicly visible when active + approved, always visible/writable by its owner ----
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_products_select_public_or_own" ON public.store_products;
CREATE POLICY "store_products_select_public_or_own" ON public.store_products FOR SELECT
  USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = store_products.business_id AND b.status = 'approved'
    ))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = store_products.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "store_products_write_owner" ON public.store_products;
CREATE POLICY "store_products_write_owner" ON public.store_products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = store_products.business_id AND b.owner_id = auth.uid() AND b.status = 'approved'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = store_products.business_id AND b.owner_id = auth.uid() AND b.status = 'approved'
  ));

-- ---- everything below is private, owner-only back-office data (no public branch) ----

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ingredients_owner_all" ON public.ingredients;
CREATE POLICY "ingredients_owner_all" ON public.ingredients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = ingredients.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = ingredients.business_id AND b.owner_id = auth.uid() AND b.status = 'approved')
    OR public.current_user_role() = 'super_admin');

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_owner_all" ON public.recipes;
CREATE POLICY "recipes_owner_all" ON public.recipes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.store_products p JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id = recipes.product_id AND (b.owner_id = auth.uid() OR public.current_user_role() = 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.store_products p JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id = recipes.product_id AND ((b.owner_id = auth.uid() AND b.status = 'approved') OR public.current_user_role() = 'super_admin')
  ));

ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventory_logs_owner_all" ON public.inventory_logs;
CREATE POLICY "inventory_logs_owner_all" ON public.inventory_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = inventory_logs.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = inventory_logs.business_id AND b.owner_id = auth.uid() AND b.status = 'approved')
    OR public.current_user_role() = 'super_admin');

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operating_expenses_owner_all" ON public.operating_expenses;
CREATE POLICY "operating_expenses_owner_all" ON public.operating_expenses FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = operating_expenses.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = operating_expenses.business_id AND b.owner_id = auth.uid() AND b.status = 'approved')
    OR public.current_user_role() = 'super_admin');

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_owner_all" ON public.sales;
CREATE POLICY "sales_owner_all" ON public.sales FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = sales.business_id AND b.owner_id = auth.uid() AND b.status = 'approved')
    OR public.current_user_role() = 'super_admin');
-- In practice sales/sale_items are written only via process_sale() (SECURITY
-- DEFINER); this policy mainly governs SELECT (sales history) and DELETE
-- (voiding a transaction), which the app does perform directly.

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sale_items_owner_all" ON public.sale_items;
CREATE POLICY "sale_items_owner_all" ON public.sale_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sales s JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = sale_items.sale_id AND (b.owner_id = auth.uid() OR public.current_user_role() = 'super_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = sale_items.sale_id AND ((b.owner_id = auth.uid() AND b.status = 'approved') OR public.current_user_role() = 'super_admin')
  ));

-- ---- online marketplace orders ----
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_orders_select_participant" ON public.store_orders;
CREATE POLICY "store_orders_select_participant" ON public.store_orders FOR SELECT
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = store_orders.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );

-- A business owner may move an order through its own pre-confirmation
-- states directly, including into 'awaiting_confirmation' — opening the
-- customer's confirmation window is just another direct status change now
-- (see SECTION 11), not a separate RPC. 'completed' and 'disputed' stay
-- excluded from this policy's WITH CHECK on purpose — those only ever
-- happen through confirm_order_completion() / dispute_order_completion() /
-- admin_resolve_order() (SECURITY DEFINER, see SECTION 11), so a business
-- can never unilaterally mark its own order 'completed' by any path, not
-- just the ones the UI happens to expose. And once a row actually reaches
-- 'awaiting_confirmation', this policy alone can't stop a business from
-- targeting it again afterward (e.g. straight to 'cancelled') — that part
-- is enforced by the trg_enforce_order_status_rules trigger in SECTION 11,
-- which this policy has no way to express on its own.
DROP POLICY IF EXISTS "store_orders_update_business_owner" ON public.store_orders;
CREATE POLICY "store_orders_update_business_owner" ON public.store_orders FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = store_orders.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = store_orders.business_id AND b.owner_id = auth.uid())
    AND status IN ('pending', 'paid', 'processing', 'shipped', 'awaiting_confirmation', 'cancelled')
  );
-- No direct INSERT policy: orders are only created via place_order() (SECURITY DEFINER),
-- which keeps stock decrements and multi-vendor order splitting atomic.

ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_order_items_select_participant" ON public.store_order_items;
CREATE POLICY "store_order_items_select_participant" ON public.store_order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.store_orders o
    WHERE o.id = store_order_items.order_id
      AND (
        o.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = o.business_id AND b.owner_id = auth.uid())
        OR public.current_user_role() = 'super_admin'
      )
  ));

-- =============================================================================
-- SECTION 9 — MIGRATING FROM THE OLDER (SINGLE-TENANT) VERSION OF THIS SCHEMA
-- Only relevant if you previously ran a version of this file that created a
-- standalone `products` table. There's no production data to preserve
-- (a clean-rebuild call made earlier in this project), so it's just dropped;
-- `store_products` is the only product table now.
--
-- The `ALTER TABLE ... ADD COLUMN IF NOT EXISTS business_id` statements
-- above (ingredients, inventory_logs, operating_expenses, sales) are
-- nullable on purpose, so they don't fail against a table that already has
-- rows. If you're upgrading a database that already has rows in those
-- tables, backfill business_id on each of them, then run:
--   ALTER TABLE public.ingredients ALTER COLUMN business_id SET NOT NULL;
--   ALTER TABLE public.inventory_logs ALTER COLUMN business_id SET NOT NULL;
--   ALTER TABLE public.operating_expenses ALTER COLUMN business_id SET NOT NULL;
--   ALTER TABLE public.sales ALTER COLUMN business_id SET NOT NULL;
-- On a fresh database (the expected case here) every one of these tables is
-- created empty with business_id NOT NULL already, and this whole section
-- is a no-op.
-- =============================================================================

DROP TABLE IF EXISTS public.products CASCADE;

-- =============================================================================
-- SECTION 10 — AFFILIATE PROGRAM
-- A separate role ('affiliate') for promoters who are neither shoppers nor
-- shop owners. Mirrors the businesses apply -> pending -> super_admin
-- approval flow exactly. Commission rates are per-business (each shop owner
-- opts in via `business_affiliate_settings` and sets their own rate), not a
-- single platform-wide rate.
-- =============================================================================

-- 'affiliate' is already part of profiles_role_check — see Section 1, the
-- single source of truth for that constraint (and the row-sanitizing update
-- that keeps re-running it safe).

-- ---- affiliates (one application/profile per promoter) ----
CREATE TABLE IF NOT EXISTS public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  code text NOT NULL UNIQUE,
  payout_method text,
  payout_details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliates_status_idx ON public.affiliates(status);
CREATE INDEX IF NOT EXISTS affiliates_code_idx ON public.affiliates(code);

DROP TRIGGER IF EXISTS trg_affiliates_updated_at ON public.affiliates;
CREATE TRIGGER trg_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only a super_admin may change `status`, same defense-in-depth as
-- protect_business_status() above.
CREATE OR REPLACE FUNCTION public.protect_affiliate_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can change an affiliate status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_affiliate_status ON public.affiliates;
CREATE TRIGGER trg_protect_affiliate_status
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.protect_affiliate_status();

-- ---- business_affiliate_settings (each shop opts in and sets its own rate) ----
CREATE TABLE IF NOT EXISTS public.business_affiliate_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  commission_rate numeric(5,2) NOT NULL DEFAULT 5.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_business_affiliate_settings_updated_at ON public.business_affiliate_settings;
CREATE TRIGGER trg_business_affiliate_settings_updated_at
  BEFORE UPDATE ON public.business_affiliate_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- affiliate_clicks (referral-link visits, for the affiliate's own stats) ----
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_clicks_affiliate_id_idx ON public.affiliate_clicks(affiliate_id);

-- ---- affiliate_payouts (created before affiliate_commissions, which references it) ----
-- This app has no payment gateway and never has (see platform_fee_rate()
-- above) — every sale is cash, so the cash for a commission only ever sits
-- with the business whose sale earned it. A payout is therefore scoped to
-- ONE business, not lumped across every shop an affiliate has referred
-- sales to: request_affiliate_payout() below splits an affiliate's payable
-- balance into one payout row per business, and it's that business's own
-- owner — not a platform admin holding no one's cash — who marks it paid
-- once they've actually handed the cash over (see
-- set_affiliate_payout_status()). business_id is nullable only so this
-- ALTER stays additive against any payout rows a pre-split install already
-- has on disk; every row request_affiliate_payout() creates from here on
-- always sets it.
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  notes text
);
ALTER TABLE public.affiliate_payouts ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS affiliate_payouts_affiliate_id_idx ON public.affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_payouts_business_id_idx ON public.affiliate_payouts(business_id);

-- ---- affiliate_commissions (one row per referring affiliate per order, lifecycle tracked via `status`) ----
-- pending (order just placed) -> approved (order marked completed) or void
-- (order cancelled) -> paid (once its payout is marked paid).
-- `referred_subtotal` is the subtotal of just the items that carried this
-- affiliate's code when they were added to the cart, not the whole order —
-- see place_order() below. `commission_rate` is applied against
-- `referred_profit` (that same referred slice's revenue minus its item
-- cost — recipe cost or cost_price, same basis as Analytics), not against
-- `referred_subtotal` — an affiliate earns a cut of what the business
-- actually made on the sale, not a cut of gross revenue.
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  referred_subtotal numeric(10,2) NOT NULL,
  referred_profit numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'void', 'paid')),
  payout_id uuid REFERENCES public.affiliate_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (affiliate_id, order_id)
);
-- Renamed from `order_subtotal`: CREATE TABLE IF NOT EXISTS is a no-op
-- against a table an earlier run of this file already created, so the
-- column rename above never reaches an existing database on its own —
-- do it explicitly, guarded so this stays safe to re-run either way.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliate_commissions' AND column_name = 'order_subtotal'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'affiliate_commissions' AND column_name = 'referred_subtotal'
  ) THEN
    ALTER TABLE public.affiliate_commissions RENAME COLUMN order_subtotal TO referred_subtotal;
  END IF;
END $$;
-- Additive, for installs from before commissions were computed on profit
-- instead of revenue — see place_order() below. Existing rows keep their
-- old (revenue-basis) commission_amount as-is; only new orders use the
-- profit basis, so this backfills the new column to 0 rather than trying
-- to reconstruct a profit figure for historical rows.
ALTER TABLE public.affiliate_commissions ADD COLUMN IF NOT EXISTS referred_profit numeric(10,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_id_idx ON public.affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_order_id_idx ON public.affiliate_commissions(order_id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_payout_id_idx ON public.affiliate_commissions(payout_id);

DROP TRIGGER IF EXISTS trg_affiliate_commissions_updated_at ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_updated_at
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- RPCs ----

-- A logged-in customer applies to become an affiliate. Flips their own role
-- to 'affiliate' and creates a `pending` affiliate profile with a unique
-- referral code, in one atomic step (mirrors register_business()). Only
-- plain customers may apply — a shop owner becoming an affiliate too would
-- open the door to self-referral (crediting themselves a commission on
-- their own shop's sales), and a profile has exactly one role at a time.
CREATE OR REPLACE FUNCTION public.register_affiliate(p_full_name text, p_payout_method text DEFAULT NULL, p_payout_details text DEFAULT NULL)
RETURNS public.affiliates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_code text;
  v_affiliate public.affiliates;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_role <> 'customer' THEN
    RAISE EXCEPTION 'Only customer accounts can apply to become an affiliate';
  END IF;

  IF p_full_name IS NULL OR length(trim(p_full_name)) = 0 THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliates WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already have an affiliate application';
  END IF;

  LOOP
    v_code := lower(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.affiliates WHERE code = v_code);
  END LOOP;

  UPDATE public.profiles SET role = 'affiliate' WHERE id = v_uid;

  INSERT INTO public.affiliates (user_id, full_name, code, payout_method, payout_details, status)
  VALUES (v_uid, trim(p_full_name), v_code, p_payout_method, p_payout_details, 'pending')
  RETURNING * INTO v_affiliate;

  RETURN v_affiliate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_affiliate(text, text, text) TO authenticated;

-- A super_admin approves or rejects a pending affiliate application.
CREATE OR REPLACE FUNCTION public.set_affiliate_status(p_affiliate_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)
RETURNS public.affiliates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate public.affiliates;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can review affiliate applications';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.affiliates
  SET status = p_status,
      rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END
  WHERE id = p_affiliate_id
  RETURNING * INTO v_affiliate;

  IF v_affiliate IS NULL THEN
    RAISE EXCEPTION 'Affiliate application not found';
  END IF;

  RETURN v_affiliate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_affiliate_status(uuid, text, text) TO authenticated;

-- Records a referral-link visit. Callable by anon (a visitor need not be
-- logged in to click a link) and authenticated alike. Silently no-ops on an
-- unknown/unapproved code instead of raising, so a stale or mistyped `?ref=`
-- never breaks the page it's attached to or leaks which codes are valid.
CREATE OR REPLACE FUNCTION public.track_affiliate_referral_click(p_code text, p_business_slug text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id uuid;
  v_business_id uuid;
BEGIN
  IF p_code IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_affiliate_id FROM public.affiliates WHERE code = lower(p_code) AND status = 'approved';
  IF v_affiliate_id IS NULL THEN
    RETURN;
  END IF;

  IF p_business_slug IS NOT NULL THEN
    SELECT id INTO v_business_id FROM public.businesses WHERE slug = p_business_slug AND status = 'approved';
  END IF;

  INSERT INTO public.affiliate_clicks (affiliate_id, business_id) VALUES (v_affiliate_id, v_business_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_affiliate_referral_click(text, text) TO anon, authenticated;

-- What an approved affiliate would earn on ONE unit of a given product,
-- right now — powers the "you'll earn ₱X" figure on the storefront product
-- page. SECURITY DEFINER because computing real profit needs `recipes` /
-- `ingredients` (owner-only RLS — see ingredients_owner_all /
-- recipes_owner_all above) and `store_products.cost_price`, none of which
-- an affiliate has row access to directly; this returns only the final
-- peso figure, never the underlying cost or recipe breakdown, so it can't
-- be used to back into a shop's margins.
-- Same profit basis as place_order()'s commission insert (recipe cost,
-- falling back to cost_price for a non-recipe product), same self-referral
-- guard is irrelevant here (this is a "what if" preview, not a real
-- credit), and the same GREATEST(profit, 0) floor — a below-cost item
-- shows ₱0.00, never a negative "earning".
-- Returns NULL (not 0) for a caller who isn't an approved affiliate, or
-- for a product that doesn't exist/isn't active — the storefront treats
-- NULL as "don't show this at all", distinct from a real ₱0.00 meaning
-- "you can share this, but this shop doesn't pay a commission on it".
CREATE OR REPLACE FUNCTION public.affiliate_product_commission(p_product_id bigint)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_affiliate boolean;
  v_business_id uuid;
  v_price numeric;
  v_cost_price numeric;
  v_recipe_cost numeric;
  v_commission_rate numeric;
  v_profit numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.affiliates a WHERE a.user_id = v_uid AND a.status = 'approved')
    INTO v_is_affiliate;
  IF NOT v_is_affiliate THEN
    RETURN NULL;
  END IF;

  SELECT p.business_id, p.price, p.cost_price
    INTO v_business_id, v_price, v_cost_price
    FROM public.store_products p
    WHERE p.id = p_product_id AND p.is_active = true;
  IF v_business_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Not enrolled in the affiliate program at all: shareable, but pays ₱0 —
  -- distinct from the NULL cases above, which mean "don't show a figure".
  SELECT commission_rate INTO v_commission_rate
    FROM public.business_affiliate_settings
    WHERE business_id = v_business_id AND enabled = true;
  IF v_commission_rate IS NULL THEN
    RETURN 0;
  END IF;

  SELECT SUM(r.quantity_used * i.cost_per_unit) INTO v_recipe_cost
    FROM public.recipes r JOIN public.ingredients i ON i.id = r.ingredient_id
    WHERE r.product_id = p_product_id;

  v_profit := v_price - COALESCE(v_recipe_cost, v_cost_price);

  RETURN round(GREATEST(v_profit, 0) * v_commission_rate / 100, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.affiliate_product_commission(bigint) TO authenticated;

-- An approved affiliate cashes out their payable balance. Every sale here
-- is cash (see affiliate_payouts above) — there's no pooled platform float
-- to pay OUT of, only whatever cash each referring business took in — so
-- this groups every 'approved', not-yet-paid-out commission BY business
-- and creates one payout row per business, not one lump sum. An affiliate
-- who referred sales to three shops gets three payout rows back from one
-- click, each collectible in person from that shop.
-- DROP first: this used to RETURN a single row before the per-business
-- split above, and Postgres refuses to CREATE OR REPLACE a function into a
-- different return type (SETOF vs. a bare row) — only a straight DROP lets
-- a database still on that earlier version pick up this change.
DROP FUNCTION IF EXISTS public.request_affiliate_payout();
CREATE OR REPLACE FUNCTION public.request_affiliate_payout()
RETURNS SETOF public.affiliate_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_affiliate_id uuid;
  v_business_id uuid;
  v_amount numeric(10,2);
  v_payout public.affiliate_payouts;
  v_any boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_affiliate_id FROM public.affiliates WHERE user_id = v_uid AND status = 'approved';
  IF v_affiliate_id IS NULL THEN
    RAISE EXCEPTION 'No approved affiliate account found';
  END IF;

  PERFORM 1 FROM public.affiliate_commissions
    WHERE affiliate_id = v_affiliate_id AND status = 'approved' AND payout_id IS NULL
    FOR UPDATE;

  FOR v_business_id, v_amount IN
    SELECT business_id, SUM(commission_amount)
    FROM public.affiliate_commissions
    WHERE affiliate_id = v_affiliate_id AND status = 'approved' AND payout_id IS NULL
    GROUP BY business_id
  LOOP
    CONTINUE WHEN v_amount <= 0;
    v_any := true;

    INSERT INTO public.affiliate_payouts (affiliate_id, business_id, amount, status)
    VALUES (v_affiliate_id, v_business_id, v_amount, 'requested')
    RETURNING * INTO v_payout;

    UPDATE public.affiliate_commissions
    SET payout_id = v_payout.id
    WHERE affiliate_id = v_affiliate_id AND business_id = v_business_id
      AND status = 'approved' AND payout_id IS NULL;

    RETURN NEXT v_payout;
  END LOOP;

  IF NOT v_any THEN
    RAISE EXCEPTION 'No payable commissions available to request';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_affiliate_payout() TO authenticated;

-- The business that owes a payout marks it paid once cash has actually
-- changed hands in person — or rejects it (e.g. a disputed referral) and
-- unlinks its commissions so they're requestable again later. A
-- super_admin can also step in for disputes, but the everyday actor here
-- is the shop itself: it's their cash, not the platform's (see
-- affiliate_payouts above). 'paid' flips the linked commissions to 'paid';
-- 'rejected' unlinks them back to 'approved'.
CREATE OR REPLACE FUNCTION public.set_affiliate_payout_status(p_payout_id uuid, p_status text)
RETURNS public.affiliate_payouts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payout public.affiliate_payouts;
  v_is_owner boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.affiliate_payouts p
    JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id = p_payout_id AND b.owner_id = v_uid
  ) INTO v_is_owner;

  IF NOT v_is_owner AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only the business that owes this payout (or a super admin) can review it';
  END IF;

  IF p_status NOT IN ('paid', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  UPDATE public.affiliate_payouts
  SET status = p_status,
      paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE NULL END
  WHERE id = p_payout_id AND status = 'requested'
  RETURNING * INTO v_payout;

  IF v_payout IS NULL THEN
    RAISE EXCEPTION 'Payout request not found or already resolved';
  END IF;

  IF p_status = 'paid' THEN
    UPDATE public.affiliate_commissions SET status = 'paid' WHERE payout_id = v_payout.id;
  ELSE
    UPDATE public.affiliate_commissions SET payout_id = NULL WHERE payout_id = v_payout.id;
  END IF;

  RETURN v_payout;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_affiliate_payout_status(uuid, text) TO authenticated;

-- Superseded by sync_order_finalization() in SECTION 11 below, which covers
-- the same two cases plus the platform-fee snapshot — dropped here so a
-- re-run of this file doesn't leave both triggers firing on the same table.
DROP TRIGGER IF EXISTS trg_sync_affiliate_commission_on_order_status ON public.store_orders;
DROP FUNCTION IF EXISTS public.sync_affiliate_commission_on_order_status();

-- Extend place_order()'s cart items with a per-line `ref_code`. Attribution
-- is per item, not per order: a commission only covers the items that
-- actually carried an affiliate's code at the moment they were added to the
-- cart (see the product page's Add to Cart/Buy Now handlers) — an item added
-- with no ref, or added before/after visiting a referral link without acting
-- on it, is never credited. This keeps the same 5-arg signature as the
-- original definition earlier in this file, so CREATE OR REPLACE below
-- truly replaces it rather than creating a parallel overload. The explicit
-- drop below only matters if an earlier revision of this file (with a
-- trailing p_ref_code text 6th param) was already applied to this database —
-- harmless no-op otherwise.
DROP FUNCTION IF EXISTS public.place_order(jsonb, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_notes text DEFAULT NULL
)
RETURNS SETOF public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_order_ids uuid[] := '{}';
  v_ref_code text;
  v_ref_affiliate_id uuid;
  v_ref_affiliate_user_id uuid;
  v_ref_commission_rate numeric(5,2);
  v_ref_business_owner uuid;
  v_ref_item_subtotal numeric(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  CREATE TEMPORARY TABLE _cart_items (
    product_id bigint,
    quantity integer,
    ref_code text
  ) ON COMMIT DROP;

  INSERT INTO _cart_items (product_id, quantity, ref_code)
  SELECT
    (elem->>'product_id')::bigint,
    (elem->>'quantity')::integer,
    NULLIF(lower(elem->>'ref_code'), '')
  FROM jsonb_array_elements(p_items) AS elem;

  IF EXISTS (SELECT 1 FROM _cart_items WHERE quantity <= 0 OR product_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid quantity in cart';
  END IF;

  -- Lock the rows we're about to sell against concurrent checkouts.
  PERFORM 1 FROM public.store_products p
    JOIN _cart_items c ON c.product_id = p.id
    FOR UPDATE OF p;

  PERFORM 1 FROM public.ingredients i
    JOIN public.recipes r ON r.ingredient_id = i.id
    JOIN _cart_items c ON c.product_id = r.product_id
    FOR UPDATE OF i;

  -- Standalone products are checked against their own stock. Recipe-based
  -- products are skipped here — their `stock` column is always kept at 0 by
  -- convention, so checking it directly would reject every recipe-based order.
  -- Untracked rows (services — see store_products.track_stock) skip this
  -- check entirely: there's no finite count to run out of.
  IF EXISTS (
    SELECT 1
    FROM _cart_items c
    LEFT JOIN public.store_products p ON p.id = c.product_id
    LEFT JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id IS NULL
       OR p.is_active = false
       OR b.status <> 'approved'
       OR (p.track_stock AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id) AND p.stock < c.quantity)
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  -- Recipe-based products are checked against ingredient supply instead,
  -- aggregated per ingredient (see process_sale() for why this can't be
  -- checked per-product independently).
  IF EXISTS (
    SELECT r.ingredient_id
    FROM _cart_items c
    JOIN public.recipes r ON r.product_id = c.product_id
    JOIN public.ingredients i ON i.id = r.ingredient_id
    GROUP BY r.ingredient_id, i.current_stock
    HAVING SUM(r.quantity_used * c.quantity) > i.current_stock
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  FOR v_business_id IN
    SELECT DISTINCT p.business_id
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
  LOOP
    SELECT COALESCE(SUM(c.quantity * p.price), 0)
      INTO v_subtotal
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id
      WHERE p.business_id = v_business_id;

    INSERT INTO public.store_orders (business_id, customer_id, status, subtotal, total, shipping_name, shipping_phone, shipping_address, notes)
    VALUES (v_business_id, v_uid, 'pending', v_subtotal, v_subtotal, p_shipping_name, p_shipping_phone, p_shipping_address, p_notes)
    RETURNING id INTO v_order_id;

    INSERT INTO public.store_order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    SELECT v_order_id, p.id, p.name, c.quantity, p.price, c.quantity * p.price
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
    WHERE p.business_id = v_business_id;

    UPDATE public.store_products p
    SET stock = p.stock - c.quantity
    FROM _cart_items c
    WHERE p.id = c.product_id
      AND p.business_id = v_business_id
      AND p.track_stock
      AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id);

    UPDATE public.ingredients i
    SET current_stock = i.current_stock - agg.total_used
    FROM (
      SELECT r.ingredient_id, SUM(r.quantity_used * c.quantity) AS total_used
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id AND p.business_id = v_business_id
      JOIN public.recipes r ON r.product_id = c.product_id
      GROUP BY r.ingredient_id
    ) agg
    WHERE i.id = agg.ingredient_id;

    -- Credit each distinct referring affiliate for just the items in this
    -- order that carried their code — never the whole order — unless the
    -- shop hasn't opted in or the affiliate is the shop's own owner
    -- (self-referral guard).
    FOR v_ref_code IN
      SELECT DISTINCT c.ref_code FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id
      WHERE p.business_id = v_business_id AND c.ref_code IS NOT NULL
    LOOP
      v_ref_affiliate_id := NULL;
      v_ref_commission_rate := NULL;

      SELECT id, user_id INTO v_ref_affiliate_id, v_ref_affiliate_user_id
        FROM public.affiliates WHERE code = v_ref_code AND status = 'approved';

      CONTINUE WHEN v_ref_affiliate_id IS NULL;

      SELECT owner_id INTO v_ref_business_owner FROM public.businesses WHERE id = v_business_id;

      SELECT commission_rate INTO v_ref_commission_rate
        FROM public.business_affiliate_settings
        WHERE business_id = v_business_id AND enabled = true;

      CONTINUE WHEN v_ref_commission_rate IS NULL OR v_ref_affiliate_user_id IS NOT DISTINCT FROM v_ref_business_owner;

      SELECT COALESCE(SUM(c.quantity * p.price), 0) INTO v_ref_item_subtotal
        FROM _cart_items c
        JOIN public.store_products p ON p.id = c.product_id
        WHERE p.business_id = v_business_id AND c.ref_code = v_ref_code;

      INSERT INTO public.affiliate_commissions (affiliate_id, order_id, business_id, referred_subtotal, commission_rate, commission_amount, status)
      VALUES (v_ref_affiliate_id, v_order_id, v_business_id, v_ref_item_subtotal, v_ref_commission_rate, round(v_ref_item_subtotal * v_ref_commission_rate / 100, 2), 'pending')
      ON CONFLICT (affiliate_id, order_id) DO NOTHING;
    END LOOP;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN QUERY SELECT * FROM public.store_orders WHERE id = ANY(v_order_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text) TO authenticated;

-- ---- RLS ----

-- SECURITY DEFINER (same reason as current_user_role() above) so this
-- bypasses affiliate_payouts' own RLS internally instead of re-triggering
-- it: affiliate_payouts_select_own_or_admin itself queries `affiliates` (to
-- check a.user_id = auth.uid()), so an affiliates policy that queried
-- affiliate_payouts as a plain subquery would call back into that policy,
-- which calls back into this one, forever — Postgres reports that as
-- "infinite recursion detected in policy for relation affiliates". Wrapping
-- the check in a SECURITY DEFINER function breaks the cycle: it runs as the
-- function owner, which — like every table here — isn't subject to RLS on
-- tables it owns (no table in this schema uses FORCE ROW LEVEL SECURITY),
-- so this reads affiliate_payouts/businesses directly with no policy
-- re-entry at all.
CREATE OR REPLACE FUNCTION public.business_owes_affiliate_payout(p_affiliate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.affiliate_payouts p
    JOIN public.businesses b ON b.id = p.business_id
    WHERE p.affiliate_id = p_affiliate_id AND b.owner_id = auth.uid()
  );
$$;

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliates_select_own_or_admin" ON public.affiliates;
CREATE POLICY "affiliates_select_own_or_admin" ON public.affiliates FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'super_admin'
    -- A business owner needs to see who they're paying — full_name, code,
    -- and payout_details (a contact number, see RegisterAffiliateForm) —
    -- for any affiliate who actually has a payout request against them
    -- (see /sell/affiliate-payouts). Without this, that page's embedded
    -- `affiliates(...)` select silently comes back null for every row: the
    -- payout amount still shows, but there's no name to put it against.
    OR public.business_owes_affiliate_payout(affiliates.id)
  );
-- Row creation/status transitions happen only via register_affiliate() /
-- set_affiliate_status() (SECURITY DEFINER), so there is no direct write policy.

ALTER TABLE public.business_affiliate_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_affiliate_settings_select_enabled_or_owner" ON public.business_affiliate_settings;
CREATE POLICY "business_affiliate_settings_select_enabled_or_owner" ON public.business_affiliate_settings FOR SELECT
  USING (
    enabled = true
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_affiliate_settings.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
DROP POLICY IF EXISTS "business_affiliate_settings_write_owner" ON public.business_affiliate_settings;
CREATE POLICY "business_affiliate_settings_write_owner" ON public.business_affiliate_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_affiliate_settings.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin')
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_affiliate_settings.business_id AND b.owner_id = auth.uid() AND b.status = 'approved')
    OR public.current_user_role() = 'super_admin');

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_clicks_select_participant" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_select_participant" ON public.affiliate_clicks FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_clicks.affiliate_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = affiliate_clicks.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- No write policy: inserted only via track_affiliate_referral_click() (SECURITY DEFINER).

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_commissions_select_participant" ON public.affiliate_commissions;
CREATE POLICY "affiliate_commissions_select_participant" ON public.affiliate_commissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_commissions.affiliate_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = affiliate_commissions.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- No write policy: written only via place_order(), the order-status trigger,
-- and the payout RPCs below (all SECURITY DEFINER).

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affiliate_payouts_select_own_or_admin" ON public.affiliate_payouts;
CREATE POLICY "affiliate_payouts_select_own_or_admin" ON public.affiliate_payouts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_payouts.affiliate_id AND a.user_id = auth.uid())
    -- The business a payout is owed by needs to see it too — it's their
    -- own /sell dashboard that lists "cash you owe" and marks it paid.
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = affiliate_payouts.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- No write policy: written only via request_affiliate_payout() /
-- set_affiliate_payout_status() (SECURITY DEFINER).

-- =============================================================================
-- SECTION 11 — ORDER COMPLETION CONFIRMATION FLOW
-- Neither side of an online order gets to unilaterally decide it's "done":
--   pending/paid/processing/shipped
--     --(business sets status = 'awaiting_confirmation' directly)--> awaiting_confirmation
--       [locked from here on — see enforce_order_status_rules() below; the
--        business's own UPDATE policy can still target the row, but only
--        the SECURITY DEFINER functions past this point may move it further]
--       --(customer: confirm_order_completion)--> completed
--       --(customer: dispute_order_completion)--> disputed --(super_admin: admin_resolve_order)--> completed | cancelled
--       --(nobody responds for order_confirmation_window(); auto_confirm_stale_orders())--> completed
-- `completed` is the one moment that settles all three parties at once: the
-- referring affiliate's commission (already sitting `pending` since
-- place_order() — see SECTION 10 — never deferred until now) flips to
-- `approved` and is payable, and the platform's own cut is snapshotted onto
-- the order. A business's own store_orders UPDATE policy above cannot reach
-- 'completed' by any path — only these SECURITY DEFINER functions can.
--
-- There used to be a separate request_order_completion() RPC the business
-- called to open the confirmation window ("mark as done"). It's gone: that
-- extra step let a business *choose* the moment it became answerable to the
-- customer, which is exactly backwards. Setting status = 'awaiting_confirmation'
-- is now just another direct status change (see the widened
-- store_orders_update_business_owner policy above) — trg_stamp_awaiting_confirmation
-- below stamps the timestamp automatically, and trg_enforce_order_status_rules
-- makes sure that, once stamped, the business can't then quietly cancel (or
-- otherwise rewrite) the order out from under the customer. See SECTION 13
-- for the other half of this — a cancelled order can still be fulfilled
-- entirely outside the app (COD, no payment gateway), which no in-app lock
-- can prevent; that gap is closed by letting the customer report it instead.
-- =============================================================================

-- How long an 'awaiting_confirmation' order waits for the customer before
-- auto_confirm_stale_orders() finalizes it on its own. A single function
-- (not a hardcoded literal in three places) so the window is one edit to change.
CREATE OR REPLACE FUNCTION public.order_confirmation_window()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT interval '4 days';
$$;

-- The marketplace's own cut of a completed order's total. Same reasoning as
-- order_confirmation_window() above — one place to change the rate later.
-- There is deliberately no payout/withdrawal machinery built on top of this
-- yet (this app has no payment gateway or business payout flow at all): this
-- only snapshots what the platform is owed for future settlement/reporting.
CREATE OR REPLACE FUNCTION public.platform_fee_rate()
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 5.00::numeric;
$$;

-- Fires on every store_orders status change, BEFORE the row is written, so
-- it can snapshot NEW.platform_fee_rate/platform_fee_amount onto the same
-- row instead of issuing a second UPDATE. One finalization event settles the
-- affiliate commission and the platform fee together, regardless of which of
-- the four paths above (confirm / timeout / admin force-complete / admin
-- force-refund) produced it.
CREATE OR REPLACE FUNCTION public.sync_order_finalization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.platform_fee_rate := public.platform_fee_rate();
    NEW.platform_fee_amount := round(NEW.total * NEW.platform_fee_rate / 100, 2);
    UPDATE public.affiliate_commissions SET status = 'approved' WHERE order_id = NEW.id AND status = 'pending';
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.affiliate_commissions SET status = 'void' WHERE order_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_finalization ON public.store_orders;
CREATE TRIGGER trg_sync_order_finalization
  BEFORE UPDATE OF status ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_order_finalization();

-- Superseded by the business setting status = 'awaiting_confirmation'
-- directly (see the flow comment above) — dropped so a re-run of this file
-- against an already-upgraded database doesn't leave it callable.
DROP FUNCTION IF EXISTS public.request_order_completion(uuid);

-- The moment any UPDATE actually lands the order on 'awaiting_confirmation'
-- for the first time, this stamps the timestamp that starts the customer's
-- confirmation window — same job request_order_completion() used to do by
-- hand, just automatic now regardless of which statement set the status.
CREATE OR REPLACE FUNCTION public.stamp_awaiting_confirmation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'awaiting_confirmation' AND OLD.status IS DISTINCT FROM 'awaiting_confirmation' THEN
    NEW.awaiting_confirmation_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_awaiting_confirmation ON public.store_orders;
CREATE TRIGGER trg_stamp_awaiting_confirmation
  BEFORE UPDATE OF status ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.stamp_awaiting_confirmation();

-- The actual backstop behind the flow diagram above. store_orders_update_business_owner
-- lets a business's own session target 'awaiting_confirmation' (so it can
-- open the confirmation window itself, with no separate RPC) — but that
-- same RLS policy has no idea *which* row it's starting from, so on its own
-- it can't stop a business from then turning right around and cancelling an
-- order the customer is already waiting to confirm. This trigger is what
-- actually enforces "once awaiting_confirmation, only the SECURITY DEFINER
-- functions below may move it further": each of them calls
-- set_config('app.order_transition_allowed', 'true', true) immediately
-- before its own UPDATE, scoped to just that statement's transaction, so a
-- plain client UPDATE — even from the business's own authenticated session —
-- can never set that flag itself.
--
-- It also requires a reason on any plain (non-admin) cancel, so a business
-- can't silently cancel an order in-system while still fulfilling it
-- off-system with the customer none the wiser that anything happened —
-- see cancellation_reason in SECTION 13. This doesn't stop a determined bad
-- actor (there's no payment gateway here to hold funds against it — see
-- SECTION 13 for what actually closes that gap), but it removes the
-- laziest version of the scam.
CREATE OR REPLACE FUNCTION public.enforce_order_status_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.awaiting_confirmation_at IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('app.order_transition_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'This order is awaiting the customer''s confirmation and can no longer be changed directly.';
  END IF;

  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND current_setting('app.order_transition_allowed', true) IS DISTINCT FROM 'true'
     AND (NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason)) = 0) THEN
    RAISE EXCEPTION 'A cancellation reason is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status_rules ON public.store_orders;
CREATE TRIGGER trg_enforce_order_status_rules
  BEFORE UPDATE OF status ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_status_rules();

-- The customer accepts the business's completion claim. This is the normal,
-- happy-path way an order reaches 'completed'.
CREATE OR REPLACE FUNCTION public.confirm_order_completion(p_order_id uuid)
RETURNS public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.store_orders;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id AND customer_id = v_uid FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'Order is not awaiting confirmation';
  END IF;

  PERFORM set_config('app.order_transition_allowed', 'true', true);
  UPDATE public.store_orders SET status = 'completed' WHERE id = p_order_id RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_completion(uuid) TO authenticated;

-- The customer rejects the business's completion claim. Routed to
-- super_admin (admin_resolve_order() below) rather than back to the
-- business — the whole point of this flow is that the business doesn't get
-- another unilateral say once it's disputed.
CREATE OR REPLACE FUNCTION public.dispute_order_completion(p_order_id uuid, p_reason text)
RETURNS public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.store_orders;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Please describe the problem';
  END IF;

  SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id AND customer_id = v_uid FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'awaiting_confirmation' THEN
    RAISE EXCEPTION 'Order is not awaiting confirmation';
  END IF;

  PERFORM set_config('app.order_transition_allowed', 'true', true);
  UPDATE public.store_orders
  SET status = 'disputed', dispute_reason = trim(p_reason)
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispute_order_completion(uuid, text) TO authenticated;

-- super_admin's backstop: force-complete ('completed') or force-refund
-- ('cancelled') any order, independent of both parties. This is both how a
-- 'disputed' order actually gets resolved, and the answer to a business that
-- simply never requests completion at all — admin isn't stuck waiting on
-- either side's cooperation.
CREATE OR REPLACE FUNCTION public.admin_resolve_order(p_order_id uuid, p_resolution text)
RETURNS public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.store_orders;
BEGIN
  IF public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admins can resolve orders';
  END IF;

  IF p_resolution NOT IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid resolution: %', p_resolution;
  END IF;

  SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Order is already finalized';
  END IF;

  PERFORM set_config('app.order_transition_allowed', 'true', true);
  UPDATE public.store_orders SET status = p_resolution WHERE id = p_order_id RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_resolve_order(uuid, text) TO authenticated;

-- Closes the opposite exploit from a business that never moves an order
-- past 'awaiting_confirmation' on its own: a customer who just ghosts it
-- forever to avoid ever confirming it. Safe to call from any authenticated
-- session (it only ever touches rows objectively past their own deadline) —
-- called opportunistically from every order-list page load (customer, business,
-- and admin) rather than depending on a cron/scheduled-function setup this
-- project doesn't otherwise have.
CREATE OR REPLACE FUNCTION public.auto_confirm_stale_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  PERFORM set_config('app.order_transition_allowed', 'true', true);
  UPDATE public.store_orders
  SET status = 'completed'
  WHERE status = 'awaiting_confirmation'
    AND awaiting_confirmation_at IS NOT NULL
    AND awaiting_confirmation_at < now() - public.order_confirmation_window();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_confirm_stale_orders() TO authenticated;

-- =============================================================================
-- SECTION 12 — DELIVERY / PICKUP FULFILLMENT
-- Extends place_order() with fulfillment_method (see store_orders above) and
-- an optional lat/lng pin the customer can drop on the checkout map. That
-- map is plain Leaflet + OpenStreetMap/Nominatim on the app side — no Google
-- Maps key or billing involved — so the coordinates are just whatever the
-- customer confirmed there; nothing here depends on them existing.
-- Keeps the same 5-arg signature as the previous definition earlier in this
-- file (jsonb, text, text, text, text) so the DROP below is required: adding
-- parameters — even ones with defaults — changes the function's identity for
-- CREATE OR REPLACE, and without dropping the old 5-arg overload first, a
-- 5-arg call from any not-yet-updated client would become ambiguous between
-- the two overloads.
-- =============================================================================

DROP FUNCTION IF EXISTS public.place_order(jsonb, text, text, text, text);

CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_notes text DEFAULT NULL,
  p_fulfillment_method text DEFAULT 'delivery',
  p_shipping_lat numeric DEFAULT NULL,
  p_shipping_lng numeric DEFAULT NULL
)
RETURNS SETOF public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_business_id uuid;
  v_order_id uuid;
  v_subtotal numeric(10,2);
  v_order_ids uuid[] := '{}';
  v_ref_code text;
  v_ref_affiliate_id uuid;
  v_ref_affiliate_user_id uuid;
  v_ref_commission_rate numeric(5,2);
  v_ref_business_owner uuid;
  v_ref_item_subtotal numeric(10,2);
  v_ref_item_profit numeric(10,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_fulfillment_method NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid fulfillment method: %', p_fulfillment_method;
  END IF;

  IF p_fulfillment_method = 'delivery' AND (p_shipping_address IS NULL OR length(trim(p_shipping_address)) = 0) THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  -- A map pin, not just typed text, is required for delivery — the whole
  -- point being an accurate lat/lng to route the order by, not just an
  -- address string. Mirrors the client-side check in CheckoutForm/checkout
  -- actions.ts; enforced here too since this function is callable directly.
  IF p_fulfillment_method = 'delivery' AND (p_shipping_lat IS NULL OR p_shipping_lng IS NULL) THEN
    RAISE EXCEPTION 'Delivery location pin is required';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  CREATE TEMPORARY TABLE _cart_items (
    product_id bigint,
    quantity integer,
    ref_code text
  ) ON COMMIT DROP;

  INSERT INTO _cart_items (product_id, quantity, ref_code)
  SELECT
    (elem->>'product_id')::bigint,
    (elem->>'quantity')::integer,
    NULLIF(lower(elem->>'ref_code'), '')
  FROM jsonb_array_elements(p_items) AS elem;

  IF EXISTS (SELECT 1 FROM _cart_items WHERE quantity <= 0 OR product_id IS NULL) THEN
    RAISE EXCEPTION 'Invalid quantity in cart';
  END IF;

  -- Lock the rows we're about to sell against concurrent checkouts.
  PERFORM 1 FROM public.store_products p
    JOIN _cart_items c ON c.product_id = p.id
    FOR UPDATE OF p;

  PERFORM 1 FROM public.ingredients i
    JOIN public.recipes r ON r.ingredient_id = i.id
    JOIN _cart_items c ON c.product_id = r.product_id
    FOR UPDATE OF i;

  -- Standalone products are checked against their own stock. Recipe-based
  -- products are skipped here — their `stock` column is always kept at 0 by
  -- convention, so checking it directly would reject every recipe-based order.
  -- Untracked rows (services — see store_products.track_stock) skip this
  -- check entirely: there's no finite count to run out of.
  IF EXISTS (
    SELECT 1
    FROM _cart_items c
    LEFT JOIN public.store_products p ON p.id = c.product_id
    LEFT JOIN public.businesses b ON b.id = p.business_id
    WHERE p.id IS NULL
       OR p.is_active = false
       OR b.status <> 'approved'
       OR (p.track_stock AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id) AND p.stock < c.quantity)
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  -- Recipe-based products are checked against ingredient supply instead,
  -- aggregated per ingredient (see process_sale() for why this can't be
  -- checked per-product independently).
  IF EXISTS (
    SELECT r.ingredient_id
    FROM _cart_items c
    JOIN public.recipes r ON r.product_id = c.product_id
    JOIN public.ingredients i ON i.id = r.ingredient_id
    GROUP BY r.ingredient_id, i.current_stock
    HAVING SUM(r.quantity_used * c.quantity) > i.current_stock
  ) THEN
    RAISE EXCEPTION 'One or more items are no longer available in the requested quantity';
  END IF;

  FOR v_business_id IN
    SELECT DISTINCT p.business_id
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
  LOOP
    SELECT COALESCE(SUM(c.quantity * p.price), 0)
      INTO v_subtotal
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id
      WHERE p.business_id = v_business_id;

    INSERT INTO public.store_orders (
      business_id, customer_id, status, subtotal, total,
      shipping_name, shipping_phone, fulfillment_method, shipping_address, shipping_lat, shipping_lng, notes
    )
    VALUES (
      v_business_id, v_uid, 'pending', v_subtotal, v_subtotal,
      p_shipping_name, p_shipping_phone, p_fulfillment_method,
      CASE WHEN p_fulfillment_method = 'delivery' THEN p_shipping_address ELSE NULL END,
      CASE WHEN p_fulfillment_method = 'delivery' THEN p_shipping_lat ELSE NULL END,
      CASE WHEN p_fulfillment_method = 'delivery' THEN p_shipping_lng ELSE NULL END,
      p_notes
    )
    RETURNING id INTO v_order_id;

    INSERT INTO public.store_order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
    SELECT v_order_id, p.id, p.name, c.quantity, p.price, c.quantity * p.price
    FROM _cart_items c
    JOIN public.store_products p ON p.id = c.product_id
    WHERE p.business_id = v_business_id;

    UPDATE public.store_products p
    SET stock = p.stock - c.quantity
    FROM _cart_items c
    WHERE p.id = c.product_id
      AND p.business_id = v_business_id
      AND p.track_stock
      AND NOT EXISTS (SELECT 1 FROM public.recipes r WHERE r.product_id = p.id);

    UPDATE public.ingredients i
    SET current_stock = i.current_stock - agg.total_used
    FROM (
      SELECT r.ingredient_id, SUM(r.quantity_used * c.quantity) AS total_used
      FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id AND p.business_id = v_business_id
      JOIN public.recipes r ON r.product_id = c.product_id
      GROUP BY r.ingredient_id
    ) agg
    WHERE i.id = agg.ingredient_id;

    -- Credit each distinct referring affiliate for just the items in this
    -- order that carried their code — never the whole order — unless the
    -- shop hasn't opted in or the affiliate is the shop's own owner
    -- (self-referral guard).
    FOR v_ref_code IN
      SELECT DISTINCT c.ref_code FROM _cart_items c
      JOIN public.store_products p ON p.id = c.product_id
      WHERE p.business_id = v_business_id AND c.ref_code IS NOT NULL
    LOOP
      v_ref_affiliate_id := NULL;
      v_ref_commission_rate := NULL;

      SELECT id, user_id INTO v_ref_affiliate_id, v_ref_affiliate_user_id
        FROM public.affiliates WHERE code = v_ref_code AND status = 'approved';

      CONTINUE WHEN v_ref_affiliate_id IS NULL;

      SELECT owner_id INTO v_ref_business_owner FROM public.businesses WHERE id = v_business_id;

      SELECT commission_rate INTO v_ref_commission_rate
        FROM public.business_affiliate_settings
        WHERE business_id = v_business_id AND enabled = true;

      CONTINUE WHEN v_ref_commission_rate IS NULL OR v_ref_affiliate_user_id IS NOT DISTINCT FROM v_ref_business_owner;

      -- Commission is paid out of what the business actually made on the
      -- referred items, not their sticker price — the same per-unit cost
      -- basis as process_sale()/Analytics (recipe cost, falling back to
      -- cost_price for a non-recipe product), summed only across the items
      -- that carried this affiliate's code.
      SELECT
        COALESCE(SUM(c.quantity * p.price), 0),
        COALESCE(SUM(c.quantity * (p.price - COALESCE(
          (SELECT SUM(r.quantity_used * i.cost_per_unit)
             FROM public.recipes r JOIN public.ingredients i ON i.id = r.ingredient_id
             WHERE r.product_id = p.id),
          p.cost_price
        ))), 0)
      INTO v_ref_item_subtotal, v_ref_item_profit
        FROM _cart_items c
        JOIN public.store_products p ON p.id = c.product_id
        WHERE p.business_id = v_business_id AND c.ref_code = v_ref_code;

      -- GREATEST(..., 0): an item sold below its own cost has negative
      -- profit — floor the commission basis at 0 rather than letting a
      -- money-losing sale generate a negative commission (or, worse, net
      -- against a different affiliate's positive one at payout time).
      INSERT INTO public.affiliate_commissions (affiliate_id, order_id, business_id, referred_subtotal, referred_profit, commission_rate, commission_amount, status)
      VALUES (v_ref_affiliate_id, v_order_id, v_business_id, v_ref_item_subtotal, v_ref_item_profit, v_ref_commission_rate, round(GREATEST(v_ref_item_profit, 0) * v_ref_commission_rate / 100, 2), 'pending')
      ON CONFLICT (affiliate_id, order_id) DO NOTHING;
    END LOOP;

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN QUERY SELECT * FROM public.store_orders WHERE id = ANY(v_order_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, numeric, numeric) TO authenticated;

-- =============================================================================
-- SECTION 13 — CANCELLATION INTEGRITY (fee-leakage guardrail)
-- Without a payment gateway (money changes hands off-platform, e.g. COD),
-- platform fee collection depends entirely on the business honestly running
-- an order through to 'completed'. A dishonest business can always cancel
-- an order in-system and just... still deliver it, pocketing the whole
-- amount with no platform cut. No in-app lock can prevent that outright —
-- the fulfillment happens entirely outside anything this schema can see —
-- so this section doesn't try to. What it does instead:
--
--   1. Let the customer contradict a false 'cancelled' status.
--      report_cancelled_order() below — the customer already has the goods,
--      so they have no incentive to lie here. Routed through the exact same
--      'disputed' -> admin_resolve_order() pipeline as SECTION 11, just
--      flagged (disputed_from_cancellation) so admin can tell it apart from
--      an ordinary awaiting_confirmation dispute.
--   2. Surface the pattern, not just the individual report. One report
--      could be a genuine mixup; a business with several is the actual
--      fraud signal. business_cancellation_reports below aggregates that
--      for admin review rather than trusting every cancel as final and inert.
--   3. Require a reason on every plain cancel (see cancellation_reason,
--      enforced by trg_enforce_order_status_rules in SECTION 11), shown to
--      the customer. Doesn't stop a determined bad actor, but removes the
--      silent version of the scam — the customer at least sees there was
--      ever a discrepancy to report in the first place.
--
-- The remaining piece — that circumventing the platform on a placed order
-- is a bannable/finable offense once caught via #1 or #2 — is a policy
-- matter for the terms of service, not something a schema can enforce.
-- =============================================================================

-- The customer's side of #1 above: "this shows cancelled, but I actually
-- got it." Reuses the same 'disputed' status and admin_resolve_order()
-- resolution as a normal dispute — only the entry point differs.
CREATE OR REPLACE FUNCTION public.report_cancelled_order(p_order_id uuid, p_reason text)
RETURNS public.store_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order public.store_orders;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Please describe what happened';
  END IF;

  SELECT * INTO v_order FROM public.store_orders WHERE id = p_order_id AND customer_id = v_uid FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Only a cancelled order can be reported this way';
  END IF;

  PERFORM set_config('app.order_transition_allowed', 'true', true);
  UPDATE public.store_orders
  SET status = 'disputed', dispute_reason = trim(p_reason), disputed_from_cancellation = true
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_cancelled_order(uuid, text) TO authenticated;

-- #2 above: per-business count of orders a customer has reported this way,
-- regardless of how admin ultimately resolved each one — even a report
-- later resolved back to 'cancelled' is worth admin seeing again if it
-- keeps happening for the same business. security_invoker means this runs
-- under the querying user's own store_orders/businesses RLS, so in practice
-- only super_admin (who can see every order) gets the real aggregate — the
-- admin orders page is what actually reads this.
CREATE OR REPLACE VIEW public.business_cancellation_reports
WITH (security_invoker = true) AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.slug AS business_slug,
  count(*) FILTER (WHERE o.disputed_from_cancellation) AS reported_count
FROM public.store_orders o
JOIN public.businesses b ON b.id = o.business_id
GROUP BY b.id, b.name, b.slug
HAVING count(*) FILTER (WHERE o.disputed_from_cancellation) > 0;

GRANT SELECT ON public.business_cancellation_reports TO authenticated;

-- =============================================================================
-- SECTION 14 — HYBRID OFFERINGS & SERVICE REQUESTS
--
-- Lets a business sell retail stock through the existing POS/cart pipeline
-- (store_products, store_orders, sales — none of it touched below) AND, at
-- the same time, take in arbitrary non-POS work — repairs, printing,
-- pa-utang applications, bookings, anything an owner invents — through
-- schema-driven request forms. Nothing here alters an existing table's
-- shape, trigger, or RPC; every table, view and function below is additive.
--
-- The core idea: `offerings` is the one catalog the storefront reads. A row
-- either points at a real store_products row (requires_pos = true — POS
-- keeps owning price/stock/checkout exactly as today) or stands alone with
-- its own price and a JSON-defined input form (requires_pos = false —
-- answers land in `service_requests`, never in store_orders).
-- =============================================================================

-- ---- 14.1 capability flags ----

-- One row per (business, capability). module_key is deliberately free text,
-- not a CHECK-constrained enum — a capability nobody has thought of yet must
-- be turnable-on without a migration. module_definitions below is optional
-- display metadata for keys the platform already knows about; it is NOT a
-- foreign key constraint on module_key, so an unlisted/experimental key is
-- still legal to enable for one business ahead of being formally catalogued.
CREATE TABLE IF NOT EXISTS public.business_modules (
  business_id  uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  module_key   text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  config       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, module_key)
);

DROP TRIGGER IF EXISTS trg_business_modules_updated_at ON public.business_modules;
CREATE TRIGGER trg_business_modules_updated_at
  BEFORE UPDATE ON public.business_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.module_definitions (
  module_key   text PRIMARY KEY,
  label        text NOT NULL,
  description  text,
  icon         text
);

INSERT INTO public.module_definitions (module_key, label, description, icon) VALUES
  ('pos', 'Point of Sale', 'In-person register and cart checkout', 'credit-card'),
  ('custom_offerings', 'Custom Offerings', 'Non-POS services, bookings and request forms', 'sparkles')
ON CONFLICT (module_key) DO NOTHING;

-- SECURITY DEFINER (not a plain SQL function) is required here — this is
-- called from submit_service_request() on behalf of a shopping customer, who
-- has no SELECT access to another business's business_modules rows under the
-- RLS policy below. Without SECURITY DEFINER the inner SELECT would always
-- see zero rows for that caller and this would silently return false for
-- every business, module or not.
CREATE OR REPLACE FUNCTION public.business_has_module(p_business_id uuid, p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.business_modules WHERE business_id = p_business_id AND module_key = p_key),
    false
  );
$$;

-- Backfill for every business that existed before this section shipped:
-- `pos` mirrors the same tracksStock logic set_business_type() already uses
-- (business_type <> 'services'); `custom_offerings` is on for everyone by
-- default — enabling it costs a retail-only owner nothing until they
-- actually build a non-POS offering. Both INSERTs are idempotent.
INSERT INTO public.business_modules (business_id, module_key, enabled)
SELECT id, 'pos', business_type <> 'services' FROM public.businesses
ON CONFLICT (business_id, module_key) DO NOTHING;

INSERT INTO public.business_modules (business_id, module_key, enabled)
SELECT id, 'custom_offerings', true FROM public.businesses
ON CONFLICT (business_id, module_key) DO NOTHING;

-- ---- 14.2 offerings: the one catalog the storefront reads ----

CREATE TABLE IF NOT EXISTS public.offerings (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  category_id       bigint REFERENCES public.categories(id) ON DELETE SET NULL,
  name              text NOT NULL,
  slug              text NOT NULL,
  description       text,
  image_url         text,
  requires_pos      boolean NOT NULL DEFAULT false,
  linked_product_id bigint REFERENCES public.store_products(id) ON DELETE CASCADE,
  -- 'instant_purchase' | 'time_slot_booking' | 'file_upload_request' |
  -- 'approval_required' | any owner-typed string. Deliberately not
  -- CHECK-constrained: every consumer below switches on service_requests.status,
  -- never on this column, so a brand-new value needs zero backend change.
  fulfillment_type  text NOT NULL DEFAULT 'instant_purchase',
  price             numeric(10,2),
  price_label       text,
  -- Ordered array of field definitions interpreted at runtime by the
  -- storefront form and the admin drawer — see lib/offerings/field-schema.ts.
  -- '[]' for an offering that needs no input beyond the built-in notes field.
  metadata_schema   jsonb NOT NULL DEFAULT '[]',
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug),
  CONSTRAINT offerings_pos_link_chk CHECK (
    (requires_pos AND linked_product_id IS NOT NULL) OR (NOT requires_pos AND linked_product_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS offerings_business_id_idx ON public.offerings(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS offerings_linked_product_idx
  ON public.offerings(linked_product_id) WHERE linked_product_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_offerings_updated_at ON public.offerings;
CREATE TRIGGER trg_offerings_updated_at BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Same cross-tenant guard as validate_recipe_business(): a linked_product_id
-- must belong to the same business as the offering wrapping it.
CREATE OR REPLACE FUNCTION public.validate_offering_business()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_product_business uuid;
BEGIN
  IF NEW.linked_product_id IS NOT NULL THEN
    SELECT business_id INTO v_product_business FROM public.store_products WHERE id = NEW.linked_product_id;
    IF v_product_business IS DISTINCT FROM NEW.business_id THEN
      RAISE EXCEPTION 'Offering and its linked product must belong to the same business';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_validate_offering_business ON public.offerings;
CREATE TRIGGER trg_validate_offering_business
  BEFORE INSERT OR UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.validate_offering_business();

-- A POS-linked offering row is a mirror, not an independently-editable
-- catalog entry — its name/price/image/is_active always come from
-- store_products via sync_offering_for_product() below. This guard stops a
-- direct client write from quietly re-pointing or un-linking one (the one
-- way this pair could drift out of sync), while still allowing the sync
-- trigger itself through via the same set_config()-flag technique
-- report_cancelled_order() already uses elsewhere in this file.
CREATE OR REPLACE FUNCTION public.protect_offering_pos_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.requires_pos IS DISTINCT FROM OLD.requires_pos OR NEW.linked_product_id IS DISTINCT FROM OLD.linked_product_id)
     AND current_setting('app.offering_sync_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'requires_pos and linked_product_id are managed automatically from the product catalog and cannot be edited directly';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_offering_pos_link ON public.offerings;
CREATE TRIGGER trg_protect_offering_pos_link BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.protect_offering_pos_link();

-- Auto-mirror: creating/editing a store_products row keeps a matching
-- offerings row in sync, so a retail seller never has to visit the Offering
-- Builder to appear in the unified storefront feed — this is what makes "no
-- change to the existing retail workflow" true in practice.
CREATE OR REPLACE FUNCTION public.sync_offering_for_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.offering_sync_allowed', 'true', true);
  INSERT INTO public.offerings (business_id, category_id, name, slug, description, image_url,
                                 requires_pos, linked_product_id, fulfillment_type, price, is_active)
  VALUES (NEW.business_id, NEW.category_id, NEW.name, NEW.slug, NEW.description, NEW.image_url,
          true, NEW.id, 'instant_purchase', NEW.price, NEW.is_active)
  ON CONFLICT (linked_product_id) WHERE linked_product_id IS NOT NULL DO UPDATE SET
    name = NEW.name, category_id = NEW.category_id, description = NEW.description,
    image_url = NEW.image_url, price = NEW.price, is_active = NEW.is_active, slug = NEW.slug;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sync_offering_for_product ON public.store_products;
CREATE TRIGGER trg_sync_offering_for_product
  AFTER INSERT OR UPDATE ON public.store_products
  FOR EACH ROW EXECUTE FUNCTION public.sync_offering_for_product();

-- One-time backfill for every store_products row that predates this section —
-- from here on, trg_sync_offering_for_product keeps them in sync. Idempotent:
-- a re-run of this script skips any row already mirrored.
DO $$ BEGIN
  PERFORM set_config('app.offering_sync_allowed', 'true', true);
  INSERT INTO public.offerings (business_id, category_id, name, slug, description, image_url,
                                 requires_pos, linked_product_id, fulfillment_type, price, is_active)
  SELECT business_id, category_id, name, slug, description, image_url, true, id, 'instant_purchase', price, is_active
  FROM public.store_products
  ON CONFLICT (linked_product_id) WHERE linked_product_id IS NOT NULL DO NOTHING;
END $$;

-- Deleting an offering that wraps a retail product would leave the product
-- with no storefront presence at all until its next edit re-triggers the
-- sync — no accidental way to do that: only a custom (requires_pos = false)
-- offering can be deleted directly. A POS-linked row disappears on its own,
-- via ON DELETE CASCADE from store_products, when the product itself is deleted.
CREATE OR REPLACE FUNCTION public.protect_offering_pos_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.requires_pos AND current_setting('app.offering_sync_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'A POS-linked offering is removed by deleting its product on the Products page, not here';
  END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_offering_pos_delete ON public.offerings;
CREATE TRIGGER trg_protect_offering_pos_delete BEFORE DELETE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.protect_offering_pos_delete();

-- ---- 14.3 service_requests & service_request_events: the non-POS pipeline ----

CREATE TABLE IF NOT EXISTS public.service_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  offering_id        bigint NOT NULL REFERENCES public.offerings(id) ON DELETE RESTRICT,
  -- Nullable: a walk-in customer who doesn't use the app at all has no
  -- profiles row to point at. walk_in_name/walk_in_phone below stand in for
  -- them instead — see service_requests_identity_chk, which requires one or
  -- the other, never neither.
  customer_id        uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  walk_in_name       text,
  walk_in_phone      text,
  -- The staff/owner account that logged this on a walk-in customer's behalf
  -- via log_walkin_service_request() below — NULL for a request the
  -- customer submitted themselves online. Mirrors sales.created_by.
  created_by         uuid REFERENCES auth.users(id),
  -- Snapshotted from the offering at submission time so relabeling the
  -- offering later never rewrites the history of an in-flight ticket.
  fulfillment_type   text NOT NULL,
  status             text NOT NULL DEFAULT 'submitted' CHECK (status IN (
                       'submitted', 'in_review', 'accepted', 'in_progress',
                       'awaiting_customer', 'completed', 'rejected', 'cancelled')),
  form_data          jsonb NOT NULL DEFAULT '{}',
  -- Reserved for files attached outside of any 'file' schema field (e.g. an
  -- owner attaching a signed receipt later). A 'file' field's own uploads
  -- live in form_data under that field's key instead — see
  -- lib/offerings/field-schema.ts — so this stays empty for most requests.
  attachments        jsonb NOT NULL DEFAULT '[]',
  quoted_price       numeric(10,2),
  agreed_price       numeric(10,2),
  scheduled_at       timestamptz,
  fulfillment_method text CHECK (fulfillment_method IN ('pickup', 'delivery', 'on_site', 'remote')),
  -- Required, unconditionally, on the customer-facing online form (see
  -- MapLocationPicker in DynamicOfferingRequestForm and the check inside
  -- submit_service_request() below) — a walk-in a business owner logs via
  -- log_walkin_service_request() may skip it instead, since the customer is
  -- standing in the shop and there's nothing to pin. Not NOT NULL at the
  -- column level for that reason: "required" is enforced per write-path,
  -- inside each RPC, not by the table shape.
  location_address   text,
  location_lat       numeric(9,6),
  location_lng       numeric(9,6),
  customer_notes     text,
  owner_notes        text,
  rejection_reason   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_identity_chk CHECK (customer_id IS NOT NULL OR walk_in_name IS NOT NULL)
);
-- Additive, in case an earlier run of this script already created this table
-- before location_address/lat/lng/walk-in support existed on it.
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS location_address text;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS location_lat numeric(9,6);
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS location_lng numeric(9,6);
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS walk_in_name text;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS walk_in_phone text;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
-- customer_id predates walk-ins and was created NOT NULL — relax it so a
-- walk-in row (customer_id IS NULL, walk_in_name set instead) is legal.
ALTER TABLE public.service_requests ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_identity_chk;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_identity_chk
  CHECK (customer_id IS NOT NULL OR walk_in_name IS NOT NULL);

CREATE INDEX IF NOT EXISTS service_requests_business_id_idx ON public.service_requests(business_id, status);
CREATE INDEX IF NOT EXISTS service_requests_customer_id_idx ON public.service_requests(customer_id);

DROP TRIGGER IF EXISTS trg_service_requests_updated_at ON public.service_requests;
CREATE TRIGGER trg_service_requests_updated_at BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.service_request_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id   uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES public.profiles(id),
  actor_role   text NOT NULL CHECK (actor_role IN ('business', 'customer', 'system')),
  event_type   text NOT NULL, -- 'submitted' | 'status_change' | 'comment' | 'quote_sent'
  message      text,
  metadata     jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_request_events_request_id_idx ON public.service_request_events(request_id, created_at);

-- ---- 14.4 reading both pipelines as one queue ----

-- Logical union, not a physical merge — store_orders/place_order()/
-- process_sale() keep their own tables and triggers untouched.
-- security_invoker MUST be true here (the opposite of marketplace_products,
-- which is deliberately public): this view carries private order/request
-- data, so it has to run as the QUERYING user, letting store_orders' and
-- service_requests' own owner-only RLS policies keep doing their job —
-- same pattern already used for business_cancellation_reports above.
CREATE OR REPLACE VIEW public.v_orders_or_requests
WITH (security_invoker = true) AS
SELECT 'pos_order'::text AS kind, so.id::text AS id, so.business_id, so.customer_id,
       so.status, so.total AS amount, NULL::jsonb AS form_data,
       NULL::text AS fulfillment_type, so.created_at, so.updated_at
FROM public.store_orders so
UNION ALL
SELECT 'service_request'::text, sr.id::text, sr.business_id, sr.customer_id,
       sr.status, COALESCE(sr.agreed_price, sr.quoted_price, 0), sr.form_data,
       sr.fulfillment_type, sr.created_at, sr.updated_at
FROM public.service_requests sr;

-- Storefront read surface for offerings, mirroring marketplace_products'
-- shape. For a POS-linked row it reuses that view's already-correct
-- recipe/ingredient stock math instead of re-deriving it.
CREATE OR REPLACE VIEW public.marketplace_offerings
WITH (security_invoker = false) AS
SELECT o.id, o.business_id, o.name, o.slug, o.description, o.image_url,
       o.requires_pos, o.linked_product_id, o.fulfillment_type,
       o.price, o.price_label, o.metadata_schema, o.sort_order,
       CASE WHEN o.requires_pos THEN mp.stock ELSE NULL END AS stock,
       CASE WHEN o.requires_pos THEN mp.track_stock ELSE NULL END AS track_stock,
       o.category_id, c.name AS category_name, c.slug AS category_slug,
       b.name AS business_name, b.slug AS business_slug, b.business_type,
       o.created_at
FROM public.offerings o
JOIN public.businesses b ON b.id = o.business_id AND b.status = 'approved'
LEFT JOIN public.categories c ON c.id = o.category_id
LEFT JOIN public.marketplace_products mp ON mp.id = o.linked_product_id
WHERE o.is_active = true;

GRANT SELECT ON public.marketplace_offerings TO anon, authenticated;

-- ---- 14.5 form-schema validation ----

-- Mirrors the client-side check in lib/offerings/field-schema.ts, but this
-- one is the actual source of truth: client validation is a UX courtesy,
-- this is what a crafted RPC call can't get past.
CREATE OR REPLACE FUNCTION public.validate_form_data(p_schema jsonb, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_field jsonb; v_key text; v_type text; v_required boolean; v_value jsonb;
BEGIN
  FOR v_field IN SELECT * FROM jsonb_array_elements(COALESCE(p_schema, '[]'::jsonb))
  LOOP
    v_key := v_field->>'key';
    v_type := COALESCE(v_field->>'type', 'text');
    v_required := COALESCE((v_field->>'required')::boolean, false);
    v_value := COALESCE(p_data, '{}'::jsonb)->v_key;

    IF v_required AND (v_value IS NULL OR v_value = 'null'::jsonb OR v_value = '""'::jsonb OR v_value = '[]'::jsonb) THEN
      RAISE EXCEPTION 'Missing required field: %', COALESCE(v_field->>'label', v_key);
    END IF;

    IF v_value IS NOT NULL AND v_value <> 'null'::jsonb THEN
      IF v_type = 'number' AND jsonb_typeof(v_value) <> 'number' THEN
        RAISE EXCEPTION '% must be a number', COALESCE(v_field->>'label', v_key);
      END IF;
      IF v_type = 'select' AND v_field ? 'options'
         AND NOT (v_field->'options' @> jsonb_build_array(v_value)) THEN
        RAISE EXCEPTION '% is not one of the allowed options', COALESCE(v_field->>'label', v_key);
      END IF;
      IF v_type IN ('file', 'multiselect') AND jsonb_typeof(v_value) <> 'array' THEN
        RAISE EXCEPTION '% must be a list', COALESCE(v_field->>'label', v_key);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ---- 14.6 write paths: every service_requests mutation goes through one of these ----

-- Customer submits a filled-out form against a non-POS offering. There is no
-- direct INSERT policy on service_requests (see RLS below) — this is the
-- only door, same discipline as place_order()/process_sale() for the POS side.
--
-- A location is required on every custom offering's request — unconditionally,
-- not something an offering's metadata_schema opts into (see
-- DynamicOfferingRequestForm, which always renders the map picker regardless
-- of what fields the offering defines). Checked here, not just client-side,
-- for the same reason place_order() re-checks a delivery address itself.
CREATE OR REPLACE FUNCTION public.submit_service_request(
  p_offering_id bigint,
  p_form_data jsonb,
  p_location_address text,
  p_location_lat numeric,
  p_location_lng numeric,
  p_fulfillment_method text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offering public.offerings;
  v_request public.service_requests;
  v_customer_schema jsonb;
  v_admin_keys text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_location_address IS NULL OR length(trim(p_location_address)) = 0 OR p_location_lat IS NULL OR p_location_lng IS NULL THEN
    RAISE EXCEPTION 'Confirm a location on the map before sending this request';
  END IF;

  -- `o.*`, not a bare `*` — the join also pulls in businesses' own columns,
  -- and v_offering is typed as public.offerings alone; selecting `*` here
  -- would hand it more columns than its type has (the same class of error
  -- as update_request_admin_fields()'s record-in-a-multi-item-INTO bug above).
  SELECT o.* INTO v_offering FROM public.offerings o
    JOIN public.businesses b ON b.id = o.business_id
    WHERE o.id = p_offering_id AND o.is_active = true AND b.status = 'approved';
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'Offering not found or no longer available';
  END IF;

  IF v_offering.requires_pos THEN
    RAISE EXCEPTION 'This offering is sold through the cart, not a request form';
  END IF;

  IF NOT public.business_has_module(v_offering.business_id, 'custom_offerings') THEN
    RAISE EXCEPTION 'This shop is not currently accepting custom requests';
  END IF;

  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery', 'on_site', 'remote') THEN
    RAISE EXCEPTION 'Invalid fulfillment method: %', p_fulfillment_method;
  END IF;

  -- admin_only fields (see OfferingField.admin_only) are never asked of the
  -- customer, so they're excluded from validation here, and any value for
  -- one is stripped from the incoming payload below rather than trusted —
  -- a crafted call could otherwise pre-seed an internal field the owner is
  -- meant to fill in themselves via update_request_admin_fields().
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) INTO v_customer_schema
    FROM jsonb_array_elements(v_offering.metadata_schema) f
    WHERE COALESCE((f->>'admin_only')::boolean, false) = false;
  SELECT COALESCE(array_agg(f->>'key'), '{}') INTO v_admin_keys
    FROM jsonb_array_elements(v_offering.metadata_schema) f
    WHERE COALESCE((f->>'admin_only')::boolean, false) = true;

  PERFORM public.validate_form_data(v_customer_schema, p_form_data);
  p_form_data := COALESCE(p_form_data, '{}'::jsonb) - v_admin_keys;

  INSERT INTO public.service_requests (
    business_id, offering_id, customer_id, fulfillment_type, form_data,
    location_address, location_lat, location_lng, fulfillment_method, customer_notes
  ) VALUES (
    v_offering.business_id, v_offering.id, v_uid, v_offering.fulfillment_type,
    COALESCE(p_form_data, '{}'::jsonb), trim(p_location_address), p_location_lat, p_location_lng,
    p_fulfillment_method, p_customer_notes
  )
  RETURNING * INTO v_request;

  INSERT INTO public.service_request_events (request_id, actor_id, actor_role, event_type, message)
  VALUES (v_request.id, v_uid, 'customer', 'submitted', 'Request submitted');

  RETURN v_request;
END;
$$;

-- The old 4-arg signature (before a location was required) is dropped
-- explicitly rather than just CREATE OR REPLACE-d: an added required
-- parameter makes this a different overload as far as Postgres is concerned,
-- and this file needs to stay safe to re-run against a database that already
-- has the old version.
DROP FUNCTION IF EXISTS public.submit_service_request(bigint, jsonb, text, text);
GRANT EXECUTE ON FUNCTION public.submit_service_request(bigint, jsonb, text, numeric, numeric, text, text) TO authenticated;

-- A business owner logs a request on behalf of a walk-in customer who came
-- into the shop in person and doesn't use the app — the admin-side
-- counterpart to submit_service_request() above, filling out the exact same
-- offering.metadata_schema form themselves instead of the customer doing it
-- online. No customer_id: walk_in_name (required) and walk_in_phone
-- (optional) identify them instead (see service_requests_identity_chk).
-- Unlike the online path, a location is optional here — the customer is
-- standing in front of the owner, so there's often nothing to pin.
CREATE OR REPLACE FUNCTION public.log_walkin_service_request(
  p_offering_id bigint,
  p_form_data jsonb,
  p_customer_name text,
  p_customer_phone text DEFAULT NULL,
  p_location_address text DEFAULT NULL,
  p_location_lat numeric DEFAULT NULL,
  p_location_lng numeric DEFAULT NULL,
  p_fulfillment_method text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_owner_notes text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_offering public.offerings;
  v_request public.service_requests;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'A name is required to log a request for a walk-in customer';
  END IF;

  SELECT * INTO v_offering FROM public.offerings WHERE id = p_offering_id;
  IF v_offering IS NULL THEN
    RAISE EXCEPTION 'Offering not found';
  END IF;

  -- Ownership check doubles as the tenant boundary: an owner can only log a
  -- walk-in against their own offering, never another shop's.
  IF NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = v_offering.business_id AND b.owner_id = v_uid) THEN
    RAISE EXCEPTION 'You can only log requests for your own shop';
  END IF;

  IF v_offering.requires_pos THEN
    RAISE EXCEPTION 'This offering is sold through the cart, not a request form';
  END IF;

  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery', 'on_site', 'remote') THEN
    RAISE EXCEPTION 'Invalid fulfillment method: %', p_fulfillment_method;
  END IF;

  PERFORM public.validate_form_data(v_offering.metadata_schema, p_form_data);

  INSERT INTO public.service_requests (
    business_id, offering_id, customer_id, walk_in_name, walk_in_phone, created_by,
    fulfillment_type, form_data, location_address, location_lat, location_lng,
    fulfillment_method, customer_notes, owner_notes
  ) VALUES (
    v_offering.business_id, v_offering.id, NULL, trim(p_customer_name), NULLIF(trim(COALESCE(p_customer_phone, '')), ''), v_uid,
    v_offering.fulfillment_type, COALESCE(p_form_data, '{}'::jsonb), p_location_address, p_location_lat, p_location_lng,
    p_fulfillment_method, p_customer_notes, p_owner_notes
  )
  RETURNING * INTO v_request;

  INSERT INTO public.service_request_events (request_id, actor_id, actor_role, event_type, message)
  VALUES (v_request.id, v_uid, 'business', 'submitted', 'Logged in person by ' || COALESCE((SELECT full_name FROM public.profiles WHERE id = v_uid), 'the shop'));

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_walkin_service_request(bigint, jsonb, text, text, text, numeric, numeric, text, text, text) TO authenticated;

-- Business owner moves a ticket through its lifecycle, sends a quote, and/or
-- leaves a message — all in one call, logging exactly one combined event.
-- Legal status transitions are enforced here, the only place status can
-- change (no direct UPDATE policy — see RLS below).
CREATE OR REPLACE FUNCTION public.update_service_request(
  p_request_id uuid,
  p_status text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_quoted_price numeric DEFAULT NULL,
  p_agreed_price numeric DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_request public.service_requests;
  v_is_owner boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = v_request.business_id AND b.owner_id = v_uid)
    INTO v_is_owner;
  IF NOT v_is_owner AND public.current_user_role() IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only the business that owns this request can update it';
  END IF;

  IF p_status IS NOT NULL AND p_status IS DISTINCT FROM v_request.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM (VALUES
        ('submitted', 'in_review'), ('submitted', 'rejected'),
        ('in_review', 'accepted'), ('in_review', 'rejected'),
        ('accepted', 'in_progress'), ('accepted', 'cancelled'),
        ('in_progress', 'awaiting_customer'), ('in_progress', 'completed'), ('in_progress', 'cancelled'),
        ('awaiting_customer', 'in_progress')
      ) AS t(from_status, to_status)
      WHERE t.from_status = v_request.status AND t.to_status = p_status
    ) THEN
      RAISE EXCEPTION 'Cannot move a request from % to %', v_request.status, p_status;
    END IF;
    IF p_status = 'rejected' AND (p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) = 0) THEN
      RAISE EXCEPTION 'A reason is required to reject a request';
    END IF;
  END IF;

  UPDATE public.service_requests SET
    status = COALESCE(p_status, status),
    quoted_price = COALESCE(p_quoted_price, quoted_price),
    agreed_price = COALESCE(p_agreed_price, agreed_price),
    scheduled_at = COALESCE(p_scheduled_at, scheduled_at),
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  IF p_status IS NOT NULL OR p_message IS NOT NULL OR p_quoted_price IS NOT NULL OR p_agreed_price IS NOT NULL THEN
    INSERT INTO public.service_request_events (request_id, actor_id, actor_role, event_type, message, metadata)
    VALUES (
      p_request_id, v_uid, 'business',
      CASE
        WHEN p_status IS NOT NULL THEN 'status_change'
        WHEN p_quoted_price IS NOT NULL OR p_agreed_price IS NOT NULL THEN 'quote_sent'
        ELSE 'comment'
      END,
      p_message,
      jsonb_strip_nulls(jsonb_build_object('status', p_status, 'quoted_price', p_quoted_price, 'agreed_price', p_agreed_price))
    );
  END IF;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_service_request(uuid, text, text, numeric, numeric, timestamptz, text) TO authenticated;

-- Fills in / edits the offering's admin_only fields (see OfferingField in
-- lib/types/marketplace.ts) — the structured, per-field alternative to the
-- one free-text owner_notes box: "Assigned technician," "Diagnosis code,"
-- whatever the owner defined as internal-only on this offering. Callable on
-- any request at any time regardless of status, since there's no customer-
-- facing transition to protect here (unlike update_service_request()) — the
-- customer never sees these fields or this event at all. p_patch is merged
-- into form_data (jsonb ||), never replacing it, so this can never touch a
-- key the customer themselves submitted.
CREATE OR REPLACE FUNCTION public.update_request_admin_fields(p_request_id uuid, p_patch jsonb)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_request public.service_requests;
  v_schema jsonb;
  v_admin_keys text[];
  v_patch_keys text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- A record variable (v_request) can't share an INTO list with another
  -- target in PL/pgSQL ("record variable cannot be part of multiple-item
  -- INTO list") — so this is two SELECTs, not one join-and-split.
  SELECT sr.* INTO v_request
  FROM public.service_requests sr
  JOIN public.businesses b ON b.id = sr.business_id
  WHERE sr.id = p_request_id AND (b.owner_id = v_uid OR public.current_user_role() = 'super_admin')
  FOR UPDATE OF sr;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  SELECT o.metadata_schema INTO v_schema FROM public.offerings o WHERE o.id = v_request.offering_id;

  SELECT COALESCE(array_agg(f->>'key'), '{}') INTO v_admin_keys
    FROM jsonb_array_elements(v_schema) f
    WHERE COALESCE((f->>'admin_only')::boolean, false) = true;
  SELECT COALESCE(array_agg(k), '{}') INTO v_patch_keys FROM jsonb_object_keys(COALESCE(p_patch, '{}'::jsonb)) k;

  IF EXISTS (SELECT 1 FROM unnest(v_patch_keys) k WHERE NOT (k = ANY(v_admin_keys))) THEN
    RAISE EXCEPTION 'This offering has no admin-only field matching one of the submitted keys';
  END IF;

  UPDATE public.service_requests
  SET form_data = form_data || COALESCE(p_patch, '{}'::jsonb)
  WHERE id = p_request_id
  RETURNING * INTO v_request;

  RETURN v_request;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_request_admin_fields(uuid, jsonb) TO authenticated;

-- Either side of a ticket can leave a message without touching its status —
-- the customer's reply box and the owner's drawer both call this. Which
-- actor_role gets stamped is derived from who's calling, never trusted from
-- the client.
CREATE OR REPLACE FUNCTION public.add_request_comment(p_request_id uuid, p_message text)
RETURNS public.service_request_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event public.service_request_events;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'Comment cannot be empty';
  END IF;

  INSERT INTO public.service_request_events (request_id, actor_id, actor_role, event_type, message)
  SELECT p_request_id, v_uid, CASE WHEN sr.customer_id = v_uid THEN 'customer' ELSE 'business' END, 'comment', trim(p_message)
  FROM public.service_requests sr
  LEFT JOIN public.businesses b ON b.id = sr.business_id
  WHERE sr.id = p_request_id AND (sr.customer_id = v_uid OR b.owner_id = v_uid OR public.current_user_role() = 'super_admin')
  RETURNING * INTO v_event;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  RETURN v_event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_request_comment(uuid, text) TO authenticated;

-- ---- 14.7 row level security ----

ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_modules_select_own_or_admin" ON public.business_modules;
CREATE POLICY "business_modules_select_own_or_admin" ON public.business_modules FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_modules.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- Capabilities are platform-managed, not self-service — an owner sees their
-- own flags but only a super_admin flips them. (business_has_module() above
-- is SECURITY DEFINER specifically so a *customer* can still read the flag
-- despite having no policy match here at all.)
DROP POLICY IF EXISTS "business_modules_write_super_admin" ON public.business_modules;
CREATE POLICY "business_modules_write_super_admin" ON public.business_modules FOR ALL
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

ALTER TABLE public.module_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "module_definitions_select_all" ON public.module_definitions;
CREATE POLICY "module_definitions_select_all" ON public.module_definitions FOR SELECT USING (true);
DROP POLICY IF EXISTS "module_definitions_write_super_admin" ON public.module_definitions;
CREATE POLICY "module_definitions_write_super_admin" ON public.module_definitions FOR ALL
  USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "offerings_select_public_or_own" ON public.offerings;
CREATE POLICY "offerings_select_public_or_own" ON public.offerings FOR SELECT
  USING (
    (is_active = true AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = offerings.business_id AND b.status = 'approved'))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = offerings.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- Direct table writes (no RPC) — same convention as store_products, since
-- ownership + the two guard triggers above are already enough protection.
DROP POLICY IF EXISTS "offerings_write_owner" ON public.offerings;
CREATE POLICY "offerings_write_owner" ON public.offerings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = offerings.business_id AND b.owner_id = auth.uid() AND b.status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = offerings.business_id AND b.owner_id = auth.uid() AND b.status = 'approved'));

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_requests_select_participant" ON public.service_requests;
CREATE POLICY "service_requests_select_participant" ON public.service_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = service_requests.business_id AND b.owner_id = auth.uid())
    OR public.current_user_role() = 'super_admin'
  );
-- No INSERT/UPDATE policy at all: every write goes through
-- submit_service_request() / update_service_request() (both SECURITY
-- DEFINER), the same discipline place_order()/process_sale() already use for
-- the POS side.

ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_request_events_select_participant" ON public.service_request_events;
CREATE POLICY "service_request_events_select_participant" ON public.service_request_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.service_requests sr
    LEFT JOIN public.businesses b ON b.id = sr.business_id
    WHERE sr.id = service_request_events.request_id
      AND (sr.customer_id = auth.uid() OR b.owner_id = auth.uid() OR public.current_user_role() = 'super_admin')
  ));
-- Writes only via submit_service_request() / update_service_request() /
-- add_request_comment() — no direct INSERT policy.

-- ---- 14.8 attachment storage ----
--
-- Deliberately a PUBLIC bucket with a random, unguessable path segment per
-- upload — the same trust posture this app already has for every other
-- image (store_products.image_url, businesses.logo_url, ...: a plain public
-- URL, no signed-URL infrastructure exists anywhere in this codebase). This
-- is a known, explicit trade-off: a file_upload_request offering can ask for
-- something sensitive (a valid ID for a pa-utang application), and "public
-- but hard to guess" is weaker than a private bucket with signed URLs. If a
-- business owner ever collects genuinely sensitive documents at scale, this
-- bucket should be flipped to private with signed URLs generated server-side
-- — flagged here rather than silently shipped as if it were already hardened.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('service-request-uploads', 'service-request-uploads', true, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_request_uploads_insert_own_folder" ON storage.objects;
CREATE POLICY "service_request_uploads_insert_own_folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'service-request-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "service_request_uploads_select_public" ON storage.objects;
CREATE POLICY "service_request_uploads_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'service-request-uploads');

DROP POLICY IF EXISTS "service_request_uploads_delete_own" ON storage.objects;
CREATE POLICY "service_request_uploads_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'service-request-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
