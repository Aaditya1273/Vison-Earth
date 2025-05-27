import { Ion } from 'cesium';

// Cesium configuration
const CESIUM_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWY0LTQzN2YtOGNkNC0yYTVmZjEwZGJmM2QiLCJpZCI6MTYyMTY3LCJpYXQiOjE2OTY5MDk2MTZ9.jaESQs38ACb1-OXgPt-FA-lARxYzBr_NLzEEZ7C27KQ';

// Initialize Cesium with the access token
export const initCesium = () => {
  // Configure the Cesium ion access token
  Ion.defaultAccessToken = CESIUM_ACCESS_TOKEN;
  
  // Set the base URL for loading Cesium assets
  // Add TypeScript declaration for the CESIUM_BASE_URL property
  (window as any).CESIUM_BASE_URL = '/cesium/';
};

export default initCesium;
