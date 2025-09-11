/**
 * Built-in Field Types Registration
 * Auto-registers all built-in field types when imported
 */

import { fieldRegistry } from './registry/FieldRegistry.js'
import { stringFieldPlugin } from './definitions/StringField/index.js'
import { textareaFieldPlugin } from './definitions/TextareaField/index.js'
import { emailFieldPlugin } from './definitions/EmailField/index.js'
import { urlFieldPlugin } from './definitions/URLField/index.js'
import { passwordFieldPlugin } from './definitions/PasswordField/index.js'
import { SlugFieldPlugin } from './definitions/SlugField/index.js'
import { numberFieldPlugin } from './definitions/NumberField/index.js'
import { booleanFieldPlugin } from './definitions/BooleanField/index.js'
import { arrayFieldPlugin } from './definitions/ArrayField/index.js'
import { ObjectFieldPlugin } from './definitions/ObjectField/index.js'
import { mediaFieldPlugin } from './definitions/MediaField/index.js'
import { AudioFieldPlugin } from './definitions/AudioField/index.js'
import { VideoFieldPlugin } from './definitions/VideoField/index.js'
import { ImageFieldPlugin } from './definitions/ImageField/index.js'
import { DocumentFieldPlugin } from './definitions/DocumentField/index.js'
import { referenceFieldPlugin } from './definitions/ReferenceField/index.js'
import { richtextFieldPlugin } from './definitions/RichTextField/index.js'
import { portableTextFieldPlugin } from './definitions/PortableTextField/index.js'
import { dateFieldPlugin } from './definitions/DateField/index.js'
import { ColorFieldPlugin } from './definitions/ColorField/index.js'

// Register all built-in field types
export function registerBuiltinFields(): void {
  // Text fields
  fieldRegistry.register(stringFieldPlugin, 'builtin')
  fieldRegistry.register(textareaFieldPlugin, 'builtin')
  fieldRegistry.register(emailFieldPlugin, 'builtin')
  fieldRegistry.register(urlFieldPlugin, 'builtin')
  fieldRegistry.register(passwordFieldPlugin, 'builtin')
  fieldRegistry.register(SlugFieldPlugin, 'builtin')

  // Number fields
  fieldRegistry.register(numberFieldPlugin, 'builtin')

  // Boolean fields
  fieldRegistry.register(booleanFieldPlugin, 'builtin')

  // Array fields
  fieldRegistry.register(arrayFieldPlugin, 'builtin')

  // Object fields
  fieldRegistry.register(ObjectFieldPlugin, 'builtin')

  // Media fields
  fieldRegistry.register(mediaFieldPlugin, 'builtin')
  fieldRegistry.register(AudioFieldPlugin, 'builtin')
  fieldRegistry.register(VideoFieldPlugin, 'builtin')
  fieldRegistry.register(ImageFieldPlugin, 'builtin')
  fieldRegistry.register(DocumentFieldPlugin, 'builtin')

  // Rich text fields
  fieldRegistry.register(richtextFieldPlugin, 'builtin')
  fieldRegistry.register(portableTextFieldPlugin, 'builtin')

  // Reference fields
  fieldRegistry.register(referenceFieldPlugin, 'builtin')

  // Date fields
  fieldRegistry.register(dateFieldPlugin, 'builtin')

  // Color field
  fieldRegistry.register(ColorFieldPlugin, 'builtin')

  // Mark registry as initialized
  fieldRegistry.markInitialized()
}

// Auto-register built-in fields when this module is imported
// Use a global flag to ensure fields are only registered once
if (typeof globalThis !== 'undefined') {
  const globalAny = globalThis as any
  if (!globalAny.__TROKKY_BUILTIN_FIELDS_REGISTERED__) {
    registerBuiltinFields()
    globalAny.__TROKKY_BUILTIN_FIELDS_REGISTERED__ = true
  }
} else {
  // Fallback for environments without globalThis
  registerBuiltinFields()
}
