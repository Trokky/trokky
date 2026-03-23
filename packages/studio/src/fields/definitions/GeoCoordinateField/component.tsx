/**
 * GeoCoordinate Field Component
 */

import React, { useState, useCallback } from 'react';
import { useT } from 'trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { GeoCoordinate, GeoCoordinateFieldDefinition } from './definition.js';

type GeoCoordinateFieldComponentProps = FieldComponentProps;

export function GeoCoordinateFieldComponent(props: GeoCoordinateFieldComponentProps) {
  const {
    value,
    onChange,
    definition,
    hasError,
    isDisabled,
    isReadonly
  } = props;

  const { t } = useT('fields');
  const def = definition as GeoCoordinateFieldDefinition;
  const coord = value as GeoCoordinate | null;
  const options = def.options || {};

  const [inputMode, setInputMode] = useState<'manual' | 'map'>(
    options.inputMode === 'both' ? 'manual' : options.inputMode || 'manual'
  );

  const handleCoordinateChange = useCallback((newCoord: Partial<GeoCoordinate>) => {
    const updated = { ...coord, ...newCoord } as GeoCoordinate;
    onChange(updated);
  }, [coord, onChange]);

  const handleGeolocation = useCallback(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoord: GeoCoordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          alt: position.coords.altitude || undefined,
          accuracy: position.coords.accuracy || undefined
        };
        onChange(newCoord);
      },
      (error) => {
        console.error('Geolocation error:', error);
      }
    );
  }, [onChange]);

  const formatCoordinate = (num: number | undefined, decimals = 6) => {
    return num?.toFixed(decimals) || '';
  };

  return (
    <div className="geo-coordinate-field">
      {/* Mode Toggle */}
      {options.inputMode === 'both' && (
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`px-2 py-0.5 text-xs rounded ${
              inputMode === 'manual'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
            disabled={isDisabled}
          >
            {t('types.geoCoordinate.manual')}
          </button>
          <button
            type="button"
            onClick={() => setInputMode('map')}
            className={`px-2 py-0.5 text-xs rounded ${
              inputMode === 'map'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
            disabled={isDisabled}
          >
            {t('types.geoCoordinate.map')}
          </button>
        </div>
      )}

      {/* Manual Input Mode */}
      {(inputMode === 'manual' || options.inputMode === 'manual') && (
        <div className="space-y-1.5">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">
                {t('types.geoCoordinate.latitude')}
              </label>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={formatCoordinate(coord?.lat)}
                onChange={(e) => handleCoordinateChange({ lat: parseFloat(e.target.value) || 0 })}
                className={`w-full px-2 py-1 text-sm border rounded-md ${
                  hasError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="40.7128"
                disabled={isDisabled}
                readOnly={isReadonly}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">
                {t('types.geoCoordinate.longitude')}
              </label>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={formatCoordinate(coord?.lng)}
                onChange={(e) => handleCoordinateChange({ lng: parseFloat(e.target.value) || 0 })}
                className={`w-full px-2 py-1 text-sm border rounded-md ${
                  hasError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="-74.0060"
                disabled={isDisabled}
                readOnly={isReadonly}
              />
            </div>
            {options.enableGeolocation && (
              <button
                type="button"
                onClick={handleGeolocation}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
                disabled={isDisabled || isReadonly}
                title={t('types.geoCoordinate.useCurrentLocation')}
              >
                GPS
              </button>
            )}
          </div>

          {options.showAltitude && (
            <div>
              <label className="block text-xs font-medium text-gray-700">
                {t('types.geoCoordinate.altitude')}
              </label>
              <input
                type="number"
                step="any"
                value={formatCoordinate(coord?.alt)}
                onChange={(e) => handleCoordinateChange({ alt: parseFloat(e.target.value) || undefined })}
                className={`w-full px-2 py-1 text-sm border rounded-md ${
                  hasError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="10"
                disabled={isDisabled}
                readOnly={isReadonly}
              />
            </div>
          )}

          {options.showAccuracy && coord?.accuracy && (
            <div>
              <label className="block text-xs font-medium text-gray-700">
                {t('types.geoCoordinate.accuracy')}
              </label>
              <input
                type="number"
                value={formatCoordinate(coord.accuracy)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md bg-gray-50"
                readOnly
              />
            </div>
          )}
        </div>
      )}

      {/* Map Mode Placeholder */}
      {(inputMode === 'map' || options.inputMode === 'map') && (
        <div 
          className="border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center"
          style={{ height: options.mapHeight || 300 }}
        >
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">{t('types.geoCoordinate.map')}</div>
            <div>{t('types.geoCoordinate.interactiveMap')}</div>
            <div className="text-sm">{t('types.geoCoordinate.comingSoon')}</div>
            {coord && (
              <div className="mt-2 text-xs">
                {formatCoordinate(coord.lat)}, {formatCoordinate(coord.lng)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current Value Display */}
      {coord && (
        <div className="mt-1 text-[10px] text-gray-400">
          {formatCoordinate(coord.lat)}, {formatCoordinate(coord.lng)}
          {coord.alt && ` (${formatCoordinate(coord.alt)}m)`}
        </div>
      )}
    </div>
  );
}
