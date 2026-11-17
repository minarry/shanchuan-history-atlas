import os,json
from PIL import Image,ImageOps,ImageDraw,ImageEnhance
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
Image.MAX_IMAGE_PIXELS=None
W,S,E,N=65,8,145,60
im=Image.open(ROOT+'/.cache/relief/SR_HR.tif')
w,h=im.size
im=im.crop((round((W+180)/360*w),round((90-N)/180*h),round((E+180)/360*w),round((90-S)/180*h))).convert('L')
width,height=im.size
mask=Image.new('L',im.size,0); draw=ImageDraw.Draw(mask)
land=json.load(open(ROOT+'/.cache/land.geojson'))
def xy(r):return [((x-W)/(E-W)*width,(N-y)/(N-S)*height) for x,y,*_ in r]
for f in land['features']:
    g=f['geometry'];polys=g['coordinates'] if g['type']=='MultiPolygon' else [g['coordinates']]
    for p in polys:
        draw.polygon(xy(p[0]),fill=255)
        for r in p[1:]:draw.polygon(xy(r),fill=0)
im=ImageEnhance.Contrast(im).enhance(1.35)
terrain=ImageOps.colorize(im,black='#697466',white='#e9e7d5',mid='#b6b8a0')
ocean=Image.new('RGB',im.size,'#ccdcd9');ocean.paste(terrain,(0,0),mask)
ocean.save(ROOT+'/dist/assets/terrain.webp',quality=87)
def coords(g):
    def flat(a):
        if not a:return
        if isinstance(a[0],(int,float)):yield a
        else:
            for q in a:yield from flat(q)
    return list(flat(g['coordinates']))
def keep(f):return any(W-1<=p[0]<=E+1 and S-1<=p[1]<=N+1 for p in coords(f['geometry']))
for name in ['rivers','lakes']:
    data=json.load(open(ROOT+'/.cache/'+name+'.geojson'))
    features=[]
    for f in data['features']:
        if not keep(f):continue
        p=f['properties']
        f['properties']={k:p[k] for k in ['name','name_zh','scalerank','min_zoom'] if k in p}
        features.append(f)
    with open(ROOT+'/dist/data/'+name+'.geojson','w') as o:json.dump({'type':'FeatureCollection','features':features},o,separators=(',',':'))
with open(ROOT+'/dist/data/terrain.json','w') as o:json.dump({'bounds':[[S,W],[N,E]],'width':width,'height':height,'source':'Natural Earth 1:10m Shaded Relief (SR_HR), SRTM Plus-derived','license':'Public domain','url':'https://www.naturalearthdata.com/downloads/10m-raster-data/10m-shaded-relief/','note':'现代地貌与河道固定底图；原始全球栅格21600×10800，约2公里像素量级；不代表古河道与古海岸线。'},o,ensure_ascii=False)
print('Terrain built',width,height,os.path.getsize(ROOT+'/dist/assets/terrain.webp'))
