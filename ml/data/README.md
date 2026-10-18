# LAND-IQ Machine Learning Datasets

The primary datasets and documentation for the ML-Based OCR Field Error Detection & Anomaly Classification are maintained inside the OCR service module:

- [Dataset Documentation & Architecture](file:///e:/LAND-IQ/ocr-service/app/ml/data/DATASET_README.md)
- **Primary Public Dataset**: FUNSD (Form Understanding in Noisy Scanned Documents) — [Official Source](https://guillaumejaume.github.io/FUNSD/)
- **Domain Cadastral Corpus**: LAND-IQ Tamil Nadu / Bhoomi / Dharani revenue document patterns
- **Data Generator & Splitter**: [prepare_dataset.py](file:///e:/LAND-IQ/ocr-service/app/ml/prepare_dataset.py)
- **Model Training Pipeline**: [train_field_validator.py](file:///e:/LAND-IQ/ocr-service/app/ml/train_field_validator.py)

Raw downloaded archives and images (`funsd.zip`, raw image directories) are excluded from Git via `.gitignore`.
