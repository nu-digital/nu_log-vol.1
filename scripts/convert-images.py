"""Convert local originals to lossless WebP. Requires Pillow; keeps originals."""
from pathlib import Path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor
import hashlib,json

root=Path(__file__).resolve().parent.parent

def convert(item):
    original=root/item['file']
    target=original.with_suffix('.webp')
    with Image.open(original) as image:
        pixels=image.convert('RGBA')
        options={key:image.info[key] for key in ('icc_profile','exif') if key in image.info}
        valid=False
        if target.exists():
            try:
                with Image.open(target) as cached:
                    valid=cached.size==image.size and cached.convert('RGBA').tobytes()==pixels.tobytes()
            except OSError:
                pass
        if not valid:
            temporary=target.with_suffix('.webp.tmp')
            pixels.save(temporary,format='WEBP',lossless=True,quality=75,method=4,exact=True,**options)
            temporary.replace(target)
        with Image.open(target) as check:
            assert check.size==image.size,original.name
            assert check.convert('RGBA').tobytes()==pixels.tobytes(),original.name
        return {'original':item['file'],'file':target.relative_to(root).as_posix(),'originalBytes':original.stat().st_size,'bytes':target.stat().st_size,'width':pixels.width,'height':pixels.height,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'pixelsIdentical':True}

if __name__=='__main__':
    inventory=json.loads((root/'reports/images.json').read_text(encoding='utf-8-sig'))
    inventory=[item for item in inventory if Path(item['file']).suffix!='.webp']
    results=[]
    with ProcessPoolExecutor(max_workers=4) as pool:
        for item in pool.map(convert,inventory):
            results.append(item)
            print(item['file'],flush=True)
    (root/'reports/image-conversion-local.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'images':len(results),'originalBytes':sum(x['originalBytes'] for x in results),'webpBytes':sum(x['bytes'] for x in results)}))
