/**
 * Web-compatible crypto utilities for Studio
 * Browser-only implementation using Web Crypto API
 */

export interface WebCryptoOptions {
  length?: number;
  includeUppercase?: boolean;
  includeLowercase?: boolean;
  includeNumbers?: boolean;
  includeSpecialChars?: boolean;
  customChars?: string;
  excludeSimilar?: boolean;
}

/**
 * Generate cryptographically secure random integer using Web Crypto API
 */
function getSecureRandomInt(max: number): number {
  if (max <= 0) throw new Error('Max must be positive');
  
  // For browser environment, we know Web Crypto API is available
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
 * Cryptographically secure array shuffling using Fisher-Yates algorithm
 */
function secureShuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Generate a cryptographically secure password for web environments
 */
export function generateWebSecurePassword(options: WebCryptoOptions = {}): string {
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