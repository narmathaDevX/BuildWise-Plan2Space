"""Image pre-processing and adaptive binarization for floor plan images."""

import cv2
import numpy as np
from typing import Tuple


def preprocess_image(image_bytes: bytes) -> Tuple[np.ndarray, np.ndarray, float]:
    """
    Decodes image bytes, computes grayscale and clean binary mask where walls are WHITE (255)
    and backgrounds are BLACK (0).
    Returns (color_img, binary_walls_mask, quality_score).
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image bytes. Unsupported or corrupted file.")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Mild gaussian blur to suppress high-frequency paper grain / compression artifacts
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Adaptive thresholding: floor plans usually have dark lines on light background
    # We invert so lines/walls become foreground (255)
    binary = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=15,
        C=8,
    )

    # Morphological noise filter: remove tiny speckles
    kernel_speckle = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_speckle)

    # Estimate contrast quality score
    std_dev = float(np.std(gray))
    quality_score = min(1.0, max(0.1, std_dev / 64.0))

    return img, cleaned, quality_score
