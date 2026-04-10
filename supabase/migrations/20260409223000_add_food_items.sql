-- Create food_items table
CREATE TABLE public.food_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID REFERENCES public.listings(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  category      TEXT NOT NULL CHECK (category IN (
                  'cooked_meal',
                  'bread_bakery',
                  'snacks_starters',
                  'dessert_sweets',
                  'raw_produce',
                  'dairy',
                  'beverages',
                  'packaged_dry'
                )),
  veg_status    TEXT NOT NULL CHECK (veg_status IN ('veg', 'non_veg', 'jain')),
  quantity_kg   DECIMAL(6,2) NOT NULL CHECK (quantity_kg > 0),
  
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view food_items" ON public.food_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Donors can create food_items for their listings" ON public.food_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.listings WHERE id = listing_id AND donor_id = auth.uid())
);

-- Note: quantity and food_type columns are kept in listings temporarily

-- Create RPC function to atomically insert a listing with its items
CREATE OR REPLACE FUNCTION public.create_listing_with_items(
  p_donor_id UUID,
  p_food_name TEXT,
  p_food_type TEXT,
  p_quantity INTEGER,
  p_expiry_time TIMESTAMP WITH TIME ZONE,
  p_pickup_location TEXT,
  p_urgency TEXT,
  p_items JSONB
) RETURNS UUID AS $$
DECLARE
  v_listing_id UUID;
  v_item JSONB;
BEGIN
  -- Validate user is inserting their own listing
  IF auth.uid() != p_donor_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Insert into listings
  INSERT INTO public.listings (donor_id, food_name, food_type, quantity, expiry_time, pickup_location, urgency)
  VALUES (p_donor_id, p_food_name, p_food_type, p_quantity, p_expiry_time, p_pickup_location, p_urgency)
  RETURNING id INTO v_listing_id;

  -- Insert into food_items array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.food_items (listing_id, name, category, veg_status, quantity_kg)
    VALUES (
      v_listing_id,
      v_item->>'name',
      v_item->>'category',
      v_item->>'veg_status',
      (v_item->>'quantity_kg')::DECIMAL
    );
  END LOOP;

  RETURN v_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
