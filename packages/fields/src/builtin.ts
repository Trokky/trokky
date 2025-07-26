/**
 * Built-in Field Types Registration
 * Auto-registers all built-in field types when imported
 */

import { fieldRegistry } from './registry/FieldRegistry.js';
import { stringFieldPlugin } from './definitions/StringField/index.js';
import { textareaFieldPlugin } from './definitions/TextareaField/index.js';
import { emailFieldPlugin } from './definitions/EmailField/index.js';
import { urlFieldPlugin } from './definitions/URLField/index.js';
import { passwordFieldPlugin } from './definitions/PasswordField/index.js';
import { numberFieldPlugin } from './definitions/NumberField/index.js';
import { booleanFieldPlugin } from './definitions/BooleanField/index.js';
import { arrayFieldPlugin } from './definitions/ArrayField/index.js';

// Register all built-in field types
export function registerBuiltinFields(): void {
  // Text fields
  fieldRegistry.register(stringFieldPlugin, 'builtin');
  fieldRegistry.register(textareaFieldPlugin, 'builtin');
  fieldRegistry.register(emailFieldPlugin, 'builtin');
  fieldRegistry.register(urlFieldPlugin, 'builtin');
  fieldRegistry.register(passwordFieldPlugin, 'builtin');
  
  // Number fields
  fieldRegistry.register(numberFieldPlugin, 'builtin');
  
  // Boolean fields
  fieldRegistry.register(booleanFieldPlugin, 'builtin');
  
  // Array fields
  fieldRegistry.register(arrayFieldPlugin, 'builtin');
  
  // TODO: Register other built-in fields
  // fieldRegistry.register(numberFieldPlugin, 'builtin');
  // fieldRegistry.register(booleanFieldPlugin, 'builtin');
  // fieldRegistry.register(dateFieldPlugin, 'builtin');
  // fieldRegistry.register(arrayFieldPlugin, 'builtin');
  // fieldRegistry.register(objectFieldPlugin, 'builtin');
  // fieldRegistry.register(referenceFieldPlugin, 'builtin');
  
  // Mark registry as initialized
  fieldRegistry.markInitialized();
}

// Auto-register built-in fields when this module is imported
registerBuiltinFields();