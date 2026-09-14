REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DROP POLICY "Anyone can view active products" ON public.products;
CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO anon USING (is_active);
CREATE POLICY "Members can view products" ON public.products FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));