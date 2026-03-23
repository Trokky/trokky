import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { PasswordFieldDefinition } from './definition.js';

export interface PasswordGeneratorOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecialChars?: boolean;
  customChars?: string;
  excludeSimilar?: boolean;
}

/**
 * Web-compatible secure random integer generation
 */
function getSecureRandomInt(max: number): number {
  if (max <= 0) throw new Error('Max must be positive');
  
  // Use Web Crypto API (available in all modern browsers)
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  
  // Use rejection sampling to avoid modulo bias
  const threshold = Math.floor(0xFFFFFFFF / max) * max;
  let randomValue = array[0];
  
  while (randomValue >= threshold) {
    crypto.getRandomValues(array);
    randomValue = array[0];
  }
  
  return randomValue % max;
}

/**
 * Cryptographically secure array shuffling
 */
function secureShuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

export function validatePasswordField(value: string | null | undefined, definition: PasswordFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    if (definition.validation?.required || definition.required) {
      errors.push(definition.validation?.message || 'Password is required');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }
  
  const password = value;
  const validation = definition.validation || {};
  
  // Length validation
  if (validation.minLength && password.length < validation.minLength) {
    errors.push(`Password must be at least ${validation.minLength} characters long`);
  }
  
  if (validation.maxLength && password.length > validation.maxLength) {
    errors.push(`Password must be no more than ${validation.maxLength} characters long`);
  }
  
  // Character requirement validation
  if (validation.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (validation.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (validation.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (validation.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Custom pattern validation
  if (validation.pattern) {
    const regex = new RegExp(validation.pattern);
    if (!regex.test(password)) {
      errors.push('Password does not meet the required pattern');
    }
  }
  
  // Password strength warnings (only if no errors)
  if (errors.length === 0) {
    if (password.length < 12) {
      warnings.push('Consider using a longer password for better security');
    }
    
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      warnings.push('Consider including uppercase, lowercase, and numbers for stronger security');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculatePasswordStrength(password: string): {
  score: number; // 0-4
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: 'No password', color: '#9CA3AF' }; // gray-400
  }
  
  let score = 0;
  let penalties = 0;
  
  // Length scoring (more realistic thresholds)
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety scoring
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  if (hasLowercase) score += 1;
  if (hasUppercase) score += 1;
  if (hasNumbers) score += 1;
  if (hasSpecialChars) score += 1;
  
  // Diversity bonus (only if multiple types are present)
  const charTypes = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  if (charTypes >= 3) score += 1;
  if (charTypes >= 4) score += 1;
  
  // PENALTIES for terrible patterns
  
  // Repeating characters (like "ggggggggg")
  const repeatingPattern = /(.)\1{3,}/; // 4 or more same characters in a row
  if (repeatingPattern.test(password)) {
    penalties += 2;
  }
  
  // Sequential patterns (like "12345", "abcde")
  const hasSequential = (str: string) => {
    for (let i = 0; i < str.length - 3; i++) {
      const chunk = str.slice(i, i + 4);
      const codes = chunk.split('').map(c => c.charCodeAt(0));
      const isSequential = codes.every((code, idx) => idx === 0 || code === codes[idx - 1] + 1);
      if (isSequential) return true;
    }
    return false;
  };
  
  if (hasSequential(password.toLowerCase())) {
    penalties += 1;
  }
  
  // Very simple patterns (like "password123", "qwerty")
  const commonPatterns = [
    /password/i, /qwerty/i, /123456/i, /admin/i, /login/i,
    /welcome/i, /monkey/i, /letmein/i, /dragon/i, /princess/i
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password))) {
    penalties += 2;
  }
  
  // Too short with weak patterns
  if (password.length < 8 && charTypes < 3) {
    penalties += 1;
  }
  
  // Apply penalties
  score = Math.max(0, score - penalties);
  
  // Cap at 4 and ensure realistic scoring
  score = Math.min(score, 4);
  
  // Force very weak for obviously terrible passwords
  if (password.length < 6 || penalties >= 2) {
    score = Math.min(score, 1);
  }
  
  const strengthMap = {
    0: { label: 'Very Weak', color: '#EF4444' }, // red-500
    1: { label: 'Weak', color: '#F97316' },      // orange-500
    2: { label: 'Fair', color: '#EAB308' },      // yellow-500
    3: { label: 'Good', color: '#22C55E' },      // green-500
    4: { label: 'Strong', color: '#059669' }     // emerald-600
  };
  
  return {
    score,
    ...strengthMap[score as keyof typeof strengthMap]
  };
}

export function generatePassword(options: PasswordGeneratorOptions = {}): string {
  const {
    length = 16,
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSpecialChars = true,
    customChars = '',
    excludeSimilar = false
  } = options;

  if (length < 1) throw new Error('Password length must be at least 1');
  if (length > 1000) throw new Error('Password length too large');

  let charset = '';
  const requiredChars: string[] = [];
  
  // Build character sets
  if (includeLowercase) {
    const lowercase = excludeSimilar ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    charset += lowercase;
    requiredChars.push(lowercase[getSecureRandomInt(lowercase.length)]);
  }
  
  if (includeUppercase) {
    const uppercase = excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    charset += uppercase;
    requiredChars.push(uppercase[getSecureRandomInt(uppercase.length)]);
  }
  
  if (includeNumbers) {
    const numbers = excludeSimilar ? '23456789' : '0123456789';
    charset += numbers;
    requiredChars.push(numbers[getSecureRandomInt(numbers.length)]);
  }
  
  if (includeSpecialChars) {
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    charset += special;
    requiredChars.push(special[getSecureRandomInt(special.length)]);
  }
  
  if (customChars) {
    charset += customChars;
  }
  
  if (!charset) {
    throw new Error('At least one character type must be included');
  }
  
  // Convert charset to array for secure selection
  const charArray = charset.split('');
  
  // Start with required characters
  const passwordChars = [...requiredChars];
  
  // Fill remaining length with random characters from full charset
  while (passwordChars.length < length) {
    const randomIndex = getSecureRandomInt(charArray.length);
    passwordChars.push(charArray[randomIndex]);
  }
  
  // Securely shuffle the password to avoid predictable patterns
  return secureShuffleArray(passwordChars).join('');
}