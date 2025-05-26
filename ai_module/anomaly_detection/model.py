import os
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, optimizers
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AnomalyDetectionModel:
    """
    Deep learning model for environmental anomaly detection from satellite imagery.
    Uses a U-Net architecture with an encoder-decoder structure for semantic segmentation
    of anomalies such as deforestation, wildfires, oil spills, etc.
    """
    
    def __init__(
        self, 
        input_shape: Tuple[int, int, int] = (256, 256, 10),  # Height, Width, Channels (10 for Sentinel-2)
        num_classes: int = 5,  # Different types of anomalies + background
        model_path: Optional[str] = None
    ):
        self.input_shape = input_shape
        self.num_classes = num_classes
        self.model_path = model_path
        self.model = None
        
        # Initialize model
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            self.build_model()
        
        logger.info(f"Initialized anomaly detection model with input shape {input_shape}")
    
    def build_model(self) -> None:
        """
        Build a U-Net model for semantic segmentation of environmental anomalies
        """
        # Input layer
        inputs = layers.Input(shape=self.input_shape)
        
        # Encoder path
        # Block 1
        conv1 = layers.Conv2D(64, 3, activation='relu', padding='same')(inputs)
        conv1 = layers.Conv2D(64, 3, activation='relu', padding='same')(conv1)
        pool1 = layers.MaxPooling2D(pool_size=(2, 2))(conv1)
        
        # Block 2
        conv2 = layers.Conv2D(128, 3, activation='relu', padding='same')(pool1)
        conv2 = layers.Conv2D(128, 3, activation='relu', padding='same')(conv2)
        pool2 = layers.MaxPooling2D(pool_size=(2, 2))(conv2)
        
        # Block 3
        conv3 = layers.Conv2D(256, 3, activation='relu', padding='same')(pool2)
        conv3 = layers.Conv2D(256, 3, activation='relu', padding='same')(conv3)
        pool3 = layers.MaxPooling2D(pool_size=(2, 2))(conv3)
        
        # Block 4
        conv4 = layers.Conv2D(512, 3, activation='relu', padding='same')(pool3)
        conv4 = layers.Conv2D(512, 3, activation='relu', padding='same')(conv4)
        drop4 = layers.Dropout(0.5)(conv4)
        pool4 = layers.MaxPooling2D(pool_size=(2, 2))(drop4)
        
        # Bridge
        conv5 = layers.Conv2D(1024, 3, activation='relu', padding='same')(pool4)
        conv5 = layers.Conv2D(1024, 3, activation='relu', padding='same')(conv5)
        drop5 = layers.Dropout(0.5)(conv5)
        
        # Decoder path
        # Block 6
        up6 = layers.Conv2DTranspose(512, 2, strides=(2, 2), padding='same')(drop5)
        concat6 = layers.Concatenate()([up6, drop4])
        conv6 = layers.Conv2D(512, 3, activation='relu', padding='same')(concat6)
        conv6 = layers.Conv2D(512, 3, activation='relu', padding='same')(conv6)
        
        # Block 7
        up7 = layers.Conv2DTranspose(256, 2, strides=(2, 2), padding='same')(conv6)
        concat7 = layers.Concatenate()([up7, conv3])
        conv7 = layers.Conv2D(256, 3, activation='relu', padding='same')(concat7)
        conv7 = layers.Conv2D(256, 3, activation='relu', padding='same')(conv7)
        
        # Block 8
        up8 = layers.Conv2DTranspose(128, 2, strides=(2, 2), padding='same')(conv7)
        concat8 = layers.Concatenate()([up8, conv2])
        conv8 = layers.Conv2D(128, 3, activation='relu', padding='same')(concat8)
        conv8 = layers.Conv2D(128, 3, activation='relu', padding='same')(conv8)
        
        # Block 9
        up9 = layers.Conv2DTranspose(64, 2, strides=(2, 2), padding='same')(conv8)
        concat9 = layers.Concatenate()([up9, conv1])
        conv9 = layers.Conv2D(64, 3, activation='relu', padding='same')(concat9)
        conv9 = layers.Conv2D(64, 3, activation='relu', padding='same')(conv9)
        
        # Output layer
        outputs = layers.Conv2D(self.num_classes, 1, activation='softmax')(conv9)
        
        # Create model
        self.model = models.Model(inputs=inputs, outputs=outputs)
        
        # Compile model
        self.model.compile(
            optimizer=optimizers.Adam(learning_rate=1e-4),
            loss='categorical_crossentropy',
            metrics=['accuracy', tf.keras.metrics.MeanIoU(num_classes=self.num_classes)]
        )
        
        logger.info("Built U-Net model for environmental anomaly detection")
    
    def load_model(self, model_path: str) -> None:
        """
        Load a pre-trained model from disk
        """
        try:
            self.model = models.load_model(model_path)
            logger.info(f"Loaded pre-trained model from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model from {model_path}: {str(e)}")
            logger.info("Building new model instead")
            self.build_model()
    
    def save_model(self, model_path: Optional[str] = None) -> None:
        """
        Save the current model to disk
        """
        save_path = model_path or self.model_path or "models/anomaly_detection_model.h5"
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        
        self.model.save(save_path)
        logger.info(f"Saved model to {save_path}")
        self.model_path = save_path
    
    def train(
        self, 
        train_data: Tuple[np.ndarray, np.ndarray],
        validation_data: Optional[Tuple[np.ndarray, np.ndarray]] = None,
        epochs: int = 50,
        batch_size: int = 16,
        callbacks: List[tf.keras.callbacks.Callback] = None
    ) -> Dict[str, Any]:
        """
        Train the model on satellite imagery
        
        Args:
            train_data: Tuple of (X_train, y_train) arrays
            validation_data: Optional tuple of (X_val, y_val) arrays
            epochs: Number of training epochs
            batch_size: Batch size for training
            callbacks: Optional list of Keras callbacks
            
        Returns:
            Training history
        """
        X_train, y_train = train_data
        
        # Default callbacks if none provided
        if callbacks is None:
            callbacks = [
                tf.keras.callbacks.ModelCheckpoint(
                    filepath='models/checkpoints/model_{epoch:02d}_{val_loss:.4f}.h5',
                    save_best_only=True,
                    monitor='val_loss'
                ),
                tf.keras.callbacks.EarlyStopping(
                    patience=10, 
                    monitor='val_loss',
                    restore_best_weights=True
                ),
                tf.keras.callbacks.ReduceLROnPlateau(
                    factor=0.1,
                    patience=5,
                    monitor='val_loss',
                    min_lr=1e-6
                )
            ]
            
            # Create directory for checkpoints
            os.makedirs('models/checkpoints', exist_ok=True)
        
        # Train the model
        history = self.model.fit(
            X_train, y_train,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks
        )
        
        logger.info(f"Model trained for {len(history.history['loss'])} epochs")
        return history.history
    
    def predict(self, image: np.ndarray) -> np.ndarray:
        """
        Perform anomaly detection on a satellite image
        
        Args:
            image: Satellite image as numpy array with shape (height, width, channels)
            
        Returns:
            Prediction mask with shape (height, width, num_classes)
        """
        # Ensure image has correct dimensions
        if len(image.shape) == 3:  # Single image
            image = np.expand_dims(image, axis=0)
        
        # Make prediction
        prediction = self.model.predict(image)
        
        return prediction[0]  # Return first (and only) prediction
    
    def evaluate(
        self, 
        test_data: Tuple[np.ndarray, np.ndarray]
    ) -> Dict[str, float]:
        """
        Evaluate the model on test data
        
        Args:
            test_data: Tuple of (X_test, y_test) arrays
            
        Returns:
            Dictionary of evaluation metrics
        """
        X_test, y_test = test_data
        
        # Evaluate model
        results = self.model.evaluate(X_test, y_test)
        
        # Create metrics dictionary
        metrics = {
            metric_name: result 
            for metric_name, result in zip(self.model.metrics_names, results)
        }
        
        logger.info(f"Model evaluation results: {metrics}")
        return metrics


# Example usage
if __name__ == "__main__":
    # Initialize model
    model = AnomalyDetectionModel(input_shape=(256, 256, 10), num_classes=5)
    
    # Print model summary
    model.model.summary()
    
    # Example of synthetic data generation for demonstration
    def generate_synthetic_data(num_samples, height, width, channels, num_classes):
        X = np.random.rand(num_samples, height, width, channels)
        y = np.random.rand(num_samples, height, width, num_classes)
        # Convert to one-hot encoding
        y = (y == y.max(axis=3, keepdims=True)).astype(float)
        return X, y
    
    # Generate synthetic data
    X_train, y_train = generate_synthetic_data(100, 256, 256, 10, 5)
    X_val, y_val = generate_synthetic_data(20, 256, 256, 10, 5)
    
    # Train model on synthetic data (for demonstration only)
    model.train(
        train_data=(X_train, y_train),
        validation_data=(X_val, y_val),
        epochs=2,  # Very few epochs for demonstration
        batch_size=4
    )
    
    # Save model
    model.save_model("models/demo_model.h5")
