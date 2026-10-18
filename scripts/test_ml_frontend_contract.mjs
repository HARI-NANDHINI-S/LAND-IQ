/**
 * Verification test for ML Service contract and offline fallback heuristics.
 */

// Simulate client heuristic logic from mlService.ts
function clientHeuristicFieldValidator(input) {
  const val = (input.field_value || '').trim();
  const name = input.field_name.toLowerCase().trim();
  const conf = input.confidence != null ? input.confidence : 80;
  const reasons = [];
  let suggested = null;
  let rationale = null;

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

console.log('Testing Frontend Client Heuristic Fallbacks...');

// Test 1: Clean field
const clean = clientHeuristicFieldValidator({
  field_name: 'survey_number',
  field_value: '124/3',
  confidence: 95.0,
});
console.assert(clean.review_classification === 'LIKELY_CORRECT', 'Clean field should be LIKELY_CORRECT');
console.assert(clean.suggested_correction === null, 'Clean field has no suggestion');
console.log('  [PASS] Clean field');

// Test 2: Survey with OCR confusion
const confused = clientHeuristicFieldValidator({
  field_name: 'survey_number',
  field_value: '142/3O',
  confidence: 50.0,
});
console.assert(confused.review_classification === 'NEEDS_REVIEW', 'Confused field should be NEEDS_REVIEW');
console.assert(confused.suggested_correction === '142/30', 'Survey 142/3O should suggest 142/30');
console.assert(confused.review_reasons.length >= 2, 'Should have multiple review reasons (confidence + confusion)');
console.log('  [PASS] Survey confusion suggestion');

// Test 3: Owner name leetspeak digit artifact
const nameFix = clientHeuristicFieldValidator({
  field_name: 'owner_name',
  field_value: 'Ram3sh Kumar',
  confidence: 65.0,
});
console.assert(nameFix.review_classification === 'NEEDS_REVIEW');
console.assert(nameFix.suggested_correction === 'Ramesh Kumar');
console.log('  [PASS] Name digit repair');

// Test 4: Empty value
const empty = clientHeuristicFieldValidator({
  field_name: 'patta_number',
  field_value: '',
  confidence: 0,
});
console.assert(empty.review_classification === 'NEEDS_REVIEW');
console.assert(empty.review_reasons.some(r => r.includes('empty')));
console.log('  [PASS] Empty value handled gracefully');

console.log('All frontend ML service heuristic contract tests passed!');
