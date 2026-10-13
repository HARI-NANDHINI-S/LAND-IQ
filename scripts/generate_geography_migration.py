# Script to generate complete, authentic Indian Geography SQL migration
# Sources: Local Government Directory (LGD) - Ministry of Panchayati Raj, Government of India
# ISO 3166-2:IN codes

import json
import uuid

# All 28 States + 8 Union Territories
STATES_DATA = [
    # 28 States
    {"code": "AP", "name": "Andhra Pradesh", "is_ut": False},
    {"code": "AR", "name": "Arunachal Pradesh", "is_ut": False},
    {"code": "AS", "name": "Assam", "is_ut": False},
    {"code": "BR", "name": "Bihar", "is_ut": False},
    {"code": "CG", "name": "Chhattisgarh", "is_ut": False},
    {"code": "GA", "name": "Goa", "is_ut": False},
    {"code": "GJ", "name": "Gujarat", "is_ut": False},
    {"code": "HR", "name": "Haryana", "is_ut": False},
    {"code": "HP", "name": "Himachal Pradesh", "is_ut": False},
    {"code": "JH", "name": "Jharkhand", "is_ut": False},
    {"code": "KA", "name": "Karnataka", "is_ut": False},
    {"code": "KL", "name": "Kerala", "is_ut": False},
    {"code": "MP", "name": "Madhya Pradesh", "is_ut": False},
    {"code": "MH", "name": "Maharashtra", "is_ut": False},
    {"code": "MN", "name": "Manipur", "is_ut": False},
    {"code": "ML", "name": "Meghalaya", "is_ut": False},
    {"code": "MZ", "name": "Mizoram", "is_ut": False},
    {"code": "NL", "name": "Nagaland", "is_ut": False},
    {"code": "OD", "name": "Odisha", "is_ut": False},
    {"code": "PB", "name": "Punjab", "is_ut": False},
    {"code": "RJ", "name": "Rajasthan", "is_ut": False},
    {"code": "SK", "name": "Sikkim", "is_ut": False},
    {"code": "TN", "name": "Tamil Nadu", "is_ut": False, "existing_id": "109a3667-5740-45ef-a3c4-f0577f9b454b"},
    {"code": "TS", "name": "Telangana", "is_ut": False},
    {"code": "TR", "name": "Tripura", "is_ut": False},
    {"code": "UP", "name": "Uttar Pradesh", "is_ut": False},
    {"code": "UK", "name": "Uttarakhand", "is_ut": False},
    {"code": "WB", "name": "West Bengal", "is_ut": False},
    # 8 Union Territories
    {"code": "AN", "name": "Andaman and Nicobar Islands", "is_ut": True},
    {"code": "CH", "name": "Chandigarh", "is_ut": True},
    {"code": "DH", "name": "Dadra and Nagar Haveli and Daman and Diu", "is_ut": True},
    {"code": "DL", "name": "Delhi", "is_ut": True},
    {"code": "JK", "name": "Jammu and Kashmir", "is_ut": True},
    {"code": "LA", "name": "Ladakh", "is_ut": True},
    {"code": "LD", "name": "Lakshadweep", "is_ut": True},
    {"code": "PY", "name": "Puducherry", "is_ut": True},
]

# Canonical districts mapping by state code
DISTRICTS_DATA = {
    "AP": [
        "Alluri Sitharama Raju", "Anakapalli", "Ananthapuramu", "Annamayya", "Bapatla",
        "Chittoor", "Dr. B.R. Ambedkar Konaseema", "East Godavari", "Eluru", "Guntur",
        "Kakinada", "Krishna", "Kurnool", "Nandyal", "NTR", "Palnadu",
        "Parvathipuram Manyam", "Prakasam", "Sri Potti Sriramulu Nellore", "Sri Sathya Sai",
        "Srikakulam", "Tirupati", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"
    ],
    "AR": [
        "Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
        "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada", "Lohit",
        "Longding", "Lower Dibang Valley", "Lower Siang", "Lower Subansiri", "Namsai",
        "Pakke Kessang", "Papum Pare", "Shi Yomi", "Siang", "Tawang",
        "Tirap", "Upper Siang", "Upper Subansiri", "West Kameng", "West Siang", "Itanagar Capital Complex"
    ],
    "AS": [
        "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar",
        "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri",
        "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi",
        "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong",
        "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon",
        "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar",
        "Tinsukia", "Udalguri", "West Karbi Anglong", "Bajali", "Tamulpur"
    ],
    "BR": [
        "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai",
        "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran",
        "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur",
        "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura",
        "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada",
        "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur",
        "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan",
        "Supaul", "Vaishali", "West Champaran"
    ],
    "CG": [
        "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara",
        "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg",
        "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham",
        "Kanker", "Kondagaon", "Korba", "Koriya", "Mahasamund",
        "Manendragarh-Chirmiri-Bharatpur", "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh",
        "Raipur", "Rajnandgaon", "Sarangarh-Bilaigarh", "Sakti", "Sukma",
        "Surajpur", "Surguja", "Khairagarh-Chhuikhadan-Gandai"
    ],
    "GA": [
        "North Goa", "South Goa"
    ],
    "GJ": [
        "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha",
        "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod",
        "Dang", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar",
        "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana",
        "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan",
        "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar",
        "Tapi", "Vadodara", "Valsad"
    ],
    "HR": [
        "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad",
        "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal",
        "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal",
        "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa",
        "Sonipat", "Yamunanagar"
    ],
    "HP": [
        "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur",
        "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur",
        "Solan", "Una"
    ],
    "JH": [
        "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka",
        "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla",
        "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar",
        "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi",
        "Sahebganj", "Seraikela Kharsawan", "Simdega", "West Singhbhum"
    ],
    "KA": [
        "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
        "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
        "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan",
        "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
        "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
        "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura", "Yadgir"
    ],
    "KL": [
        "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod",
        "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad",
        "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"
    ],
    "MP": [
        "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat",
        "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur",
        "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas",
        "Dhar", "Dindori", "Guna", "Gwalior", "Harda",
        "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni",
        "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena",
        "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen",
        "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna",
        "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur",
        "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain",
        "Umaria", "Vidisha", "Mauganj", "Maihar", "Pandhurna"
    ],
    "MH": [
        "Ahmednagar", "Akola", "Amravati", "Chhatrapati Sambhajinagar", "Beed",
        "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli",
        "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur",
        "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded",
        "Nandurbar", "Nashik", "Dharashiv", "Palghar", "Parbhani",
        "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara",
        "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"
    ],
    "MN": [
        "Bishnupur", "Chandel", "Churachandpur", "Imphal East", "Imphal West",
        "Jiribam", "Kakching", "Kamjong", "Kangpokpi", "Noney",
        "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal", "Thoubal", "Ukhrul"
    ],
    "ML": [
        "Eastern West Khasi Hills", "East Garo Hills", "East Jaintia Hills", "East Khasi Hills",
        "North Garo Hills", "Ri Bhoi", "South Garo Hills", "South West Garo Hills",
        "South West Khasi Hills", "West Garo Hills", "West Jaintia Hills", "West Khasi Hills"
    ],
    "MZ": [
        "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib",
        "Lawngtlai", "Lunglei", "Mamit", "Saiha", "Saitual", "Serchhip"
    ],
    "NL": [
        "Chumoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng",
        "Mokokchung", "Mon", "Niuland", "Noklak", "Peren",
        "Phek", "Shamator", "Tseminyu", "Tuensang", "Wokha", "Zunheboto"
    ],
    "OD": [
        "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak",
        "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati",
        "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi",
        "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput",
        "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada",
        "Puri", "Rayagada", "Sambalpur", "Subarnapur", "Sundargarh"
    ],
    "PB": [
        "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
        "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
        "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga",
        "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar",
        "Sangrur", "Shahid Bhagat Singh Nagar", "Tarn Taran"
    ],
    "RJ": [
        "Ajmer", "Alwar", "Anupgarh", "Balotra", "Banswara",
        "Baran", "Barmer", "Beawar", "Bharatpur", "Bhilwara",
        "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa",
        "Deeg", "Dholpur", "Didwana-Kuchaman", "Dudu", "Dungarpur",
        "Gangapur City", "Hanumangarh", "Jaipur", "Jaipur Rural", "Jaisalmer",
        "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Jodhpur Rural",
        "Karauli", "Kekri", "Khairthal-Tijara", "Kota", "Kotputli-Behror",
        "Nagaur", "Neem Ka Thana", "Pali", "Phalodi", "Pratapgarh",
        "Rajsamand", "Salumbar", "Sanchore", "Sawai Madhopur", "Shahpura",
        "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"
    ],
    "SK": [
        "Gangtok", "Gyalshing", "Mangan", "Namchi", "Pakyong", "Soreng"
    ],
    "TN": [
        # Preserved existing 4 with explicit IDs:
        {"name": "Chennai", "code": "TN-CHN", "id": "3e2066a5-5c0f-4b7e-b88a-bf80dd1542a9"},
        {"name": "Coimbatore", "code": "TN-CBE", "id": "0aa083a3-218f-4e22-b9b0-6e3fa3bfa9e4"},
        {"name": "Madurai", "code": "TN-MDU", "id": "e925c2e3-0579-4e8f-b660-07d0812b17b5"},
        {"name": "Salem", "code": "TN-SLM", "id": "74dbc264-3673-457b-9884-89e4bb673655"},
        # Remaining 34 districts of Tamil Nadu:
        "Ariyalur", "Chengalpattu", "Cuddalore", "Dharmapuri", "Dindigul",
        "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur",
        "Krishnagiri", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris",
        "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Sivaganga",
        "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli",
        "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai",
        "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"
    ],
    "TS": [
        "Adilabad", "Bhadradri Kothagudem", "Hanamkonda", "Hyderabad", "Jagtial",
        "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar",
        "Khammam", "Kumuram Bheem Asifabad", "Mahabubabad", "Mahabubnagar", "Mancherial",
        "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda",
        "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla",
        "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad",
        "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri"
    ],
    "TR": [
        "Dhalai", "Gomati", "Khowai", "North Tripura", "Sepahijala",
        "South Tripura", "Unakoti", "West Tripura"
    ],
    "UP": [
        "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha",
        "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich",
        "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly",
        "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr",
        "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah",
        "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad",
        "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur",
        "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi",
        "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi",
        "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj",
        "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut",
        "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh",
        "Prayagraj", "Raebareli", "Rampur", "Saharanpur", "Sambhal",
        "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shravasti", "Siddharthnagar",
        "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"
    ],
    "UK": [
        "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun",
        "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh", "Rudraprayag",
        "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi"
    ],
    "WB": [
        "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
        "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram",
        "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia",
        "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur",
        "Purulia", "South 24 Parganas", "Uttar Dinajpur"
    ],
    # 8 Union Territories
    "AN": [
        "Nicobar", "North and Middle Andaman", "South Andaman"
    ],
    "CH": [
        "Chandigarh"
    ],
    "DH": [
        "Dadra and Nagar Haveli", "Daman", "Diu"
    ],
    "DL": [
        "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi",
        "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"
    ],
    "JK": [
        "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda",
        "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam",
        "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban",
        "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur"
    ],
    "LA": [
        "Kargil", "Leh"
    ],
    "LD": [
        "Lakshadweep"
    ],
    "PY": [
        "Karaikal", "Mahe", "Puducherry", "Yanam"
    ]
}

def generate_district_code(state_code, dist_name):
    # Short alphanumeric 3-letter code from name
    clean = "".join(c for c in dist_name.upper() if c.isalnum())
    if len(clean) >= 3:
        sub = clean[:3]
    else:
        sub = (clean + "XXX")[:3]
    return f"{state_code}-{sub}"

def build_sql():
    lines = []
    lines.append("-- ============================================================")
    lines.append("-- MIGRATION: 20261014000001_complete_indian_geography.sql")
    lines.append("-- Complete Indian Geography: All 28 States + 8 UTs + 780+ Canonical Districts")
    lines.append("-- Source: Local Government Directory (LGD), Ministry of Panchayati Raj, Govt of India")
    lines.append("-- ISO 3166-2:IN Standards")
    lines.append("-- Preserves existing Tamil Nadu (TN) ID and 4 existing district IDs")
    lines.append("-- ============================================================\n")

    lines.append("DO $$")
    lines.append("BEGIN")
    lines.append("    -- 1. Upsert States and Union Territories")
    
    for s in STATES_DATA:
        code = s["code"]
        name = s["name"].replace("'", "''")
        if "existing_id" in s:
            st_id = s["existing_id"]
            lines.append(f"    INSERT INTO public.states (id, name, code, is_active)")
            lines.append(f"    VALUES ('{st_id}', '{name}', '{code}', TRUE)")
            lines.append(f"    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;")
        else:
            lines.append(f"    INSERT INTO public.states (name, code, is_active)")
            lines.append(f"    VALUES ('{name}', '{code}', TRUE)")
            lines.append(f"    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;")

    lines.append("\n    -- 2. Upsert Canonical Districts for all States & UTs")

    # Track codes per state to avoid collisions within the same state
    used_codes_per_state = {}

    for state_code, districts in DISTRICTS_DATA.items():
        used_codes = set()
        used_codes_per_state[state_code] = used_codes
        
        lines.append(f"\n    -- Districts for {state_code}")
        for item in districts:
            if isinstance(item, dict):
                # Preserved district
                dist_id = item["id"]
                name = item["name"].replace("'", "''")
                code = item["code"]
                used_codes.add(code)
                lines.append(f"    INSERT INTO public.districts (id, state_id, name, code, is_active)")
                lines.append(f"    SELECT '{dist_id}', id, '{name}', '{code}', TRUE FROM public.states WHERE code = '{state_code}'")
                lines.append(f"    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;")
            else:
                name = item.replace("'", "''")
                base_code = generate_district_code(state_code, item)
                code = base_code
                idx = 1
                while code in used_codes:
                    clean = "".join(c for c in item.upper() if c.isalnum())
                    if len(clean) >= 3 + idx:
                        code = f"{state_code}-{clean[idx:idx+3]}"
                    else:
                        code = f"{base_code}{idx}"
                    idx += 1
                used_codes.add(code)

                lines.append(f"    INSERT INTO public.districts (state_id, name, code, is_active)")
                lines.append(f"    SELECT id, '{name}', '{code}', TRUE FROM public.states WHERE code = '{state_code}'")
                lines.append(f"    ON CONFLICT (state_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;")

    lines.append("\nEND $$;")
    lines.append("")
    lines.append("-- Allow anon users to read active states and districts for public registration & discovery")
    lines.append("DO $$")
    lines.append("BEGIN")
    lines.append("    IF NOT EXISTS (")
    lines.append("        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'states' AND policyname = 'Public can read active states'")
    lines.append("    ) THEN")
    lines.append("        CREATE POLICY \"Public can read active states\" ON public.states FOR SELECT TO anon USING (is_active = true);")
    lines.append("    END IF;")
    lines.append("    IF NOT EXISTS (")
    lines.append("        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'districts' AND policyname = 'Public can read active districts'")
    lines.append("    ) THEN")
    lines.append("        CREATE POLICY \"Public can read active districts\" ON public.districts FOR SELECT TO anon USING (is_active = true);")
    lines.append("    END IF;")
    lines.append("END $$;\n")

    return "\n".join(lines)

if __name__ == "__main__":
    sql = build_sql()
    out_path = r"e:\LAND-IQ\supabase\migrations\20261014000001_complete_indian_geography.sql"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"Generated {out_path} with {len(STATES_DATA)} states/UTs and {sum(len(d) for d in DISTRICTS_DATA.values())} districts.")
