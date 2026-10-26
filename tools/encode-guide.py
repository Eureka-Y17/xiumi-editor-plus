# Encode captured UI frames; developer tool requiring Pillow.
from pathlib import Path
from PIL import Image
import json
out=Path('public/guide');out.mkdir(parents=True,exist_ok=True)
for folder in Path('.output/guide-frames').iterdir():
 frames=[]
 for p in sorted(folder.glob('*.png')):
  im=Image.open(p).convert('RGB');im=im.resize((1200,round(im.height*1200/im.width)),Image.Resampling.LANCZOS)
  frames.append(im)
 if not frames:continue
 frames[0].save(out/(folder.name+'.png'))
 converted=[im.quantize(colors=128) for im in frames]
 converted[0].save(out/(folder.name+'.gif'),save_all=True,append_images=converted[1:],duration=json.loads((folder/'durations.json').read_text()),loop=0,disposal=2,optimize=True)
 print(folder.name,len(frames),(out/(folder.name+'.gif')).stat().st_size)
