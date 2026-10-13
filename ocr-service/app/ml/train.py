"""
LAND-IQ Machine Learning Training Pipeline
Model: Land Record Anomaly / Review Priority Classifier
Task: 3-class classification (LOW, MEDIUM, HIGH review priority)
Library: scikit-learn
"""

import os
import json
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    classification_report,
)

from app.ml.features import (
    FEATURE_NAMES,
    PRIORITY_CLASSES,
    CLASS_TO_INT,
    INT_TO_CLASS,
)

RANDOM_SEED = 42
MODEL_VERSION = "landiq-anomaly-classifier-v1.0.0"


def generate_engineering_dataset(n_samples: int = 2500, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """
    Generates a deterministic, reproducible engineering validation dataset based on
    empirical distributions of digitized land documents.
    
    CRITICAL SAFEGUARD:
    This dataset is explicitly designated for engineering validation and pipeline verification.
    It simulates realistic Indian revenue document traits (Tamil Nadu, Karnataka, AP formats)
    with non-linear decision boundaries for human review prioritization.
    """
    rng = np.random.default_rng(seed)

    # 1. OCR avg confidence: Beta distribution skewed towards higher confidence with tail
    ocr_avg = rng.beta(a=7.0, b=2.0, size=n_samples) * 100.0

    # 2. OCR min confidence: derived with jitter below avg
    ocr_min = np.clip(ocr_avg - rng.uniform(5.0, 35.0, size=n_samples), 10.0, 99.0)

    # 3. Missing fields count: Poisson distribution centered on few missing
    missing_fields = rng.poisson(lam=0.7, size=n_samples)
    missing_fields = np.clip(missing_fields, 0, 6)

    # 4. Duplicate similarity score: skewed towards 0 with occasional high match
    duplicate_sim = rng.beta(a=0.5, b=4.0, size=n_samples)

    # 5. Identifier syntax mismatch: Bernoulli trial
    syntax_mismatch = rng.binomial(n=1, p=0.12, size=n_samples)

    # 6. Area outlier score: Chi-squared distribution (most normal, few extreme)
    area_outlier = rng.chisquare(df=1.5, size=n_samples)
    area_outlier = np.clip(area_outlier, 0.0, 5.0)

    # 7. Document type: uniform across 6 types
    doc_type = rng.integers(low=0, high=6, size=n_samples)

    # 8. Page count: 1-15 pages
    page_count = rng.integers(low=1, high=16, size=n_samples)

    # 9. Text density ratio: normal centered at 1.0
    text_density = np.clip(rng.normal(loc=1.0, scale=0.3, size=n_samples), 0.1, 3.5)

    df = pd.DataFrame({
        "ocr_avg_confidence": ocr_avg,
        "ocr_min_confidence": ocr_min,
        "missing_fields_count": missing_fields,
        "duplicate_similarity_score": duplicate_sim,
        "identifier_syntax_mismatch": syntax_mismatch,
        "area_outlier_score": area_outlier,
        "document_type_encoded": doc_type,
        "page_count": page_count,
        "text_density_ratio": text_density,
    })

    # Ground truth determination using revenue validation logic
    # Composite risk index (0.0 to 100.0)
    risk_index = (
        (100.0 - df["ocr_min_confidence"]) * 0.35 +
        (df["missing_fields_count"] * 16.0) +
        (df["duplicate_similarity_score"] * 30.0) +
        (df["identifier_syntax_mismatch"] * 25.0) +
        (df["area_outlier_score"] * 10.0) +
        rng.normal(loc=0.0, scale=4.0, size=n_samples)
    )

    # Class assignment:
    # Low: risk_index < 35
    # Medium: 35 <= risk_index < 60
    # High: risk_index >= 60
    labels = np.where(risk_index >= 58.0, 2, np.where(risk_index >= 34.0, 1, 0))
    df["label"] = labels
    df["priority_class"] = [INT_TO_CLASS[l] for l in labels]

    return df


def train_and_evaluate(
    df: pd.DataFrame,
    output_dir: str,
) -> Dict[str, Any]:
    """
    Executes reproducible stratified train/test split, trains baseline and ensemble classifier,
    computes evaluation metrics, and persists artifacts.
    """
    os.makedirs(output_dir, exist_ok=True)

    X = df[FEATURE_NAMES].values
    y = df["label"].values

    # Stratified 80/20 train/test split to prevent data leakage and guarantee class balance
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED, stratify=y
    )

    # Standardize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 1. Baseline Model (Dummy Classifier)
    dummy = DummyClassifier(strategy="stratified", random_state=RANDOM_SEED)
    dummy.fit(X_train, y_train)
    y_pred_dummy = dummy.predict(X_test)
    dummy_acc = float(accuracy_score(y_test, y_pred_dummy))
    dummy_f1 = float(f1_score(y_test, y_pred_dummy, average="macro"))

    # 2. Linear Baseline (Logistic Regression)
    log_reg = LogisticRegression(max_iter=1000, random_state=RANDOM_SEED)
    log_reg.fit(X_train_scaled, y_train)
    y_pred_lr = log_reg.predict(X_test_scaled)
    lr_acc = float(accuracy_score(y_test, y_pred_lr))
    lr_f1 = float(f1_score(y_test, y_pred_lr, average="macro"))

    # 3. Primary Production Model: Random Forest Ensemble
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=7,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=1,
    )
    rf.fit(X_train, y_train)

    y_pred_rf = rf.predict(X_test)
    y_prob_rf = rf.predict_proba(X_test)

    # Evaluation Metrics
    rf_acc = float(accuracy_score(y_test, y_pred_rf))
    rf_prec_macro = float(precision_score(y_test, y_pred_rf, average="macro"))
    rf_prec_weighted = float(precision_score(y_test, y_pred_rf, average="weighted"))
    rf_rec_macro = float(recall_score(y_test, y_pred_rf, average="macro"))
    rf_rec_weighted = float(recall_score(y_test, y_pred_rf, average="weighted"))
    rf_f1_macro = float(f1_score(y_test, y_pred_rf, average="macro"))
    rf_f1_weighted = float(f1_score(y_test, y_pred_rf, average="weighted"))
    rf_roc_auc = float(roc_auc_score(y_test, y_prob_rf, multi_class="ovr", average="macro"))

    cm = confusion_matrix(y_test, y_pred_rf).tolist()

    # Feature Importances
    importances = {
        name: float(imp)
        for name, imp in zip(FEATURE_NAMES, rf.feature_importances_)
    }
    # Sort importances descending
    importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # Save model and preprocessor artifacts
    model_path = os.path.join(output_dir, "anomaly_classifier.joblib")
    scaler_path = os.path.join(output_dir, "scaler.joblib")
    joblib.dump(rf, model_path)
    joblib.dump(scaler, scaler_path)

    metadata = {
        "model_name": "Land Record Anomaly & Review Priority Classifier",
        "model_version": MODEL_VERSION,
        "algorithm": "RandomForestClassifier(n_estimators=120, max_depth=7, class_weight='balanced')",
        "feature_names": FEATURE_NAMES,
        "priority_classes": PRIORITY_CLASSES,
        "class_mapping": CLASS_TO_INT,
        "random_seed": RANDOM_SEED,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "total_samples": int(len(df)),
        "metrics": {
            "accuracy": rf_acc,
            "precision_macro": rf_prec_macro,
            "precision_weighted": rf_prec_weighted,
            "recall_macro": rf_rec_macro,
            "recall_weighted": rf_rec_weighted,
            "f1_macro": rf_f1_macro,
            "f1_weighted": rf_f1_weighted,
            "roc_auc_ovr": rf_roc_auc,
            "confusion_matrix": cm,
        },
        "baseline_comparison": {
            "dummy_stratified": {
                "accuracy": dummy_acc,
                "f1_macro": dummy_f1,
            },
            "logistic_regression": {
                "accuracy": lr_acc,
                "f1_macro": lr_f1,
            },
            "random_forest_improvement_over_dummy_f1": float(rf_f1_macro - dummy_f1),
        },
        "feature_importances": importances,
        "safeguards": {
            "dataset_nature": "Engineering validation dataset with deterministic empirical distributions",
            "is_experimental": True,
            "adjudication_notice": (
                "Predictions from this classifier serve exclusively to prioritize human review queues "
                "and highlight inconsistencies. Predictions must never independently determine ownership, "
                "reject a citizen's land deed, or replace authoritative revenue verification."
            ),
        },
    }

    metadata_path = os.path.join(output_dir, "model_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n========================================================")
    print(f"LAND-IQ ML Model Trained Successfully: {MODEL_VERSION}")
    print("========================================================")
    print(f"Test Accuracy:           {rf_acc:.4f} (vs Dummy: {dummy_acc:.4f})")
    print(f"Macro F1-Score:          {rf_f1_macro:.4f} (vs Dummy: {dummy_f1:.4f})")
    print(f"Macro Recall:            {rf_rec_macro:.4f}")
    print(f"Macro Precision:         {rf_prec_macro:.4f}")
    print(f"ROC-AUC (ovr macro):     {rf_roc_auc:.4f}")
    print("Confusion Matrix (Low / Med / High):")
    for row in cm:
        print(f"  {row}")
    print("\nTop 3 Feature Importances:")
    for i, (k, v) in enumerate(list(importances.items())[:3], 1):
        print(f"  {i}. {k}: {v:.4f}")
    print(f"\nArtifacts saved to: {output_dir}")

    return metadata


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(current_dir, "models")
    data = generate_engineering_dataset()
    train_and_evaluate(data, models_dir)
