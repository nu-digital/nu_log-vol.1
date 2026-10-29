from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
import pdfplumber,json,logging; logging.disable(logging.WARNING)
files=sorted(Path('tmp/pdfs').glob('proof-*.jpg'))
for start in range(0,len(files),16):
    batch=files[start:start+16]
    canvas=Image.new('RGB',(1000,((len(batch)+3)//4)*355),'#dedede')
    draw=ImageDraw.Draw(canvas)
    for i,p in enumerate(batch):
        canvas.paste(ImageOps.contain(Image.open(p),(230,325)),((i%4)*250,(i//4)*355))
        draw.text(((i%4)*250+5,(i//4)*355+330),p.stem,fill='black')
    canvas.save(f'tmp/pdfs/proof-contact-{start//16}.jpg')
with pdfplumber.open('output/pdf/nu_log.pdf') as pdf:
    rows=[]
    for i,p in enumerate(pdf.pages):
        text=p.extract_text() or ''
        rows.append({'page':i+1,'characters':len(text),'images':len(p.images),'text':text,'size':[p.width,p.height]})
    Path('reports/pdf-pages.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    print('Pages:',len(rows))
    print('Sparse pages:',[(r['page'],r['characters'],r['images']) for r in rows if r['characters']<250])


