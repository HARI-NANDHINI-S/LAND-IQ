-- ============================================================
-- Fix Geography UUIDs
-- ============================================================
-- The original seed data used pseudo-UUIDs (e.g., 10000000-0000-0000-0000-000000000001).
-- Zod's z.uuid() requires valid UUIDv4.
-- This migration updates those IDs to real UUIDv4s safely.

DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 1. Create a temporary mapping table
    CREATE TEMP TABLE geo_mapping (
        table_name TEXT,
        old_id UUID,
        new_id UUID DEFAULT public.uuid_generate_v4()
    );

    -- 2. Populate mapping
    INSERT INTO geo_mapping (table_name, old_id)
    SELECT 'states', id FROM public.states;
    
    INSERT INTO geo_mapping (table_name, old_id)
    SELECT 'districts', id FROM public.districts;
    
    INSERT INTO geo_mapping (table_name, old_id)
    SELECT 'taluks', id FROM public.taluks;
    
    INSERT INTO geo_mapping (table_name, old_id)
    SELECT 'villages', id FROM public.villages;

    -- 3. Temporarily set all foreign keys referencing these tables to DEFERRABLE
    -- (We will dynamically alter all foreign keys that reference states, districts, taluks, villages)
    FOR r IN 
        SELECT conrelid::regclass::text AS tbl, conname AS cons
        FROM pg_constraint 
        WHERE confrelid IN ('public.states'::regclass, 'public.districts'::regclass, 'public.taluks'::regclass, 'public.villages'::regclass)
          AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.cons);
    END LOOP;

    -- We also need to drop the primary keys so we can update them
    ALTER TABLE public.villages DROP CONSTRAINT IF EXISTS villages_pkey CASCADE;
    ALTER TABLE public.taluks DROP CONSTRAINT IF EXISTS taluks_pkey CASCADE;
    ALTER TABLE public.districts DROP CONSTRAINT IF EXISTS districts_pkey CASCADE;
    ALTER TABLE public.states DROP CONSTRAINT IF EXISTS states_pkey CASCADE;

    -- 4. Update the IDs
    
    -- States
    UPDATE public.states s SET id = m.new_id FROM geo_mapping m WHERE m.table_name = 'states' AND m.old_id = s.id;
    UPDATE public.districts d SET state_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'states' AND m.old_id = d.state_id;
    UPDATE public.profiles p SET state_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'states' AND m.old_id = p.state_id;
    UPDATE public.land_records l SET state_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'states' AND m.old_id = l.state_id;
    UPDATE public.documents doc SET state_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'states' AND m.old_id = doc.state_id;

    -- Districts
    UPDATE public.districts d SET id = m.new_id FROM geo_mapping m WHERE m.table_name = 'districts' AND m.old_id = d.id;
    UPDATE public.taluks t SET district_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'districts' AND m.old_id = t.district_id;
    UPDATE public.profiles p SET district_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'districts' AND m.old_id = p.district_id;
    UPDATE public.land_records l SET district_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'districts' AND m.old_id = l.district_id;
    UPDATE public.documents doc SET district_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'districts' AND m.old_id = doc.district_id;

    -- Taluks
    UPDATE public.taluks t SET id = m.new_id FROM geo_mapping m WHERE m.table_name = 'taluks' AND m.old_id = t.id;
    UPDATE public.villages v SET taluk_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'taluks' AND m.old_id = v.taluk_id;
    UPDATE public.land_records l SET taluk_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'taluks' AND m.old_id = l.taluk_id;

    -- Villages
    UPDATE public.villages v SET id = m.new_id FROM geo_mapping m WHERE m.table_name = 'villages' AND m.old_id = v.id;
    UPDATE public.profiles p SET village_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'villages' AND m.old_id = p.village_id;
    UPDATE public.land_records l SET village_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'villages' AND m.old_id = l.village_id;
    UPDATE public.documents doc SET village_id = m.new_id FROM geo_mapping m WHERE m.table_name = 'villages' AND m.old_id = doc.village_id;

    -- 5. Re-add Primary Keys
    ALTER TABLE public.states ADD PRIMARY KEY (id);
    ALTER TABLE public.districts ADD PRIMARY KEY (id);
    ALTER TABLE public.taluks ADD PRIMARY KEY (id);
    ALTER TABLE public.villages ADD PRIMARY KEY (id);

    -- 6. Re-add Foreign Keys with CASCADE
    ALTER TABLE public.districts ADD CONSTRAINT districts_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE public.taluks ADD CONSTRAINT taluks_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON UPDATE CASCADE ON DELETE CASCADE;
    ALTER TABLE public.villages ADD CONSTRAINT villages_taluk_id_fkey FOREIGN KEY (taluk_id) REFERENCES public.taluks(id) ON UPDATE CASCADE ON DELETE CASCADE;

    ALTER TABLE public.profiles ADD CONSTRAINT profiles_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON UPDATE CASCADE;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON UPDATE CASCADE;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_village_id_fkey FOREIGN KEY (village_id) REFERENCES public.villages(id) ON UPDATE CASCADE;

    ALTER TABLE public.land_records ADD CONSTRAINT land_records_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON UPDATE CASCADE;
    ALTER TABLE public.land_records ADD CONSTRAINT land_records_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON UPDATE CASCADE;
    ALTER TABLE public.land_records ADD CONSTRAINT land_records_taluk_id_fkey FOREIGN KEY (taluk_id) REFERENCES public.taluks(id) ON UPDATE CASCADE;
    ALTER TABLE public.land_records ADD CONSTRAINT land_records_village_id_fkey FOREIGN KEY (village_id) REFERENCES public.villages(id) ON UPDATE CASCADE;

    ALTER TABLE public.documents ADD CONSTRAINT documents_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON UPDATE CASCADE;
    ALTER TABLE public.documents ADD CONSTRAINT documents_district_id_fkey FOREIGN KEY (district_id) REFERENCES public.districts(id) ON UPDATE CASCADE;
    ALTER TABLE public.documents ADD CONSTRAINT documents_village_id_fkey FOREIGN KEY (village_id) REFERENCES public.villages(id) ON UPDATE CASCADE;

    DROP TABLE geo_mapping;
END $$;
