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

// Initialize the map and overlay on DOM ready
window.addEventListener('DOMContentLoaded', async function() {
    document.getElementById('loading').style.display = 'block';
    await loadRadarStations();
    await loadCurrentStation();
    await initMapWithRadar();
    checkRadarStatus();
    updateRadarDataTime();
    updateRadarTimestampHistory();
    setupAutoRefreshEventListener(); // Set up event listener
    setupStationSelectorEventListener(); // Set up station selector
    startAutoRefresh();
});

async function loadRadarStations() {
    try {
        const response = await fetch('/api/radar/stations');
        const stations = await response.json();
        
        const select = document.getElementById('radar-station');
        select.innerHTML = '';
        
        stations.forEach(station => {
            const option = document.createElement('option');
            option.value = station.id;
            option.textContent = `${station.id} - ${station.name}, ${station.state}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading radar stations:', error);
        document.getElementById('radar-station').innerHTML = '<option value="">Error loading stations</option>';
    }
}

async function loadCurrentStation() {
    try {
        const response = await fetch('/api/radar/current-station');
        const station = await response.json();
        
        document.getElementById('radar-station').value = station.station_id;
        updateStationInfo(station);
    } catch (error) {
        console.error('Error loading current station:', error);
    }
}

function updateStationInfo(station) {
    const infoElement = document.getElementById('current-station-info');
    infoElement.textContent = `${station.name}, ${station.state}`;
    document.title = `NOAA ${station.station_id} Radar Display`;
}

function setupStationSelectorEventListener() {
    document.getElementById('radar-station').addEventListener('change', async function(e) {
        const stationId = e.target.value;
        if (!stationId) return;
        
        try {
            // Show loading state
            const statusElement = document.getElementById('status-text');
            const originalText = statusElement.textContent;
            statusElement.textContent = 'Switching radar station...';
            
            // Switch station on backend
            const response = await fetch('/api/radar/station', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ station_id: stationId })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }
            
            const station = await response.json();
            updateStationInfo(station);
            
            // Reinitialize map with new bounds
            await initMapWithRadar();
            
            // Reset refresh system for new station
            radarUpdatePattern = [];
            currentRefreshRate = 60000; // Reset to 1 minute
            updateRefreshRateDisplay();
            
            // Refresh radar data immediately
            await addOrUpdateRadarOverlay();
            
            statusElement.textContent = originalText;
            
        } catch (error) {
            console.error('Error switching radar station:', error);
            console.error('Error details:', error.message, error.stack);
            
            // Try to get more specific error information
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response text:', await error.response.text().catch(() => 'Could not read response text'));
            }
            
            alert(`Failed to switch radar station: ${error.message || 'Unknown error'}. Please check the console for details.`);
            // Reset to previous selection
            await loadCurrentStation();
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

    // Build URL with cache buster
    const url = `/api/radar?t=${Date.now()}`;
    const dbg = await fetch('/api/radar/debug').then(r => r.json());
    const b = dbg.bbox;
    const bounds = [[b.lat_min, b.lon_min], [b.lat_max, b.lon_max]];

    radarOverlay = L.imageOverlay(url, bounds, { opacity: 0.8, interactive: false, zIndex: 5 });

    radarOverlay.on('load', () => {
        loading.style.display = 'none';
        markOnline();
        updateLastUpdateTime();
        updateRadarDataTime(); // Update radar data timestamp when image loads
        updateRadarTimestampHistory(); // Update timestamp history
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
