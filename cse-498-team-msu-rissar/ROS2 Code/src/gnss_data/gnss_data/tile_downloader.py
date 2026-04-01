import requests
import os
from pathlib import Path
from gnss_data.map_cache_db import MapCache, coord_to_xy


#This functions downloads a map tile to the map cache
#ONLY CALL THIS FROM save_tile_to_db
def download_tile(zoom, x, y, save_to = "../Local Website/rissar-frontend/src/maps"):
    url = f"https://tile.openstreetmap.org/{zoom}/{x}/{y}.png"

    filename = f"{zoom}_{x}_{y}.png"

    #Extrapolates full file path, purpose of os is to make this portable to different computers
    filepath = os.path.join(save_to, filename)

    try:

        #Sends this header to the server
        header = {'User-Agent':'MSU-PoliMOVE-Racecar'}

        #This downloads the tile
        result = requests.get(url, headers = header, timeout=10)

        #opens in 'wb' mode so that we can save image content
        with open(filepath, 'wb') as f:
            #writes the downloaded content to disk
            f.write(result.content)
        return True, filename

    except Exception as err:
        print(err)
        print("Download Error")
        return False, None

#This downloads the file and saves it to the database
def save_tile_to_db(zoom, x, y, db, save_to = "../resource/map_cache"):

    #Check if exists, if it does, return
    if (db.check_map_exists(zoom, x, y)):
        print("This tile already exists in the DB")
        return False

    result, filename = download_tile(zoom, x, y)
    if (result):
        db.insert_tile(zoom, x, y, filename)
        return True
    else:
        return False

def download_grid(latitude, longitude, db, zoom=14):
    x, y = coord_to_xy(latitude, longitude, zoom)
    for dx in range(-2, 2):
        for dy in range(-2, 2):
            save_tile_to_db(zoom, x + dx, y + dy, db)

def main():
    #Below is for Demo purposes only
    #East Lansing
    # lat, lon = 39.7903, -86.2337
    # zoom = 14
    # x, y = coord_to_xy(lat, lon, zoom)
    # db = MapCache("../resource/map_cache")
    # print(save_tile_to_db(zoom, x, y, db))

    #Detroit
    lat, lon = 42.3393, -83.0489
    zoom = 15
    x, y = coord_to_xy(lat, lon, zoom)
    db = MapCache("../resource/map_cache")
    print(save_tile_to_db(zoom, x, y, db))

if (__name__ == "__main__"):
    main()