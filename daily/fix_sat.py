"""เติมภาพดาวเทียม (ภาพที่ 7) ให้ชุดรายงานของวันที่ระบุ: python daily/fix_sat.py 2026-11-23"""
import sys, os, io, json, datetime, requests
from PIL import Image
iso = sys.argv[1]; d = datetime.date.fromisoformat(iso); ymd = d.strftime('%Y%m%d')
out = os.path.join('line', 'daily', iso)
prev = (d - datetime.timedelta(days=1)).strftime('%Y%m%d')
tries = [(ymd, h) for h in ['0700', '0600', '0500', '0400', '0300', '0200', '0100', '0000']] + [(prev, h) for h in ['2300', '2200', '2100']]
data = None
for day, hh in tries:
    try:
        r = requests.get('https://satda.tmd.go.th/wp-content/uploads/data/%s/%s%s_sat.jpg' % (day, day, hh), timeout=40,
                         headers={'User-Agent': 'Mozilla/5.0'})
        if r.ok and len(r.content) > 10000: data = r.content; print('got', day, hh); break
        print('miss', day, hh, r.status_code)
    except Exception as e: print('err', day, hh, e)
if not data: sys.exit('ไม่พบภาพดาวเทียม')
im = Image.open(io.BytesIO(data)); im.load()
open(os.path.join(out, '7.jpg'), 'wb').write(data)
pv = im.convert('RGB'); pv.thumbnail((1024, 1024)); pv.save(os.path.join(out, '7_pv.jpg'), quality=85)
sp = os.path.join(out, 'status.json')
if os.path.exists(sp):
    st = json.load(open(sp, encoding='utf-8')); st.get('errors', {}).pop('7.jpg', None); st['images'] = st.get('images', 0) + 1
    json.dump(st, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ip = os.path.join(out, 'index.html')
if os.path.exists(ip):
    s = open(ip, encoding='utf-8').read(); card = '<a href="7.jpg"><img loading=lazy src="7_pv.jpg"></a>'
    if card not in s and '<a href="8.jpg">' in s: s = s.replace('<a href="8.jpg">', card + '<a href="8.jpg">', 1)
    open(ip, 'w', encoding='utf-8').write(s)
