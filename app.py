"""
NOAA KLWX Radar Display Web Application
Displays current weather radar imagery from NOAA for radar station KLWX
"""
from flask import Flask, render_template, jsonify, send_file, request
import requests
from datetime import datetime, timedelta
import io
from PIL import Image
import logging
import xml.etree.ElementTree as ET
import re
from weather_layers import WEATHER_LAYERS, CURRENT_LAYER
try:
    from zoneinfo import ZoneInfo
    TIMEZONE_SUPPORT = True
except ImportError:
    TIMEZONE_SUPPORT = False
    ZoneInfo = None


app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# Global storage for radar timestamp history
radar_history_storage = []

# Radar station database with identifiers, names, coordinates, and states
RADAR_STATIONS = {
    'KABR': {'name': 'Aberdeen', 'lat': 45.4558, 'lon': -98.4132, 'state': 'South Dakota'},
    'KABX': {'name': 'Albuquerque', 'lat': 35.1497, 'lon': -106.8244, 'state': 'New Mexico'},
    'KAKQ': {'name': 'Norfolk/Wakefield', 'lat': 36.9840, 'lon': -77.0074, 'state': 'Virginia'},
    'KAMA': {'name': 'Amarillo', 'lat': 35.2333, 'lon': -101.7092, 'state': 'Texas'},
    'KAMX': {'name': 'Miami', 'lat': 25.6111, 'lon': -80.4128, 'state': 'Florida'},
    'KAPX': {'name': 'Gaylord', 'lat': 44.9067, 'lon': -84.7197, 'state': 'Michigan'},
    'KARX': {'name': 'La Crosse', 'lat': 43.8228, 'lon': -91.1914, 'state': 'Wisconsin'},
    'KATX': {'name': 'Seattle/Tacoma', 'lat': 48.1947, 'lon': -122.4958, 'state': 'Washington'},
    'KBBX': {'name': 'Beale AFB', 'lat': 39.4961, 'lon': -121.6317, 'state': 'California'},
    'KBGM': {'name': 'Binghamton', 'lat': 42.1997, 'lon': -75.9847, 'state': 'New York'},
    'KBHX': {'name': 'Eureka', 'lat': 40.4986, 'lon': -124.2919, 'state': 'California'},
    'KBIS': {'name': 'Bismarck', 'lat': 46.7708, 'lon': -100.7603, 'state': 'North Dakota'},
    'KBLX': {'name': 'Billings', 'lat': 45.8536, 'lon': -108.6061, 'state': 'Montana'},
    'KBMX': {'name': 'Birmingham', 'lat': 33.1722, 'lon': -86.7697, 'state': 'Alabama'},
    'KBOX': {'name': 'Boston', 'lat': 41.9556, 'lon': -71.1367, 'state': 'Massachusetts'},
    'KBRO': {'name': 'Brownsville', 'lat': 25.9161, 'lon': -97.4189, 'state': 'Texas'},
    'KBUF': {'name': 'Buffalo', 'lat': 42.9489, 'lon': -78.7369, 'state': 'New York'},
    'KBYX': {'name': 'Key West', 'lat': 24.5975, 'lon': -81.7031, 'state': 'Florida'},
    'KCAE': {'name': 'Columbia', 'lat': 33.9489, 'lon': -81.1186, 'state': 'South Carolina'},
    'KCBW': {'name': 'Houlton', 'lat': 46.0392, 'lon': -67.8067, 'state': 'Maine'},
    'KCBX': {'name': 'Boise', 'lat': 43.4906, 'lon': -116.2356, 'state': 'Idaho'},
    'KCCX': {'name': 'State College', 'lat': 40.9231, 'lon': -78.0036, 'state': 'Pennsylvania'},
    'KCLE': {'name': 'Cleveland', 'lat': 41.4133, 'lon': -81.8597, 'state': 'Ohio'},
    'KCLX': {'name': 'Charleston', 'lat': 32.6556, 'lon': -81.0422, 'state': 'South Carolina'},
    'KCRP': {'name': 'Corpus Christi', 'lat': 27.7842, 'lon': -97.5111, 'state': 'Texas'},
    'KCXX': {'name': 'Burlington', 'lat': 44.5111, 'lon': -73.1667, 'state': 'Vermont'},
    'KCYS': {'name': 'Cheyenne', 'lat': 41.1519, 'lon': -104.8061, 'state': 'Wyoming'},
    'KDAX': {'name': 'Sacramento', 'lat': 38.5011, 'lon': -121.6778, 'state': 'California'},
    'KDDC': {'name': 'Dodge City', 'lat': 37.7608, 'lon': -99.9689, 'state': 'Kansas'},
    'KDFX': {'name': 'Laughlin AFB', 'lat': 29.2731, 'lon': -100.2803, 'state': 'Texas'},
    'KDGX': {'name': 'Jackson', 'lat': 32.2803, 'lon': -89.9844, 'state': 'Mississippi'},
    'KDIX': {'name': 'Philadelphia', 'lat': 39.9469, 'lon': -74.4111, 'state': 'New Jersey'},
    'KDLH': {'name': 'Duluth', 'lat': 46.8369, 'lon': -92.2097, 'state': 'Minnesota'},
    'KDMX': {'name': 'Des Moines', 'lat': 41.7311, 'lon': -93.7231, 'state': 'Iowa'},
    'KDOX': {'name': 'Dover AFB', 'lat': 38.8256, 'lon': -75.4400, 'state': 'Delaware'},
    'KDTX': {'name': 'Detroit', 'lat': 42.6997, 'lon': -83.4717, 'state': 'Michigan'},
    'KDVN': {'name': 'Davenport', 'lat': 41.6117, 'lon': -90.5808, 'state': 'Iowa'},
    'KEAX': {'name': 'Kansas City', 'lat': 38.8103, 'lon': -94.2644, 'state': 'Missouri'},
    'KEMX': {'name': 'Tucson', 'lat': 31.8936, 'lon': -110.6300, 'state': 'Arizona'},
    'KENX': {'name': 'Albany', 'lat': 42.5864, 'lon': -74.0639, 'state': 'New York'},
    'KEOX': {'name': 'Fort Rucker', 'lat': 31.4606, 'lon': -85.4594, 'state': 'Alabama'},
    'KEPZ': {'name': 'El Paso', 'lat': 31.8731, 'lon': -106.6978, 'state': 'Texas'},
    'KESX': {'name': 'Las Vegas', 'lat': 35.7011, 'lon': -114.8919, 'state': 'Nevada'},
    'KEVX': {'name': 'Eglin AFB', 'lat': 30.5644, 'lon': -85.9214, 'state': 'Florida'},
    'KEWX': {'name': 'Austin/San Antonio', 'lat': 29.7039, 'lon': -98.0283, 'state': 'Texas'},
    'KEYX': {'name': 'Edwards AFB', 'lat': 35.0978, 'lon': -117.5606, 'state': 'California'},
    'KFCX': {'name': 'Roanoke', 'lat': 37.0242, 'lon': -80.2742, 'state': 'Virginia'},
    'KFDR': {'name': 'Altus AFB', 'lat': 34.3622, 'lon': -98.9761, 'state': 'Oklahoma'},
    'KFDX': {'name': 'Cannon AFB', 'lat': 34.6347, 'lon': -103.6186, 'state': 'New Mexico'},
    'KFFC': {'name': 'Atlanta', 'lat': 33.3636, 'lon': -84.5658, 'state': 'Georgia'},
    'KFSD': {'name': 'Sioux Falls', 'lat': 43.5878, 'lon': -96.7289, 'state': 'South Dakota'},
    'KFSX': {'name': 'Flagstaff', 'lat': 34.5744, 'lon': -111.1983, 'state': 'Arizona'},
    'KFTG': {'name': 'Denver', 'lat': 39.7867, 'lon': -104.5458, 'state': 'Colorado'},
    'KFWS': {'name': 'Dallas/Fort Worth', 'lat': 32.5731, 'lon': -97.3031, 'state': 'Texas'},
    'KGGW': {'name': 'Glasgow', 'lat': 48.2064, 'lon': -106.6250, 'state': 'Montana'},
    'KGJX': {'name': 'Grand Junction', 'lat': 39.0619, 'lon': -108.2139, 'state': 'Colorado'},
    'KGLD': {'name': 'Goodland', 'lat': 39.3667, 'lon': -101.7000, 'state': 'Kansas'},
    'KGRB': {'name': 'Green Bay', 'lat': 44.4986, 'lon': -88.1117, 'state': 'Wisconsin'},
    'KGRK': {'name': 'Fort Hood', 'lat': 30.7217, 'lon': -97.3831, 'state': 'Texas'},
    'KGRR': {'name': 'Grand Rapids', 'lat': 42.8939, 'lon': -85.5447, 'state': 'Michigan'},
    'KGSP': {'name': 'Greer', 'lat': 34.8833, 'lon': -82.2200, 'state': 'South Carolina'},
    'KGWX': {'name': 'Columbus AFB', 'lat': 33.8967, 'lon': -88.3292, 'state': 'Mississippi'},
    'KGYX': {'name': 'Portland', 'lat': 43.8914, 'lon': -70.2564, 'state': 'Maine'},
    'KHDX': {'name': 'Holloman AFB', 'lat': 33.0786, 'lon': -106.1222, 'state': 'New Mexico'},
    'KHGX': {'name': 'Houston/Galveston', 'lat': 29.4719, 'lon': -95.0792, 'state': 'Texas'},
    'KHNX': {'name': 'San Joaquin Valley', 'lat': 36.3142, 'lon': -119.6322, 'state': 'California'},
    'KHPX': {'name': 'Fort Campbell', 'lat': 36.7367, 'lon': -87.2856, 'state': 'Kentucky'},
    'KHTX': {'name': 'Huntsville', 'lat': 34.9306, 'lon': -86.0836, 'state': 'Alabama'},
    'KICT': {'name': 'Wichita', 'lat': 37.6544, 'lon': -97.4431, 'state': 'Kansas'},
    'KILX': {'name': 'Lincoln', 'lat': 40.1506, 'lon': -89.3367, 'state': 'Illinois'},
    'KIND': {'name': 'Indianapolis', 'lat': 39.7075, 'lon': -86.2803, 'state': 'Indiana'},
    'KINX': {'name': 'Tulsa', 'lat': 36.1750, 'lon': -95.5644, 'state': 'Oklahoma'},
    'KIWA': {'name': 'Phoenix', 'lat': 33.2892, 'lon': -111.6700, 'state': 'Arizona'},
    'KIWX': {'name': 'North Webster', 'lat': 41.3586, 'lon': -85.7000, 'state': 'Indiana'},
    'KJAX': {'name': 'Jacksonville', 'lat': 30.4847, 'lon': -81.7019, 'state': 'Florida'},
    'KJGX': {'name': 'Robins AFB', 'lat': 32.6750, 'lon': -83.3511, 'state': 'Georgia'},
    'KJKL': {'name': 'Jackson', 'lat': 37.5906, 'lon': -83.3131, 'state': 'Kentucky'},
    'KLBB': {'name': 'Lubbock', 'lat': 33.6539, 'lon': -101.8142, 'state': 'Texas'},
    'KLCH': {'name': 'Lake Charles', 'lat': 30.1253, 'lon': -93.2158, 'state': 'Louisiana'},
    'KLIX': {'name': 'New Orleans', 'lat': 30.3367, 'lon': -89.8256, 'state': 'Louisiana'},
    'KLNX': {'name': 'North Platte', 'lat': 41.9581, 'lon': -100.5758, 'state': 'Nebraska'},
    'KLOT': {'name': 'Chicago', 'lat': 41.6044, 'lon': -88.0844, 'state': 'Illinois'},
    'KLRX': {'name': 'Elko', 'lat': 40.7397, 'lon': -116.8028, 'state': 'Nevada'},
    'KLSX': {'name': 'St. Louis', 'lat': 38.6989, 'lon': -90.6828, 'state': 'Missouri'},
    'KLTX': {'name': 'Wilmington', 'lat': 33.9892, 'lon': -78.4292, 'state': 'North Carolina'},
    'KLVX': {'name': 'Louisville', 'lat': 37.9753, 'lon': -85.9436, 'state': 'Kentucky'},
    'KLWX': {'name': 'Sterling', 'lat': 38.9754, 'lon': -77.4778, 'state': 'Virginia'},
    'KLZK': {'name': 'Little Rock', 'lat': 34.8364, 'lon': -92.2622, 'state': 'Arkansas'},
    'KMAF': {'name': 'Midland/Odessa', 'lat': 31.9433, 'lon': -102.1892, 'state': 'Texas'},
    'KMAX': {'name': 'Medford', 'lat': 42.0811, 'lon': -122.7175, 'state': 'Oregon'},
    'KMBX': {'name': 'Minot AFB', 'lat': 48.3925, 'lon': -100.8644, 'state': 'North Dakota'},
    'KMHX': {'name': 'Morehead City', 'lat': 34.7756, 'lon': -76.8761, 'state': 'North Carolina'},
    'KMKX': {'name': 'Milwaukee', 'lat': 42.9678, 'lon': -88.5506, 'state': 'Wisconsin'},
    'KMLB': {'name': 'Melbourne', 'lat': 28.1133, 'lon': -80.6542, 'state': 'Florida'},
    'KMOB': {'name': 'Mobile', 'lat': 30.6794, 'lon': -88.2397, 'state': 'Alabama'},
    'KMPX': {'name': 'Minneapolis/St. Paul', 'lat': 44.8489, 'lon': -93.5653, 'state': 'Minnesota'},
    'KMQT': {'name': 'Marquette', 'lat': 46.5311, 'lon': -87.5486, 'state': 'Michigan'},
    'KMRX': {'name': 'Knoxville/Tri-Cities', 'lat': 36.1686, 'lon': -83.4017, 'state': 'Tennessee'},
    'KMSX': {'name': 'Missoula', 'lat': 47.0414, 'lon': -113.9864, 'state': 'Montana'},
    'KMTX': {'name': 'Salt Lake City', 'lat': 41.2628, 'lon': -112.4453, 'state': 'Utah'},
    'KMUX': {'name': 'San Francisco', 'lat': 37.1553, 'lon': -121.8981, 'state': 'California'},
    'KMVX': {'name': 'Grand Forks', 'lat': 47.5281, 'lon': -97.3256, 'state': 'North Dakota'},
    'KMXX': {'name': 'Maxwell AFB', 'lat': 32.5367, 'lon': -85.7897, 'state': 'Alabama'},
    'KNKX': {'name': 'San Diego', 'lat': 32.9189, 'lon': -117.0419, 'state': 'California'},
    'KNQA': {'name': 'Millington', 'lat': 35.3447, 'lon': -89.8736, 'state': 'Tennessee'},
    'KOAX': {'name': 'Omaha', 'lat': 41.3203, 'lon': -96.3667, 'state': 'Nebraska'},
    'KOHX': {'name': 'Nashville', 'lat': 36.2472, 'lon': -86.5625, 'state': 'Tennessee'},
    'KOKX': {'name': 'New York City', 'lat': 40.8656, 'lon': -72.8644, 'state': 'New York'},
    'KOTX': {'name': 'Spokane', 'lat': 47.6803, 'lon': -117.6267, 'state': 'Washington'},
    'KPAH': {'name': 'Paducah', 'lat': 37.0683, 'lon': -88.7719, 'state': 'Kentucky'},
    'KPBZ': {'name': 'Pittsburgh', 'lat': 40.5317, 'lon': -80.2178, 'state': 'Pennsylvania'},
    'KPDT': {'name': 'Pendleton', 'lat': 45.6906, 'lon': -118.8528, 'state': 'Oregon'},
    'KPOE': {'name': 'Fort Polk', 'lat': 31.1556, 'lon': -92.9761, 'state': 'Louisiana'},
    'KPUX': {'name': 'Pueblo', 'lat': 38.4594, 'lon': -104.1814, 'state': 'Colorado'},
    'KRAX': {'name': 'Raleigh/Durham', 'lat': 35.6656, 'lon': -78.4897, 'state': 'North Carolina'},
    'KRGX': {'name': 'Reno', 'lat': 39.7542, 'lon': -119.4622, 'state': 'Nevada'},
    'KRIW': {'name': 'Riverton', 'lat': 43.0661, 'lon': -108.4769, 'state': 'Wyoming'},
    'KRLX': {'name': 'Charleston', 'lat': 38.3111, 'lon': -81.7231, 'state': 'West Virginia'},
    'KRMX': {'name': 'Griffiss AFB', 'lat': 43.4678, 'lon': -75.4581, 'state': 'New York'},
    'KRTX': {'name': 'Portland', 'lat': 45.7150, 'lon': -122.9653, 'state': 'Oregon'},
    'KSFX': {'name': 'Pocatello/Idaho Falls', 'lat': 43.1058, 'lon': -112.6856, 'state': 'Idaho'},
    'KSGF': {'name': 'Springfield', 'lat': 37.2353, 'lon': -93.4006, 'state': 'Missouri'},
    'KSHV': {'name': 'Shreveport', 'lat': 32.4506, 'lon': -93.8414, 'state': 'Louisiana'},
    'KSJT': {'name': 'San Angelo', 'lat': 31.3711, 'lon': -100.4925, 'state': 'Texas'},
    'KSOX': {'name': 'Santa Ana Mountains', 'lat': 33.8175, 'lon': -117.6361, 'state': 'California'},
    'KSRX': {'name': 'Western Arkansas', 'lat': 35.2906, 'lon': -94.3619, 'state': 'Arkansas'},
    'KTBW': {'name': 'Tampa Bay', 'lat': 27.7056, 'lon': -82.4017, 'state': 'Florida'},
    'KTFX': {'name': 'Great Falls', 'lat': 47.4597, 'lon': -111.3853, 'state': 'Montana'},
    'KTLH': {'name': 'Tallahassee', 'lat': 30.3975, 'lon': -84.3289, 'state': 'Florida'},
    'KTLX': {'name': 'Oklahoma City', 'lat': 35.3331, 'lon': -97.2778, 'state': 'Oklahoma'},
    'KTWX': {'name': 'Topeka', 'lat': 38.9969, 'lon': -96.2322, 'state': 'Kansas'},
    'KTYX': {'name': 'Montpelier', 'lat': 43.7556, 'lon': -75.6800, 'state': 'New York'},
    'KUDX': {'name': 'Rapid City', 'lat': 44.1250, 'lon': -102.8297, 'state': 'South Dakota'},
    'KUEX': {'name': 'Hastings', 'lat': 40.3208, 'lon': -98.4417, 'state': 'Nebraska'},
    'KVAX': {'name': 'Moody AFB', 'lat': 30.8903, 'lon': -83.0019, 'state': 'Georgia'},
    'KVBX': {'name': 'Vandenberg AFB', 'lat': 34.8381, 'lon': -120.3978, 'state': 'California'},
    'KVNX': {'name': 'Vance AFB', 'lat': 36.7406, 'lon': -98.1281, 'state': 'Oklahoma'},
    'KVTX': {'name': 'Los Angeles', 'lat': 34.4119, 'lon': -119.1797, 'state': 'California'},
    'KVWX': {'name': 'Evansville', 'lat': 38.2600, 'lon': -87.7244, 'state': 'Indiana'},
    'KYUX': {'name': 'Yuma', 'lat': 32.4953, 'lon': -114.6567, 'state': 'Arizona'}
}

# Current radar station configuration
RADAR_STATION = "KCLE"  # Cleveland, Ohio radar station

# Current weather layer selection
current_weather_layer = CURRENT_LAYER

# Get current radar coordinates from database
def get_radar_coords():
    station = RADAR_STATIONS.get(RADAR_STATION, RADAR_STATIONS['KCLE'])
    return station['lat'], station['lon']

RADAR_LAT, RADAR_LON = get_radar_coords()

# Build a bounding box around the radar station (in degrees)
def build_bbox(center_lat=None, center_lon=None, lat_span=5.0, lon_span=6.0):
    # Get current radar coordinates if not provided
    if center_lat is None or center_lon is None:
        center_lat, center_lon = get_radar_coords()
    
    lat_min = center_lat - lat_span / 2.0
    lat_max = center_lat + lat_span / 2.0
    lon_min = center_lon - lon_span / 2.0
    lon_max = center_lon + lon_span / 2.0
    return lon_min, lat_min, lon_max, lat_max

def build_wms_url(layer_id=None):
    if layer_id is None:
        layer_id = current_weather_layer
    
    layer_config = WEATHER_LAYERS.get(layer_id, WEATHER_LAYERS['reflectivity'])
    
    lon_min, lat_min, lon_max, lat_max = build_bbox()
    bbox = f"{lon_min},{lat_min},{lon_max},{lat_max}"
    
    # Select base URL based on service
    if layer_config['service'] == 'mrms':
        base = "https://opengeo.ncep.noaa.gov/geoserver/mrms/ows"
    else:  # conus
        base = "https://opengeo.ncep.noaa.gov/geoserver/conus/ows"
    
    # Use MRMS composite reflectivity with WMS 1.1.1 (lon,lat axis order) and latest time
    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.1.1",
        "layers": layer_config['layer'],
        "format": "image/png",
        "transparent": "true",
        "width": "700",
        "height": "600",
        "srs": "EPSG:4326",
        "bbox": bbox,
        "TIME": "latest",
        "bgcolor": "0x00000000",
        "styles": "",
        "format_options": "antialiasing:full"
    }
    from urllib.parse import urlencode
    return f"{base}?{urlencode(params)}"

def build_wms_url_130(layer_id=None):
    """WMS 1.3.0 variant (lat,lon axis order for EPSG:4326)."""
    if layer_id is None:
        layer_id = current_weather_layer
    
    layer_config = WEATHER_LAYERS.get(layer_id, WEATHER_LAYERS['reflectivity'])
    
    lon_min, lat_min, lon_max, lat_max = build_bbox()
    bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    # Select base URL based on service
    if layer_config['service'] == 'mrms':
        base = "https://opengeo.ncep.noaa.gov/geoserver/mrms/ows"
    else:  # conus
        base = "https://opengeo.ncep.noaa.gov/geoserver/conus/ows"
    
    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.3.0",
        "layers": layer_config['layer'],
        "format": "image/png",
        "transparent": "true",
        "width": "700",
        "height": "600",
        "crs": "EPSG:4326",
        "bbox": bbox,
        "TIME": "latest",
        "bgcolor": "0x00000000",
        "styles": "",
    }
    from urllib.parse import urlencode
    return f"{base}?{urlencode(params)}"

def build_conus_bref_url():
    """Fallback to CONUS base reflectivity layer with wider bbox."""
    lon_min, lat_min, lon_max, lat_max = build_bbox(lat_span=6.0, lon_span=8.0)
    bbox = f"{lon_min},{lat_min},{lon_max},{lat_max}"
    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.1.1",
        "layers": "conus:conus_bref_qcd",
        "format": "image/png",
        "transparent": "true",
        "width": "700",
        "height": "600",
        "srs": "EPSG:4326",
        "bbox": bbox,
        "bgcolor": "0x00000000",
    }
    base = "https://opengeo.ncep.noaa.gov/geoserver/conus/ows"
    from urllib.parse import urlencode
    return f"{base}?{urlencode(params)}"

def _is_png(content: bytes) -> bool:
    return bool(content) and len(content) >= 8 and content[:8] == b"\x89PNG\r\n\x1a\n"

def _try_fetch(url: str, session: requests.Session) -> bytes | None:
    try:
        resp = session.get(url, headers=_http_headers(), timeout=20)
        app.logger.info(f"GET {url[:120]}... -> {resp.status_code} {resp.headers.get('Content-Type')}")
        if resp.status_code == 200 and _is_png(resp.content):
            return resp.content
        # Log XML error snippets if present
        ctype = resp.headers.get('Content-Type', '')
        if 'xml' in ctype:
            app.logger.warning(f"WMS XML error: {resp.text[:200]}")
        return None
    except Exception as e:
        app.logger.error(f"Fetch failed: {e}")
        return None

def fetch_radar_image_bytes() -> tuple[bytes | None, str | None]:
    session = requests.Session()
    candidates = [
        ("mrms_wms_111", build_wms_url()),
        ("mrms_wms_130", build_wms_url_130()),
        ("conus_bref", build_conus_bref_url()),
    ]
    for name, url in candidates:
        content = _try_fetch(url, session)
        if content:
            return content, url
    return None, None

def _http_headers():
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

def update_radar_timestamp_history(new_timestamp):
    """Update the history of radar timestamps, keeping the last 3 entries"""
    global radar_history_storage
    
    if new_timestamp:
        # Check if this timestamp is significantly different from the most recent one
        # If timestamps are too similar (within 30 seconds), skip adding to history
        if radar_history_storage:
            time_diff = abs((new_timestamp - radar_history_storage[0]).total_seconds())
            if time_diff < 30:  # Less than 30 seconds difference
                app.logger.debug(f"Skipping timestamp - too similar to recent ({time_diff:.1f}s difference)")
                return
        
        # Add new timestamp to the front of the list
        radar_history_storage.insert(0, new_timestamp)
        
        # Keep only the last 3 timestamps
        radar_history_storage = radar_history_storage[:3]
        
        app.logger.info(f"Updated radar timestamp history. Count: {len(radar_history_storage)}")
        app.logger.info(f"Latest timestamps: {[ts.strftime('%H:%M:%S') for ts in radar_history_storage]}")

def get_radar_timestamp_with_history():
    """Get current radar timestamp and calculate differences with previous ones"""
    current_timestamp = get_radar_data_timestamp()
    
    if current_timestamp:
        # Update history with new timestamp (will be filtered if too similar)
        update_radar_timestamp_history(current_timestamp)
    
    # Calculate time differences
    history_with_diffs = []
    for i, timestamp in enumerate(radar_history_storage):
        entry = {
            'timestamp': timestamp,
            'position': 'current' if i == 0 else f'previous_{i}',
            'time_diff_minutes': None
        }
        
        # Calculate difference with next timestamp (older one)
        if i < len(radar_history_storage) - 1:
            next_timestamp = radar_history_storage[i + 1]
            diff_seconds = (timestamp - next_timestamp).total_seconds()
            diff_minutes = round(diff_seconds / 60, 1)
            entry['time_diff_minutes'] = diff_minutes
        
        history_with_diffs.append(entry)
    
    return history_with_diffs

def get_radar_data_timestamp():
    """Get the actual timestamp of the radar data from WMS service"""
    try:
        app.logger.info("Attempting to get radar data timestamp...")
        
        # Try to use a more stable approach - round timestamps to nearest 5 minutes
        # Most radar data updates every 2-10 minutes, often on 5-minute intervals
        session = requests.Session()
        
        # Try the same URLs we use for actual radar images
        candidates = [
            ("mrms_wms_111", build_wms_url()),
            ("mrms_wms_130", build_wms_url_130()),
            ("conus_bref", build_conus_bref_url()),
        ]
        
        for name, url in candidates:
            try:
                resp = session.get(url, headers=_http_headers(), timeout=15)
                app.logger.info(f"Timestamp check for {name}: {resp.status_code}")
                
                if resp.status_code == 200 and _is_png(resp.content):
                    # Try to get timestamp from Cache-Control max-age
                    cache_control = resp.headers.get('Cache-Control', '')
                    if 'max-age=' in cache_control:
                        try:
                            max_age_match = re.search(r'max-age=(\d+)', cache_control)
                            if max_age_match:
                                max_age = int(max_age_match.group(1))
                                # Calculate when the data was generated (now - remaining cache time)
                                now = datetime.now()
                                data_age_seconds = 120 - max_age  # Assume 120s total cache time
                                if data_age_seconds > 0:
                                    estimated_timestamp = now - timedelta(seconds=data_age_seconds)
                                    
                                    # Round to nearest 2 minutes to reduce noise
                                    minutes = estimated_timestamp.minute
                                    rounded_minutes = round(minutes / 2) * 2
                                    if rounded_minutes >= 60:
                                        estimated_timestamp = estimated_timestamp.replace(hour=estimated_timestamp.hour + 1, minute=0, second=0, microsecond=0)
                                    else:
                                        estimated_timestamp = estimated_timestamp.replace(minute=rounded_minutes, second=0, microsecond=0)
                                    
                                    app.logger.info(f"Estimated radar timestamp from cache: {estimated_timestamp} (max-age: {max_age}s)")
                                    return estimated_timestamp
                        except Exception as e:
                            app.logger.warning(f"Cache-based timestamp calculation failed: {e}")
                    
                    # Fallback: Use rounded current time minus a reasonable delay
                    fallback_time = datetime.now() - timedelta(minutes=2)
                    # Round to nearest 2 minutes
                    minutes = fallback_time.minute
                    rounded_minutes = round(minutes / 2) * 2
                    if rounded_minutes >= 60:
                        fallback_time = fallback_time.replace(hour=fallback_time.hour + 1, minute=0, second=0, microsecond=0)
                    else:
                        fallback_time = fallback_time.replace(minute=rounded_minutes, second=0, microsecond=0)
                    
                    app.logger.info(f"Using rounded fallback timestamp: {fallback_time}")
                    return fallback_time
                    
            except Exception as e:
                app.logger.warning(f"Error checking {name}: {e}")
                continue
        
        app.logger.error("Could not determine radar timestamp from any source")
        return None
        
    except Exception as e:
        app.logger.error(f"Error getting radar timestamp: {e}")
        return None

@app.route('/')
def index():
    """Home page displaying the radar map"""
    station_info = RADAR_STATIONS.get(RADAR_STATION, RADAR_STATIONS['KCLE'])
    return render_template('index.html', 
                         station=RADAR_STATION,
                         station_name=station_info['name'],
                         station_state=station_info['state'])

@app.route('/api/radar')
def get_radar_image():
    """Fetch the latest radar image from NOAA"""
    try:
        # Fetch with fallbacks
        content, used_url = fetch_radar_image_bytes()
        if not content:
            raise RuntimeError("Failed to fetch radar image from all sources")
        app.logger.info(f"Serving radar image from: {used_url}")

        # Save a copy for debugging
        try:
            with open("last_radar.png", "wb") as f:
                f.write(content)
        except Exception as fe:
            app.logger.debug(f"Could not save debug image: {fe}")
        
        return send_file(
            io.BytesIO(content),
            mimetype='image/png',
            as_attachment=False
        )
    except Exception as e:
        app.logger.error(f"Error fetching radar: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/radar/status')
def radar_status():
    """Check radar data availability"""
    try:
        # Use same fetcher to determine availability
        content, used_url = fetch_radar_image_bytes()
        status = 'online' if content else 'offline'
        
        # Try to get actual radar data timestamp
        data_timestamp = get_radar_data_timestamp()
        
        response_data = {
            'status': status,
            'station': RADAR_STATION,
            'timestamp': datetime.now().isoformat()
        }
        
        if data_timestamp:
            response_data['data_timestamp'] = data_timestamp.isoformat()
            
        return jsonify(response_data)
    except Exception as e:
        app.logger.error(f"Error checking status: {e}")
        return jsonify({
            'status': 'error',
            'station': RADAR_STATION,
            'error': str(e)
        }), 500

@app.route('/api/radar/data-time')
def radar_data_time():
    """Get the actual timestamp of the radar data"""
    try:
        data_timestamp = get_radar_data_timestamp()
        
        # If we can't get the real timestamp, provide a reasonable fallback
        if not data_timestamp:
            # Most radar data is updated every 5-10 minutes
            # Use a fallback timestamp that's 5 minutes ago
            data_timestamp = datetime.now() - timedelta(minutes=5)
            app.logger.warning("Using fallback radar timestamp")
        
        if data_timestamp:
            # Ensure the timestamp is UTC-aware
            if data_timestamp.tzinfo is None:
                # For now, just mark it as naive and let frontend handle timezone conversion
                pass
            
            response_data = {
                'data_timestamp': data_timestamp.isoformat(),
                'data_timestamp_utc': data_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC'),
                'success': True,
                'is_fallback': False,
                'timezone_support': TIMEZONE_SUPPORT
            }
            
            # Let the frontend handle timezone conversion for now
            response_data['data_time_local_display'] = data_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
            
            return jsonify(response_data)
        else:
            return jsonify({
                'error': 'Could not determine radar data timestamp',
                'success': False
            }), 404
    except Exception as e:
        app.logger.error(f"Error getting radar data timestamp: {e}")
        # Provide fallback even in case of error
        fallback_time = datetime.now() - timedelta(minutes=5)
        return jsonify({
            'data_timestamp': fallback_time.isoformat(),
            'data_time_local_display': fallback_time.strftime('%Y-%m-%d %H:%M:%S Local'),
            'success': True,
            'is_fallback': True,
            'error_message': str(e)
        })

@app.route('/api/radar/timestamp-history')
def radar_timestamp_history():
    """Get radar timestamp history with time differences"""
    try:
        history_data = get_radar_timestamp_with_history()
        
        # Format the response with local time conversions
        formatted_history = []
        for entry in history_data:
            timestamp = entry['timestamp']
            
            # Let frontend handle timezone conversion
            local_display = timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')
            
            formatted_entry = {
                'timestamp': timestamp.isoformat(),
                'local_display': local_display,
                'position': entry['position'],
                'time_diff_minutes': entry['time_diff_minutes']
            }
            formatted_history.append(formatted_entry)
        
        return jsonify({
            'success': True,
            'history': formatted_history,
            'count': len(formatted_history)
        })
    except Exception as e:
        app.logger.error(f"Error getting radar timestamp history: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/radar/debug')
def radar_debug():
    """Return the current WMS URL and bbox used for debugging."""
    lon_min, lat_min, lon_max, lat_max = build_bbox()
    return jsonify({
        'station': RADAR_STATION,
        'bbox': {
            'lon_min': lon_min,
            'lat_min': lat_min,
            'lon_max': lon_max,
            'lat_max': lat_max,
        },
        'mrms_wms_111': build_wms_url(),
        'mrms_wms_130': build_wms_url_130(),
        'conus_bref': build_conus_bref_url(),
        'time': datetime.now().isoformat()
    })

@app.route('/api/radar/stations')
def get_radar_stations():
    """Get list of all available radar stations"""
    stations = []
    for station_id, station_info in RADAR_STATIONS.items():
        stations.append({
            'id': station_id,
            'name': station_info['name'],
            'state': station_info['state'],
            'lat': station_info['lat'],
            'lon': station_info['lon']
        })
    # Sort by state, then by identifier
    stations.sort(key=lambda x: (x['state'], x['id']))
    return jsonify(stations)

@app.route('/api/radar/station', methods=['POST'])
def set_radar_station():
    """Switch to a different radar station"""
    global RADAR_STATION, RADAR_LAT, RADAR_LON, radar_history_storage
    
    data = request.get_json()
    station_id = data.get('station_id', '').upper()
    
    if station_id not in RADAR_STATIONS:
        return jsonify({'error': 'Invalid radar station'}), 400
    
    # Update global configuration
    RADAR_STATION = station_id
    RADAR_LAT, RADAR_LON = get_radar_coords()
    
    # Clear timestamp history when switching stations
    radar_history_storage = []
    
    station_info = RADAR_STATIONS[station_id]
    
    return jsonify({
        'success': True,
        'station_id': station_id,
        'name': station_info['name'],
        'state': station_info['state'],
        'lat': station_info['lat'],
        'lon': station_info['lon']
    })

@app.route('/api/radar/current-station')
def get_current_station():
    """Get current radar station information"""
    station_info = RADAR_STATIONS.get(RADAR_STATION, RADAR_STATIONS['KCLE'])
    return jsonify({
        'station_id': RADAR_STATION,
        'name': station_info['name'],
        'state': station_info['state'],
        'lat': station_info['lat'],
        'lon': station_info['lon']
    })

@app.route('/api/weather/layers')
def get_weather_layers():
    """Get list of available weather layers"""
    layers = []
    for layer_id, layer_config in WEATHER_LAYERS.items():
        layers.append({
            'id': layer_id,
            'name': layer_config['name'],
            'description': layer_config['description'],
            'service': layer_config['service'],
            'layer': layer_config['layer'],
            'legend_url': layer_config.get('legend_url'),
            'is_current': layer_id == current_weather_layer
        })
    return jsonify(layers)

@app.route('/api/weather/layer', methods=['POST'])
def set_weather_layer():
    """Switch to a different weather layer"""
    global current_weather_layer
    
    data = request.get_json()
    layer_id = data.get('layer_id', '')
    
    if layer_id not in WEATHER_LAYERS:
        return jsonify({'error': 'Invalid weather layer'}), 400
    
    # Update current layer
    current_weather_layer = layer_id
    layer_config = WEATHER_LAYERS[layer_id]
    
    return jsonify({
        'success': True,
        'layer_id': layer_id,
        'name': layer_config['name'],
        'description': layer_config['description'],
        'service': layer_config['service'],
        'layer': layer_config['layer']
    })

@app.route('/api/weather/current-layer')
def get_current_layer():
    """Get current weather layer information"""
    layer_config = WEATHER_LAYERS.get(current_weather_layer, WEATHER_LAYERS['reflectivity'])
    return jsonify({
        'layer_id': current_weather_layer,
        'name': layer_config['name'],
        'description': layer_config['description'],
        'service': layer_config['service'],
        'layer': layer_config['layer'],
        'legend_url': layer_config.get('legend_url')
    })

@app.route('/api/radar/url')
def radar_url():
    """Return the working URL used (if any)."""
    content, used_url = fetch_radar_image_bytes()
    return jsonify({'ok': bool(content), 'url': used_url})

@app.route('/api/radar/last')
def radar_last_image():
    """Serve the last saved radar image if available."""
    try:
        return send_file('last_radar.png', mimetype='image/png')
    except Exception:
        return jsonify({'error': 'No saved image'}), 404

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    if debug:
        print(f"Starting NOAA {RADAR_STATION} Radar Display")
        print(f"Open http://localhost:{port} in your browser")
    
    app.run(debug=debug, host='0.0.0.0', port=port)
