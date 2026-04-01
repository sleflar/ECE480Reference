import math
import time
import requests
from pathlib import Path


def coord_to_xy(lat, lon, zoom):
    """
    Convert latitude/longitude coordinates to tile coordinates at a given zoom level.

    Args:
        lat: Latitude in degrees
        lon: Longitude in degrees
        zoom: Map zoom level

    Returns:
        Tuple of (x, y) tile coordinates
    """
    lat_rad = math.radians(lat)
    n = 2.0 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


def download_tile_to_frontend(zoom, x, y, folder_name):
    """
    Download a single map tile from OpenStreetMap and save it to the frontend maps directory.

    Args:
        zoom: Map zoom level
        x: Tile x coordinate
        y: Tile y coordinate
        folder_name: Destination folder name for the tile

    Returns:
        Tuple of (success: bool, filename: str or None)
    """
    url = f"https://tile.openstreetmap.org/{zoom}/{x}/{y}.png"
    filename = f"{zoom}_{x}_{y}.png"

    base_dir = Path(__file__).parent.parent.parent / 'rissar-frontend' / 'src' / 'maps' / folder_name
    base_dir.mkdir(parents=True, exist_ok=True)
    filepath = base_dir / filename

    if filepath.exists():
        return True, filename

    try:
        header = {'User-Agent': 'RISSAR-MapCache/1.0'}
        response = requests.get(url, headers=header, timeout=10)
        response.raise_for_status()

        with open(filepath, 'wb') as f:
            f.write(response.content)

        time.sleep(0.1)

        return True, filename
    except Exception as err:
        print(f"Download Error for tile {zoom}/{x}/{y}: {err}")
        return False, None


def download_grid(latitude, longitude, folder_name, zoom=14, grid_size=4):
    """
    Download a grid of map tiles centered on the given coordinates.

    Args:
        latitude: Center point latitude
        longitude: Center point longitude
        folder_name: Destination folder for tiles
        zoom: Map zoom level (default: 14)
        grid_size: Size of the grid to download (default: 4)

    Returns:
        Tuple of (tiles_downloaded: int, errors: list, center_x: int, center_y: int)
    """
    center_x, center_y = coord_to_xy(latitude, longitude, zoom)

    half_grid = grid_size // 2
    tiles_downloaded = 0
    errors = []

    for dx in range(-half_grid, half_grid):
        for dy in range(-half_grid, half_grid):
            x = center_x + dx
            y = center_y + dy

            success, filename = download_tile_to_frontend(zoom, x, y, folder_name)
            if success:
                tiles_downloaded += 1
            else:
                errors.append(f"Failed to download tile {zoom}/{x}/{y}")

    return tiles_downloaded, errors, center_x, center_y