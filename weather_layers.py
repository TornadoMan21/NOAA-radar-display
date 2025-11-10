# Weather Layer Configurations
WEATHER_LAYERS = {
    'reflectivity': {
        'name': 'Base Reflectivity',
        'description': 'Radar reflectivity showing precipitation intensity',
        'layer': 'conus:conus_bref_qcd',
        'service': 'conus',
        'legend_url': None,
        'default': True
    },
    'composite_reflectivity': {
        'name': 'Composite Reflectivity',
        'description': 'Composite radar reflectivity (highest intensity at each location)',
        'layer': 'conus:conus_cref_qcd',
        'service': 'conus',
        'legend_url': None
    },
    'echo_tops': {
        'name': 'Echo Top Heights',
        'description': 'Height of storm tops (indicating storm intensity)',
        'layer': 'conus:conus_neet_v18',
        'service': 'conus',
        'legend_url': None
    },
    'precipitation_type': {
        'name': 'Precipitation Type',
        'description': 'Type of precipitation (rain, snow, ice, etc.)',
        'layer': 'conus:conus_pcpn_typ',
        'service': 'conus',
        'legend_url': None
    },
    'local_reflectivity': {
        'name': 'Local Radar',
        'description': 'Local radar station reflectivity',
        'layer': 'conus:{station}_BREF',
        'service': 'conus',
        'legend_url': None,
        'dynamic_station': True
    },
    'base_velocity': {
        'name': 'Base Velocity (Unavailable)',
        'description': 'Doppler velocity data showing wind movement - currently not available through NOAA WMS services',
        'layer': 'conus:{station}_BVEL',
        'service': 'conus',
        'legend_url': None,
        'dynamic_station': True,
        'available': False,
        'note': 'High-Def Velocity products require direct radar data feeds not available through this service'
    },
    'storm_relative_velocity': {
        'name': 'Storm Relative Velocity (Unavailable)',
        'description': 'Storm-relative motion velocity - currently not available through NOAA WMS services',
        'layer': 'conus:{station}_SRV',
        'service': 'conus',
        'legend_url': None,
        'dynamic_station': True,
        'available': False,
        'note': 'Requires specialized meteorological data feeds'
    }
}

# Current layer selection
CURRENT_LAYER = 'reflectivity'