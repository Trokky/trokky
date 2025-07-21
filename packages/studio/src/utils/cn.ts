import clsx, { ClassValue } from 'clsx';

/**
 * Utility function to merge class names with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}