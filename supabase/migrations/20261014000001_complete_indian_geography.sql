-- ============================================================
-- MIGRATION: 20261014000001_complete_indian_geography.sql
-- Complete Indian Geography: All 28 States + 8 UTs + 780+ Canonical Districts
-- Source: Local Government Directory (LGD), Ministry of Panchayati Raj, Govt of India
-- ISO 3166-2:IN Standards
-- Preserves existing Tamil Nadu (TN) ID and 4 existing district IDs
-- ============================================================

DO $$
BEGIN
    -- 1. Upsert States and Union Territories
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Andhra Pradesh', 'AP', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Arunachal Pradesh', 'AR', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Assam', 'AS', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Bihar', 'BR', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Chhattisgarh', 'CG', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Goa', 'GA', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Gujarat', 'GJ', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Haryana', 'HR', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Himachal Pradesh', 'HP', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Jharkhand', 'JH', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Karnataka', 'KA', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Kerala', 'KL', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Madhya Pradesh', 'MP', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Maharashtra', 'MH', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Manipur', 'MN', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Meghalaya', 'ML', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Mizoram', 'MZ', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Nagaland', 'NL', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Odisha', 'OD', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Punjab', 'PB', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Rajasthan', 'RJ', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Sikkim', 'SK', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (id, name, code, is_active)
    VALUES ('109a3667-5740-45ef-a3c4-f0577f9b454b', 'Tamil Nadu', 'TN', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Telangana', 'TS', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Tripura', 'TR', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Uttar Pradesh', 'UP', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Uttarakhand', 'UK', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('West Bengal', 'WB', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Andaman and Nicobar Islands', 'AN', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Chandigarh', 'CH', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Dadra and Nagar Haveli and Daman and Diu', 'DH', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Delhi', 'DL', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Jammu and Kashmir', 'JK', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Ladakh', 'LA', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Lakshadweep', 'LD', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.states (name, code, is_active)
    VALUES ('Puducherry', 'PY', TRUE)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- 2. Upsert Canonical Districts for all States & UTs

    -- Districts for AP
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Alluri Sitharama Raju', 'AP-ALL', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anakapalli', 'AP-ANA', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ananthapuramu', 'AP-NAN', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Annamayya', 'AP-ANN', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bapatla', 'AP-BAP', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chittoor', 'AP-CHI', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dr. B.R. Ambedkar Konaseema', 'AP-DRB', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Godavari', 'AP-EAS', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Eluru', 'AP-ELU', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Guntur', 'AP-GUN', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kakinada', 'AP-KAK', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Krishna', 'AP-KRI', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kurnool', 'AP-KUR', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nandyal', 'AP-AND', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'NTR', 'AP-NTR', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Palnadu', 'AP-PAL', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Parvathipuram Manyam', 'AP-PAR', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Prakasam', 'AP-PRA', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sri Potti Sriramulu Nellore', 'AP-SRI', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sri Sathya Sai', 'AP-RIS', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Srikakulam', 'AP-RIK', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tirupati', 'AP-TIR', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Visakhapatnam', 'AP-VIS', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vizianagaram', 'AP-VIZ', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Godavari', 'AP-WES', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'YSR Kadapa', 'AP-YSR', TRUE FROM public.states WHERE code = 'AP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for AR
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anjaw', 'AR-ANJ', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Changlang', 'AR-CHA', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dibang Valley', 'AR-DIB', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Kameng', 'AR-EAS', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Siang', 'AR-AST', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kamle', 'AR-KAM', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kra Daadi', 'AR-KRA', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kurung Kumey', 'AR-KUR', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lepa Rada', 'AR-LEP', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lohit', 'AR-LOH', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Longding', 'AR-LON', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lower Dibang Valley', 'AR-LOW', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lower Siang', 'AR-OWE', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lower Subansiri', 'AR-WER', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Namsai', 'AR-NAM', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pakke Kessang', 'AR-PAK', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Papum Pare', 'AR-PAP', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shi Yomi', 'AR-SHI', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Siang', 'AR-SIA', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tawang', 'AR-TAW', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tirap', 'AR-TIR', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Upper Siang', 'AR-UPP', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Upper Subansiri', 'AR-PPE', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Kameng', 'AR-WES', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Siang', 'AR-EST', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Itanagar Capital Complex', 'AR-ITA', TRUE FROM public.states WHERE code = 'AR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for AS
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Baksa', 'AS-BAK', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Barpeta', 'AS-BAR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Biswanath', 'AS-BIS', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bongaigaon', 'AS-BON', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Cachar', 'AS-CAC', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Charaideo', 'AS-CHA', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chirang', 'AS-CHI', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Darrang', 'AS-DAR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhemaji', 'AS-DHE', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhubri', 'AS-DHU', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dibrugarh', 'AS-DIB', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dima Hasao', 'AS-DIM', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Goalpara', 'AS-GOA', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Golaghat', 'AS-GOL', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hailakandi', 'AS-HAI', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hojai', 'AS-HOJ', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jorhat', 'AS-JOR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kamrup', 'AS-KAM', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kamrup Metropolitan', 'AS-AMR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karbi Anglong', 'AS-KAR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karimganj', 'AS-ARI', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kokrajhar', 'AS-KOK', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lakhimpur', 'AS-LAK', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Majuli', 'AS-MAJ', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Morigaon', 'AS-MOR', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nagaon', 'AS-NAG', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nalbari', 'AS-NAL', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sivasagar', 'AS-SIV', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sonitpur', 'AS-SON', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Salmara-Mankachar', 'AS-SOU', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tinsukia', 'AS-TIN', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Udalguri', 'AS-UDA', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Karbi Anglong', 'AS-WES', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bajali', 'AS-BAJ', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tamulpur', 'AS-TAM', TRUE FROM public.states WHERE code = 'AS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for BR
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Araria', 'BR-ARA', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Arwal', 'BR-ARW', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Aurangabad', 'BR-AUR', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Banka', 'BR-BAN', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Begusarai', 'BR-BEG', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhagalpur', 'BR-BHA', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhojpur', 'BR-BHO', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Buxar', 'BR-BUX', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Darbhanga', 'BR-DAR', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Champaran', 'BR-EAS', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gaya', 'BR-GAY', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gopalganj', 'BR-GOP', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jamui', 'BR-JAM', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jehanabad', 'BR-JEH', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kaimur', 'BR-KAI', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Katihar', 'BR-KAT', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khagaria', 'BR-KHA', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kishanganj', 'BR-KIS', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lakhisarai', 'BR-LAK', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Madhepura', 'BR-MAD', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Madhubani', 'BR-ADH', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Munger', 'BR-MUN', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Muzaffarpur', 'BR-MUZ', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nalanda', 'BR-NAL', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nawada', 'BR-NAW', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Patna', 'BR-PAT', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Purnia', 'BR-PUR', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rohtas', 'BR-ROH', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Saharsa', 'BR-SAH', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Samastipur', 'BR-SAM', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Saran', 'BR-SAR', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sheikhpura', 'BR-SHE', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sheohar', 'BR-HEO', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sitamarhi', 'BR-SIT', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Siwan', 'BR-SIW', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Supaul', 'BR-SUP', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vaishali', 'BR-VAI', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Champaran', 'BR-WES', TRUE FROM public.states WHERE code = 'BR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for CG
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balod', 'CG-BAL', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Baloda Bazar', 'CG-ALO', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balrampur', 'CG-ALR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bastar', 'CG-BAS', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bemetara', 'CG-BEM', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bijapur', 'CG-BIJ', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bilaspur', 'CG-BIL', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dantewada', 'CG-DAN', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhamtari', 'CG-DHA', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Durg', 'CG-DUR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gariaband', 'CG-GAR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gaurela-Pendra-Marwahi', 'CG-GAU', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Janjgir-Champa', 'CG-JAN', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jashpur', 'CG-JAS', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kabirdham', 'CG-KAB', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kanker', 'CG-KAN', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kondagaon', 'CG-KON', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Korba', 'CG-KOR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Koriya', 'CG-ORI', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahasamund', 'CG-MAH', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Manendragarh-Chirmiri-Bharatpur', 'CG-MAN', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mohla-Manpur-Ambagarh Chowki', 'CG-MOH', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mungeli', 'CG-MUN', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Narayanpur', 'CG-NAR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raigarh', 'CG-RAI', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raipur', 'CG-AIP', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajnandgaon', 'CG-RAJ', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sarangarh-Bilaigarh', 'CG-SAR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sakti', 'CG-SAK', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sukma', 'CG-SUK', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Surajpur', 'CG-SUR', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Surguja', 'CG-URG', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khairagarh-Chhuikhadan-Gandai', 'CG-KHA', TRUE FROM public.states WHERE code = 'CG'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for GA
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North Goa', 'GA-NOR', TRUE FROM public.states WHERE code = 'GA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Goa', 'GA-SOU', TRUE FROM public.states WHERE code = 'GA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for GJ
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ahmedabad', 'GJ-AHM', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Amreli', 'GJ-AMR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anand', 'GJ-ANA', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Aravalli', 'GJ-ARA', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Banaskantha', 'GJ-BAN', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bharuch', 'GJ-BHA', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhavnagar', 'GJ-HAV', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Botad', 'GJ-BOT', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chhota Udaipur', 'GJ-CHH', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dahod', 'GJ-DAH', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dang', 'GJ-DAN', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Devbhumi Dwarka', 'GJ-DEV', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gandhinagar', 'GJ-GAN', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gir Somnath', 'GJ-GIR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jamnagar', 'GJ-JAM', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Junagadh', 'GJ-JUN', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kheda', 'GJ-KHE', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kutch', 'GJ-KUT', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahisagar', 'GJ-MAH', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mehsana', 'GJ-MEH', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Morbi', 'GJ-MOR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Narmada', 'GJ-NAR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Navsari', 'GJ-NAV', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Panchmahal', 'GJ-PAN', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Patan', 'GJ-PAT', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Porbandar', 'GJ-POR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajkot', 'GJ-RAJ', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sabarkantha', 'GJ-SAB', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Surat', 'GJ-SUR', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Surendranagar', 'GJ-URE', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tapi', 'GJ-TAP', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vadodara', 'GJ-VAD', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Valsad', 'GJ-VAL', TRUE FROM public.states WHERE code = 'GJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for HR
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ambala', 'HR-AMB', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhiwani', 'HR-BHI', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Charkhi Dadri', 'HR-CHA', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Faridabad', 'HR-FAR', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Fatehabad', 'HR-FAT', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gurugram', 'HR-GUR', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hisar', 'HR-HIS', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhajjar', 'HR-JHA', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jind', 'HR-JIN', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kaithal', 'HR-KAI', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karnal', 'HR-KAR', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kurukshetra', 'HR-KUR', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahendragarh', 'HR-MAH', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nuh', 'HR-NUH', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Palwal', 'HR-PAL', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Panchkula', 'HR-PAN', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Panipat', 'HR-ANI', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rewari', 'HR-REW', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rohtak', 'HR-ROH', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sirsa', 'HR-SIR', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sonipat', 'HR-SON', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Yamunanagar', 'HR-YAM', TRUE FROM public.states WHERE code = 'HR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for HP
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bilaspur', 'HP-BIL', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chamba', 'HP-CHA', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hamirpur', 'HP-HAM', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kangra', 'HP-KAN', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kinnaur', 'HP-KIN', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kullu', 'HP-KUL', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lahaul and Spiti', 'HP-LAH', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mandi', 'HP-MAN', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shimla', 'HP-SHI', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sirmaur', 'HP-SIR', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Solan', 'HP-SOL', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Una', 'HP-UNA', TRUE FROM public.states WHERE code = 'HP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for JH
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bokaro', 'JH-BOK', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chatra', 'JH-CHA', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Deoghar', 'JH-DEO', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhanbad', 'JH-DHA', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dumka', 'JH-DUM', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Singhbhum', 'JH-EAS', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Garhwa', 'JH-GAR', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Giridih', 'JH-GIR', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Godda', 'JH-GOD', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gumla', 'JH-GUM', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hazaribagh', 'JH-HAZ', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jamtara', 'JH-JAM', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khunti', 'JH-KHU', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Koderma', 'JH-KOD', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Latehar', 'JH-LAT', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lohardaga', 'JH-LOH', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pakur', 'JH-PAK', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Palamu', 'JH-PAL', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ramgarh', 'JH-RAM', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ranchi', 'JH-RAN', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sahebganj', 'JH-SAH', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Seraikela Kharsawan', 'JH-SER', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Simdega', 'JH-SIM', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Singhbhum', 'JH-WES', TRUE FROM public.states WHERE code = 'JH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for KA
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bagalkot', 'KA-BAG', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ballari', 'KA-BAL', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Belagavi', 'KA-BEL', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bengaluru Rural', 'KA-BEN', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bengaluru Urban', 'KA-ENG', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bidar', 'KA-BID', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chamarajanagar', 'KA-CHA', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chikkaballapur', 'KA-CHI', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chikkamagaluru', 'KA-HIK', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chitradurga', 'KA-HIT', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dakshina Kannada', 'KA-DAK', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Davanagere', 'KA-DAV', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dharwad', 'KA-DHA', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gadag', 'KA-GAD', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hassan', 'KA-HAS', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Haveri', 'KA-HAV', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kalaburagi', 'KA-KAL', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kodagu', 'KA-KOD', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kolar', 'KA-KOL', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Koppal', 'KA-KOP', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mandya', 'KA-MAN', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mysuru', 'KA-MYS', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raichur', 'KA-RAI', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ramanagara', 'KA-RAM', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shivamogga', 'KA-SHI', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tumakuru', 'KA-TUM', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Udupi', 'KA-UDU', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Uttara Kannada', 'KA-UTT', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vijayanagara', 'KA-VIJ', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vijayapura', 'KA-IJA', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Yadgir', 'KA-YAD', TRUE FROM public.states WHERE code = 'KA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for KL
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Alappuzha', 'KL-ALA', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ernakulam', 'KL-ERN', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Idukki', 'KL-IDU', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kannur', 'KL-KAN', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kasaragod', 'KL-KAS', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kollam', 'KL-KOL', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kottayam', 'KL-KOT', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kozhikode', 'KL-KOZ', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Malappuram', 'KL-MAL', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Palakkad', 'KL-PAL', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pathanamthitta', 'KL-PAT', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thiruvananthapuram', 'KL-THI', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thrissur', 'KL-THR', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Wayanad', 'KL-WAY', TRUE FROM public.states WHERE code = 'KL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for MP
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Agar Malwa', 'MP-AGA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Alirajpur', 'MP-ALI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anuppur', 'MP-ANU', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ashoknagar', 'MP-ASH', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balaghat', 'MP-BAL', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Barwani', 'MP-BAR', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Betul', 'MP-BET', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhind', 'MP-BHI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhopal', 'MP-BHO', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Burhanpur', 'MP-BUR', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chhatarpur', 'MP-CHH', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chhindwara', 'MP-HHI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Damoh', 'MP-DAM', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Datia', 'MP-DAT', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dewas', 'MP-DEW', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhar', 'MP-DHA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dindori', 'MP-DIN', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Guna', 'MP-GUN', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gwalior', 'MP-GWA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Harda', 'MP-HAR', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hoshangabad', 'MP-HOS', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Indore', 'MP-IND', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jabalpur', 'MP-JAB', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhabua', 'MP-JHA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Katni', 'MP-KAT', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khandwa', 'MP-KHA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khargone', 'MP-ARG', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mandla', 'MP-MAN', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mandsaur', 'MP-AND', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Morena', 'MP-MOR', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Narsinghpur', 'MP-NAR', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Neemuch', 'MP-NEE', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Niwari', 'MP-NIW', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Panna', 'MP-PAN', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raisen', 'MP-RAI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajgarh', 'MP-RAJ', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ratlam', 'MP-RAT', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rewa', 'MP-REW', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sagar', 'MP-SAG', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Satna', 'MP-SAT', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sehore', 'MP-SEH', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Seoni', 'MP-SEO', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shahdol', 'MP-SHA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shajapur', 'MP-HAJ', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sheopur', 'MP-SHE', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shivpuri', 'MP-SHI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sidhi', 'MP-SID', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Singrauli', 'MP-SIN', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tikamgarh', 'MP-TIK', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ujjain', 'MP-UJJ', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Umaria', 'MP-UMA', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vidisha', 'MP-VID', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mauganj', 'MP-MAU', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Maihar', 'MP-MAI', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pandhurna', 'MP-NDH', TRUE FROM public.states WHERE code = 'MP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for MH
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ahmednagar', 'MH-AHM', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Akola', 'MH-AKO', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Amravati', 'MH-AMR', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chhatrapati Sambhajinagar', 'MH-CHH', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Beed', 'MH-BEE', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhandara', 'MH-BHA', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Buldhana', 'MH-BUL', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chandrapur', 'MH-CHA', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhule', 'MH-DHU', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gadchiroli', 'MH-GAD', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gondia', 'MH-GON', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hingoli', 'MH-HIN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalgaon', 'MH-JAL', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalna', 'MH-ALN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kolhapur', 'MH-KOL', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Latur', 'MH-LAT', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mumbai City', 'MH-MUM', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mumbai Suburban', 'MH-UMB', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nagpur', 'MH-NAG', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nanded', 'MH-NAN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nandurbar', 'MH-AND', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nashik', 'MH-NAS', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dharashiv', 'MH-DHA', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Palghar', 'MH-PAL', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Parbhani', 'MH-PAR', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pune', 'MH-PUN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raigad', 'MH-RAI', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ratnagiri', 'MH-RAT', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sangli', 'MH-SAN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Satara', 'MH-SAT', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sindhudurg', 'MH-SIN', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Solapur', 'MH-SOL', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thane', 'MH-THA', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Wardha', 'MH-WAR', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Washim', 'MH-WAS', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Yavatmal', 'MH-YAV', TRUE FROM public.states WHERE code = 'MH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for MN
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bishnupur', 'MN-BIS', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chandel', 'MN-CHA', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Churachandpur', 'MN-CHU', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Imphal East', 'MN-IMP', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Imphal West', 'MN-MPH', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jiribam', 'MN-JIR', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kakching', 'MN-KAK', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kamjong', 'MN-KAM', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kangpokpi', 'MN-KAN', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Noney', 'MN-NON', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pherzawl', 'MN-PHE', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Senapati', 'MN-SEN', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tamenglong', 'MN-TAM', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tengnoupal', 'MN-TEN', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thoubal', 'MN-THO', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ukhrul', 'MN-UKH', TRUE FROM public.states WHERE code = 'MN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for ML
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Eastern West Khasi Hills', 'ML-EAS', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Garo Hills', 'ML-AST', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Jaintia Hills', 'ML-STJ', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Khasi Hills', 'ML-STK', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North Garo Hills', 'ML-NOR', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ri Bhoi', 'ML-RIB', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Garo Hills', 'ML-SOU', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South West Garo Hills', 'ML-OUT', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South West Khasi Hills', 'ML-UTH', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Garo Hills', 'ML-WES', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Jaintia Hills', 'ML-EST', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Khasi Hills', 'ML-TKH', TRUE FROM public.states WHERE code = 'ML'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for MZ
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Aizawl', 'MZ-AIZ', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Champhai', 'MZ-CHA', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hnahthial', 'MZ-HNA', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khawzawl', 'MZ-KHA', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kolasib', 'MZ-KOL', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lawngtlai', 'MZ-LAW', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lunglei', 'MZ-LUN', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mamit', 'MZ-MAM', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Saiha', 'MZ-SAI', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Saitual', 'MZ-AIT', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Serchhip', 'MZ-SER', TRUE FROM public.states WHERE code = 'MZ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for NL
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chumoukedima', 'NL-CHU', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dimapur', 'NL-DIM', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kiphire', 'NL-KIP', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kohima', 'NL-KOH', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Longleng', 'NL-LON', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mokokchung', 'NL-MOK', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mon', 'NL-MON', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Niuland', 'NL-NIU', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Noklak', 'NL-NOK', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Peren', 'NL-PER', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Phek', 'NL-PHE', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shamator', 'NL-SHA', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tseminyu', 'NL-TSE', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tuensang', 'NL-TUE', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Wokha', 'NL-WOK', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Zunheboto', 'NL-ZUN', TRUE FROM public.states WHERE code = 'NL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for OD
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Angul', 'OD-ANG', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balangir', 'OD-BAL', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balasore', 'OD-ALA', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bargarh', 'OD-BAR', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhadrak', 'OD-BHA', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Boudh', 'OD-BOU', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Cuttack', 'OD-CUT', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Deogarh', 'OD-DEO', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhenkanal', 'OD-DHE', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gajapati', 'OD-GAJ', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ganjam', 'OD-GAN', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jagatsinghpur', 'OD-JAG', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jajpur', 'OD-JAJ', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jharsuguda', 'OD-JHA', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kalahandi', 'OD-KAL', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kandhamal', 'OD-KAN', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kendrapara', 'OD-KEN', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kendujhar', 'OD-END', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khordha', 'OD-KHO', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Koraput', 'OD-KOR', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Malkangiri', 'OD-MAL', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mayurbhanj', 'OD-MAY', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nabarangpur', 'OD-NAB', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nayagarh', 'OD-NAY', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nuapada', 'OD-NUA', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Puri', 'OD-PUR', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rayagada', 'OD-RAY', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sambalpur', 'OD-SAM', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Subarnapur', 'OD-SUB', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sundargarh', 'OD-SUN', TRUE FROM public.states WHERE code = 'OD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for PB
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Amritsar', 'PB-AMR', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Barnala', 'PB-BAR', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bathinda', 'PB-BAT', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Faridkot', 'PB-FAR', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Fatehgarh Sahib', 'PB-FAT', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Fazilka', 'PB-FAZ', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ferozepur', 'PB-FER', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gurdaspur', 'PB-GUR', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hoshiarpur', 'PB-HOS', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalandhar', 'PB-JAL', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kapurthala', 'PB-KAP', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ludhiana', 'PB-LUD', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Malerkotla', 'PB-MAL', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mansa', 'PB-MAN', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Moga', 'PB-MOG', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Muktsar', 'PB-MUK', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pathankot', 'PB-PAT', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Patiala', 'PB-ATI', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rupnagar', 'PB-RUP', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sahibzada Ajit Singh Nagar', 'PB-SAH', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sangrur', 'PB-SAN', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shahid Bhagat Singh Nagar', 'PB-SHA', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tarn Taran', 'PB-TAR', TRUE FROM public.states WHERE code = 'PB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for RJ
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ajmer', 'RJ-AJM', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Alwar', 'RJ-ALW', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anupgarh', 'RJ-ANU', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balotra', 'RJ-BAL', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Banswara', 'RJ-BAN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Baran', 'RJ-BAR', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Barmer', 'RJ-ARM', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Beawar', 'RJ-BEA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bharatpur', 'RJ-BHA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhilwara', 'RJ-BHI', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bikaner', 'RJ-BIK', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bundi', 'RJ-BUN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chittorgarh', 'RJ-CHI', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Churu', 'RJ-CHU', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dausa', 'RJ-DAU', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Deeg', 'RJ-DEE', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dholpur', 'RJ-DHO', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Didwana-Kuchaman', 'RJ-DID', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dudu', 'RJ-DUD', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dungarpur', 'RJ-DUN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gangapur City', 'RJ-GAN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hanumangarh', 'RJ-HAN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jaipur', 'RJ-JAI', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jaipur Rural', 'RJ-AIP', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jaisalmer', 'RJ-AIS', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalore', 'RJ-JAL', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhalawar', 'RJ-JHA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhunjhunu', 'RJ-JHU', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jodhpur', 'RJ-JOD', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jodhpur Rural', 'RJ-ODH', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karauli', 'RJ-KAR', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kekri', 'RJ-KEK', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khairthal-Tijara', 'RJ-KHA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kota', 'RJ-KOT', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kotputli-Behror', 'RJ-OTP', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nagaur', 'RJ-NAG', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Neem Ka Thana', 'RJ-NEE', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pali', 'RJ-PAL', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Phalodi', 'RJ-PHA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pratapgarh', 'RJ-PRA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajsamand', 'RJ-RAJ', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Salumbar', 'RJ-SAL', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sanchore', 'RJ-SAN', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sawai Madhopur', 'RJ-SAW', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shahpura', 'RJ-SHA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sikar', 'RJ-SIK', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sirohi', 'RJ-SIR', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sri Ganganagar', 'RJ-SRI', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tonk', 'RJ-TON', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Udaipur', 'RJ-UDA', TRUE FROM public.states WHERE code = 'RJ'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for SK
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gangtok', 'SK-GAN', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gyalshing', 'SK-GYA', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mangan', 'SK-MAN', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Namchi', 'SK-NAM', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pakyong', 'SK-PAK', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Soreng', 'SK-SOR', TRUE FROM public.states WHERE code = 'SK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for TN
    INSERT INTO public.districts (id, state_id, name, code, is_active)
    SELECT '3e2066a5-5c0f-4b7e-b88a-bf80dd1542a9', id, 'Chennai', 'TN-CHN', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (id, state_id, name, code, is_active)
    SELECT '0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4', id, 'Coimbatore', 'TN-CBE', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (id, state_id, name, code, is_active)
    SELECT 'e925c2e3-0579-4e8f-b660-07d0812b17b5', id, 'Madurai', 'TN-MDU', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (id, state_id, name, code, is_active)
    SELECT '74dbc264-3673-457b-9884-89e4bb673655', id, 'Salem', 'TN-SLM', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ariyalur', 'TN-ARI', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chengalpattu', 'TN-CHE', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Cuddalore', 'TN-CUD', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dharmapuri', 'TN-DHA', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dindigul', 'TN-DIN', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Erode', 'TN-ERO', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kallakurichi', 'TN-KAL', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kanchipuram', 'TN-KAN', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kanyakumari', 'TN-ANY', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karur', 'TN-KAR', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Krishnagiri', 'TN-KRI', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mayiladuthurai', 'TN-MAY', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nagapattinam', 'TN-NAG', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Namakkal', 'TN-NAM', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nilgiris', 'TN-NIL', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Perambalur', 'TN-PER', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pudukkottai', 'TN-PUD', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ramanathapuram', 'TN-RAM', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ranipet', 'TN-RAN', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sivaganga', 'TN-SIV', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tenkasi', 'TN-TEN', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thanjavur', 'TN-THA', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Theni', 'TN-THE', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Thoothukudi', 'TN-THO', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tiruchirappalli', 'TN-TIR', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tirunelveli', 'TN-IRU', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tirupathur', 'TN-RUP', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tiruppur', 'TN-UPP', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tiruvallur', 'TN-RUV', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tiruvannamalai', 'TN-UVA', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tiruvarur', 'TN-VAR', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vellore', 'TN-VEL', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Viluppuram', 'TN-VIL', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Virudhunagar', 'TN-VIR', TRUE FROM public.states WHERE code = 'TN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for TS
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Adilabad', 'TS-ADI', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhadradri Kothagudem', 'TS-BHA', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hanamkonda', 'TS-HAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hyderabad', 'TS-HYD', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jagtial', 'TS-JAG', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jangaon', 'TS-JAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jayashankar Bhupalpally', 'TS-JAY', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jogulamba Gadwal', 'TS-JOG', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kamareddy', 'TS-KAM', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karimnagar', 'TS-KAR', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khammam', 'TS-KHA', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kumuram Bheem Asifabad', 'TS-KUM', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahabubabad', 'TS-MAH', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahabubnagar', 'TS-AHA', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mancherial', 'TS-MAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Medak', 'TS-MED', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Medchal-Malkajgiri', 'TS-EDC', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mulugu', 'TS-MUL', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nagarkurnool', 'TS-NAG', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nalgonda', 'TS-NAL', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Narayanpet', 'TS-NAR', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nirmal', 'TS-NIR', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nizamabad', 'TS-NIZ', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Peddapalli', 'TS-PED', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajanna Sircilla', 'TS-RAJ', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ranga Reddy', 'TS-RAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sangareddy', 'TS-SAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Siddipet', 'TS-SID', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Suryapet', 'TS-SUR', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Vikarabad', 'TS-VIK', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Wanaparthy', 'TS-WAN', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Warangal', 'TS-WAR', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Yadadri Bhuvanagiri', 'TS-YAD', TRUE FROM public.states WHERE code = 'TS'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for TR
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dhalai', 'TR-DHA', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gomati', 'TR-GOM', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Khowai', 'TR-KHO', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North Tripura', 'TR-NOR', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sepahijala', 'TR-SEP', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Tripura', 'TR-SOU', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Unakoti', 'TR-UNA', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Tripura', 'TR-WES', TRUE FROM public.states WHERE code = 'TR'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for UP
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Agra', 'UP-AGR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Aligarh', 'UP-ALI', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ambedkar Nagar', 'UP-AMB', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Amethi', 'UP-AME', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Amroha', 'UP-AMR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Auraiya', 'UP-AUR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ayodhya', 'UP-AYO', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Azamgarh', 'UP-AZA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Baghpat', 'UP-BAG', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bahraich', 'UP-BAH', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ballia', 'UP-BAL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Balrampur', 'UP-ALR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Banda', 'UP-BAN', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Barabanki', 'UP-BAR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bareilly', 'UP-ARE', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Basti', 'UP-BAS', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bhadohi', 'UP-BHA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bijnor', 'UP-BIJ', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Budaun', 'UP-BUD', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bulandshahr', 'UP-BUL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chandauli', 'UP-CHA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chitrakoot', 'UP-CHI', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Deoria', 'UP-DEO', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Etah', 'UP-ETA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Etawah', 'UP-TAW', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Farrukhabad', 'UP-FAR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Fatehpur', 'UP-FAT', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Firozabad', 'UP-FIR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gautam Buddha Nagar', 'UP-GAU', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ghaziabad', 'UP-GHA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ghazipur', 'UP-HAZ', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gonda', 'UP-GON', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Gorakhpur', 'UP-GOR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hamirpur', 'UP-HAM', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hapur', 'UP-HAP', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hardoi', 'UP-HAR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hathras', 'UP-HAT', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalaun', 'UP-JAL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jaunpur', 'UP-JAU', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhansi', 'UP-JHA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kannauj', 'UP-KAN', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kanpur Dehat', 'UP-ANP', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kanpur Nagar', 'UP-NPU', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kasganj', 'UP-KAS', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kaushambi', 'UP-KAU', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kheri', 'UP-KHE', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kushinagar', 'UP-KUS', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lalitpur', 'UP-LAL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lucknow', 'UP-LUC', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Maharajganj', 'UP-MAH', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahoba', 'UP-AHO', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mainpuri', 'UP-MAI', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mathura', 'UP-MAT', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mau', 'UP-MAU', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Meerut', 'UP-MEE', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mirzapur', 'UP-MIR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Moradabad', 'UP-MOR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Muzaffarnagar', 'UP-MUZ', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pilibhit', 'UP-PIL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pratapgarh', 'UP-PRA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Prayagraj', 'UP-RAY', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Raebareli', 'UP-RAE', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rampur', 'UP-RAM', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Saharanpur', 'UP-SAH', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sambhal', 'UP-SAM', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sant Kabir Nagar', 'UP-SAN', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shahjahanpur', 'UP-SHA', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shamli', 'UP-AML', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shravasti', 'UP-SHR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Siddharthnagar', 'UP-SID', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sitapur', 'UP-SIT', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sonbhadra', 'UP-SON', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Sultanpur', 'UP-SUL', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Unnao', 'UP-UNN', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Varanasi', 'UP-VAR', TRUE FROM public.states WHERE code = 'UP'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for UK
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Almora', 'UK-ALM', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bageshwar', 'UK-BAG', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chamoli', 'UK-CHA', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Champawat', 'UK-HAM', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dehradun', 'UK-DEH', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Haridwar', 'UK-HAR', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nainital', 'UK-NAI', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pauri Garhwal', 'UK-PAU', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pithoragarh', 'UK-PIT', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rudraprayag', 'UK-RUD', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Tehri Garhwal', 'UK-TEH', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Udham Singh Nagar', 'UK-UDH', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Uttarkashi', 'UK-UTT', TRUE FROM public.states WHERE code = 'UK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for WB
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Alipurduar', 'WB-ALI', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bankura', 'WB-BAN', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Birbhum', 'WB-BIR', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Cooch Behar', 'WB-COO', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dakshin Dinajpur', 'WB-DAK', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Darjeeling', 'WB-DAR', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Hooghly', 'WB-HOO', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Howrah', 'WB-HOW', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jalpaiguri', 'WB-JAL', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jhargram', 'WB-JHA', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kalimpong', 'WB-KAL', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kolkata', 'WB-KOL', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Malda', 'WB-MAL', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Murshidabad', 'WB-MUR', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nadia', 'WB-NAD', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North 24 Parganas', 'WB-NOR', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Paschim Bardhaman', 'WB-PAS', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Paschim Medinipur', 'WB-ASC', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Purba Bardhaman', 'WB-PUR', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Purba Medinipur', 'WB-URB', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Purulia', 'WB-URU', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South 24 Parganas', 'WB-SOU', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Uttar Dinajpur', 'WB-UTT', TRUE FROM public.states WHERE code = 'WB'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for AN
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Nicobar', 'AN-NIC', TRUE FROM public.states WHERE code = 'AN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North and Middle Andaman', 'AN-NOR', TRUE FROM public.states WHERE code = 'AN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Andaman', 'AN-SOU', TRUE FROM public.states WHERE code = 'AN'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for CH
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Chandigarh', 'CH-CHA', TRUE FROM public.states WHERE code = 'CH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for DH
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Dadra and Nagar Haveli', 'DH-DAD', TRUE FROM public.states WHERE code = 'DH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Daman', 'DH-DAM', TRUE FROM public.states WHERE code = 'DH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Diu', 'DH-DIU', TRUE FROM public.states WHERE code = 'DH'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for DL
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Central Delhi', 'DL-CEN', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'East Delhi', 'DL-EAS', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'New Delhi', 'DL-NEW', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North Delhi', 'DL-NOR', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North East Delhi', 'DL-ORT', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'North West Delhi', 'DL-RTH', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shahdara', 'DL-SHA', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South Delhi', 'DL-SOU', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South East Delhi', 'DL-OUT', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'South West Delhi', 'DL-UTH', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'West Delhi', 'DL-WES', TRUE FROM public.states WHERE code = 'DL'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for JK
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Anantnag', 'JK-ANA', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Bandipora', 'JK-BAN', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Baramulla', 'JK-BAR', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Budgam', 'JK-BUD', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Doda', 'JK-DOD', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ganderbal', 'JK-GAN', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Jammu', 'JK-JAM', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kathua', 'JK-KAT', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kishtwar', 'JK-KIS', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kulgam', 'JK-KUL', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kupwara', 'JK-KUP', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Poonch', 'JK-POO', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Pulwama', 'JK-PUL', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Rajouri', 'JK-RAJ', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Ramban', 'JK-RAM', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Reasi', 'JK-REA', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Samba', 'JK-SAM', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Shopian', 'JK-SHO', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Srinagar', 'JK-SRI', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Udhampur', 'JK-UDH', TRUE FROM public.states WHERE code = 'JK'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for LA
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Kargil', 'LA-KAR', TRUE FROM public.states WHERE code = 'LA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Leh', 'LA-LEH', TRUE FROM public.states WHERE code = 'LA'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for LD
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Lakshadweep', 'LD-LAK', TRUE FROM public.states WHERE code = 'LD'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

    -- Districts for PY
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Karaikal', 'PY-KAR', TRUE FROM public.states WHERE code = 'PY'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Mahe', 'PY-MAH', TRUE FROM public.states WHERE code = 'PY'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Puducherry', 'PY-PUD', TRUE FROM public.states WHERE code = 'PY'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;
    INSERT INTO public.districts (state_id, name, code, is_active)
    SELECT id, 'Yanam', 'PY-YAN', TRUE FROM public.states WHERE code = 'PY'
    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

END $$;

-- Allow anon users to read active states and districts for public registration & discovery
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'states' AND policyname = 'Public can read active states'
    ) THEN
        CREATE POLICY "Public can read active states" ON public.states FOR SELECT TO anon USING (is_active = true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'districts' AND policyname = 'Public can read active districts'
    ) THEN
        CREATE POLICY "Public can read active districts" ON public.districts FOR SELECT TO anon USING (is_active = true);
    END IF;
END $$;
