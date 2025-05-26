import os
import numpy as np
import cv2
import rasterio
from rasterio.windows import Window
from rasterio.enums import Resampling
import logging
from typing import List, Tuple, Dict, Any, Optional, Union
from pathlib import Path
import geopandas as gpd
from shapely.geometry import box, Polygon, mapping
import matplotlib.pyplot as plt
from sklearn.preprocessing import MinMaxScaler
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class SatelliteImageProcessor:
    """
    Satellite image processing class for handling multi-spectral satellite imagery.
    Supports common operations like loading, preprocessing, band combination,
    vegetation indices calculation, and image enhancement.
    """
    
    def __init__(self):
        """Initialize the satellite image processor"""
        logger.info("Initialized satellite image processor")
        
        # Common band indices for different satellite sources
        self.band_indices = {
            'sentinel-2': {
                'blue': 1, 'green': 2, 'red': 3, 'nir': 7, 'swir1': 11, 'swir2': 12
            },
            'landsat-8': {
                'blue': 1, 'green': 2, 'red': 3, 'nir': 4, 'swir1': 5, 'swir2': 6
            }
        }
        
    def load_image(self, image_path: str) -> Dict[str, Any]:
        """
        Load a satellite image from file
        
        Args:
            image_path: Path to satellite image file (GeoTIFF)
            
        Returns:
            Dictionary containing image data, metadata, and projection info
        """
        try:
            with rasterio.open(image_path) as src:
                # Read image data
                image_data = src.read()
                
                # Get metadata
                metadata = {
                    'width': src.width,
                    'height': src.height,
                    'count': src.count,
                    'dtype': src.dtypes[0],
                    'crs': src.crs.to_string(),
                    'transform': src.transform,
                    'bounds': src.bounds,
                    'resolution': (src.res[0], src.res[1])
                }
                
                logger.info(f"Loaded image from {image_path} with shape {image_data.shape}")
                
                return {
                    'data': image_data,
                    'metadata': metadata,
                    'path': image_path
                }
                
        except Exception as e:
            logger.error(f"Error loading image from {image_path}: {str(e)}")
            raise
    
    def preprocess(
        self, 
        image_data: np.ndarray,
        source: str = 'sentinel-2',
        normalize: bool = True,
        mask_clouds: bool = True,
        cloud_threshold: float = 0.7
    ) -> np.ndarray:
        """
        Preprocess satellite image data
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            source: Satellite source ('sentinel-2', 'landsat-8')
            normalize: Whether to normalize pixel values to [0, 1]
            mask_clouds: Whether to apply cloud masking
            cloud_threshold: Threshold for cloud detection
            
        Returns:
            Preprocessed image data
        """
        # Make a copy to avoid modifying the original
        processed_data = image_data.copy()
        
        # Handle missing or invalid values
        processed_data = np.nan_to_num(processed_data, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Normalize data if requested
        if normalize:
            # Normalize each band separately
            for i in range(processed_data.shape[0]):
                if np.max(processed_data[i]) > 0:  # Avoid division by zero
                    scaler = MinMaxScaler()
                    band = processed_data[i].reshape(-1, 1)
                    processed_data[i] = scaler.fit_transform(band).reshape(processed_data[i].shape)
        
        # Apply cloud masking if requested
        if mask_clouds:
            cloud_mask = self._detect_clouds(processed_data, source, cloud_threshold)
            
            # Apply cloud mask to all bands
            for i in range(processed_data.shape[0]):
                processed_data[i][cloud_mask] = 0
        
        logger.info(f"Preprocessed image data with shape {processed_data.shape}")
        return processed_data
    
    def _detect_clouds(
        self, 
        image_data: np.ndarray,
        source: str = 'sentinel-2',
        threshold: float = 0.7
    ) -> np.ndarray:
        """
        Detect clouds in satellite imagery
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            source: Satellite source ('sentinel-2', 'landsat-8')
            threshold: Threshold for cloud detection
            
        Returns:
            Boolean mask where True indicates cloud pixels
        """
        # Simple cloud detection based on band thresholds
        # This is a simplified implementation - production systems would use more sophisticated algorithms
        
        if source == 'sentinel-2':
            # For Sentinel-2, use blue band and SWIR band for cloud detection
            blue_idx = self.band_indices[source]['blue'] - 1  # Convert to 0-based index
            swir_idx = self.band_indices[source]['swir1'] - 1
            
            if blue_idx >= image_data.shape[0] or swir_idx >= image_data.shape[0]:
                logger.warning(f"Required bands for cloud detection not available in image data")
                return np.zeros(image_data.shape[1:], dtype=bool)
            
            blue_band = image_data[blue_idx]
            swir_band = image_data[swir_idx]
            
            # Clouds are bright in blue band and relatively bright in SWIR
            cloud_mask = (blue_band > threshold) & (swir_band > threshold * 0.8)
            
        elif source == 'landsat-8':
            # For Landsat-8, use QA band if available, otherwise similar approach to Sentinel-2
            if image_data.shape[0] >= 7:  # QA band is typically the last one
                qa_band = image_data[-1]
                # In Landsat QA bands, cloud bits are set according to specific bit patterns
                # This is a simplified version; actual implementation would check specific bits
                cloud_mask = qa_band > threshold
            else:
                blue_idx = self.band_indices[source]['blue'] - 1
                swir_idx = self.band_indices[source]['swir1'] - 1
                
                if blue_idx >= image_data.shape[0] or swir_idx >= image_data.shape[0]:
                    logger.warning(f"Required bands for cloud detection not available in image data")
                    return np.zeros(image_data.shape[1:], dtype=bool)
                
                blue_band = image_data[blue_idx]
                swir_band = image_data[swir_idx]
                
                cloud_mask = (blue_band > threshold) & (swir_band > threshold * 0.7)
        else:
            logger.warning(f"Cloud detection not implemented for source: {source}")
            return np.zeros(image_data.shape[1:], dtype=bool)
        
        logger.info(f"Detected cloud coverage: {np.mean(cloud_mask) * 100:.2f}%")
        return cloud_mask
    
    def create_rgb_composite(
        self, 
        image_data: np.ndarray,
        source: str = 'sentinel-2',
        rgb_bands: Optional[Tuple[int, int, int]] = None,
        stretch: bool = True
    ) -> np.ndarray:
        """
        Create an RGB composite image from multi-spectral data
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            source: Satellite source ('sentinel-2', 'landsat-8')
            rgb_bands: Tuple of (red, green, blue) band indices, 1-based
                       If None, use default RGB bands for the given source
            stretch: Whether to apply contrast stretching
            
        Returns:
            RGB image array with shape (height, width, 3), values in [0, 1]
        """
        # Get default RGB bands if not specified
        if rgb_bands is None:
            if source in self.band_indices:
                red_idx = self.band_indices[source]['red'] - 1
                green_idx = self.band_indices[source]['green'] - 1
                blue_idx = self.band_indices[source]['blue'] - 1
            else:
                # Fallback to 3, 2, 1 for unknown sources
                red_idx, green_idx, blue_idx = 2, 1, 0
        else:
            # Convert 1-based indices to 0-based
            red_idx, green_idx, blue_idx = [i - 1 for i in rgb_bands]
        
        # Check if bands are available
        num_bands = image_data.shape[0]
        if any(idx >= num_bands for idx in [red_idx, green_idx, blue_idx]):
            logger.error(f"Requested RGB bands ({red_idx+1}, {green_idx+1}, {blue_idx+1}) exceed available bands ({num_bands})")
            raise ValueError(f"Requested RGB bands exceed available bands")
        
        # Extract RGB bands
        r = image_data[red_idx]
        g = image_data[green_idx]
        b = image_data[blue_idx]
        
        # Create RGB composite
        height, width = r.shape
        rgb = np.zeros((height, width, 3), dtype=np.float32)
        rgb[:, :, 0] = r
        rgb[:, :, 1] = g
        rgb[:, :, 2] = b
        
        # Apply contrast stretching if requested
        if stretch:
            for i in range(3):
                if np.max(rgb[:, :, i]) > np.min(rgb[:, :, i]):
                    p2 = np.percentile(rgb[:, :, i], 2)
                    p98 = np.percentile(rgb[:, :, i], 98)
                    rgb[:, :, i] = np.clip((rgb[:, :, i] - p2) / (p98 - p2), 0, 1)
        
        # Ensure all values are in [0, 1]
        rgb = np.clip(rgb, 0, 1)
        
        logger.info(f"Created RGB composite with shape {rgb.shape}")
        return rgb
    
    def calculate_ndvi(
        self, 
        image_data: np.ndarray,
        source: str = 'sentinel-2'
    ) -> np.ndarray:
        """
        Calculate Normalized Difference Vegetation Index (NDVI)
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            source: Satellite source ('sentinel-2', 'landsat-8')
            
        Returns:
            NDVI image array with shape (height, width), values in [-1, 1]
        """
        if source in self.band_indices:
            nir_idx = self.band_indices[source]['nir'] - 1
            red_idx = self.band_indices[source]['red'] - 1
        else:
            # Default indices for NIR and Red bands
            nir_idx, red_idx = 3, 2
        
        # Check if bands are available
        num_bands = image_data.shape[0]
        if nir_idx >= num_bands or red_idx >= num_bands:
            logger.error(f"Required bands for NDVI calculation not available")
            raise ValueError(f"Required bands for NDVI calculation not available")
        
        # Extract NIR and Red bands
        nir = image_data[nir_idx].astype(np.float32)
        red = image_data[red_idx].astype(np.float32)
        
        # Calculate NDVI
        # NDVI = (NIR - Red) / (NIR + Red)
        denominator = nir + red
        ndvi = np.zeros_like(nir)
        
        # Avoid division by zero
        valid_mask = denominator > 0
        ndvi[valid_mask] = (nir[valid_mask] - red[valid_mask]) / denominator[valid_mask]
        
        logger.info(f"Calculated NDVI with shape {ndvi.shape}")
        return ndvi
    
    def calculate_indices(
        self, 
        image_data: np.ndarray,
        source: str = 'sentinel-2',
        indices: List[str] = ['ndvi', 'ndwi', 'ndbi']
    ) -> Dict[str, np.ndarray]:
        """
        Calculate multiple spectral indices
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            source: Satellite source ('sentinel-2', 'landsat-8')
            indices: List of indices to calculate ('ndvi', 'ndwi', 'ndbi', etc.)
            
        Returns:
            Dictionary mapping index names to index arrays
        """
        result = {}
        
        # Get band indices for the source
        if source not in self.band_indices:
            logger.warning(f"Unknown source: {source}, using default band indices")
            band_idx = {
                'blue': 0, 'green': 1, 'red': 2, 'nir': 3, 
                'swir1': 4, 'swir2': 5
            }
        else:
            # Convert 1-based indices to 0-based
            band_idx = {k: v-1 for k, v in self.band_indices[source].items()}
        
        # Check if all required bands are available
        num_bands = image_data.shape[0]
        for band_name, idx in band_idx.items():
            if idx >= num_bands:
                logger.warning(f"Band {band_name} (index {idx+1}) not available in image with {num_bands} bands")
        
        # Calculate requested indices
        for index_name in indices:
            if index_name.lower() == 'ndvi':
                # NDVI = (NIR - Red) / (NIR + Red)
                if band_idx['nir'] < num_bands and band_idx['red'] < num_bands:
                    nir = image_data[band_idx['nir']].astype(np.float32)
                    red = image_data[band_idx['red']].astype(np.float32)
                    
                    denominator = nir + red
                    ndvi = np.zeros_like(nir)
                    valid_mask = denominator > 0
                    ndvi[valid_mask] = (nir[valid_mask] - red[valid_mask]) / denominator[valid_mask]
                    
                    result['ndvi'] = ndvi
                else:
                    logger.warning(f"Cannot calculate NDVI: required bands not available")
            
            elif index_name.lower() == 'ndwi':
                # NDWI = (Green - NIR) / (Green + NIR)
                if band_idx['green'] < num_bands and band_idx['nir'] < num_bands:
                    green = image_data[band_idx['green']].astype(np.float32)
                    nir = image_data[band_idx['nir']].astype(np.float32)
                    
                    denominator = green + nir
                    ndwi = np.zeros_like(green)
                    valid_mask = denominator > 0
                    ndwi[valid_mask] = (green[valid_mask] - nir[valid_mask]) / denominator[valid_mask]
                    
                    result['ndwi'] = ndwi
                else:
                    logger.warning(f"Cannot calculate NDWI: required bands not available")
            
            elif index_name.lower() == 'ndbi':
                # NDBI = (SWIR1 - NIR) / (SWIR1 + NIR)
                if band_idx['swir1'] < num_bands and band_idx['nir'] < num_bands:
                    swir1 = image_data[band_idx['swir1']].astype(np.float32)
                    nir = image_data[band_idx['nir']].astype(np.float32)
                    
                    denominator = swir1 + nir
                    ndbi = np.zeros_like(swir1)
                    valid_mask = denominator > 0
                    ndbi[valid_mask] = (swir1[valid_mask] - nir[valid_mask]) / denominator[valid_mask]
                    
                    result['ndbi'] = ndbi
                else:
                    logger.warning(f"Cannot calculate NDBI: required bands not available")
            
            else:
                logger.warning(f"Unknown index: {index_name}")
        
        return result
    
    def extract_patches(
        self, 
        image_data: np.ndarray,
        patch_size: int = 256,
        stride: int = 128,
        min_valid_percentage: float = 0.8
    ) -> List[np.ndarray]:
        """
        Extract overlapping patches from a satellite image
        
        Args:
            image_data: Satellite image data array (bands, height, width)
            patch_size: Size of square patches to extract
            stride: Stride between adjacent patches
            min_valid_percentage: Minimum percentage of valid (non-zero) pixels required
            
        Returns:
            List of patches, each with shape (bands, patch_size, patch_size)
        """
        num_bands, height, width = image_data.shape
        patches = []
        
        for y in range(0, height - patch_size + 1, stride):
            for x in range(0, width - patch_size + 1, stride):
                patch = image_data[:, y:y+patch_size, x:x+patch_size]
                
                # Check if patch has enough valid pixels
                valid_mask = np.sum(patch, axis=0) > 0
                valid_percentage = np.mean(valid_mask)
                
                if valid_percentage >= min_valid_percentage:
                    patches.append(patch)
        
        logger.info(f"Extracted {len(patches)} patches of size {patch_size}x{patch_size}")
        return patches
    
    def save_as_geotiff(
        self, 
        image_data: np.ndarray,
        output_path: str,
        metadata: Dict[str, Any]
    ) -> str:
        """
        Save image data as a GeoTIFF file
        
        Args:
            image_data: Image data to save (bands, height, width) or (height, width) for single band
            output_path: Path to save the GeoTIFF
            metadata: Metadata containing projection and transform information
            
        Returns:
            Path to the saved file
        """
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Handle single-band data
        if len(image_data.shape) == 2:
            image_data = np.expand_dims(image_data, axis=0)
        
        # Create output GeoTIFF
        count, height, width = image_data.shape
        
        with rasterio.open(
            output_path,
            'w',
            driver='GTiff',
            height=height,
            width=width,
            count=count,
            dtype=image_data.dtype,
            crs=metadata.get('crs'),
            transform=metadata.get('transform')
        ) as dst:
            dst.write(image_data)
        
        logger.info(f"Saved image data to {output_path}")
        return output_path
    
    def visualize(
        self, 
        image_data: Union[np.ndarray, Dict[str, np.ndarray]],
        title: Optional[str] = None,
        colormap: Optional[str] = None,
        save_path: Optional[str] = None,
        show: bool = True
    ) -> Optional[str]:
        """
        Visualize image data or indices
        
        Args:
            image_data: Image data (RGB array or dictionary of indices)
            title: Title for the plot
            colormap: Matplotlib colormap for single-band images
            save_path: Optional path to save the visualization
            show: Whether to display the plot
            
        Returns:
            Path to the saved visualization if save_path is provided
        """
        plt.figure(figsize=(10, 8))
        
        if isinstance(image_data, np.ndarray):
            # Single image array
            if len(image_data.shape) == 3 and image_data.shape[2] == 3:
                # RGB image
                plt.imshow(image_data)
                plt.title(title or "RGB Composite")
            else:
                # Single-band image
                plt.imshow(image_data, cmap=colormap or 'viridis')
                plt.colorbar(label=title or "Value")
                plt.title(title or "Image")
        
        elif isinstance(image_data, dict):
            # Dictionary of indices
            num_indices = len(image_data)
            if num_indices > 1:
                # Multiple indices
                rows = (num_indices + 1) // 2
                cols = min(2, num_indices)
                
                for i, (index_name, index_data) in enumerate(image_data.items()):
                    plt.subplot(rows, cols, i + 1)
                    plt.imshow(index_data, cmap=colormap or 'RdYlGn')
                    plt.colorbar(label=index_name)
                    plt.title(index_name.upper())
            elif num_indices == 1:
                # Single index
                index_name, index_data = next(iter(image_data.items()))
                plt.imshow(index_data, cmap=colormap or 'RdYlGn')
                plt.colorbar(label=index_name)
                plt.title(title or f"{index_name.upper()} Index")
        
        plt.tight_layout()
        
        # Save figure if requested
        if save_path:
            os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            logger.info(f"Saved visualization to {save_path}")
        
        # Show figure if requested
        if show:
            plt.show()
        else:
            plt.close()
        
        return save_path if save_path else None
