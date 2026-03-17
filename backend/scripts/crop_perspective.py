#!/usr/bin/env python3
"""
Perspective crop: 4 points (corners) → sort to TL, TR, BR, BL → getPerspectiveTransform → warp → save.
Usage: python crop_perspective.py input.jpg output.jpg x1 y1 x2 y2 x3 y3 x4 y4
Requires: opencv-python, numpy
"""
import sys
import cv2
import numpy as np


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def order_points(pts):
    """
    Sort 4 points to: top-left, top-right, bottom-right, bottom-left.
    Top = smaller y; left = smaller x.
    """
    pts = np.array(pts, dtype=np.float32)
    if len(pts) != 4:
        raise ValueError("Exactly 4 points required")
    # Sort by y (top to bottom), then top two by x (left, right), bottom two by x
    pts = pts[np.argsort(pts[:, 1])]   # top two, bottom two
    top = pts[:2]
    bottom = pts[2:]
    top = top[np.argsort(top[:, 0])]   # top-left, top-right
    bottom = bottom[np.argsort(bottom[:, 0])]  # bottom-left, bottom-right
    return np.array([top[0], top[1], bottom[1], bottom[0]], dtype=np.float32)


def main():
    if len(sys.argv) != 11:
        log("Usage: crop_perspective.py input.jpg output.jpg x1 y1 x2 y2 x3 y3 x4 y4")
        sys.exit(1)
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    try:
        coords = [float(sys.argv[i]) for i in range(3, 11)]
    except ValueError:
        log("Error: coordinates must be numbers")
        sys.exit(2)
    if len(coords) != 8:
        log("Error: exactly 8 coordinates (4 points x,y) required")
        sys.exit(2)
    pts = np.array([[coords[i], coords[i + 1]] for i in range(0, 8, 2)], dtype=np.float32)
    if pts.shape[0] != 4:
        log("Error: exactly 4 points required")
        sys.exit(2)

    log(f"[crop_perspective] input={input_path} output={output_path}")
    img = cv2.imread(input_path)
    if img is None:
        log(f"Error: could not read image {input_path}")
        sys.exit(3)
    h, w = img.shape[:2]
    pts_ordered = order_points(pts)
    log(f"[crop_perspective] points ordered to TL, TR, BR, BL")

    # Output size: max of top/bottom width and left/right height
    (tl, tr, br, bl) = pts_ordered
    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    out_w = int(max(width_top, width_bottom))
    out_h = int(max(height_left, height_right))
    if out_w < 1 or out_h < 1:
        log("Error: invalid crop size")
        sys.exit(4)
    log(f"[crop_perspective] output size {out_w}x{out_h}")

    pts_dst = np.array(
        [[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(pts_ordered, pts_dst)
    warped = cv2.warpPerspective(img, M, (out_w, out_h), flags=cv2.INTER_LINEAR)
    if not cv2.imwrite(output_path, warped):
        log(f"Error: could not write {output_path}")
        sys.exit(5)
    log(f"[crop_perspective] done")


if __name__ == "__main__":
    main()
