// This script handles loading Cesium and setting up global state

// Set a global flag to track Cesium loading status
window.CESIUM_LOADED = false;

// Create a promise to track Cesium loading status
window.CESIUM_READY = new Promise((resolve, reject) => {
  window.CESIUM_RESOLVE = resolve;
  window.CESIUM_REJECT = reject;
});

// Function to load Cesium
function loadCesium() {
  try {
    console.log('[CESIUM LOADER] Starting Cesium loading process');
    
    // Set the base URL for Cesium assets using absolute path
    window.CESIUM_BASE_URL = window.location.origin + '/cesium';
    console.log('[CESIUM LOADER] CESIUM_BASE_URL set to:', window.CESIUM_BASE_URL);
    
    // Create and append the script element
    const script = document.createElement('script');
    script.src = window.CESIUM_BASE_URL + '/Cesium.js';
    script.type = 'text/javascript';
    script.async = false;
    
    script.onload = () => {
      console.log('[CESIUM LOADER] Cesium loaded successfully with absolute path');
      // Check if Cesium object is actually available
      if (typeof window.Cesium !== 'undefined') {
        window.CESIUM_LOADED = true;
        window.CESIUM_RESOLVE(true);
      } else {
        console.error('[CESIUM LOADER] Cesium script loaded but Cesium object not available');
        tryFallbackLoading();
      }
    };
    
    script.onerror = (e) => {
      console.error('[CESIUM LOADER] Failed to load Cesium with absolute path:', e);
      tryFallbackLoading();
    };
    
    function tryFallbackLoading() {
      console.log('[CESIUM LOADER] Attempting to load Cesium with fallback path');
      // Try with a relative path as fallback
      const fallbackScript = document.createElement('script');
      fallbackScript.src = './cesium/Cesium.js';
      fallbackScript.type = 'text/javascript';
      fallbackScript.async = false;
      
      fallbackScript.onload = () => {
        console.log('[CESIUM LOADER] Cesium loaded via fallback relative path');
        // Double check that Cesium is actually available
        if (typeof window.Cesium !== 'undefined') {
          window.CESIUM_LOADED = true;
          window.CESIUM_RESOLVE(true);
        } else {
          console.error('[CESIUM LOADER] Fallback script loaded but Cesium object not available');
          window.CESIUM_REJECT(new Error('Cesium object not available after script load'));
        }
      };
      
      fallbackScript.onerror = () => {
        console.error('[CESIUM LOADER] All attempts to load Cesium failed');
        window.CESIUM_REJECT(new Error('Failed to load Cesium'));
      };
      
      document.head.appendChild(fallbackScript);
    }
    
    document.head.appendChild(script);
    
    // Set a timeout to reject the promise if loading takes too long
    setTimeout(() => {
      if (!window.CESIUM_LOADED) {
        console.error('[CESIUM LOADER] Cesium loading timed out after 30 seconds');
        // Check if Cesium is actually available despite the timeout
        if (typeof window.Cesium !== 'undefined') {
          console.log('[CESIUM LOADER] Cesium object found despite timeout, resolving promise');
          window.CESIUM_LOADED = true;
          window.CESIUM_RESOLVE(true);
        } else {
          window.CESIUM_REJECT(new Error('Cesium loading timed out'));
        }
      }
    }, 30000);
  } catch (error) {
    console.error('[CESIUM LOADER] Critical error in cesium-loader.js:', error);
    window.CESIUM_REJECT(error);
    
    // Add a visible error message to the page for debugging
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '10px';
    errorDiv.style.right = '10px';
    errorDiv.style.padding = '10px';
    errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.borderRadius = '5px';
    errorDiv.textContent = 'Cesium loading error: ' + (error.message || 'Unknown error');
    document.body.appendChild(errorDiv);
  }
}

// Check if Cesium is already loaded
if (typeof window.Cesium !== 'undefined') {
  console.log('Cesium already loaded');
  window.CESIUM_LOADED = true;
  window.CESIUM_RESOLVE(true);
} else {
  // Load Cesium
  loadCesium();
  
  // Also try to load on window load as a fallback
  window.addEventListener('load', () => {
    if (!window.CESIUM_LOADED) {
      console.log('Window loaded, but Cesium not loaded yet. Trying again...');
      loadCesium();
    }
  });
}
