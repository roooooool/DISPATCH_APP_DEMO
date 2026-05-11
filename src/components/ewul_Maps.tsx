import { useState, useImperativeHandle, forwardRef, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, TruckIcon } from 'lucide-react';


// CSS imports
import './comp_css/ewul_Maps.css';
import '../theme.css';


export interface HighlightConfig {
  col_key: string;
  key: any;
  type: 'success' | 'warning' | 'info' | 'danger';
}

interface GSDCMapProps {
  data: any[];
  latCol: string;
  lngCol: string;
  labelCol: string;
  highlight?: HighlightConfig | null;
  isolateHighlighted?: boolean;
  renderMarker?: (item: any, isHighlighted: boolean) => React.ReactNode;
}

export interface GSDCMapHandle {
  scrollTo: (lat: number, lng: number, zoom?: number, offsetX?: number | string) => void;
}

const MAP_STYLES = {
  dark: "https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  satellite: {
    version: 8,
    sources: {
      "satellite-tiles": {
        type: "raster",
        tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        attribution: "Esri"
      },
      "road-labels": {
        type: "raster",
        tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256
      }
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster",
        source: "satellite-tiles"
      },
      {
        id: "roads-layer",
        type: "raster",
        source: "road-labels",
        paint: { 
                    "raster-opacity": 0.5,
                    // This shifts the colors. Experiment with these values:
                    "raster-hue-rotate": 180, 
                    "raster-brightness-max": 0.9 
                },// Slightly transparent so it blends well
        minzoom: 0,
        maxzoom: 15
      }
    ]
  }
} as const;

const GSDCMap = forwardRef<GSDCMapHandle, GSDCMapProps>(({ data, latCol, lngCol, labelCol, highlight = null, isolateHighlighted = false, renderMarker }, ref) => {
    const [currentStyle, setCurrentStyle] = useState<keyof typeof MAP_STYLES>("satellite");
    const [showStylePicker, setShowStylePicker] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const mapRef = useRef<MapRef>(null);  

    // Expose the "Scroll To" logic to the parent
    useImperativeHandle(ref, () => ({
        scrollTo: (lat: number, lng: number, zoom = 12, offsetX: number | string = 0) => {
            const mapCanvas = mapRef.current?.getCanvas();
            if (!mapCanvas) return;

            let finalOffsetX = 0;

            if (typeof offsetX === 'string' && offsetX.endsWith('%')) {
                const percentValue = parseFloat(offsetX) / 100; // e.g., 0.2 for '20%'
                const width = mapCanvas.clientWidth;
                
                // MapLibre offset [0,0] is center. 
                // We subtract 0.5 so 50% becomes 0, 0% becomes -0.5, 100% becomes +0.5
                finalOffsetX = (percentValue - 0.5) * width;
            } else {
                finalOffsetX = Number(offsetX);
            }

            mapRef.current?.flyTo({ 
                center: [lng, lat], 
                zoom, 
                duration: 2000,
                offset: [finalOffsetX, 0] 
            });
        }
    }));

    // Helper: get highlight color
    const getHighlightBorder = (type: string) => {
      switch (type) {
        case 'success': return 'var(--color-border-success)';
        case 'warning': return 'var(--color-border-warning)';
        case 'info': return 'var(--color-border-info)';
        case 'danger': return 'var(--color-border-danger)';
        default: return 'var(--color-border-row)';
      }
    };

    return (
        <div className="gsdc-map-container" style={{ width: '100%', height: '100%', minHeight: '400px', borderRadius: '12px', overflow: 'hidden' }}>

        {/* STYLE SELECTOR OVERLAY */}
        <div className="map-style-picker">
            <button 
            type="button" // Prevents form submission if map is inside a form
            className="style-toggle-btn" 
            onClick={() => setShowStylePicker(!showStylePicker)}
            >
                <Layers size={18} />
            </button>

            {showStylePicker && (
            <div className="style-options-card">
                {Object.keys(MAP_STYLES).map((style) => (
                <label key={style} className="style-option">
                    <input 
                    type="radio" 
                    name="mapStyle" 
                    checked={currentStyle === style} 
                    onChange={() => {
                        setCurrentStyle(style as any);
                        setShowStylePicker(false);
                    }} 
                    />
                    <span className="capitalize">{style}</span>
                </label>
                ))}
            </div>
            )}
        </div>



        <Map
            ref={mapRef}
            initialViewState={{ longitude: 121.0, latitude: 14.6, zoom: 10 }} // Default to Manila/Philippines area
            mapStyle={MAP_STYLES[currentStyle] as any} // A nice dark/navy style
            style={{ width: '100%', height: '100%' }}
        >
            <NavigationControl position="top-right" />


            {(isolateHighlighted && highlight && highlight.col_key && typeof highlight.key !== 'undefined')
              ? data.filter(item => item[highlight.col_key] === highlight.key).map((item) => {
                  const lat = parseFloat(item[latCol]);
                  const lng = parseFloat(item[lngCol]);
                  const truckId = item[labelCol];
                  if (isNaN(lat) || isNaN(lng)) return null;
                  let highlightType = highlight.type || 'info';
                  const highlightColor = getHighlightBorder(highlightType);
                  return (
                    <Marker 
                        key={truckId} 
                        latitude={lat} 
                        longitude={lng}
                        anchor="bottom"
                    >
                        <div 
                        className={`animated-map-marker highlighted-map-marker`}
                        style={{ '--highlight-color': highlightColor } as React.CSSProperties}
                        >
                        <span className="marker-label">📍 {item[labelCol]}</span>
                        {renderMarker ? (
                          renderMarker(item, true)
                        ) : (
                          <>
                            <TruckIcon 
                                size={48}
                                color={"var(--color-accent-light)"}
                                fill={highlightColor}
                                strokeWidth={2}
                                style={{
                                  filter: `drop-shadow(0 0 10px ${highlightColor})`
                                }}
                            />
                          </>  
                        )}
                        </div>
                    </Marker>
                  );
                })
              : data.map((item) => {
              const lat = parseFloat(item[latCol]);
              const lng = parseFloat(item[lngCol]);
              const truckId = item[labelCol];

              // If coordinates are missing or invalid, don't render this marker
              if (isNaN(lat) || isNaN(lng)) {
                return null; 
              }

                // Highlight logic
                let isHighlighted = false;
                let highlightType = 'info';
                if (highlight && highlight.col_key && typeof highlight.key !== 'undefined') {
                  isHighlighted = item[highlight.col_key] === highlight.key;
                  highlightType = highlight.type || 'info';
                }
                const highlightColor = isHighlighted ? getHighlightBorder(highlightType) : 'transparent';
                return (
                  <Marker 
                    key={truckId} 
                    latitude={lat} 
                    longitude={lng}
                    anchor="bottom" 
                  >
                    <div 
                    className={`animated-map-marker${isHighlighted ? ' highlighted-map-marker' : ''}`}
                    style={{ '--highlight-color': highlightColor } as React.CSSProperties}
                    >
                    <span className="marker-label">
                      {isHighlighted ? `📍 ${item[labelCol]}` : item[labelCol]}
                    </span>
                        {renderMarker ? (
                          renderMarker(item, true)
                        ) : (
                        <>
                          <TruckIcon 
                            size={isHighlighted ? 48 : 40}
                            color={isHighlighted ? "var(--color-accent-light)" : "#105704"}
                            fill={isHighlighted ? highlightColor : "#39FF14"}
                            strokeWidth={isHighlighted ? 2 : 0.5}
                            style={{
                            filter: isHighlighted 
                              ? `drop-shadow(0 0 10px ${highlightColor})` 
                              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                            }}
                          />
                        </> )}
                    </div>
                  </Marker>
                );
                })}

            {selectedItem && (
            <Popup
                latitude={selectedItem[latCol]}
                longitude={selectedItem[lngCol]}
                onClose={() => setSelectedItem(null)}
                closeButton={false}
                className="gsdc-custom-popup"
            >
                <div className="popup-card">
                <h4>{selectedItem[labelCol]}</h4>
                <p>Lat: {selectedItem[latCol]}</p>
                <p>Lng: {selectedItem[lngCol]}</p>
                <button className="status-pill">View Details</button>
                </div>
            </Popup>
            )}
        </Map>
        </div>
    );
});

export default GSDCMap;