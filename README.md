# NOAA KLWX Radar Display

A web application that displays real-time weather radar imagery from NOAA for radar station KLWX (Sterling, Virginia).

## Features

- 🌧️ Real-time NOAA radar imagery for KLWX station
- 🔄 Auto-refresh every 2 minutes
- 📱 Responsive design for mobile and desktop
- ⚡ Fast loading with direct NOAA data access
- 🎨 Clean, modern interface

## Installation

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

## Usage

1. **Run the application:**
```bash
python app.py
```

2. **Open your browser:**
Navigate to `http://localhost:5000`

3. **View the radar:**
The radar image will automatically load and refresh every 2 minutes. You can also manually refresh using the "Refresh Radar" button.

## Project Structure

```
radar-map/
├── app.py                 # Flask application
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main HTML template
├── static/
│   ├── style.css         # Styling
│   └── script.js         # JavaScript for auto-refresh
└── README.md             # This file
```

## Data Source

Radar data is fetched directly from NOAA's Ridge Radar system:
- **Station:** KLWX (Sterling, VA)
- **Coverage:** ~230 mile radius
- **Update Frequency:** Every 2-5 minutes
- **Data URL:** https://radar.weather.gov/ridge/RadarImg/N0R/KLWX_N0R_0.gif

## Radar Legend

- **Light Blue:** Light precipitation
- **Green:** Moderate precipitation
- **Yellow:** Heavy precipitation
- **Red:** Very heavy precipitation
- **Magenta:** Severe weather

## Technologies Used

- **Flask** - Web framework
- **Requests** - HTTP library for fetching radar data
- **Pillow** - Image processing
- **HTML/CSS/JavaScript** - Frontend

## Notes

- Radar data is public domain from NOAA/National Weather Service
- For educational and informational purposes
- Radar updates depend on NOAA's data availability

## License

This project is for educational purposes. NOAA radar data is in the public domain.
