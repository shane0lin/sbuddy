/**
 * Viewer Configuration
 * Configure API endpoint for the viewer
 */
const VIEWER_CONFIG = {
    // API base URL - change this based on your environment
    API_BASE_URL: window.location.origin + '/api/v1/crawled',

    // Fallback to file-based system if API is not available
    USE_FILE_FALLBACK: true,

    // File paths for fallback mode
    FILE_BASE_PATH: '../../crawled_data',
    FILE_INDEX_PATH: '../../crawled_data/amc_index.json'
};

// Helper function to get API URL
function getApiUrl(endpoint) {
    return `${VIEWER_CONFIG.API_BASE_URL}${endpoint}`;
}

// Helper function to detect if we should use API or files
async function shouldUseAPI() {
    if (!VIEWER_CONFIG.USE_FILE_FALLBACK) {
        return true;
    }

    // Try to ping the API
    try {
        const response = await fetch(getApiUrl('/tests'), { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        console.warn('API not available, falling back to file-based system');
        return false;
    }
}
