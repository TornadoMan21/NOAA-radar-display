let autoRefreshInterval = null;
let countdownInterval = null;
let lastUpdateTime = null;
let nextRefreshTime = null;
let map = null;
let radarOverlay = null;
let currentBounds = null;
let currentRefreshRate = 60000; // Start with 1 minute (60000ms)
let adaptiveRefreshEnabled = true;
let radarUpdatePattern = [];
let radarStations = []; // Store all radar stations data
let stationMarkers = []; // Store all station markers
let currentStationId = null;

// Initialize the map and overlay on DOM ready
window.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('loading').style.display = 'block';
    await loadRadarStations();
    await loadWeatherLayers();
    await loadCurrentStation();
    await loadCurrentLayer();
    await initMapWithRadar();
    
    // Add markers after everything is fully loaded
    if (map && radarStations && radarStations.length > 0) {
        addRadarStationMarkers();
    }
    
    checkRadarStatus();
    updateRadarDataTime();
    updateRadarTimestampHistory();
    setupAutoRefreshEventListener(); // Set up event listener
    setupLayerSelectorEventListener(); // Set up layer selector
    startAutoRefresh();
});

async function loadRadarStations() {
    try {
        const response = await fetch('/api/radar/stations');
        radarStations = await response.json();
        console.log('Loaded radar stations:', radarStations.length);
    } catch (error) {
        console.error('Error loading radar stations:', error);
    }
}

async function loadCurrentStation() {
    try {
        const response = await fetch('/api/radar/current-station');
        const station = await response.json();
        
        currentStationId = station.station_id;
        updateStationInfo(station);
    } catch (error) {
        console.error('Error loading current station:', error);
    }
}

function updateStationInfo(station) {
    const infoElement = document.getElementById('current-station-info');
    infoElement.textContent = `${station.station_id} - ${station.name}, ${station.state}`;
    document.title = `NOAA ${station.station_id} Radar Display`;
    
    // Update marker states
    updateStationMarkers();
}

async function switchToStation(stationId) {
    console.log(`=== SWITCH TO STATION CALLED ===`);
    console.log(`switchToStation called with: ${stationId}`);
    console.log(`Current station: ${currentStationId}`);
    console.log(`Type of stationId: ${typeof stationId}`);
    console.log(`Type of currentStationId: ${typeof currentStationId}`);
    
    if (!stationId || stationId === currentStationId) {
        console.log(`Skipping switch: stationId=${stationId}, currentStationId=${currentStationId}`);
        return;
    }
    
    try {
        // Show loading state
        const statusElement = document.getElementById('status-text');
        if (!statusElement) {
            console.error('Status element not found!');
            return;
        }
        
        const originalText = statusElement.textContent;
        statusElement.textContent = 'Switching radar station...';
        
        console.log(`Switching from ${currentStationId} to ${stationId}`);
        console.log('Making fetch request to /api/radar/station');
        
        // Switch station on backend
        const response = await fetch('/api/radar/station', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ station_id: stationId })
        });
        
        console.log('Response received:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        
        const station = await response.json();
        console.log('Station data received:', station);
        
        currentStationId = stationId;
        updateStationInfo(station);
        
        console.log('Reinitializing map...');
        // Reinitialize map with new bounds
        await initMapWithRadar();
        
        // Reset refresh system for new station
        radarUpdatePattern = [];
        currentRefreshRate = 60000; // Reset to 1 minute
        updateRefreshRateDisplay();
        
        console.log('Refreshing radar data...');
        // Refresh radar data immediately
        await addOrUpdateRadarOverlay();
        
        statusElement.textContent = originalText;
        
        console.log('Successfully switched to station:', stationId);
        console.log(`=== STATION SWITCH COMPLETE ===`);
        
    } catch (error) {
        console.error('=== ERROR IN SWITCH TO STATION ===');
        console.error('Error switching radar station:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Try to get more specific error information
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response text:', await error.response.text().catch(() => 'Could not read response text'));
        }
        
        alert(`Failed to switch radar station: ${error.message || 'Unknown error'}. Please check the console for details.`);
        // Reset to previous selection
        await loadCurrentStation();
    }
}

// Make function globally available
console.log('Making switchToStation globally available');
window.switchToStation = switchToStation;

// Test that the function is accessible
console.log('Testing global switchToStation function...');
console.log('Type of window.switchToStation:', typeof window.switchToStation);
console.log('switchToStation function:', window.switchToStation);

// Add a simple test function that can be called from console
window.testStationSwitch = function(stationId = 'KMUX') {
    console.log(`Testing station switch to ${stationId}...`);
    if (typeof window.switchToStation === 'function') {
        window.switchToStation(stationId);
    } else {
        console.error('switchToStation function not available!');
    }
};

function addRadarStationMarkers() {
    console.log('addRadarStationMarkers called');
    console.log('Map object:', map);
    console.log('Radar stations:', radarStations ? radarStations.length : 'null');
    
    if (!map || !radarStations || radarStations.length === 0) {
        console.log('Cannot add station markers: missing map or stations data');
        console.log('Map exists:', !!map);
        console.log('Stations loaded:', radarStations ? radarStations.length : 'null');
        return;
    }
    
    // Clear existing markers
    clearStationMarkers();
    console.log('Cleared existing markers');
    
    radarStations.forEach((station, index) => {
        console.log(`Adding marker for ${station.id} - ${station.name}`);
        
        // Create custom marker with proper event handling
        const markerDiv = L.divIcon({
            className: 'radar-station-marker',
            html: `<div class="marker-inner" data-station="${station.id}" title="${station.id} - ${station.name}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        // Create marker with enhanced options
        const marker = L.marker([station.lat, station.lon], { 
            icon: markerDiv,
            interactive: true,
            bubblingMouseEvents: false,
            zIndexOffset: 1000,
            title: `${station.id} - ${station.name}`,
            keyboard: true,
            riseOnHover: true
        });
        console.log(`Created marker ${index} for ${station.id} at ${station.lat}, ${station.lon}`);
        
        // Create popup content
        const popupContent = createStationPopup(station);
        marker.bindPopup(popupContent);
        
        // Add click handler with enhanced debugging
        marker.on('click', function(e) {
            console.log(`=== MARKER CLICKED ===`);
            console.log(`Station: ${station.id} - ${station.name}`);
            console.log('Event object:', e);
            console.log('Current station ID:', currentStationId);
            
            // Stop event propagation
            if (e && e.originalEvent) {
                e.originalEvent.stopPropagation();
                e.originalEvent.preventDefault();
            }
            L.DomEvent.stopPropagation(e);
            
            // Always close popup first
            marker.closePopup();
            
            if (station.id !== currentStationId) {
                console.log(`Switching from ${currentStationId} to ${station.id}`);
                try {
                    // Provide immediate feedback
                    console.log('Calling switchToStation...');
                    if (typeof window.switchToStation === 'function') {
                        window.switchToStation(station.id);
                    } else {
                        throw new Error('switchToStation function not available');
                    }
                } catch (error) {
                    console.error('Error in switchToStation:', error);
                    alert(`Error switching to station ${station.id}: ${error.message}`);
                }
            } else {
                console.log(`Already on station ${station.id}`);
                alert(`Already viewing station ${station.id} - ${station.name}`);
            }
        });
        
        // Add DOM event handler as backup
        marker.on('add', function() {
            const markerElement = this._icon;
            if (markerElement) {
                console.log(`Adding DOM click handler for ${station.id}`);
                
                // Add direct DOM click handler
                markerElement.addEventListener('click', function(domEvent) {
                    console.log(`=== DOM CLICK ===`);
                    console.log(`DOM click on ${station.id}`);
                    
                    domEvent.preventDefault();
                    domEvent.stopPropagation();
                    
                    if (station.id !== currentStationId) {
                        try {
                            window.switchToStation(station.id);
                        } catch (error) {
                            console.error('DOM click error:', error);
                            alert(`Error: ${error.message}`);
                        }
                    }
                }, true); // Use capture phase
                
                // Make sure the element is clickable
                markerElement.style.pointerEvents = 'all';
                markerElement.style.cursor = 'pointer';
                markerElement.style.zIndex = '1000';
            }
        });
        
        // Add mouseover event for extra feedback
        marker.on('mouseover', function(e) {
            console.log(`Mouse over station: ${station.id}`);
        });
        
        // Add to map
        marker.addTo(map);
        stationMarkers.push({
            marker: marker,
            station: station
        });
    });
    
    // Update marker states
    updateStationMarkers();
    
    console.log(`Added ${stationMarkers.length} radar station markers to map`);
}

function createStationPopup(station) {
    const isCurrentStation = station.id === currentStationId;
    
    return `
        <div class="station-popup">
            <h3>${station.id} - ${station.name}</h3>
            <p><strong>State:</strong> ${station.state}</p>
            <p><strong>Coordinates:</strong> ${station.lat.toFixed(3)}, ${station.lon.toFixed(3)}</p>
            ${isCurrentStation ? 
                '<div class="current-indicator">🎯 Current Station</div>' : 
                `<button class="switch-btn" onclick="switchToStation('${station.id}')">Switch to this station</button>`
            }
        </div>
    `;
}

function updateStationMarkers() {
    stationMarkers.forEach(({ marker, station }) => {
        const markerElement = marker.getElement();
        if (markerElement) {
            // Remove existing classes
            markerElement.classList.remove('active');
            
            // Add active class to current station
            if (station.id === currentStationId) {
                markerElement.classList.add('active');
            }
        }
        
        // Update popup content
        const popupContent = createStationPopup(station);
        marker.getPopup().setContent(popupContent);
    });
}

function clearStationMarkers() {
    stationMarkers.forEach(({ marker }) => {
        map.removeLayer(marker);
    });
    stationMarkers = [];
}

async function loadWeatherLayers() {
    try {
        const response = await fetch('/api/weather/layers');
        const layers = await response.json();
        
        const select = document.getElementById('weather-layer');
        select.innerHTML = ''; // Clear loading option
        
        layers.forEach(layer => {
            const option = document.createElement('option');
            option.value = layer.id;
            
            // Handle unavailable layers
            if (layer.available === false) {
                option.textContent = `${layer.name} (Unavailable)`;
                option.disabled = true;
                option.title = `${layer.description}${layer.note ? '\n\nNote: ' + layer.note : ''}`;
                option.style.color = '#999';
                option.style.fontStyle = 'italic';
            } else {
                option.textContent = layer.name;
                option.title = layer.description; // Tooltip with description
            }
            
            if (layer.is_current) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        console.log('Loaded weather layers:', layers.length);
    } catch (error) {
        console.error('Failed to load weather layers:', error);
        document.getElementById('weather-layer').innerHTML = '<option value="">Error loading layers</option>';
    }
}

async function loadCurrentLayer() {
    try {
        const response = await fetch('/api/weather/current-layer');
        const layer = await response.json();
        
        const layerInfo = document.getElementById('current-layer-info');
        if (layerInfo) {
            layerInfo.textContent = layer.description;
            layerInfo.title = `Service: ${layer.service}, Layer: ${layer.layer}`;
        }
        
        console.log('Current layer:', layer);
    } catch (error) {
        console.error('Failed to load current layer:', error);
    }
}

function setupLayerSelectorEventListener() {
    const select = document.getElementById('weather-layer');
    
    select.addEventListener('change', async function(e) {
        const layerId = e.target.value;
        if (!layerId) return;
        
        // Check if the selected option is disabled (unavailable layer)
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption.disabled) {
            alert(`${selectedOption.textContent}\n\n${selectedOption.title}`);
            // Reset to previous selection
            await loadCurrentLayer();
            return;
        }
        
        console.log('Switching to weather layer:', layerId);
        
        try {
            const response = await fetch('/api/weather/layer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    layer_id: layerId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
            }
            
            const result = await response.json();
            console.log('Layer switched successfully:', result);
            
            // Update current layer info
            const layerInfo = document.getElementById('current-layer-info');
            if (layerInfo) {
                layerInfo.textContent = result.description;
                layerInfo.title = `Service: ${result.service}, Layer: ${result.layer}`;
            }
            
            // Refresh the radar image with new layer
            await addOrUpdateRadarOverlay();
            
            console.log('Weather layer switched to:', result.name);
            
        } catch (error) {
            console.error('Error switching weather layer:', error);
            console.error('Error details:', error.message, error.stack);
            
            alert(`Failed to switch weather layer: ${error.message || 'Unknown error'}. Please check the console for details.`);
            // Reset to previous selection
            await loadCurrentLayer();
        }
    });
}

function setupAutoRefreshEventListener() {
    // Handle auto-refresh toggle (with event delegation for dynamic updates)
    document.addEventListener('change', function(e) {
        if (e.target.id === 'auto-refresh') {
            if (e.target.checked) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        }
    });
}

async function initMapWithRadar() {
    try {
        // Fetch bbox from backend debug endpoint
        const dbg = await fetch('/api/radar/debug').then(r => r.json());
        const b = dbg.bbox;
        currentBounds = L.latLngBounds(
            [b.lat_min, b.lon_min ? b.lon_min : b.lon_min],
            [b.lat_max, b.lon_max]
        );

        // Create map if not exists
        if (!map) {
            map = L.map('map');
            // Base map
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);
        }

        // Fit to bounds
        map.fitBounds([[b.lat_min, b.lon_min], [b.lat_max, b.lon_max]]);

        // Add initial radar overlay
        await addOrUpdateRadarOverlay();
    } catch (err) {
        console.error('Failed to init map/radar:', err);
        showError('Error loading radar data');
    }
}

async function addOrUpdateRadarOverlay() {
    // Remove previous overlay if present
    if (radarOverlay) {
        map.removeLayer(radarOverlay);
        radarOverlay = null;
    }

    // Show loading
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = 'Loading radar data...';
    loading.style.background = 'rgba(0,0,0,0.7)';

    // Get current layer from the dropdown
    const layerSelect = document.getElementById('weather-layer');
    const currentLayer = layerSelect ? layerSelect.value : 'reflectivity';
    
    // Build URL with cache buster and layer parameter
    const url = `/api/radar?layer=${currentLayer}&t=${Date.now()}`;
    console.log('Loading radar image with layer:', currentLayer, 'URL:', url);
    
    const dbg = await fetch('/api/radar/debug').then(r => r.json());
    const b = dbg.bbox;
    const bounds = [[b.lat_min, b.lon_min], [b.lat_max, b.lon_max]];

    radarOverlay = L.imageOverlay(url, bounds, { opacity: 0.8, interactive: true, zIndex: 5 });

    radarOverlay.on('load', () => {
        loading.style.display = 'none';
        markOnline();
        updateLastUpdateTime();
        updateRadarDataTime(); // Update radar data timestamp when image loads
        updateRadarTimestampHistory(); // Update timestamp history
        console.log('Radar overlay loaded successfully for layer:', currentLayer);
        
        // Initialize hover display after overlay loads
        initializeRadarValueDisplay();
        
        // Update cursor after everything is loaded
        setTimeout(updateCursor, 100);
    });
    radarOverlay.on('error', (e) => {
        console.error('Overlay load error', e);
        showError('Error loading radar data');
    });

    radarOverlay.addTo(map);
}

function refreshRadar() {
    addOrUpdateRadarOverlay();
    checkRadarStatus();
    updateRadarDataTime(); // Fetch latest radar data timestamp
    updateRadarTimestampHistory(); // Fetch and display timestamp history
    // Reset countdown for next refresh using current refresh rate
    if (autoRefreshInterval) {
        nextRefreshTime = new Date(Date.now() + currentRefreshRate);
    }
}

function checkRadarStatus() {
    fetch('/api/radar/status')
        .then(response => response.json())
        .then(data => {
            const statusText = document.getElementById('status-text');
            const statusIndicator = document.querySelector('.status-indicator');
            if (data.status === 'online') {
                statusText.textContent = 'Radar Online';
                statusIndicator.style.background = '#48bb78';
            } else {
                statusText.textContent = 'Radar Offline';
                statusIndicator.style.background = '#f56565';
            }
            
            // Update radar data timestamp if available
            if (data.data_timestamp) {
                updateRadarDataTime(data.data_timestamp);
            }
        })
        .catch(error => {
            console.error('Status check failed:', error);
            document.getElementById('status-text').textContent = 'Status Unknown';
        });
}

async function updateRadarDataTime(timestamp = null) {
    try {
        let dataTime = timestamp;
        
        // If no timestamp provided, fetch it separately
        if (!dataTime) {
            const response = await fetch('/api/radar/data-time');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data_timestamp) {
                    dataTime = data.data_timestamp;
                    
                    // Use backend local time if available, otherwise client-side conversion
                    if (data.data_time_local_display) {
                        const dataTimeElement = document.getElementById('radar-data-time');
                        if (dataTimeElement) {
                            const dt = new Date(dataTime);
                            window.radarDataTimestamp = dt;
                            updateRadarDataTimeDisplay(data.data_time_local_display);
                        }
                        return;
                    }
                } else {
                    console.warn('Radar timestamp API returned error:', data);
                    const dataTimeElement = document.getElementById('radar-data-time');
                    if (dataTimeElement) {
                        dataTimeElement.textContent = 'Data time unavailable';
                    }
                    return;
                }
            } else {
                console.warn('Failed to fetch radar timestamp:', response.status);
                const dataTimeElement = document.getElementById('radar-data-time');
                if (dataTimeElement) {
                    dataTimeElement.textContent = 'Data time unavailable';
                }
                return;
            }
        }
        
        const dataTimeElement = document.getElementById('radar-data-time');
        if (dataTimeElement && dataTime) {
            const dt = new Date(dataTime);
            // Store the timestamp for periodic updates
            window.radarDataTimestamp = dt;
            updateRadarDataTimeDisplay();
        }
    } catch (error) {
        console.error('Error updating radar data time:', error);
        const dataTimeElement = document.getElementById('radar-data-time');
        if (dataTimeElement) {
            dataTimeElement.textContent = 'Data time error';
        }
    }
}

function updateRadarDataTimeDisplay(serverLocalTime = null) {
    const dataTimeElement = document.getElementById('radar-data-time');
    if (dataTimeElement && window.radarDataTimestamp) {
        const dt = window.radarDataTimestamp;
        const now = new Date();
        const diffMinutes = Math.floor((now - dt) / 60000);
        
        let timeString;
        if (serverLocalTime) {
            // Use server-provided local time string
            timeString = serverLocalTime;
        } else {
            // Use browser's local timezone conversion
            timeString = dt.toLocaleString();
        }
        
        if (diffMinutes < 60) {
            dataTimeElement.textContent = `${timeString} (${diffMinutes} min old)`;
        } else {
            const diffHours = Math.floor(diffMinutes / 60);
            dataTimeElement.textContent = `${timeString} (${diffHours}h ${diffMinutes % 60}m old)`;
        }
    }
}

async function updateRadarTimestampHistory() {
    try {
        const response = await fetch('/api/radar/timestamp-history');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.history) {
                displayRadarTimestampHistory(data.history);
                
                // Analyze pattern for adaptive refresh
                analyzeRadarUpdatePattern(data.history);
                radarUpdatePattern = data.history; // Store for reference
                
                // Update display to show current refresh rate
                updateRefreshRateDisplay();
            } else {
                console.warn('Failed to get radar timestamp history:', data);
                const historyElement = document.getElementById('history-content');
                if (historyElement) {
                    historyElement.innerHTML = 'History unavailable';
                }
            }
        } else {
            console.warn('Failed to fetch radar timestamp history:', response.status);
            const historyElement = document.getElementById('history-content');
            if (historyElement) {
                historyElement.innerHTML = 'History unavailable';
            }
        }
    } catch (error) {
        console.error('Error fetching radar timestamp history:', error);
        const historyElement = document.getElementById('history-content');
        if (historyElement) {
            historyElement.innerHTML = 'History error';
        }
    }
}

function displayRadarTimestampHistory(history) {
    const historyElement = document.getElementById('history-content');
    if (!historyElement || !history || history.length === 0) {
        if (historyElement) {
            historyElement.innerHTML = 'No history available';
        }
        return;
    }

    let html = '';
    history.forEach((entry, index) => {
        const dt = new Date(entry.timestamp);
        const timeDisplay = entry.local_display || dt.toLocaleString();
        
        let positionLabel;
        if (entry.position === 'current') {
            positionLabel = 'Current';
        } else if (entry.position === 'previous_1') {
            positionLabel = 'Previous';
        } else if (entry.position === 'previous_2') {
            positionLabel = 'Before';
        } else {
            positionLabel = 'Older';
        }
        
        let diffDisplay = '';
        if (entry.time_diff_minutes !== null) {
            if (entry.time_diff_minutes < 60) {
                diffDisplay = `(+${entry.time_diff_minutes} min)`;
            } else {
                const hours = Math.floor(entry.time_diff_minutes / 60);
                const minutes = Math.round(entry.time_diff_minutes % 60);
                diffDisplay = `(+${hours}h ${minutes}m)`;
            }
        }
        
        html += `
            <div class="history-item">
                <span class="history-position">${positionLabel}:</span>
                <span class="history-time">${timeDisplay}</span>
                <span class="history-diff">${diffDisplay}</span>
            </div>
        `;
    });

    historyElement.innerHTML = html;
    
    // Show adaptive refresh status in console
    if (history.length >= 2) {
        const intervals = history.filter(e => e.time_diff_minutes !== null).map(e => e.time_diff_minutes);
        if (intervals.length >= 2) {
            console.log('Radar update pattern detected:', intervals, 'minutes');
        }
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(refreshRadar, currentRefreshRate);
    nextRefreshTime = new Date(Date.now() + currentRefreshRate);
    startCountdown();
    console.log(`Auto-refresh started with ${currentRefreshRate/1000} second interval`);
}

function analyzeRadarUpdatePattern(history) {
    if (!adaptiveRefreshEnabled || !history || history.length < 2) {
        console.log('Not enough data for pattern analysis:', history ? history.length : 0, 'entries');
        return;
    }
    
    // Extract time differences from history
    const timeDiffs = history
        .filter(entry => entry.time_diff_minutes !== null)
        .map(entry => entry.time_diff_minutes);
    
    if (timeDiffs.length < 1) {
        console.log('No time differences available for pattern analysis');
        return;
    }
    
    console.log('Radar update intervals (minutes):', timeDiffs);
    
    // Check if intervals are too small (less than 2 minutes) - this indicates we're getting
    // request timestamps rather than actual radar data timestamps
    const tooSmall = timeDiffs.filter(diff => diff < 2);
    if (tooSmall.length > 0) {
        console.log('Detected small intervals - timestamps may not reflect actual radar updates');
        // Don't adjust refresh rate for intervals less than 2 minutes
        return;
    }
    
    // Only proceed if we have meaningful intervals (2+ minutes)
    const meaningfulIntervals = timeDiffs.filter(diff => diff >= 2);
    if (meaningfulIntervals.length < 2) {
        console.log('Not enough meaningful intervals for pattern detection');
        return;
    }
    
    // Calculate average update interval
    const avgInterval = meaningfulIntervals.reduce((a, b) => a + b, 0) / meaningfulIntervals.length;
    console.log(`Average radar update interval: ${avgInterval.toFixed(1)} minutes`);
    
    // Calculate new refresh rate (check slightly more frequently than radar updates)
    // Use 85% of the average interval, with bounds between 30 seconds and 15 minutes
    let newRefreshRate = Math.round(avgInterval * 60000 * 0.85); // Convert to ms and reduce by 15%
    newRefreshRate = Math.max(30000, Math.min(900000, newRefreshRate)); // 30s to 15min bounds
    
    // Only update if the new rate is significantly different (more than 30 seconds difference)
    if (Math.abs(newRefreshRate - currentRefreshRate) > 30000) {
        const oldRate = currentRefreshRate;
        currentRefreshRate = newRefreshRate;
        
        console.log(`Adaptive refresh: Changed from ${oldRate/1000}s to ${newRefreshRate/1000}s based on radar pattern`);
        
        // Restart auto-refresh with new rate
        if (autoRefreshInterval) {
            updateRefreshRateDisplay();
            startAutoRefresh(); // This will restart with new interval
        }
    }
}

function updateRefreshRateDisplay() {
    // Update the UI to show current refresh rate
    const autoRefreshLabel = document.querySelector('.auto-refresh');
    if (autoRefreshLabel) {
        const minutes = Math.round(currentRefreshRate / 60000 * 10) / 10; // Round to 1 decimal
        
        let statusText;
        if (radarUpdatePattern.length >= 2 && currentRefreshRate > 60000) {
            statusText = `Auto-refresh every ${minutes} min (adaptive)`;
        } else {
            statusText = `Auto-refresh every ${minutes} min (learning...)`;
        }
        
        autoRefreshLabel.innerHTML = `
            <input type="checkbox" id="auto-refresh" checked>
            ${statusText}
        `;
        
        // Re-attach event listener
        const checkbox = document.getElementById('auto-refresh');
        if (checkbox) {
            checkbox.addEventListener('change', function(e) {
                if (e.target.checked) {
                    startAutoRefresh();
                } else {
                    stopAutoRefresh();
                }
            });
        }
    }
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
    stopCountdown();
}

function updateLastUpdateTime() {
    lastUpdateTime = new Date();
    const timeString = lastUpdateTime.toLocaleTimeString();
    document.getElementById('last-update').textContent = timeString;
}

function startCountdown() {
    stopCountdown();
    updateCountdownDisplay();
    countdownInterval = setInterval(updateCountdownDisplay, 1000);
}

function stopCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    const countdownElement = document.getElementById('countdown');
    if (countdownElement) {
        countdownElement.textContent = '';
    }
}

function updateCountdownDisplay() {
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement || !nextRefreshTime) {
        return;
    }

    const now = new Date();
    const timeRemaining = nextRefreshTime - now;

    if (timeRemaining <= 0) {
        countdownElement.textContent = 'Refreshing...';
        return;
    }

    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    
    countdownElement.textContent = `Next refresh in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showError(msg) {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';
    loading.textContent = msg;
    loading.style.background = 'rgba(220,38,38,0.8)';
}

function markOnline() {
    const statusText = document.getElementById('status-text');
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusText && statusIndicator) {
        statusText.textContent = 'Radar Online';
        statusIndicator.style.background = '#48bb78';
    }
}

// Update relative time every minute
setInterval(() => {
    if (lastUpdateTime) {
        const now = new Date();
        const diffMinutes = Math.floor((now - lastUpdateTime) / 60000);
        const timeString = lastUpdateTime.toLocaleTimeString();
        if (diffMinutes > 0) {
            document.getElementById('last-update').textContent = `${timeString} (${diffMinutes} min ago)`;
        } else {
            document.getElementById('last-update').textContent = timeString;
        }
    }
    // Also update radar data time display if element exists
    updateRadarDataTimeDisplay();
}, 60000);

// Radar Value Hover Display
let radarValueDisplay = null;
let hoverTimeout = null;
let hoverEnabled = true;

function initializeRadarValueDisplay() {
    radarValueDisplay = document.getElementById('radar-value-display');
    if (!radarValueDisplay) {
        console.warn('Radar value display element not found');
        return;
    }
    
    console.log('Initializing radar value hover display...');
    
    // Initialize hover toggle
    const hoverToggle = document.getElementById('hover-toggle');
    if (hoverToggle) {
        hoverEnabled = hoverToggle.checked;
        hoverToggle.addEventListener('change', toggleHoverFeature);
        updateCursor();
    }
    
    // Remove existing listeners first
    if (map) {
        map.off('mousemove', handleRadarHover);
        map.off('mouseout', hideRadarValue);
    }
    
    // Add mousemove listener to the map
    if (map && hoverEnabled) {
        map.on('mousemove', handleRadarHover);
        map.on('mouseout', hideRadarValue);
        console.log('Radar value hover listeners attached to map');
    } else {
        console.warn('Map not found when initializing radar value display');
    }
}

function toggleHoverFeature() {
    const hoverToggle = document.getElementById('hover-toggle');
    hoverEnabled = hoverToggle.checked;
    
    if (map) {
        map.off('mousemove', handleRadarHover);
        map.off('mouseout', hideRadarValue);
        
        if (hoverEnabled) {
            map.on('mousemove', handleRadarHover);
            map.on('mouseout', hideRadarValue);
            console.log('Radar hover enabled');
        } else {
            hideRadarValue();
            console.log('Radar hover disabled');
        }
    }
    
    updateCursor();
}

function updateCursor() {
    console.log('=== CURSOR UPDATE START ===');
    console.log('Hover enabled:', hoverEnabled);
    
    const mapContainer = document.getElementById('map');
    const leafletContainer = document.querySelector('.leaflet-container');
    const body = document.body;
    
    console.log('Map container found:', !!mapContainer);
    console.log('Leaflet container found:', !!leafletContainer);
    
    // Use bullseye cursor with 2 circles and crosshairs stopping at inner circle
    const bullseyeCursor = "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDMyIDMyIj4KICA8ZyBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSI+CiAgICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxMiIvPgogICAgPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iNiIvPgogICAgPGxpbmUgeDE9IjQiIHkxPSIxNiIgeDI9IjEwIiB5Mj0iMTYiLz4KICAgIDxsaW5lIHgxPSIyMiIgeTE9IjE2IiB4Mj0iMjgiIHkyPSIxNiIvPgogICAgPGxpbmUgeDE9IjE2IiB5MT0iNCIgeDI9IjE2IiB5Mj0iMTAiLz4KICAgIDxsaW5lIHgxPSIxNiIgeTE9IjIyIiB4Mj0iMTYiIHkyPSIyOCIvPgogIDwvZz4KPC9zdmc+') 16 16, crosshair";
    
    if (hoverEnabled) {
        console.log('ENABLING BULLSEYE CURSOR');
        
        // Apply bullseye cursor to body
        body.style.cursor = bullseyeCursor;
        body.classList.add('bullseye-cursor');
        console.log('Applied bullseye cursor to body');
        
        // Apply to map container with multiple methods
        if (mapContainer) {
            mapContainer.style.setProperty('cursor', bullseyeCursor, 'important');
            mapContainer.classList.add('bullseye-cursor', 'force-cursor');
            console.log('Applied bullseye cursor to map container');
        }
        
        // Apply to leaflet container
        if (leafletContainer) {
            leafletContainer.style.setProperty('cursor', bullseyeCursor, 'important');
            leafletContainer.classList.add('bullseye-cursor', 'force-cursor');
            console.log('Applied bullseye cursor to leaflet container');
        }
        
        // Apply to ALL elements inside the map
        if (mapContainer) {
            const allChildren = mapContainer.querySelectorAll('*');
            console.log(`Applying bullseye cursor to ${allChildren.length} child elements`);
            allChildren.forEach((element, index) => {
                element.style.setProperty('cursor', bullseyeCursor, 'important');
                element.classList.add('bullseye-cursor');
                if (index < 5) console.log(`Applied bullseye to element ${index}:`, element.tagName, element.className);
            });
        }
        
        // Force a style update
        if (mapContainer) {
            mapContainer.offsetHeight; // Force reflow
        }
        
        // Try to override any Leaflet event handlers that might be setting cursor
        setTimeout(() => {
            console.log('Delayed bullseye cursor application...');
            if (mapContainer) {
                mapContainer.style.setProperty('cursor', bullseyeCursor, 'important');
            }
            if (leafletContainer) {
                leafletContainer.style.setProperty('cursor', bullseyeCursor, 'important');
            }
        }, 100);
        
    } else {
        console.log('DISABLING CURSOR');
        
        // Remove from body
        body.style.cursor = "";
        body.classList.remove('force-cursor', 'bullseye-cursor');
        
        // Remove from containers
        if (mapContainer) {
            mapContainer.style.cursor = "";
            mapContainer.classList.remove('test-cursor', 'force-cursor', 'bullseye-cursor');
            // Remove from all children
            const allChildren = mapContainer.querySelectorAll('*');
            allChildren.forEach(element => {
                element.style.cursor = "";
                element.classList.remove('force-cursor', 'bullseye-cursor');
            });
        }
        
        if (leafletContainer) {
            leafletContainer.style.cursor = "";
            leafletContainer.classList.remove('test-cursor', 'force-cursor', 'bullseye-cursor');
        }
    }
    
    console.log('=== CURSOR UPDATE END ===');
}

function handleRadarHover(e) {
    if (!radarValueDisplay || !radarOverlay || !hoverEnabled) return;
    
    clearTimeout(hoverTimeout);
    
    // Get lat/lon from mouse position
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    
    // Get current layer
    const layerSelect = document.getElementById('weather-layer');
    const currentLayer = layerSelect ? layerSelect.value : 'reflectivity';
    
    // Update tooltip position relative to the map container
    const mapContainer = document.getElementById('map');
    const rect = mapContainer.getBoundingClientRect();
    const x = e.containerPoint.x;
    const y = e.containerPoint.y;
    
    // Smart positioning to avoid blocking cursor and stay in bounds
    // Default offset: 40px right and 60px up from cursor
    let offsetX = 40;
    let offsetY = -60;
    
    // Check if tooltip would go off the right edge of map
    const tooltipWidth = 200; // Approximate width of tooltip
    if (x + offsetX + tooltipWidth > mapContainer.offsetWidth) {
        // Position to the left of cursor instead
        offsetX = -tooltipWidth - 20;
    }
    
    // Check if tooltip would go above the top of map
    if (y + offsetY < 0) {
        // Position below cursor instead
        offsetY = 30;
    }
    
    // Position tooltip with calculated offset
    radarValueDisplay.style.left = (x + offsetX) + 'px';
    radarValueDisplay.style.top = (y + offsetY) + 'px';
    radarValueDisplay.style.display = 'block';
    radarValueDisplay.textContent = 'Loading...';
    
    console.log('Radar hover at:', lat.toFixed(4), lon.toFixed(4), 'Layer:', currentLayer);
    
    // Debounce the API call
    hoverTimeout = setTimeout(() => {
        fetchRadarValue(lat, lon, currentLayer);
    }, 200);
}

function hideRadarValue() {
    if (radarValueDisplay) {
        radarValueDisplay.style.display = 'none';
    }
    clearTimeout(hoverTimeout);
}

async function fetchRadarValue(lat, lon, layer) {
    try {
        const response = await fetch(`/api/radar/value?lat=${lat}&lon=${lon}&layer=${layer}`);
        const data = await response.json();
        
        if (response.ok && radarValueDisplay && radarValueDisplay.style.display === 'block') {
            radarValueDisplay.textContent = data.value || 'No data';
        } else if (data.error) {
            if (radarValueDisplay && radarValueDisplay.style.display === 'block') {
                radarValueDisplay.textContent = data.error === 'Coordinates outside radar coverage' ? 
                    'Outside coverage' : 'No data';
            }
        }
    } catch (error) {
        console.error('Error fetching radar value:', error);
        if (radarValueDisplay && radarValueDisplay.style.display === 'block') {
            radarValueDisplay.textContent = 'Error';
        }
    }
}

// Initialize radar value display when map and radar are ready
// (This is now called from addOrUpdateRadarOverlay after overlay loads)
