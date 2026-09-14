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