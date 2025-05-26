import os
import logging
import numpy as np
import tensorflow as tf
from typing import Dict, List, Optional, Any, Union, Tuple
from pathlib import Path
import datetime
import json
from abc import ABC, abstractmethod
import rasterio
from rasterio.warp import transform_bounds
import geopandas as gpd
from shapely.geometry import box, mapping

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class AnomalyDetector(ABC):
    """
    Abstract base class for anomaly detection models
    Defines the interface for all anomaly detection models
    """
    
    @abstractmethod
    def load_model(self, model_path: str) -> None:
        """
        Load a pre-trained model from disk
        
        Args:
            model_path: Path to the model file or directory
        """
        pass
    
    @abstractmethod
    def detect_anomalies(
        self, 
        image_path: str,
        threshold: float = 0.5,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Detect anomalies in a satellite image
        
        Args:
            image_path: Path to the satellite image file
            threshold: Threshold for anomaly detection
            metadata: Additional metadata for the image
            
        Returns:
            Dictionary with detection results
        """
        pass
    
    @abstractmethod
    def train(
        self,
        training_data_path: str,
        validation_data_path: Optional[str] = None,
        epochs: int = 10,
        batch_size: int = 32,
        output_model_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Train the anomaly detection model
        
        Args:
            training_data_path: Path to the training data
            validation_data_path: Path to the validation data
            epochs: Number of training epochs
            batch_size: Batch size for training
            output_model_path: Path to save the trained model
            
        Returns:
            Dictionary with training results
        """
        pass


class EnvironmentalAnomalyDetector(AnomalyDetector):
    """
    Environmental anomaly detector using deep learning
    Detects environmental anomalies such as wildfires, deforestation, floods, etc.
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        anomaly_types: List[str] = ["wildfire", "deforestation", "flood", "oil_spill"],
        input_shape: Tuple[int, int, int] = (256, 256, 12),  # height, width, channels
    ):
        """
        Initialize the environmental anomaly detector
        
        Args:
            model_path: Path to a pre-trained model (if None, a new model will be created)
            anomaly_types: List of environmental anomaly types that the model detects
            input_shape: Input shape for the model (height, width, channels)
        """
        self.model = None
        self.anomaly_types = anomaly_types
        self.input_shape = input_shape
        
        # Load model if path is provided
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
            logger.info(f"Initialized Environmental Anomaly Detector with pre-trained model from {model_path}")
        else:
            logger.info(f"Initialized Environmental Anomaly Detector without pre-trained model")
    
    def load_model(self, model_path: str) -> None:
        """
        Load a pre-trained model from disk
        
        Args:
            model_path: Path to the model file or directory
        """
        try:
            # Load TensorFlow model
            self.model = tf.keras.models.load_model(model_path)
            logger.info(f"Loaded model from {model_path}")
            logger.info(f"Model input shape: {self.model.input_shape}")
            logger.info(f"Model output shape: {self.model.output_shape}")
        except Exception as e:
            logger.error(f"Error loading model from {model_path}: {str(e)}")
            raise
    
    def _create_model(self) -> tf.keras.Model:
        """
        Create a new model for anomaly detection
        
        Returns:
            TensorFlow model
        """
        # Create a U-Net model for semantic segmentation
        # This is a simplified implementation
        
        # Input layer
        inputs = tf.keras.layers.Input(shape=self.input_shape)
        
        # Encoder
        conv1 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(inputs)
        conv1 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(conv1)
        pool1 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv1)
        
        conv2 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(pool1)
        conv2 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(conv2)
        pool2 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv2)
        
        conv3 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(pool2)
        conv3 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(conv3)
        pool3 = tf.keras.layers.MaxPooling2D(pool_size=(2, 2))(conv3)
        
        # Bridge
        conv4 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(pool3)
        conv4 = tf.keras.layers.Conv2D(512, 3, activation='relu', padding='same')(conv4)
        
        # Decoder
        up5 = tf.keras.layers.concatenate([
            tf.keras.layers.Conv2DTranspose(256, 2, strides=(2, 2), padding='same')(conv4),
            conv3
        ], axis=3)
        conv5 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(up5)
        conv5 = tf.keras.layers.Conv2D(256, 3, activation='relu', padding='same')(conv5)
        
        up6 = tf.keras.layers.concatenate([
            tf.keras.layers.Conv2DTranspose(128, 2, strides=(2, 2), padding='same')(conv5),
            conv2
        ], axis=3)
        conv6 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(up6)
        conv6 = tf.keras.layers.Conv2D(128, 3, activation='relu', padding='same')(conv6)
        
        up7 = tf.keras.layers.concatenate([
            tf.keras.layers.Conv2DTranspose(64, 2, strides=(2, 2), padding='same')(conv6),
            conv1
        ], axis=3)
        conv7 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(up7)
        conv7 = tf.keras.layers.Conv2D(64, 3, activation='relu', padding='same')(conv7)
        
        # Output layer
        # One channel per anomaly type + 1 for no anomaly
        outputs = tf.keras.layers.Conv2D(len(self.anomaly_types) + 1, 1, activation='softmax')(conv7)
        
        # Create model
        model = tf.keras.Model(inputs=inputs, outputs=outputs)
        model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Preprocess a satellite image for model input
        
        Args:
            image_path: Path to the satellite image file
            
        Returns:
            Preprocessed image as numpy array
        """
        try:
            # Open raster file
            with rasterio.open(image_path) as src:
                # Read all bands
                image = src.read()
                
                # Transpose to height, width, channels
                image = np.transpose(image, (1, 2, 0))
                
                # Resize to target input shape if needed
                if image.shape[0] != self.input_shape[0] or image.shape[1] != self.input_shape[1]:
                    # In a real implementation, use proper resampling
                    # This is a placeholder for demonstration
                    image_resized = np.zeros(self.input_shape)
                    # Copy as many channels as available
                    min_channels = min(image.shape[2], self.input_shape[2])
                    image_resized[:, :, :min_channels] = tf.image.resize(
                        image[:, :, :min_channels], 
                        (self.input_shape[0], self.input_shape[1])
                    )
                    image = image_resized
                
                # Normalize values to [0, 1]
                image = image.astype(np.float32) / 10000.0  # Assuming Sentinel-2 reflectance values
                
                # Clip values to [0, 1] range
                image = np.clip(image, 0, 1)
                
                return image
        
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {str(e)}")
            raise
    
    def train(
        self,
        training_data_path: str,
        validation_data_path: Optional[str] = None,
        epochs: int = 10,
        batch_size: int = 32,
        output_model_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Train the anomaly detection model
        
        Args:
            training_data_path: Path to the training data
            validation_data_path: Path to the validation data
            epochs: Number of training epochs
            batch_size: Batch size for training
            output_model_path: Path to save the trained model
            
        Returns:
            Dictionary with training results
        """
        try:
            # Create a new model if none exists
            if self.model is None:
                self.model = self._create_model()
                logger.info("Created new model for training")
            
            # Load and preprocess training data
            # This is a placeholder - in a real implementation, this would load actual data
            logger.info(f"Loading training data from {training_data_path}")
            
            # Mock training history for demonstration
            history = {
                "accuracy": [0.6, 0.7, 0.75, 0.8, 0.85],
                "val_accuracy": [0.55, 0.65, 0.7, 0.75, 0.78],
                "loss": [0.8, 0.6, 0.5, 0.4, 0.3],
                "val_loss": [0.9, 0.7, 0.6, 0.5, 0.45]
            }
            
            # Save model if output path is provided
            if output_model_path:
                os.makedirs(os.path.dirname(os.path.abspath(output_model_path)), exist_ok=True)
                self.model.save(output_model_path)
                logger.info(f"Saved trained model to {output_model_path}")
            
            # Return training results
            return {
                "epochs_completed": epochs,
                "final_accuracy": history["accuracy"][-1],
                "final_val_accuracy": history["val_accuracy"][-1],
                "final_loss": history["loss"][-1],
                "final_val_loss": history["val_loss"][-1],
                "history": history
            }
        
        except Exception as e:
            logger.error(f"Error training model: {str(e)}")
            raise
    
    def detect_anomalies(
        self, 
        image_path: str,
        threshold: float = 0.5,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Detect environmental anomalies in a satellite image
        
        Args:
            image_path: Path to the satellite image file
            threshold: Threshold for anomaly detection
            metadata: Additional metadata for the image
            
        Returns:
            Dictionary with detection results
        """
        try:
            # Create a model if none exists
            if self.model is None:
                raise ValueError("No model loaded. Please load a pre-trained model or train a new one.")
            
            # Load and preprocess the image
            logger.info(f"Processing satellite image: {image_path}")
            processed_image = self.preprocess_image(image_path)
            
            # Get image metadata
            with rasterio.open(image_path) as src:
                image_bounds = src.bounds
                image_crs = src.crs
                image_transform = src.transform
                image_width = src.width
                image_height = src.height
            
            # Convert to WGS84 (EPSG:4326) for consistency
            if image_crs and image_crs.to_epsg() != 4326:
                # Transform bounds to WGS84
                image_bounds = transform_bounds(image_crs, 'EPSG:4326', *image_bounds)
            
            # Get bounding box
            bbox = [image_bounds.left, image_bounds.bottom, image_bounds.right, image_bounds.top]
            
            # Expand dimensions for batch processing (add batch dimension)
            batch_image = np.expand_dims(processed_image, axis=0)
            
            # Perform inference
            logger.info("Running anomaly detection model inference")
            predictions = self.model.predict(batch_image)
            
            # Process predictions
            # predictions shape: [batch, height, width, classes]
            # Extract first (and only) image from batch
            pred_masks = predictions[0]
            
            # Create result masks for each anomaly type
            anomaly_results = {}
            
            for i, anomaly_type in enumerate(self.anomaly_types):
                # Get class index (add 1 to skip the "no anomaly" class)
                class_idx = i + 1
                
                # Get mask for this anomaly type
                anomaly_mask = pred_masks[:, :, class_idx]
                
                # Apply threshold
                binary_mask = anomaly_mask > threshold
                
                # Calculate coverage percentage
                coverage = np.mean(binary_mask) * 100
                
                # Find contours/regions (simplified for this implementation)
                # In a real implementation, we would use proper contour extraction
                regions = []
                if coverage > 0:
                    # Mock region for demonstration
                    regions.append({
                        "id": f"{anomaly_type}_1",
                        "confidence": float(np.max(anomaly_mask)),
                        "area_percentage": float(coverage),
                        "bbox": bbox,  # Using full image bbox as a simplification
                    })
                
                # Store results for this anomaly type
                anomaly_results[anomaly_type] = {
                    "detected": len(regions) > 0,
                    "coverage_percentage": float(coverage),
                    "confidence_score": float(np.max(anomaly_mask)) if coverage > 0 else 0.0,
                    "regions": regions
                }
            
            # Combine results
            detection_time = datetime.datetime.now()
            
            # Construct GeoJSON for the bounding box
            bbox_polygon = box(*bbox)
            bbox_geojson = mapping(bbox_polygon)
            
            result = {
                "image_path": image_path,
                "detection_time": detection_time.isoformat(),
                "bbox": bbox,
                "coverage_area": bbox_geojson,
                "threshold": threshold,
                "anomalies": anomaly_results,
                "metadata": metadata or {}
            }
            
            logger.info(f"Completed anomaly detection for {image_path}")
            
            # Add summary of detected anomalies
            detected_types = [atype for atype, info in anomaly_results.items() if info["detected"]]
            result["summary"] = {
                "detected_anomaly_types": detected_types,
                "total_detected_regions": sum(len(info["regions"]) for info in anomaly_results.values()),
                "has_anomalies": len(detected_types) > 0
            }
            
            return result
        
        except Exception as e:
            logger.error(f"Error detecting anomalies: {str(e)}")
            raise


class WildfireDetector(EnvironmentalAnomalyDetector):
    """
    Specialized detector for wildfire detection
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        input_shape: Tuple[int, int, int] = (256, 256, 12)
    ):
        super().__init__(
            model_path=model_path,
            anomaly_types=["wildfire"],
            input_shape=input_shape
        )
        
        logger.info("Initialized Wildfire Detector")
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Preprocess a satellite image specifically for wildfire detection
        
        Args:
            image_path: Path to the satellite image file
            
        Returns:
            Preprocessed image as numpy array
        """
        # Call the parent class implementation first
        image = super().preprocess_image(image_path)
        
        # Additional processing specific to wildfire detection
        # For example, calculate NBR (Normalized Burn Ratio)
        # This is a placeholder - in a real implementation, we would calculate NBR
        
        return image


class DeforestationDetector(EnvironmentalAnomalyDetector):
    """
    Specialized detector for deforestation detection
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        input_shape: Tuple[int, int, int] = (256, 256, 12)
    ):
        super().__init__(
            model_path=model_path,
            anomaly_types=["deforestation"],
            input_shape=input_shape
        )
        
        logger.info("Initialized Deforestation Detector")
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Preprocess a satellite image specifically for deforestation detection
        
        Args:
            image_path: Path to the satellite image file
            
        Returns:
            Preprocessed image as numpy array
        """
        # Call the parent class implementation first
        image = super().preprocess_image(image_path)
        
        # Additional processing specific to deforestation detection
        # For example, calculate NDVI (Normalized Difference Vegetation Index)
        # This is a placeholder - in a real implementation, we would calculate NDVI
        
        return image


class FloodDetector(EnvironmentalAnomalyDetector):
    """
    Specialized detector for flood detection
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        input_shape: Tuple[int, int, int] = (256, 256, 12)
    ):
        super().__init__(
            model_path=model_path,
            anomaly_types=["flood"],
            input_shape=input_shape
        )
        
        logger.info("Initialized Flood Detector")
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Preprocess a satellite image specifically for flood detection
        
        Args:
            image_path: Path to the satellite image file
            
        Returns:
            Preprocessed image as numpy array
        """
        # Call the parent class implementation first
        image = super().preprocess_image(image_path)
        
        # Additional processing specific to flood detection
        # For example, calculate NDWI (Normalized Difference Water Index)
        # This is a placeholder - in a real implementation, we would calculate NDWI
        
        return image


# Factory function to create appropriate detector
def create_anomaly_detector(
    anomaly_type: str,
    model_path: Optional[str] = None,
    input_shape: Tuple[int, int, int] = (256, 256, 12)
) -> AnomalyDetector:
    """
    Factory function to create an appropriate anomaly detector
    
    Args:
        anomaly_type: Type of anomaly to detect
        model_path: Path to the pre-trained model
        input_shape: Input shape for the model
        
    Returns:
        Anomaly detector instance
    """
    if anomaly_type.lower() == "wildfire":
        return WildfireDetector(model_path=model_path, input_shape=input_shape)
    elif anomaly_type.lower() in ["deforestation", "forest_loss"]:
        return DeforestationDetector(model_path=model_path, input_shape=input_shape)
    elif anomaly_type.lower() in ["flood", "flooding", "water"]:
        return FloodDetector(model_path=model_path, input_shape=input_shape)
    else:
        # Generic environmental anomaly detector
        return EnvironmentalAnomalyDetector(
            model_path=model_path,
            anomaly_types=[anomaly_type],
            input_shape=input_shape
        )


# Example usage
if __name__ == "__main__":
    # Create a wildfire detector
    wildfire_detector = create_anomaly_detector("wildfire")
    
    # Example detection (with mock data)
    mock_image_path = "example_data/sentinel2_image.tif"
    
    # This would normally fail because the image doesn't exist and there's no model
    # But here's what the result would look like:
    mock_result = {
        "image_path": mock_image_path,
        "detection_time": datetime.datetime.now().isoformat(),
        "bbox": [-122.5, 37.7, -122.2, 37.9],
        "threshold": 0.5,
        "anomalies": {
            "wildfire": {
                "detected": True,
                "coverage_percentage": 8.5,
                "confidence_score": 0.87,
                "regions": [
                    {
                        "id": "wildfire_1",
                        "confidence": 0.87,
                        "area_percentage": 8.5,
                        "bbox": [-122.45, 37.75, -122.38, 37.85]
                    }
                ]
            }
        },
        "summary": {
            "detected_anomaly_types": ["wildfire"],
            "total_detected_regions": 1,
            "has_anomalies": True
        }
    }
    
    print(json.dumps(mock_result, indent=2))
