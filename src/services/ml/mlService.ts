/**
 * LAND-IQ Frontend Machine Learning Service
 * Connects to the local/deployed FastAPI ML inference service for Land Record Anomaly & Review Priority.
 */

const OCR_SERVICE_URL = import.meta.env.VITE_OCR_SERVICE_URL || 'http://127.0.0.1:8001';

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

export const mlService = {
  async predictAnomaly(input: MLPredictionInput): Promise<MLPredictionResult> {
    try {
      const response = await fetch(`${OCR_SERVICE_URL}/ml/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`ML service responded with ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn('ML inference service error, using client-side heuristic safeguard:', err);
      // Client-side fallback if ML service offline
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
      const response = await fetch(`${OCR_SERVICE_URL}/ml/model-info`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  },
};
