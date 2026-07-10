export function validateProject(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { valid: false, errors: ['body es obligatorio'] };
  if (!String(input.name || '').trim()) errors.push('name es obligatorio');
  if (!String(input.subject || '').trim()) errors.push('subject es obligatorio');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.deadline || ''))) errors.push('deadline debe usar YYYY-MM-DD');
  return { valid: errors.length === 0, errors };
}

export function validateProgress(input) {
  const errors = [];
  if (!input || typeof input !== 'object') return { valid: false, errors: ['body es obligatorio'] };
  if (!Number.isInteger(input.percentage) || input.percentage < 0 || input.percentage > 100) {
    errors.push('percentage debe ser entero entre 0 y 100');
  }
  if (!String(input.evidence || '').trim()) errors.push('evidence es obligatorio');
  return { valid: errors.length === 0, errors };
}

