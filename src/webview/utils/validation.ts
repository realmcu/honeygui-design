/**
 * ID/变量名校验工具
 */

const C_KEYWORDS = new Set([
  'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
  'int', 'long', 'register', 'return', 'short', 'signed', 'sizeof', 'static',
  'struct', 'switch', 'typedef', 'union', 'unsigned', 'void', 'volatile', 'while'
]);

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 校验 C 语言变量名合法性
 */
export function isValidCIdentifier(id: string): ValidationResult {
  if (!id || !id.trim()) {
    return { valid: false, error: '名称不能为空' };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
    return { valid: false, error: '只能包含字母、数字、下划线，且以字母或下划线开头' };
  }
  if (C_KEYWORDS.has(id)) {
    return { valid: false, error: `"${id}" 是 C 语言关键字` };
  }
  return { valid: true };
}

/**
 * 校验 ID 唯一性
 */
export function isUniqueId(id: string, existingIds: string[], currentId?: string): ValidationResult {
  const othersIds = currentId ? existingIds.filter(i => i !== currentId) : existingIds;
  if (othersIds.includes(id)) {
    return { valid: false, error: `"${id}" 已被其他组件使用` };
  }
  return { valid: true };
}

/**
 * 完整校验：合法性 + 唯一性
 */
export function validateComponentId(id: string, existingIds: string[], currentId?: string): ValidationResult {
  const validResult = isValidCIdentifier(id);
  if (!validResult.valid) return validResult;
  
  return isUniqueId(id, existingIds, currentId);
}
