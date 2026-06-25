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


interface AnimatedMarkerProps {
  latitude: number;
  longitude: number;
  anchor?: "center" | "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}

const AnimatedMarker = ({ latitude, longitude, anchor = "bottom", children }: AnimatedMarkerProps) => {
  const [pos, setPos] = useState({ lat: latitude, lng: longitude });
  const animRef = useRef<number | null>(null);
  
  // Track previous target coordinates to detect changes
  const prevTarget = useRef({ lat: latitude, lng: longitude });

  if (prevTarget.current.lat !== latitude || prevTarget.current.lng !== longitude) {
    prevTarget.current = { lat: latitude, lng: longitude };
    
    // Smoothly interpolate towards the target coordinates
    const animate = () => {
      setPos((current) => {
        const dLat = latitude - current.lat;
        const dLng = longitude - current.lng;
        
        // Adjust 0.1 to tweak speed (lower = slower/smoother, higher = snappier)
        const step = 0.1; 

        // If close enough, snap to target and stop loop
        if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) {
          return { lat: latitude, lng: longitude };
        }

        animRef.current = requestAnimationFrame(animate);
        return {
          lat: current.lat + dLat * step,
          lng: current.lng + dLng * step,
        };
      });
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
  }

  return (
    <Marker latitude={pos.lat} longitude={pos.lng} anchor={anchor}>
      {children}
    </Marker>
  );
};

const GSDCMap = forwardRef<GSDCMapHandle, GSDCMapProps>(({ data, latCol, lngCol, labelCol, highlight = null, isolateHighlighted = false, renderMarker }, ref) => {
    const [currentStyle, setCurrentStyle] = useState<keyof typeof MAP_STYLES>("satellite");
    const [showStylePicker, setShowStylePicker] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const mapRef = useRef<MapRef>(null);  

    useImperativeHandle(ref, () => ({
        scrollTo: (lat: number, lng: number, zoom = 12, offsetX: number | string = 0) => {
            const mapCanvas = mapRef.current?.getCanvas();
            if (!mapCanvas) return;

            let finalOffsetX = 0;

            if (typeof offsetX === 'string' && offsetX.endsWith('%')) {
                const percentValue = parseFloat(offsetX) / 100;
                const width = mapCanvas.clientWidth;
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
            type="button" 
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
            initialViewState={{ longitude: 121.0, latitude: 14.6, zoom: 10 }} 
            mapStyle={MAP_STYLES[currentStyle] as any} 
            style={{ width: '100%', height: '100%' }}
        >
            <NavigationControl position="top-right" />

            {/* CHUNK 1: ISOLATED HIGHLIGHT MAP VIEW */}
            {(isolateHighlighted && highlight && highlight.col_key && typeof highlight.key !== 'undefined')
              ? data.filter(item => item[highlight.col_key] === highlight.key).map((item) => {
                  const lat = parseFloat(item[latCol]);
                  const lng = parseFloat(item[lngCol]);
                  const truckId = item[labelCol];
                  if (isNaN(lat) || isNaN(lng)) return null;
                  let highlightType = highlight.type || 'info';
                  const highlightColor = getHighlightBorder(highlightType);
                  return (
                    <AnimatedMarker 
                        key={truckId} 
                        latitude={lat} 
                        longitude={lng}
                        anchor="bottom"
                    >
                        <div 
                        className={`animated-map-marker highlighted-map-marker`}
                        style={{ '--highlight-color': highlightColor } as React.CSSProperties}
                        onClick={() => setSelectedItem(item)}
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
                    </AnimatedMarker>
                  );
                })
              
              /* CHUNK 2: REGULAR DATA DATASET MAP VIEW */
              : data.map((item) => {
              const lat = parseFloat(item[latCol]);
              const lng = parseFloat(item[lngCol]);
              const truckId = item[labelCol];

              if (isNaN(lat) || isNaN(lng)) {
                return null; 
              }

                let isHighlighted = false;
                let highlightType = 'info';
                if (highlight && highlight.col_key && typeof highlight.key !== 'undefined') {
                  isHighlighted = item[highlight.col_key] === highlight.key;
                  highlightType = highlight.type || 'info';
                }
                const highlightColor = isHighlighted ? getHighlightBorder(highlightType) : 'transparent';
                return (
                  <AnimatedMarker 
                    key={truckId} 
                    latitude={lat} 
                    longitude={lng}
                    anchor="bottom" 
                  >
                    <div 
                    className={`animated-map-marker${isHighlighted ? ' highlighted-map-marker' : ''}`}
                    style={{ '--highlight-color': highlightColor } as React.CSSProperties}
                    onClick={() => setSelectedItem(item)}
                    >
                    <span className="marker-label">
                      {isHighlighted ? `📍 ${item[labelCol]}` : item[labelCol]}
                    </span>
                        {renderMarker ? (
                          renderMarker(item, isHighlighted)
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
                  </AnimatedMarker>
                );
                })}

            {selectedItem && (
            <Popup
                latitude={parseFloat(selectedItem[latCol])}
                longitude={parseFloat(selectedItem[lngCol])}
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