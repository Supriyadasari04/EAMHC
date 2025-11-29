import sys
import json
import joblib
import numpy as np
import os

def predict_emotion(text):
    """
    Predict emotion using the trained model
    """
    try:
        print(f"Starting emotion prediction for: {text}")
        
        # Try different possible model paths
        possible_paths = [
            "emotion_classifier_pipe_lr.pkl",
            "./emotion_classifier_pipe_lr.pkl",
            "D:/Projects/Supriya Self Projects/EAMHC/backend/emotion_classifier_pipe_lr.pkl"
        ]
        
        model_path = None
        for path in possible_paths:
            if os.path.exists(path):
                model_path = path
                break
        
        if not model_path:
            raise FileNotFoundError("Model file not found in any of the expected locations")
        
        print(f"Loading model from: {model_path}")
        pipe_lr = joblib.load(model_path)
        
        # Make prediction
        prediction = pipe_lr.predict([text])[0]
        
        # Get prediction probabilities
        probabilities = pipe_lr.predict_proba([text])[0]
        
        # Create probability dictionary for all emotions
        emotion_classes = pipe_lr.classes_
        
        probability_dict = {}
        for i, emotion in enumerate(emotion_classes):
            probability_dict[emotion] = float(probabilities[i])
        
        return {
            "prediction": prediction,
            "probability": probability_dict
        }
        
    except Exception as e:
        error_msg = f"Error in predict_emotion: {str(e)}"
        return {
            "error": error_msg,
            "prediction": "error",
            "probability": {}
        }

if __name__ == "__main__":
    # Get text from command line arguments
    if len(sys.argv) > 1:
        input_text = sys.argv[1]
        result = predict_emotion(input_text)
        # PRINT ONLY THE JSON, NO OTHER OUTPUT
        print(json.dumps(result))
    else:
        error_result = {
            "error": "No text provided",
            "prediction": "error", 
            "probability": {}
        }
        print(json.dumps(error_result))