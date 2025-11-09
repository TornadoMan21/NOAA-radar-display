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
        'name': 'Local Radar (KLWX)',
        'description': 'Local Washington DC area radar reflectivity',
        'layer': 'conus:KLWX_BREF',
        'service': 'conus',
        'legend_url': None
    }
}

# Current layer selection
CURRENT_LAYER = 'reflectivity'