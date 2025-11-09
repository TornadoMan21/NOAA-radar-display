# Weather Layer Configurations
WEATHER_LAYERS = {
    'reflectivity': {
        'name': 'Base Reflectivity',
        'description': 'Radar reflectivity showing precipitation intensity',
        'layer': 'mrms:Reflectivity_Composite_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Reflectivity_Composite_1km',
        'default': True
    },
    'velocity': {
        'name': 'Velocity',
        'description': 'Wind patterns and rotation (Doppler velocity)',
        'layer': 'mrms:Velocity_Composite_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Velocity_Composite_1km'
    },
    'precip_rate': {
        'name': 'Precipitation Rate',
        'description': 'Current precipitation rate (mm/hr)',
        'layer': 'mrms:Precipitation_Rate_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Precipitation_Rate_1km'
    },
    'precip_1hr': {
        'name': '1-Hour Precipitation',
        'description': 'Precipitation accumulation over last hour',
        'layer': 'mrms:Precipitation_1hr_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Precipitation_1hr_1km'
    },
    'precip_24hr': {
        'name': '24-Hour Precipitation',
        'description': 'Precipitation accumulation over last 24 hours',
        'layer': 'mrms:Precipitation_24hr_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Precipitation_24hr_1km'
    },
    'echo_top': {
        'name': 'Echo Top Heights',
        'description': 'Height of storm tops (indicating storm intensity)',
        'layer': 'mrms:Echo_Top_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Echo_Top_1km'
    },
    'vil': {
        'name': 'Vertically Integrated Liquid',
        'description': 'Total liquid water content in column (storm strength indicator)',
        'layer': 'mrms:VIL_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:VIL_1km'
    },
    'lightning': {
        'name': 'Lightning Activity',
        'description': 'Lightning strike density',
        'layer': 'mrms:Lightning_Strike_Density_1km',
        'service': 'mrms',
        'legend_url': 'https://opengeo.ncep.noaa.gov/geoserver/mrms/ows?service=WMS&request=GetLegendGraphic&format=image/png&layer=mrms:Lightning_Strike_Density_1km'
    },
    'conus_reflectivity': {
        'name': 'CONUS Base Reflectivity',
        'description': 'Continental US base reflectivity (fallback)',
        'layer': 'conus:conus_bref_qcd',
        'service': 'conus',
        'legend_url': None
    }
}

# Current layer selection
CURRENT_LAYER = 'reflectivity'