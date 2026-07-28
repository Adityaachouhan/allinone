/*
# Fix personal-care category icon name

The seed migration (0002) used icon_name 'Spa' for the Personal Care category, but that
icon does not exist in the installed lucide-react version. This updates it to 'SprayCan'.
*/

UPDATE public.categories
SET icon_name = 'SprayCan'
WHERE slug = 'personal-care' AND icon_name = 'Spa';
