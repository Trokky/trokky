import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/index.js';

export interface DateValidation extends BaseValidation {
  min?: string | Date;
  max?: string | Date;
  disablePast?: boolean;
  disableFuture?: boolean;
  disableWeekends?: boolean;
  disabledDates?: Array<string | Date>;
  allowedDates?: Array<string | Date>;
}

export interface DateFieldOptions extends BaseFieldOptions {
  dateFormat?: string;
  displayFormat?: string;
  includeTime?: boolean;
  timeFormat?: '12h' | '24h';
  minTime?: string;
  maxTime?: string;
  showCalendar?: boolean;
  calendarStartDay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  placeholder?: string;
  clearable?: boolean;
  autoFocus?: boolean;
}

export interface DateFieldDefinition extends BaseFieldDefinition {
  type: 'date';
  validation?: DateValidation;
  options?: DateFieldOptions;
  default?: string | Date | 'now';
}

export type DateFieldValue = string | Date | null;

export const DATE_FIELD_DEFAULTS: DateFieldOptions = {
  dateFormat: 'YYYY-MM-DD',
  displayFormat: 'MMM DD, YYYY',
  includeTime: false,
  timeFormat: '12h',
  showCalendar: true,
  calendarStartDay: 0,
  placeholder: 'Select a date',
  clearable: true,
  autoFocus: false
};