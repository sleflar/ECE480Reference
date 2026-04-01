from flask import Blueprint, jsonify, request
from pathlib import Path
import shutil
from ..utils.map_utils import download_grid

maps_bp = Blueprint('maps', __name__)


@maps_bp.route('/cache-map', methods=['POST'])
def cache_map():
    """
    Cache map tiles for offline use.
    Downloads a grid of tiles from OpenStreetMap based on provided coordinates.
    """
    try:
        data = request.get_json()

        lat = float(data.get('lat'))
        lng = float(data.get('lng'))
        folder_name = data.get('folderName', 'cached_map')
        zoom = int(data.get('zoom', 14))
        grid_size = int(data.get('gridSize', 4))

        if not (-90 <= lat <= 90):
            return jsonify({"error": "Latitude must be between -90 and 90"}), 400
        if not (-180 <= lng <= 180):
            return jsonify({"error": "Longitude must be between -180 and 180"}), 400
        if not (1 <= zoom <= 18):
            return jsonify({"error": "Zoom must be between 1 and 18"}), 400
        if not (1 <= grid_size <= 10):
            return jsonify({"error": "Grid size must be between 1 and 10"}), 400

        tiles_downloaded, errors, center_x, center_y = download_grid(
            lat, lng, folder_name, zoom, grid_size
        )

        response_data = {
            "status": "success",
            "folderName": folder_name,
            "tilesDownloaded": tiles_downloaded,
            "totalTiles": grid_size * grid_size,
            "centerTile": {"x": center_x, "y": center_y, "zoom": zoom}
        }

        if errors:
            response_data["errors"] = errors
            response_data["status"] = "partial_success"

        return jsonify(response_data), 200

    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@maps_bp.route('/delete-map-folder', methods=['POST'])
def delete_map_folder():
    """
    Delete a cached map folder and all its contents.
    Includes security checks to prevent path traversal attacks.
    """
    try:
        data = request.get_json()
        folder_name = data.get('folderName')

        if not folder_name:
            return jsonify({"error": "Folder name is required"}), 400

        if '..' in folder_name or '/' in folder_name or '\\' in folder_name:
            return jsonify({"error": "Invalid folder name"}), 400

        maps_dir = Path(__file__).parent.parent.parent / 'rissar-frontend' / 'src' / 'maps' / folder_name

        if not maps_dir.exists():
            return jsonify({"error": "Folder not found"}), 404

        if not maps_dir.is_dir():
            return jsonify({"error": "Path is not a directory"}), 400

        shutil.rmtree(maps_dir)

        return jsonify({
            "status": "success",
            "message": f"Folder '{folder_name}' deleted successfully"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500