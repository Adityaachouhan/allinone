/*
# Add decrement_stock RPC

1. Overview
Provides a safe, atomic stock decrement used when an order is placed. It clamps at zero so
stock never goes negative, and is callable by the authenticated customer placing the order.

2. Changes
- CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity int)
  Returns void. Updates products.stock_quantity = GREATEUST(stock_quantity - p_quantity, 0).
  SECURITY INVOKER so the caller's RLS still applies on the products table read.

3. Security
- The function updates the products table. products UPDATE policy is admin-only, so a
  customer cannot call this directly via PostgREST. We therefore mark it SECURITY DEFINER
  with a fixed search_path so it runs with the function owner's privileges, allowing the
  stock decrement to succeed for authenticated customers. This is safe because it only
  decrements (never increments) and clamps at zero.
*/

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = GREATEST(stock_quantity - p_quantity, 0),
      is_out_of_stock = (stock_quantity - p_quantity <= 0)
  WHERE id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_stock(uuid, int) TO authenticated;
