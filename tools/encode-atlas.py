"""Build-only lossless PNG -> WebP. Keep transparent RGB and verify decoded pixels."""
import io
import sys
from PIL import Image

source = Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
output = io.BytesIO()
source.save(output, format='WEBP', lossless=True, method=6, exact=True)
data = output.getvalue()
if Image.open(io.BytesIO(data)).convert('RGBA').tobytes() != source.tobytes():
    raise RuntimeError('Lossless atlas round trip changed pixels')
sys.stdout.buffer.write(data)
