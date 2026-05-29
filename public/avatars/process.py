import cv2
import numpy as np
import os
import sys

def process_avatars(image_path, output_dir):
    print(f"Reading image from {image_path}...")
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print("Error: Could not read image.")
        sys.exit(1)
        
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    print("Removing background...")
    # Get the background color from the top-left pixel
    bg_color = img[0, 0].copy()
    
    tolerance = 30
    h, w = img.shape[:2]
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    img_bgr = img[:,:,:3].copy()
    cv2.floodFill(img_bgr, mask, (0, 0), (255, 255, 255), (tolerance, tolerance, tolerance), (tolerance, tolerance, tolerance), cv2.FLOODFILL_FIXED_RANGE)
    
    bg_mask = mask[1:h+1, 1:w+1]
    
    # Remove background
    img[bg_mask == 1, 3] = 0
    
    print("Slicing into 4 rows and 3 columns...")
    rows = 4
    cols = 3
    
    cell_h = h // rows
    cell_w = w // cols
    
    count = 1
    for r in range(rows):
        for c in range(cols):
            y1 = r * cell_h
            y2 = (r + 1) * cell_h if r < rows - 1 else h
            x1 = c * cell_w
            x2 = (c + 1) * cell_w if c < cols - 1 else w
            
            char_img = img[y1:y2, x1:x2]
            
            # Optional: Crop the transparency bounds so the character takes up the whole image
            # Find bounding box of non-transparent pixels
            alpha_channel = char_img[:, :, 3]
            coords = cv2.findNonZero(alpha_channel)
            if coords is not None:
                x_box, y_box, w_box, h_box = cv2.boundingRect(coords)
                # add some padding
                pad = 10
                y1_crop = max(0, y_box - pad)
                y2_crop = min(char_img.shape[0], y_box + h_box + pad)
                x1_crop = max(0, x_box - pad)
                x2_crop = min(char_img.shape[1], x_box + w_box + pad)
                char_img = char_img[y1_crop:y2_crop, x1_crop:x2_crop]
            
            out_path = os.path.join(output_dir, f"avatar_{count + 12}.png")
            cv2.imwrite(out_path, char_img)
            print(f"Saved {out_path}")
            count += 1
            
    print("Done!")

if __name__ == "__main__":
    base_dir = r"C:\Users\hp\Documents\ST_points\public\avatars"
    source_img = os.path.join(base_dir, "source02.png")
    process_avatars(source_img, base_dir)
