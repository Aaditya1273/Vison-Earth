const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Copy Cesium assets to public directory
const cesiumSource = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium');
const cesiumDestination = path.resolve(__dirname, 'public/cesium');

// Helper function to copy directories recursively
function copyDir(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Get all files and directories in the source
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy directories
      copyDir(srcPath, destPath);
    } else {
      // Copy files
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy if not already present
if (!fs.existsSync(cesiumDestination)) {
  console.log('Copying Cesium assets to public directory...');
  try {
    copyDir(cesiumSource, cesiumDestination);
    console.log('Cesium assets copied successfully.');
  } catch (error) {
    console.error('Error copying Cesium assets:', error);
  }
} else {
  console.log('Cesium assets already present in public directory.');
}
