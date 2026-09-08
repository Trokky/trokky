/**
 * GeoCoordinate Field Preview Component
 */

import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { GeoCoordinate } from './definition.js';

export function GeoCoordinateFieldPreview(props: FieldComponentProps) {
  const { value } = props;
  const coord = value as GeoCoordinate | null;

  if (!coord || coord.lat === undefined || coord.lng === undefined) {
    return (
      <div className="text-gray-400 italic">
        No coordinates set
      </div>
    );
  }

  const formatCoordinate = (num: number, decimals = 4) => {
    return num.toFixed(decimals);
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps?q=${coord.lat},${coord.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <div className="font-mono text-sm">
          {formatCoordinate(coord.lat)}, {formatCoordinate(coord.lng)}
        </div>
        {coord.alt && (
          <div className="text-xs text-gray-500">
            Altitude: {formatCoordinate(coord.alt)}m
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={openInMaps}
        className="text-blue-500 hover:text-blue-700 text-sm"
        title="View on Google Maps"
      >
        Map
      </button>
    </div>
  );
}
