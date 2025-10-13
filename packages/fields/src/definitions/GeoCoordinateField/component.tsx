/**
 * GeoCoordinate Field Component
 */

import React, { useState, useCallback } from 'react';
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
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            className={`px-3 py-1 text-sm rounded ${
              inputMode === 'manual' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            disabled={isDisabled}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => setInputMode('map')}
            className={`px-3 py-1 text-sm rounded ${
              inputMode === 'map' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700'
            }`}
            disabled={isDisabled}
          >
            Map
          </button>
        </div>
      )}

      {/* Manual Input Mode */}
      {(inputMode === 'manual' || options.inputMode === 'manual') && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                value={formatCoordinate(coord?.lat)}
                onChange={(e) => handleCoordinateChange({ lat: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-md ${
                  hasError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="40.7128"
                disabled={isDisabled}
                readOnly={isReadonly}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                value={formatCoordinate(coord?.lng)}
                onChange={(e) => handleCoordinateChange({ lng: parseFloat(e.target.value) || 0 })}
                className={`w-full px-3 py-2 border rounded-md ${
                  hasError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="-74.0060"
                disabled={isDisabled}
                readOnly={isReadonly}
              />
            </div>
          </div>

          {options.showAltitude && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Altitude (meters)
              </label>
              <input
                type="number"
                step="any"
                value={formatCoordinate(coord?.alt)}
                onChange={(e) => handleCoordinateChange({ alt: parseFloat(e.target.value) || undefined })}
                className={`w-full px-3 py-2 border rounded-md ${
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accuracy (meters)
              </label>
              <input
                type="number"
                value={formatCoordinate(coord.accuracy)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                readOnly
              />
            </div>
          )}

          {options.enableGeolocation && (
            <button
              type="button"
              onClick={handleGeolocation}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
              disabled={isDisabled || isReadonly}
            >
              📍 Use Current Location
            </button>
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
            <div className="text-2xl mb-2">🗺️</div>
            <div>Interactive Map</div>
            <div className="text-sm">(Coming soon)</div>
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
        <div className="mt-2 text-xs text-gray-500">
          Current: {formatCoordinate(coord.lat)}, {formatCoordinate(coord.lng)}
          {coord.alt && ` (${formatCoordinate(coord.alt)}m)`}
        </div>
      )}
    </div>
  );
}
