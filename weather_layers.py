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
    'super_res_velocity': {
        'name': 'Super Resolution Base Radial Velocity',
        'description': 'High-resolution Doppler velocity data showing wind movement and storm rotation',
        'layer': '{station_lower}_sr_bvel',
        'service': 'station-specific',
        'legend_url': None,
        'dynamic_station': True,
        'available': True,
        'high_res': True
    },
    'super_res_reflectivity': {
        'name': 'Super Resolution Base Reflectivity',
        'description': 'High-resolution base reflectivity from individual radar stations',
        'layer': '{station_lower}_sr_bref',
        'service': 'station-specific',
        'legend_url': None,
        'dynamic_station': True,
        'available': True,
        'high_res': True
    },
    'digital_hybrid_reflectivity': {
        'name': 'Digital Hybrid Scan Reflectivity',
        'description': 'Composite reflectivity from multiple elevation scans',
        'layer': '{station_lower}_bdhc',
        'service': 'station-specific',
        'legend_url': None,
        'dynamic_station': True,
        'available': True,
        'high_res': True
    },
    'storm_total_accumulation': {
        'name': 'Digital Storm Total Accumulation',
        'description': 'Total precipitation accumulation for current storm event',
        'layer': '{station_lower}_bdsa',
        'service': 'station-specific',
        'legend_url': None,
        'dynamic_station': True,
        'available': True
    },
    'one_hour_accumulation': {
        'name': 'One Hour Accumulation',
        'description': 'Precipitation accumulation over the past hour',
        'layer': '{station_lower}_boha',
        'service': 'station-specific',
        'legend_url': None,
        'dynamic_station': True,
        'available': True
    }
}

# Current layer selection
CURRENT_LAYER = 'reflectivity'