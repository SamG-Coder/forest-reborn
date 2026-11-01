"""Pack generated artwork without altering the original face pixels."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
face = Image.open(root / 'public/assets/warrior-face.png').convert('RGB')
ear = Image.open(root / 'public/assets/male-ear.png').convert('RGB').resize(face.size)
atlas = Image.new('RGB', (face.width * 2, face.height))
atlas.paste(face, (0, 0))
atlas.paste(ear, (face.width, 0))
atlas.save(root / 'public/assets/male-head-atlas.png')
assert atlas.crop((0, 0, face.width, face.height)).tobytes() == face.tobytes()
print('Packed face + ear atlas; original face pixels preserved exactly.')
