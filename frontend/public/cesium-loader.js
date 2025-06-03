// This file ensures Cesium is properly loaded and configured
window.CESIUM_BASE_URL = '/cesium';

// Set a global flag to track Cesium loading status
window.CESIUM_LOADED = false;

// Create a promise that resolves when Cesium is loaded
window.CESIUM_READY = new Promise((resolve, reject) => {
  window.CESIUM_RESOLVE = resolve;
  window.CESIUM_REJECT = reject;
});

// Function to check if Cesium is loaded
function checkCesiumLoaded() {
  if (window.Cesium) {
    console.log('Cesium is loaded successfully');
    window.CESIUM_LOADED = true;
    window.CESIUM_RESOLVE(window.Cesium);
    return true;
  }
  return false;
}

// Check immediately if Cesium is already loaded
checkCesiumLoaded();

// Also check when the window loads
window.addEventListener('load', function() {
  console.log('Cesium base URL set to:', window.CESIUM_BASE_URL);
  
  // Check if Cesium is loaded
  if (!checkCesiumLoaded()) {
    // If not loaded yet, check again after a short delay
    setTimeout(function() {
      if (!checkCesiumLoaded()) {
        console.error('Cesium failed to load after timeout');
        window.CESIUM_REJECT(new Error('Cesium failed to load'));
      }
    }, 2000);
  }
});
