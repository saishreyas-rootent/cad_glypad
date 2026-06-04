from pdf2image import convert_from_path
import os, numpy as np
from skimage import io


dest_DIR='tests'
file_path='tests/Gripper.pdf'
filename=os.path.splitext(os.path.basename(file_path))[0]
img = convert_from_path(file_path)
img = np.array(img[0])

io.imsave(os.path.join(dest_DIR, filename+'.jpg'),img)