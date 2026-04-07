
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('donor', 'ngo')),
  location TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Create listings table
CREATE TABLE public.listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  food_type TEXT NOT NULL CHECK (food_type IN ('veg', 'non-veg')),
  quantity INTEGER NOT NULL DEFAULT 1,
  expiry_time TIMESTAMP WITH TIME ZONE NOT NULL,
  pickup_location TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up')),
  urgency TEXT NOT NULL DEFAULT 'safe' CHECK (urgency IN ('urgent', 'medium', 'safe')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view listings" ON public.listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Donors can create their own listings" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_id);
CREATE POLICY "Donors can update their own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = donor_id);

-- Create acceptances table
CREATE TABLE public.acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'picked_up'))
);

ALTER TABLE public.acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view acceptances" ON public.acceptances FOR SELECT TO authenticated USING (true);
CREATE POLICY "NGOs can create acceptances" ON public.acceptances FOR INSERT TO authenticated WITH CHECK (auth.uid() = ngo_id);
CREATE POLICY "NGOs can update their own acceptances" ON public.acceptances FOR UPDATE TO authenticated USING (auth.uid() = ngo_id);

-- Allow NGOs to update listing status when accepting
CREATE POLICY "NGOs can update listing status" ON public.listings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create storage bucket for food images
INSERT INTO storage.buckets (id, name, public) VALUES ('food-images', 'food-images', true);

CREATE POLICY "Anyone can view food images" ON storage.objects FOR SELECT USING (bucket_id = 'food-images');
CREATE POLICY "Authenticated users can upload food images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-images');

-- Trigger to auto-create profile on signup (via database function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, role, location)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'donor'), COALESCE(NEW.raw_user_meta_data->>'location', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
