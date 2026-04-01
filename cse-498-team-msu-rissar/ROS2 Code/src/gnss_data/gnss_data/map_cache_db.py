import sqlite3
import os
import math
from pathlib import Path

#This class outlines a simple Map Cache and its connected database
class MapCache:
    #Initialize
    #This creates a path to the map cache directory
    #Also creates database file and connection to the file
    def __init__(self, cache_dir="src/gnss_data/resource/map_cache"):
        self.cache_dir = cache_dir


        Path(self.cache_dir).mkdir(parents = True, exist_ok = True)


        self.db_path = os.path.join(self.cache_dir, 'map_cache.db')


        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()


        self.create_table()


        #FOR DEMO PURPOSES ONLY
        print(f"Database created at: {self.db_path}")


    #this just creates our table
    #tracks the zoom level, x and y coordinates, and stores the filename for the map tile
    def create_table(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tiles(
                zoom INTEGER,
                x_coord INTEGER,
                y_coord INTEGER,
                filename TEXT
            )
        ''')
        self.conn.commit()


        #for demo purposes only
        print("Table generated")


    #insert map tile
    def insert_tile(self, zoom, x, y, filename):
        self.cursor.execute('''
            INSERT INTO tiles(zoom, x_coord, y_coord, filename)
            VALUES(?, ?, ?, ?)
        ''', (zoom, x, y, filename))
        self.conn.commit()


        #for demo purposes only
        print(f"Added tile: zoom={zoom}, x_coord={x}, y_coord={y}, filename={filename}")


    #check if map tile exists
    #if not, we can safely add new cached map tile
    def check_map_exists(self, zoom, x, y):
        self.cursor.execute('''
            SELECT filename FROM tiles
            WHERE zoom=? AND x_coord=? AND y_coord=?
        ''', (zoom, x, y))


        result = self.cursor.fetchone()
        if result:
            return True
        else:
            return False
   
    #closes the database connection
    def close(self):
        self.conn.close()

#This converts coordinates to an x, y plane
#I got this concept from the following stack overflow link
#https://stackoverflow.com/questions/29218920/how-to-find-out-map-tile-coordinates-from-latitude-and-longitude
def coord_to_xy(lat, lon, zoom):

    lat_radians = math.radians(lat)

    n = 2 ** zoom
    x = int((lon+180.0)/360.0*n)
    y = int((1.0-math.asinh(math.tan(lat_radians))/math.pi)/2.0*n)

    return x, y

#This calculates the distance between two GPS points in meters using the Haversine formula
#This is necessary to gauge when to download a new map tile
#E.G. "If the car has driven +50 meters in the y direction, download a new map tile"
#Concept taken from the following Stack Overflow post
#https://stackoverflow.com/questions/365826/calculate-distance-between-2-gps-coordinates 
def calculate_distance(lat1, lon1, lat2, lon2):

    lat1_rads = math.radians(lat1)
    lat2_rads = math.radians(lat2)

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    #Haversine formula
    temp = (math.sin(dlat/2) * math.sin(dlat/2) +
            math.cos(lat1_rads) * math.cos(lat2_rads) * 
            math.sin(dlon/2) * math.sin(dlon/2))

    a = 2 * math.atan2(math.sqrt(temp), math.sqrt(1-temp))

    #Radius of the earth in meters
    R = 6371000

    return R * a


#main for testing purposes
def main(args=None):

    cache = MapCache()
    
    # print(cache.check_map_exists(1, 2, 3))

    # cache.insert_tile(1, 2, 3, "test1")

    # print(cache.check_map_exists(1, 2, 3))

    print(f"Coordinates of MSU in x, y plane: {coord_to_xy(42.7018, -84.4822, 14)}")
    print(f"Coordinates of Detroit in x, y plane: {coord_to_xy(42.3297, -83.0425, 15)}")

    print(f"Distance between MSU and Detroit in Kilometers: {calculate_distance(42.7018, -84.4822, 42.3297, -83.0425)/1000}")
   
#call to main
if __name__ == "__main__":
    main()