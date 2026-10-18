/**
 * LAND-IQ Frontend Machine Learning Service
 * Connects to the local/deployed FastAPI ML inference microservice for:
 * 1. Document-level Land Record Anomaly & Review Priority Classifier
 * 2. Field-level ML-Based OCR Error Detection & Candidate Correction Validator
 */

import { supabase } from '@/lib/supabase';

const OCR_SERVICE_URL = import.meta.env.VITE_OCR_SERVICE_URL || 'http://127.0.0.1:8001';
const REQUEST_TIMEOUT_MS = 10000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch {
    // Offline or session unavailable; send standard content header
  }
  return headers;
}

// ============================================================================
// 1. Document Anomaly Types
// ============================================================================

export interface MLPredictionInput {
  ocr_avg_confidence?: number;
  ocr_min_confidence?: number;
  missing_fields_count?: number;
  duplicate_similarity_score?: number;
  identifier_syntax_mismatch?: number;
  area_outlier_score?: number;
  document_type?: string;
  page_count?: number;
  text_density_ratio?: number;
}

export interface MLPredictionResult {
  review_priority: 'LOW' | 'MEDIUM' | 'HIGH';
  anomaly_score: number;
  probabilities: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
  };
  contributing_factors: string[];
  recommended_action: string;
  model_version: string;
  is_experimental: boolean;
  safeguards_notice: string;
}

export interface MLModelInfo {
  model_name: string;
  model_version: string;
  algorithm: string;
  feature_names: string[];
  metrics: {
    accuracy: number;
    precision_macro: number;
    recall_macro: number;
    f1_macro: number;
    roc_auc_ovr: number;
    confusion_matrix: number[][];
  };
  baseline_comparison: {
    dummy_stratified: { accuracy: number; f1_macro: number };
    random_forest_improvement_over_dummy_f1: number;
  };
  feature_importances: Record<string, number>;
  safeguards: {
    dataset_nature: string;
    is_experimental: boolean;
    adjudication_notice: string;
  };
}

// ============================================================================
// 2. OCR Field Validator Types
// ============================================================================

export interface SingleFieldValidationRequest {
  field_id?: string | null;
  field_name: string;
  field_value: string;
  confidence?: number | null;
}

export interface FieldValidationResult {
  field_id?: string | null;
  field_name: string;
  original_value: string;
  review_classification: 'LIKELY_CORRECT' | 'NEEDS_REVIEW';
  review_priority_score: number;
  confidence_score?: number | null;
  review_reasons: string[];
  suggested_correction?: string | null;
  correction_rationale?: string | null;
  model_version: string;
  is_experimental: boolean;
  safeguards_notice: string;
}

export interface FieldValidatorModelInfo {
  model_name: string;
  model_version: string;
  algorithm: string;
  feature_names: string[];
  target_labels: string[];
  train_samples: number;
  test_samples: number;
  metrics: {
    accuracy: number;
    precision_macro: number;
    recall_macro: number;
    f1_macro: number;
    roc_auc: number;
    confusion_matrix: number[][];
  };
  baseline_comparison: {
    dummy_most_frequent: { accuracy: number; f1_macro: number };
    rule_based_heuristic: { accuracy: number; precision_macro: number; recall_macro: number; f1_macro: number };
    logistic_regression: { accuracy: number; f1_macro: number };
    rf_improvement_over_rules_f1: number;
    rf_improvement_over_dummy_f1: number;
  };
  per_field_type_breakdown: Record<string, { samples: number; accuracy: number; f1_macro: number }>;
  feature_importances: Record<string, number>;
  safeguards: {
    dataset_nature: string;
    is_experimental: boolean;
    adjudication_notice: string;
    synthetic_limitations: string;
  };
}

// ============================================================================
// Client Heuristic Helpers (Offline Safeguard)
// ============================================================================

function clientHeuristicFieldValidator(input: SingleFieldValidationRequest): FieldValidationResult {
  const val = (input.field_value || '').trim();
  const name = input.field_name.toLowerCase().trim();
  const conf = input.confidence != null ? input.confidence : 80;
  const reasons: string[] = [];
  let suggested: string | null = null;
  let rationale: string | null = null;

  if (!val) {
    reasons.push('Field value is empty or unextracted by OCR.');
  } else {
    if (conf < 70) {
      reasons.push(`Low OCR confidence (${conf.toFixed(1)}%) detected on field.`);
    }

    if (name === 'survey_number') {
      if (/\d+\/\d*[Oo]+/.test(val)) {
        suggested = val.replace(/(\d+\/\d*)[Oo]+/g, '$10');
        rationale = "Corrected optical character confusion: replaced letter 'O' with digit '0'.";
        reasons.push("Potential optical confusion: character 'O' detected in numeric survey denominator.");
      } else if (!/^\d{1,5}(\s*[/-]\s*[0-9A-Za-z]+)?$/.test(val)) {
        reasons.push('Survey identifier does not match standard cadastral pattern.');
      }
    } else if (name === 'patta_number') {
      if (/^(PAT[-_\s]?)(\d*[Oo]+\d*)$/i.test(val)) {
        suggested = val.replace(/[Oo]/g, '0');
        rationale = "Corrected optical character confusion: replaced 'O' with '0' in patta sequence.";
        reasons.push("Potential character confusion: 'O' detected in patta number.");
      } else if (!/^(PAT[-_\s]?)?\d{1,6}([-_\s/]\d{1,6})?[A-Za-z]?$/i.test(val)) {
        reasons.push('Patta number does not match expected statutory revenue format.');
      }
    } else if (name === 'document_date') {
      if (/[OoIl|]/.test(val) && /\d/.test(val)) {
        const cleaned = val.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
        suggested = cleaned;
        rationale = 'Standardized date numbers and replaced optical confusion letters.';
        reasons.push('Alphabetic characters detected inside date structure.');
      } else if (!/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(val)) {
        reasons.push('Date format does not match DD/MM/YYYY pattern.');
      }
    } else if (name === 'owner_name' || name === 'pattadar_name') {
      if (/\d/.test(val)) {
        suggested = val.replace(/3/g, 'e').replace(/4/g, 'a').replace(/1/g, 'i').replace(/0/g, 'o');
        rationale = 'Removed intruding digit artifacts from personal name string.';
        reasons.push('Numeric character detected within personal owner name.');
      }
    }
  }

  const isReview = reasons.length > 0;
  return {
    field_id: input.field_id,
    field_name: input.field_name,
    original_value: input.field_value,
    review_classification: isReview ? 'NEEDS_REVIEW' : 'LIKELY_CORRECT',
    review_priority_score: isReview ? 0.85 : 0.15,
    confidence_score: input.confidence,
    review_reasons: reasons,
    suggested_correction: suggested,
    correction_rationale: rationale,
    model_version: 'client-heuristic-safeguard-v1.0.0',
    is_experimental: true,
    safeguards_notice: 'Field verification indicators prioritize reviewer scrutiny. Final decisions require human verification.',
  };
}

// ============================================================================
// Service Export
// ============================================================================

export const mlService = {
  // Document-level Anomaly Detection
  predictAnomalyPriority(input: MLPredictionInput): Promise<MLPredictionResult> {
    return this.predictAnomaly(input);
  },

  async predictAnomaly(input: MLPredictionInput): Promise<MLPredictionResult> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${OCR_SERVICE_URL}/ml/predict`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`ML service responded with ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('ML inference service error, using client-side heuristic safeguard:', err);
      const isHigh =
        (input.ocr_min_confidence ?? 100) < 50 ||
        (input.missing_fields_count ?? 0) >= 2 ||
        (input.duplicate_similarity_score ?? 0) > 0.8;
      const isMed =
        (input.ocr_avg_confidence ?? 100) < 70 ||
        (input.missing_fields_count ?? 0) === 1 ||
        (input.identifier_syntax_mismatch ?? 0) === 1;

      const priority = isHigh ? 'HIGH' : isMed ? 'MEDIUM' : 'LOW';
      return {
        review_priority: priority,
        anomaly_score: isHigh ? 0.88 : isMed ? 0.45 : 0.12,
        probabilities: { LOW: isHigh ? 0.05 : 0.8, MEDIUM: isMed ? 0.6 : 0.15, HIGH: isHigh ? 0.85 : 0.05 },
        contributing_factors: [
          ...(input.missing_fields_count ? [`${input.missing_fields_count} field(s) missing from OCR`] : []),
          ...(input.duplicate_similarity_score ? [`Duplicate match score: ${(input.duplicate_similarity_score * 100).toFixed(1)}%`] : []),
        ],
        recommended_action: isHigh
          ? 'Route immediately to senior officer for verification.'
          : 'Standard verification queue applies.',
        model_version: 'landiq-anomaly-fallback',
        is_experimental: true,
        safeguards_notice: 'Human review prioritization only. Not legal adjudication.',
      };
    }
  },

  async getModelInfo(): Promise<MLModelInfo | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${OCR_SERVICE_URL}/ml/model-info`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },

  // Field-level Error Detection & Validation
  async validateField(input: SingleFieldValidationRequest): Promise<FieldValidationResult> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${OCR_SERVICE_URL}/ml/validate-field`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          field_name: input.field_name,
          field_value: input.field_value,
          confidence: input.confidence ?? null,
          field_id: input.field_id ?? null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Field validator responded with status ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('Field validator service unavailable, applying client-side domain rules:', err);
      return clientHeuristicFieldValidator(input);
    }
  },

  async validateFieldsBatch(fields: SingleFieldValidationRequest[]): Promise<FieldValidationResult[]> {
    if (!fields.length) return [];
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${OCR_SERVICE_URL}/ml/validate-fields`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          fields: fields.map((f) => ({
            field_name: f.field_name,
            field_value: f.field_value,
            confidence: f.confidence ?? null,
            field_id: f.field_id ?? null,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch field validator responded with status ${response.status}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (err) {
      console.warn('Batch field validator service unavailable, applying client-side fallback:', err);
      return fields.map((f) => clientHeuristicFieldValidator(f));
    }
  },

  async getFieldValidatorModelInfo(): Promise<FieldValidatorModelInfo | null> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${OCR_SERVICE_URL}/ml/field-validator/info`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },
};
