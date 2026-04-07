
-- Drop the overly permissive policy
DROP POLICY "NGOs can update listing status" ON public.listings;

-- Replace with a function-based approach: NGOs can update status only
CREATE OR REPLACE FUNCTION public.accept_listing(p_listing_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify caller is an NGO
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ngo') THEN
    RAISE EXCEPTION 'Only NGOs can accept listings';
  END IF;
  
  -- Update listing status
  UPDATE public.listings SET status = 'accepted' WHERE id = p_listing_id AND status = 'pending';
  
  -- Create acceptance record
  INSERT INTO public.acceptances (listing_id, ngo_id) VALUES (p_listing_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
