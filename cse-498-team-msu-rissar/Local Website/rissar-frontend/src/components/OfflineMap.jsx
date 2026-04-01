/**
 * Offline Map View Component
 * 
 * Allows viewing and managing cached map tiles or single images for offline use.
 * Supports caching new regions via a backend API and deleting existing maps.
 * 
 */
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  MapContainer,
  ImageOverlay,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

const mapModules = import.meta.glob('../maps/**/*.png', { eager: true });

// convert tile coordinates to lat/lng bounds using spherical mercator projection
function tile2lat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tile2lng(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function getTileBounds(x, y, zoom) {
  const north = tile2lat(y, zoom);
  const south = tile2lat(y + 1, zoom);
  const west = tile2lng(x, zoom);
  const east = tile2lng(x + 1, zoom);
  return [[south, west], [north, east]];
}

function ChangeMapView({ bounds }) {
  const map = useMap();
  if (bounds) {
    map.fitBounds(bounds);
  }
  return null;
}

export default function OfflineMapView() {
  const [availableMaps, setAvailableMaps] = useState([]);
  const [selectedMap, setSelectedMap] = useState(null);
  const [loadedMap, setLoadedMap] = useState(null);
  const [imageBounds, setImageBounds] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);

  // map caching state
  const [showCacheForm, setShowCacheForm] = useState(false);
  const [cacheParams, setCacheParams] = useState({
    lat: 42.725,
    lng: -84.475,
    folderName: '',
    zoom: 14,
    gridSize: 4
  });
  const [caching, setCaching] = useState(false);
  const [cacheStatus, setCacheStatus] = useState('');

  // map deletion state
  const [deletingMap, setDeletingMap] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState('');

  // Load available maps from the file system (via Vite glob import)
  useEffect(() => {
    // extract map names and organize by folder structure
    const allFiles = Object.keys(mapModules).map(path => {
      const parts = path.split('/');
      const fileName = parts.pop().replace('.png', '');
      // get the folder name (second to last part after 'maps')
      const folderIndex = parts.indexOf('maps');
      const folderName = folderIndex !== -1 && parts[folderIndex + 1]
        ? parts[folderIndex + 1]
        : null;

      return {
        fileName: fileName,
        folderName: folderName,
        path: path,
        url: mapModules[path].default || mapModules[path]
      };
    });

    // group files by folder
    const tilePattern = /^(\d+)_(\d+)_(\d+)$/; // zoom_x_y pattern
    const folderMaps = new Map(); // map of folder name -> tiles
    const singleMaps = [];

    allFiles.forEach(file => {
      if (file.folderName) {
        // file is in a subfolder - treat as tiled map
        if (!folderMaps.has(file.folderName)) {
          folderMaps.set(file.folderName, []);
        }

        // try to parse tile coordinates from filename
        const match = file.fileName.match(tilePattern);
        if (match) {
          const [, zoom, x, y] = match;
          folderMaps.get(file.folderName).push({
            ...file,
            zoom: parseInt(zoom),
            x: parseInt(x),
            y: parseInt(y)
          });
        } else {
          // non-standard filename in folder - still add it but mark it
          folderMaps.get(file.folderName).push({
            ...file,
            zoom: null,
            x: null,
            y: null
          });
        }
      } else {
        // file is directly in maps/ - treat as single image
        singleMaps.push(file);
      }
    });

    // create map options list
    const mapOptions = [
      ...singleMaps.map(m => ({
        type: 'single',
        name: m.fileName,
        data: m
      })),
      ...Array.from(folderMaps.entries()).map(([folderName, tiles]) => ({
        type: 'tiled',
        name: folderName,
        data: tiles
      }))
    ];

    setAvailableMaps(mapOptions);
    if (mapOptions.length > 0) {
      setSelectedMap(mapOptions[0].name);
    }
  }, []);

  // Handle loading the selected map (calculating bounds for tiles or single images)
  const handleLoadMap = () => {
    const map = availableMaps.find(m => m.name === selectedMap);
    if (!map) return;

    if (map.type === 'tiled') {
      // for tiled maps, calculate bounds from all tiles
      const tiles = map.data;
      if (tiles.length === 0) return;

      // calculate overall bounds from all tiles
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;

      tiles.forEach(tile => {
        const tileBounds = getTileBounds(tile.x, tile.y, tile.zoom);
        minLat = Math.min(minLat, tileBounds[0][0]);
        maxLat = Math.max(maxLat, tileBounds[1][0]);
        minLng = Math.min(minLng, tileBounds[0][1]);
        maxLng = Math.max(maxLng, tileBounds[1][1]);
      });

      setImageBounds([[minLat, minLng], [maxLat, maxLng]]);
      setLoadedMap(map);
      // Set marker at center of bounds
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      setMarkerPosition([centerLat, centerLng]);
    } else {
      // single image - load to get dimensions
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.naturalWidth / img.naturalHeight;

        // center point (adjust to your location if needed)
        const centerLat = 42.725;
        const centerLng = -84.475;

        // define a reasonable size for the map
        const latHeight = 0.05; // degrees latitude
        const lngWidth = latHeight * aspectRatio; // maintain aspect ratio

        const bounds = [
          [centerLat - latHeight / 2, centerLng - lngWidth / 2],
          [centerLat + latHeight / 2, centerLng + lngWidth / 2]
        ];

        setImageBounds(bounds);
        setLoadedMap(map);
        // Set marker at center of bounds
        setMarkerPosition([centerLat, centerLng]);
      };
      img.src = map.data.url;
    }
  };

  // Send request to backend to cache a new map region
  const handleCacheMap = async () => {
    if (!cacheParams.folderName.trim()) {
      setCacheStatus('Please enter a folder name');
      return;
    }

    setCaching(true);
    setCacheStatus('Caching map tiles...');

    try {
      const response = await fetch('http://localhost:8080/cache-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cacheParams),
      });

      const data = await response.json();

      if (response.ok) {
        setCacheStatus(
          `Success! Downloaded ${data.tilesDownloaded} tiles to folder "${data.folderName}". Refreshing page...`
        );
        // reset form
        setCacheParams({
          lat: 42.725,
          lng: -84.475,
          folderName: '',
          zoom: 14,
          gridSize: 4
        });
        // refresh the page after a brief delay to show the success message
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setCacheStatus(`Error: ${data.error || 'Failed to cache map'}`);
      }
    } catch (error) {
      setCacheStatus(`Error: ${error.message}`);
    } finally {
      setCaching(false);
    }
  };

  // Send request to backend to delete a cached map
  const handleDeleteMap = async (mapName) => {
    if (!confirm(`Are you sure you want to delete the map "${mapName}"? This cannot be undone.`)) {
      return;
    }

    setDeletingMap(mapName);
    setDeleteStatus('Deleting...');

    try {
      const response = await fetch('http://localhost:8080/delete-map-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderName: mapName }),
      });

      const data = await response.json();

      if (response.ok) {
        setDeleteStatus(`Successfully deleted "${mapName}"`);

        // remove the deleted map from the available maps list
        setAvailableMaps(prev => prev.filter(m => m.name !== mapName));

        // if the deleted map was selected or loaded, clear the selection
        if (selectedMap === mapName) {
          setSelectedMap(availableMaps.find(m => m.name !== mapName)?.name || null);
        }
        if (loadedMap?.name === mapName) {
          setLoadedMap(null);
          setImageBounds(null);
        }

        // clear status after 3 seconds
        setTimeout(() => {
          setDeleteStatus('');
          setDeletingMap(null);
        }, 3000);
      } else {
        setDeleteStatus(`Error: ${data.error}`);
        setTimeout(() => {
          setDeleteStatus('');
          setDeletingMap(null);
        }, 5000);
      }
    } catch (error) {
      setDeleteStatus(`Error: ${error.message}`);
      setTimeout(() => {
        setDeleteStatus('');
        setDeletingMap(null);
      }, 5000);
    }
  };

  if (loadedMap && imageBounds) {
    return (
      <div className="flex h-full flex-col gap-3 text-xs text-gray-900 dark:text-gray-100 sm:text-sm">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm dark:bg-card">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Currently loaded: <strong>{loadedMap.name}</strong>
            </span>
            {loadedMap.type === 'tiled' && (
              <span className="text-muted-foreground">
                ({loadedMap.data.length} tiles)
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setLoadedMap(null);
              setImageBounds(null);
              setMarkerPosition(null);
            }}
            className="ml-auto inline-flex items-center rounded-md border border-brand-green px-2 py-1 text-[11px] font-semibold text-brand-green transition hover:bg-brand-green/10 dark:border-brand-green dark:text-white dark:hover:bg-brand-green/30"
          >
            Back to selection
          </button>
        </div>

        <div className="flex-1 min-h-0 rounded-xl border border-border bg-muted/40 dark:bg-black/40">
          <MapContainer
            key={loadedMap.name}
            bounds={imageBounds}
            scrollWheelZoom
            style={{ height: "100%", width: "100%", backgroundColor: "#0f0f0f" }}
          >
            {loadedMap.type === 'tiled'
              ? loadedMap.data.map((tile) => {
                const tileBounds = getTileBounds(tile.x, tile.y, tile.zoom);
                return (
                  <ImageOverlay
                    key={`${tile.zoom}_${tile.x}_${tile.y}`}
                    url={tile.url}
                    bounds={tileBounds}
                    opacity={1}
                  />
                );
              })
              : (
                <ImageOverlay
                  url={loadedMap.data.url}
                  bounds={imageBounds}
                  opacity={1}
                />
              )}
            {markerPosition && (
              <Marker position={markerPosition}>
                <Popup>
                  Marker position <br />
                  Latitude: {markerPosition[0].toFixed(4)} <br />
                  Longitude: {markerPosition[1].toFixed(4)}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 text-xs text-gray-900 dark:text-gray-100 sm:text-sm">
      <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm dark:bg-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Select Offline Map</p>
            <p className="text-xs text-muted-foreground">
              Choose a cached set or add a new region.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadMap}
              disabled={!selectedMap}
              className={cn(
                "rounded-md px-3 py-2 text-xs font-semibold transition",
                selectedMap
                  ? "border border-brand-green text-brand-green hover:bg-brand-green/10 dark:border-brand-green dark:text-white dark:hover:bg-brand-green/30"
                  : "cursor-not-allowed border border-border text-muted-foreground"
              )}
            >
              Load Map
            </button>
            <button
              onClick={() => setShowCacheForm(!showCacheForm)}
              className="rounded-md border border-brand-green px-3 py-2 text-xs font-semibold text-brand-green shadow transition hover:bg-brand-green/10 dark:border-brand-green dark:text-white dark:hover:bg-brand-green/30"
            >
              {showCacheForm ? "Hide Cache Form" : "Cache New Map"}
            </button>
          </div>
        </div>
      </div>

      {showCacheForm && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm dark:bg-[#111111]">
          <h4 className="mb-3 text-sm font-semibold">Cache Map Tiles</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted-foreground">
              Latitude
              <input
                type="number"
                step="any"
                value={cacheParams.lat}
                onChange={(e) => setCacheParams({ ...cacheParams, lat: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Longitude
              <input
                type="number"
                step="any"
                value={cacheParams.lng}
                onChange={(e) => setCacheParams({ ...cacheParams, lng: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Folder Name
              <input
                type="text"
                value={cacheParams.folderName}
                onChange={(e) => setCacheParams({ ...cacheParams, folderName: e.target.value })}
                placeholder="e.g. downtown"
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Zoom Level (1-18)
              <input
                type="number"
                min="1"
                max="18"
                value={cacheParams.zoom}
                onChange={(e) => setCacheParams({ ...cacheParams, zoom: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Grid Size (tiles)
              <input
                type="number"
                min="1"
                max="10"
                value={cacheParams.gridSize}
                onChange={(e) => setCacheParams({ ...cacheParams, gridSize: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              />
            </label>
          </div>
          <button
            onClick={handleCacheMap}
            disabled={caching}
            className={cn(
              "mt-4 w-full rounded-md px-3 py-2 text-xs font-semibold text-white transition",
              caching ? "bg-muted text-muted-foreground" : "bg-brand-green hover:bg-brand-green/90"
            )}
          >
            {caching ? "Caching..." : "Cache Map"}
          </button>
          {cacheStatus && (
            <div
              className={cn(
                "mt-3 rounded-md px-3 py-2 text-xs font-medium",
                cacheStatus.includes("Error")
                  ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
              )}
            >
              {cacheStatus}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-inner dark:bg-[#111111]">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Available maps
          </span>
          {availableMaps.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {availableMaps.length} saved
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/70">
          {availableMaps.length === 0 ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
              No offline maps found. Cache a region to get started.
            </div>
          ) : (
            availableMaps.map((map) => (
              <div
                role="button"
                tabIndex={0}
                key={map.name}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-green",
                  selectedMap === map.name
                    ? "bg-brand-green/10 text-brand-green dark:bg-brand-green/30 dark:text-white"
                    : "hover:bg-muted dark:hover:bg-[#1a1a1a]"
                )}
                onClick={() => setSelectedMap(map.name)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedMap(map.name);
                  }
                }}
              >
                <div>
                  <p className="font-semibold">{map.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {map.type === 'tiled'
                      ? `${map.data.length} tiles`
                      : 'Single image'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {map.type === 'tiled' ? 'Tiled' : 'Image'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMap(map.name);
                    }}
                    disabled={deletingMap === map.name}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-semibold text-destructive-foreground",
                      deletingMap === map.name
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive hover:bg-destructive/90"
                    )}
                  >
                    {deletingMap === map.name ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {deleteStatus && (
        <div
          className={cn(
            "rounded-md px-3 py-2 text-xs font-medium",
            deleteStatus.includes("Error")
              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
          )}
        >
          {deleteStatus}
        </div>
      )}
    </div>
  );
}
