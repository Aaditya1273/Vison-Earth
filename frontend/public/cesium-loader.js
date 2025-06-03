// This file ensures Cesium is properly loaded and configured
window.CESIUM_BASE_URL = '/cesium';

// Ensure Cesium assets are properly loaded
window.onload = function() {
  console.log('Cesium base URL set to:', window.CESIUM_BASE_URL);
  
  // Check if Cesium is loaded
  if (window.Cesium) {
    console.log('Cesium is loaded successfully');
  } else {
    console.error('Cesium failed to load');
  }
};
