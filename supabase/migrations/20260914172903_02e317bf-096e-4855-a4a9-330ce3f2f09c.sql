ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

GRANT UPDATE, DELETE ON public.order_items TO authenticated;

DROP POLICY IF EXISTS "Admins update order items" ON public.order_items;
CREATE POLICY "Admins update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete order items" ON public.order_items;
CREATE POLICY "Admins delete order items" ON public.order_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

GRANT DELETE ON public.orders TO authenticated;

CREATE POLICY "Admins delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS district text NOT NULL DEFAULT '';