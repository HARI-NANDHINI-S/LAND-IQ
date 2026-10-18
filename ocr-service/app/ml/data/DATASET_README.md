# LAND-IQ OCR Field Error Detection Dataset

## 1. Overview & Purpose
This dataset is designed for training and benchmarking machine learning models that identify errors and anomalies in OCR-extracted structured fields from land records and scanned administrative documents.

The objective is to classify an individual extracted field into one of two operational states:
- `LIKELY_CORRECT`: The extracted field exhibits high OCR confidence, conforms to statutory revenue syntax, and contains no OCR confusion artifacts.
- `NEEDS_REVIEW`: The field presents low OCR confidence, character confusion (e.g. `O` vs `0`, `l` vs `1`), date/extent format malformation, or character omissions/insertions requiring verification officer review.

---

## 2. Data Sources & Licences

### Source 1: FUNSD (Form Understanding in Noisy Scanned Documents)
- **Official URL**: [https://guillaumejaume.github.io/FUNSD/](https://guillaumejaume.github.io/FUNSD/)
- **Direct Download**: [https://guillaumejaume.github.io/FUNSD/dataset.zip](https://guillaumejaume.github.io/FUNSD/dataset.zip)
- **Publication**: Guillaume Jaume et al., *FUNSD: A Dataset for Form Understanding in Noisy Scanned Documents*, ICDAR-OST 2019.
- **Licence**: Released for academic, educational, and research evaluation purposes.
- **Download Date**: October 2026.
- **Content**: 199 fully annotated scanned forms (149 training, 50 testing), comprising 31,485 word tokens, bounding boxes, labels (`header`, `question`, `answer`, `other`), and real OCR noise from degraded scanned sheets.

### Source 2: LAND-IQ Cadastral & Revenue Document Corpus
- **Origin**: Synthesized based on authentic Indian Land Administration standards (Tamil Nadu Anywhere e-Services, Coimbatore District Collectorate patterns, Karnataka Bhoomi, AP Dharani schemas present in project migrations).
- **Licence**: Project Open Source / Engineering Test Data (MIT compatible).
- **Field Types Covered**:
  - `survey_number`: Cadastral parcel sub-divisions (e.g., `124/3`, `200/1A`, `315/2B`, `142/3B`)
  - `patta_number`: Revenue landholding identifier (e.g., `PAT-2024-001`, `4521`, `8812`)
  - `document_number`: Sub-Registrar Office deed number (e.g., `TN-COI-2024-001`, `DOC/2024/4512`)
  - `pattadar_passbook_number`: Passbook identifier (e.g., `TNPB-2022-8172`, `PB-982341`)
  - `document_date`: Registration or patta issue date (e.g., `26/06/2015`, `14.08.2021`)
  - `state`: Indian state name (e.g., `Tamil Nadu`, `Karnataka`, `Andhra Pradesh`)
  - `district`: Administrative district (e.g., `Coimbatore`, `Tiruppur`, `Salem`)
  - `taluk`: Sub-district / revenue taluk (e.g., `Coimbatore South`, `Pollachi`, `Perur`)
  - `village`: Cadastral revenue village (e.g., `Perur`, `Ondipudur`, `Saravanampatti`)
  - `extent`: Parcel land area with unit (e.g., `2.50 Acres`, `1.25 Hectares`, `50 Cents`)
  - `owner_name` / `pattadar_name`: Legal titleholder names (e.g., `Ramesh Kumar`, `Anitha Devi`)

---

## 3. Evaluation of Candidate Datasets
- **FUNSD**: Highly suitable for empirical word distributions, noise, and real document key-value pairing. However, it does **not** contain Indian land revenue fields or survey parcel formats.
- **SROIE** (Scanned Receipts OCR and Information Extraction): Contains commercial retail receipts (company, date, address, total). It lacks land titles, cadastral numbers, and requires manual account credentials on RRC.
- **Adopted Strategy**: Dual-source approach combining real scanned form extractions from FUNSD with an authentic Tamil Nadu / Indian cadastral registry corpus, ensuring both realistic document noise and exact revenue domain fidelity.

---

## 4. Preprocessing & Data Leakage Prevention
To guarantee that the model learns generalizable error patterns rather than memorizing specific record values:
1. **Document-Level Group Split**: Data is grouped and partitioned by **Source Document ID** (80% Train, 20% Test) **before** generating any synthetic OCR corruption variants.
2. **Deterministic Random Seed**: All splits and corruption seeds use `random_state = 42` for strict reproducibility.
3. **No Ground Truth Leakage**: Features passed to the model contain only information available at inference time (length, character ratios, Shannon entropy, regex format conformity, character confusion flags, and OCR confidence).
4. **Reproducible OCR Error Simulation**:
   - Visual substitutions: `0` $\leftrightarrow$ `O`, `1` $\leftrightarrow$ `l` / `I`, `5` $\leftrightarrow$ `S`, `8` $\leftrightarrow$ `B`, `2` $\leftrightarrow$ `Z`, `6` $\leftrightarrow$ `G`.
   - Character drops / omissions: e.g. `124/3` $\rightarrow$ `1243`.
   - Noise insertion: e.g. `2.50 Acres` $\rightarrow$ `2..50 Acr#es`.
   - Transposition: e.g. `Coimbatore` $\rightarrow$ `Coimbatroe`.
   - Confidence degradation: Corrupted fields are assigned lower confidence scores mirroring degraded optical recognition.

---

## 5. Limitations of Synthetic Data
While synthetic OCR error generation models known optical confusion matrices, it cannot fully capture physical paper degradation such as:
- Physical document creases, smudges, and biological decay across century-old palm-leaf or parchment deeds.
- Ink bleed-through from double-sided paper documents.
- Stamp paper seal overlaps and handwritten revenue officer endorsements.

Therefore, synthetic benchmark metrics must be interpreted as engineering validation benchmarks, and **all production land record decisions remain strictly under authorized human control**.
