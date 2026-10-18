# LAND-IQ Real-World ML & OCR Evaluation Report

**Evaluation Timestamp**: `2026-10-18T07:15:00Z`  
**Model Version**: `landiq-ocr-field-validator-v1.0.0`  
**Pipeline**: `landiq-eval-pipeline-v3.0.0`  

---

## 1. OCR Text Recognition Performance (PaddleOCR Local)

Evaluated across 18 realistic land-record documents modeled on authentic Tamil Nadu statutory revenue templates:

- **Overall Character Error Rate (CER)**: **29.57%**
- **Overall Word Error Rate (WER)**: **29.83%**
- **Evaluation Time**: 90.01s

### Performance by Scan Quality:
| Scan Quality Profile | Documents | Character Error Rate (CER) | Word Error Rate (WER) |
| :--- | :---: | :---: | :---: |
| **Clean (300 DPI)** | 6 | 29.52% | 26.37% |
| **Medium (Scanner Noise)** | 6 | 29.71% | 25.81% |
| **Degraded (Faint / Low Contrast)** | 6 | 29.48% | 37.30% |

---

## 2. ML Field Error Detection Classifier Metrics

Evaluated on held-out test partition (704 samples from 42 documents, **0 document leakage**):

- **Accuracy**: **92.90%**
- **Macro Precision**: **93.71%**
- **Macro Recall**: **92.90%**
- **Macro F1-Score**: **92.86%**
- **ROC-AUC**: **0.9835**

### Confusion Matrix:
| Ground Truth \ Prediction | Predicted LIKELY_CORRECT (0) | Predicted NEEDS_REVIEW (1) |
| :--- | :---: | :---: |
| **Actual LIKELY_CORRECT (0)** | **351** (TN) | **1** (FP) |
| **Actual NEEDS_REVIEW (1)** | **49** (FN) | **303** (TP) |

---

## 3. Review Threshold Tuning & Out-of-Sample Validation

Evaluated using a **strictly isolated, document-level validation partition** (133 sub-train documents with 2,675 samples vs 34 validation documents with 701 samples, **0 document overlap**). The validation model was trained exclusively on the sub-train documents **without the validation samples**, ensuring zero contamination. The 704-sample test set remained 100% untouched.

| Decision Threshold ($\tau$) | `NEEDS_REVIEW` Recall | `NEEDS_REVIEW` Precision | False Positive Rate | Missed Errors (FN) | False Alarms (FP) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **0.20** | 97.18% | 88.63% | 19.20% | 12 | 53 |
| **0.25** | 94.59% | 92.63% | 11.59% | 23 | 32 |
| **0.30** | 91.76% | 97.26% | 3.99% | 35 | 11 |
| **0.35** | **90.12%** | **98.71%** | **1.81%** | **42** | **5** |
| **0.40** | 88.00% | 99.47% | 0.72% | 51 | 2 |
| **0.45** | 87.53% | 100.00% | 0.00% | 53 | 0 |
| **0.50** (Default) | 87.53% | 100.00% | 0.00% | 53 | 0 |
| **0.55** | 86.59% | 100.00% | 0.00% | 57 | 0 |
| **0.60** | 86.35% | 100.00% | 0.00% | 58 | 0 |

> **Audit Correction (Phase 6)**: Prior reports evaluated thresholds using the full model fitted on all development records, which artificially elevated in-sample recall (93.49%). When evaluated on an uncontaminated model trained without the validation documents, the true out-of-sample recall is **90.12% at $\tau = 0.35$** (missed errors reduced from 53 to 42) and **88.00% at $\tau = 0.40$**, with near-zero false alarms (1.81% and 0.72% FPR).
>
> **Operational Recommendation**: Operating at threshold **$\tau = 0.35$** is recommended for revenue inspection workflows, capturing 90.12% of OCR errors while falsely flagging fewer than 2% of clean fields.

---

## 4. Probability Calibration Analysis

- **Brier Score**: **0.0533** (Lower is better, $\le 0.10$ signifies strong calibration)
- **Expected Calibration Error (ECE)**: **5.94%**

---

## 5. Model Comparison against Baselines

| Model Architecture | Accuracy | Macro F1 | ROC-AUC |
| :--- | :---: | :---: | :---: |
| **Dummy (Most Frequent)** | 50.00% | 0.3333 | — |
| **Rule-Based Heuristic** | 88.21% | 0.8804 | — |
| **Logistic Regression** | 88.92% | 0.8890 | 0.9412 |
| **Random Forest (Deployed)** | **92.90%** | **0.9286** | **0.9835** |
