/**
 * Info Field Preview Component
 * Same as main component since InfoField is display-only
 */

import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import { InfoFieldComponent } from './component.js';

type InfoFieldPreviewProps = FieldComponentProps;

export function InfoFieldPreview(props: InfoFieldPreviewProps) {
  // Info field is display-only, so preview is the same as the main component
  return <InfoFieldComponent {...props} />;
}
