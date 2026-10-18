"""
LAND-IQ OCR Field Error Detection & Validation Training Pipeline
Trains and evaluates:
1. Dummy Classifier Baseline
2. Deterministic Rule-Based Heuristic Baseline
3. Logistic Regression Baseline
4. Primary Production Model: Random Forest Classifier on 16 structured inference features.
Evaluates overall and per-field-type precision, recall, F1, ROC-AUC, and confusion matrix.
Persists model and evaluation metadata.
"""

import os
import json
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
import joblib

from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)

from app.ml.field_features import (
    FIELD_FEATURE_NAMES,
    TARGET_LABELS,
    LABEL_TO_INT,
    INT_TO_LABEL,
    extract_field_feature_dict,
)

RANDOM_SEED = 42
MODEL_VERSION = "landiq-ocr-field-validator-v1.0.0"


def load_dataset_features(json_path: str) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
    """Loads dataset from JSON and transforms each sample into numeric feature vectors."""
    with open(json_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    X_list = []
    y_list = []

    for s in samples:
        feat_dict = extract_field_feature_dict(
            field_name=s["field_name"],
            field_value=s["ocr_value"],
            confidence=s.get("confidence", 80.0),
        )
        vec = [feat_dict[k] for k in FIELD_FEATURE_NAMES]
        label_int = LABEL_TO_INT[s["label"]]

        X_list.append(vec)
        y_list.append(label_int)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.int32)
    return X, y, samples


def rule_based_baseline_predict(samples: List[Dict[str, Any]]) -> np.ndarray:
    """
    Standard domain rule-based baseline:
    Flags for review (1) if confidence < 75%, format mismatch, OCR confusion detected, or empty.
    Otherwise classifies as likely correct (0).
    """
    preds = []
    for s in samples:
        f = extract_field_feature_dict(
            field_name=s["field_name"],
            field_value=s["ocr_value"],
            confidence=s.get("confidence", 80.0),
        )
        flag = (
            f["ocr_confidence"] < 75.0
            or f["format_pattern_match"] == 0.0
            or f["has_ocr_confusion_chars"] == 1.0
            or f["is_empty_or_whitespace"] == 1.0
        )
        preds.append(1 if flag else 0)
    return np.array(preds, dtype=np.int32)


def compute_per_field_type_metrics(
    samples: List[Dict[str, Any]],
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> Dict[str, Dict[str, float]]:
    """Calculates breakdown metrics per field type."""
    field_groups: Dict[str, List[int]] = {}
    for idx, s in enumerate(samples):
        ft = s["field_name"]
        # Group generic FUNSD questions/answers together
        if ft.startswith("funsd_"):
            group_name = "funsd_form_field"
        else:
            group_name = ft
        if group_name not in field_groups:
            field_groups[group_name] = []
        field_groups[group_name].append(idx)

    breakdown = {}
    for name, indices in field_groups.items():
        if len(indices) < 5:
            continue
        sub_true = y_true[indices]
        sub_pred = y_pred[indices]

        acc = float(accuracy_score(sub_true, sub_pred))
        f1 = float(f1_score(sub_true, sub_pred, average="macro", zero_division=0))
        breakdown[name] = {
            "samples": len(indices),
            "accuracy": round(acc, 4),
            "f1_macro": round(f1, 4),
        }
    return breakdown


def train_and_evaluate_field_validator(
    data_dir: str,
    output_dir: str,
) -> Dict[str, Any]:
    """Trains Random Forest model alongside rule-based and linear baselines, evaluates, and persists artifacts."""
    train_file = os.path.join(data_dir, "train_field_data.json")
    test_file = os.path.join(data_dir, "test_field_data.json")

    if not os.path.exists(train_file) or not os.path.exists(test_file):
        raise FileNotFoundError(f"Missing train or test data in {data_dir}. Run prepare_dataset.py first.")

    print(f"Loading feature matrices from {data_dir}...")
    X_train, y_train, train_samples = load_dataset_features(train_file)
    X_test, y_test, test_samples = load_dataset_features(test_file)

    print(f"Train set: {X_train.shape[0]} samples, {X_train.shape[1]} features.")
    print(f"Test set:  {X_test.shape[0]} samples, {X_test.shape[1]} features.")

    # -------------------------------------------------------------
    # 1. Baseline 1: Dummy Most Frequent
    # -------------------------------------------------------------
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train, y_train)
    y_pred_dummy = dummy.predict(X_test)
    dummy_acc = float(accuracy_score(y_test, y_pred_dummy))
    dummy_f1 = float(f1_score(y_test, y_pred_dummy, average="macro"))

    # -------------------------------------------------------------
    # 2. Baseline 2: Rule-Based Heuristic
    # -------------------------------------------------------------
    y_pred_rules = rule_based_baseline_predict(test_samples)
    rules_acc = float(accuracy_score(y_test, y_pred_rules))
    rules_f1 = float(f1_score(y_test, y_pred_rules, average="macro"))
    rules_prec = float(precision_score(y_test, y_pred_rules, average="macro"))
    rules_rec = float(recall_score(y_test, y_pred_rules, average="macro"))

    # -------------------------------------------------------------
    # 3. Baseline 3: Logistic Regression
    # -------------------------------------------------------------
    log_reg = LogisticRegression(max_iter=1000, random_state=RANDOM_SEED)
    log_reg.fit(X_train, y_train)
    y_pred_lr = log_reg.predict(X_test)
    lr_acc = float(accuracy_score(y_test, y_pred_lr))
    lr_f1 = float(f1_score(y_test, y_pred_lr, average="macro"))

    # -------------------------------------------------------------
    # 4. Primary Model: Random Forest Ensemble
    # -------------------------------------------------------------
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=1,
    )
    rf.fit(X_train, y_train)

    y_pred_rf = rf.predict(X_test)
    y_prob_rf = rf.predict_proba(X_test)

    rf_acc = float(accuracy_score(y_test, y_pred_rf))
    rf_prec_macro = float(precision_score(y_test, y_pred_rf, average="macro"))
    rf_prec_weighted = float(precision_score(y_test, y_pred_rf, average="weighted"))
    rf_rec_macro = float(recall_score(y_test, y_pred_rf, average="macro"))
    rf_rec_weighted = float(recall_score(y_test, y_pred_rf, average="weighted"))
    rf_f1_macro = float(f1_score(y_test, y_pred_rf, average="macro"))
    rf_f1_weighted = float(f1_score(y_test, y_pred_rf, average="weighted"))
    rf_roc_auc = float(roc_auc_score(y_test, y_prob_rf[:, 1]))

    cm = confusion_matrix(y_test, y_pred_rf).tolist()

    # Per field-type metrics
    field_breakdown = compute_per_field_type_metrics(test_samples, y_test, y_pred_rf)

    # Feature importances
    importances = {
        name: round(float(imp), 4)
        for name, imp in zip(FIELD_FEATURE_NAMES, rf.feature_importances_)
    }
    importances = dict(sorted(importances.items(), key=lambda item: item[1], reverse=True))

    # Persist model
    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, "ocr_field_validator.joblib")
    joblib.dump(rf, model_path)

    metadata = {
        "model_name": "LAND-IQ OCR Field Error Detection & Validation Classifier",
        "model_version": MODEL_VERSION,
        "algorithm": "RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced')",
        "feature_names": FIELD_FEATURE_NAMES,
        "target_labels": TARGET_LABELS,
        "label_mapping": LABEL_TO_INT,
        "random_seed": RANDOM_SEED,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "metrics": {
            "accuracy": rf_acc,
            "precision_macro": rf_prec_macro,
            "precision_weighted": rf_prec_weighted,
            "recall_macro": rf_rec_macro,
            "recall_weighted": rf_rec_weighted,
            "f1_macro": rf_f1_macro,
            "f1_weighted": rf_f1_weighted,
            "roc_auc": rf_roc_auc,
            "confusion_matrix": cm,
            "labels_order": ["LIKELY_CORRECT (0)", "NEEDS_REVIEW (1)"],
        },
        "baseline_comparison": {
            "dummy_most_frequent": {
                "accuracy": dummy_acc,
                "f1_macro": dummy_f1,
            },
            "rule_based_heuristic": {
                "accuracy": rules_acc,
                "precision_macro": rules_prec,
                "recall_macro": rules_rec,
                "f1_macro": rules_f1,
            },
            "logistic_regression": {
                "accuracy": lr_acc,
                "f1_macro": lr_f1,
            },
            "rf_improvement_over_rules_f1": round(rf_f1_macro - rules_f1, 4),
            "rf_improvement_over_dummy_f1": round(rf_f1_macro - dummy_f1, 4),
        },
        "per_field_type_breakdown": field_breakdown,
        "feature_importances": importances,
        "safeguards": {
            "dataset_nature": "Empirical validation dataset constructed from FUNSD scanned documents and authentic South Indian cadastral formats with partitioned document-level splitting",
            "is_experimental": True,
            "adjudication_notice": (
                "Field-level predictions prioritize OCR fields for verification officer review and highlighting. "
                "The model never automatically modifies title, alters registry ownership, or invalidates documents."
            ),
            "synthetic_limitations": (
                "Evaluation was performed on empirical document splits with simulated optical degradations. "
                "Real-world field documents may have additional physical degradation (water damage, torn parchment, "
                "wax seals) requiring mandatory human supervision."
            ),
        },
    }

    metadata_path = os.path.join(output_dir, "field_validator_metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("\n=================================================================")
    print(f"LAND-IQ OCR Field Validator Trained Successfully: {MODEL_VERSION}")
    print("=================================================================")
    print(f"Test Accuracy:           {rf_acc:.4f} (Rule Baseline: {rules_acc:.4f}, Dummy: {dummy_acc:.4f})")
    print(f"Macro F1-Score:          {rf_f1_macro:.4f} (Rule Baseline: {rules_f1:.4f}, Dummy: {dummy_f1:.4f})")
    print(f"Macro Recall:            {rf_rec_macro:.4f} (Rule Baseline: {rules_rec:.4f})")
    print(f"Macro Precision:         {rf_prec_macro:.4f} (Rule Baseline: {rules_prec:.4f})")
    print(f"ROC-AUC:                 {rf_roc_auc:.4f}")
    print("Confusion Matrix [ [TN, FP], [FN, TP] ]:")
    print(f"  LIKELY_CORRECT (true):  TN={cm[0][0]}, FP={cm[0][1]}")
    print(f"  NEEDS_REVIEW   (true):  FN={cm[1][0]}, TP={cm[1][1]}")
    print("\nTop 5 Feature Importances:")
    for i, (k, v) in enumerate(list(importances.items())[:5], 1):
        print(f"  {i}. {k}: {v:.4f}")
    print("\nPer-Field-Type F1 Breakdown:")
    for ftype, m in field_breakdown.items():
        print(f"  - {ftype:22s} ({m['samples']:2d} samples): Acc={m['accuracy']:.4f}, F1={m['f1_macro']:.4f}")
    print(f"\nModel artifact saved to:    {model_path}")
    print(f"Metadata artifact saved to: {metadata_path}")

    return metadata


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(current_dir, "data")
    models_dir = os.path.join(current_dir, "models")

    train_and_evaluate_field_validator(data_dir, models_dir)
