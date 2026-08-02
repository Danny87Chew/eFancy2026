export function getCuttingOptions(category = '') {
  const normalized = String(category || '').trim().toLowerCase();
  const cleaned = normalized
    .replace(/\b(fresh|frozen|cooked)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (['beef', 'lamb', 'mutton'].includes(cleaned)) {
    return ['100g/Pcs', '150g/Pcs', '200g/Pcs', '250g/Pcs', '300g/Pcs', '350g/Pcs', '400g/Pcs'];
  }
  if (cleaned === 'fish') {
    return ['Butter Fly', 'Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  if (['chicken', 'checken', 'duck', 'goose'].includes(cleaned)) {
    return ['Whole', 'Half', 'Quarter', '8 pieces', 'Small pieces'];
  }
  return [];
}
