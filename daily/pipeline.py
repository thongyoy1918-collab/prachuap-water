# -*- coding: utf-8 -*-
"""รายงานน้ำประจำวัน คป.ประจวบฯ — สร้างชุดส่ง LINE บนคลาวด์ (GitHub Actions)
ข้อมูลเข้า: ไฟล์ .xlsx  หรือ  payload.json {"s1":{เซลล์ชีต 1.0}, "sr":{เซลล์ชีต รวม}} ที่บอท LINE ส่งมา
ผลลัพธ์: line/daily/<วันที่>/ (ภาพ 1–9, 11–15, PDF) + line/latest.json (ข้อความ → ภาพ → PDF)
ใช้: python daily/pipeline.py <xlsx|payload.json> [run_id]
"""
import sys, os, re, json, base64, asyncio, datetime, io, warnings
import requests
from PIL import Image
warnings.filterwarnings('ignore')
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
A = lambda f: os.path.join(HERE, 'assets', f)
REPO_RAW = 'https://raw.githubusercontent.com/thongyoy1918-collab/prachuap-water/main/'
PAGES = 'https://thongyoy1918-collab.github.io/prachuap-water/'
TH_M = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
TH_S = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
EN_M = ['', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36'}

# ---------------- ข้อมูล ----------------
def cells_from_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, data_only=True)
    def grab(ws, r0, r1, c1):
        out = {}
        for row in ws.iter_rows(min_row=r0, max_row=r1, max_col=c1):
            for c in row:
                v = c.value
                if isinstance(v, datetime.datetime): v = (v - datetime.datetime(1899, 12, 30)).days
                if isinstance(v, (int, float)) and not isinstance(v, bool): out[c.coordinate] = v
        return out
    return {'s1': grab(wb['1.0'], 1, 19, 26), 'sr': grab(wb['รวม'], 1, 26, 22)}

def build_D(P):
    s1, sr = P['s1'], P['sr']
    t10 = {k: v for k, v in s1.items() if 10 <= int(re.sub(r'\D', '', k)) <= 19 and re.match(r'[E-Z]\d', k)}
    n = lambda k: sr.get(k) or 0
    rows = {'ปราณบุรี': 7, 'ไทรงาม': 9, 'มงคล': 10, 'ยางชุม': 11, 'วังเต็น': 12, 'คลองบึง': 13, 'อ่างหิน': 14,
            'ช่องลม': 15, 'จะกระ': 16, 'สามร้อยยอด': 17, 'บางสะพาน': 18, 'บางสะพานน้อย': 19}
    rain = {k: [n('L%d' % r), n('F%d' % r), n('U%d' % r) + n('F%d' % r)] for k, r in rows.items()}
    g = {k: dict(lv=sr.get('B%d' % r), q=sr.get('C%d' % r), ylv=sr.get('I%d' % r))
         for k, r in {'KY3': 21, 'GT7': 22, 'GT20': 24, 'GT9': 25, 'GT10': 26}.items()}
    d = datetime.date(1899, 12, 30) + datetime.timedelta(days=int(sr['B3']))
    return dict(iso=d.isoformat(), t10=t10, rain=rain, g=g), d

# ---------------- ข้อความ LINE ----------------
def line_text(D, d):
    t = D['t10']; f = lambda k: float(t.get(k) or 0)
    txt = open(A('line_template.txt'), encoding='utf-8-sig').read()
    by = d.year + 543
    txt = re.sub(r'ประจำวันที่\s+\d+\s+\S+\s+\d{4}', 'ประจำวันที่  %d %s  %d' % (d.day, TH_M[d.month], by), txt, count=1)
    txt = re.sub(r'\d+ \S+\.\S*\s?\d{2} \(08\.00\)', '%d %s %d (08.00)' % (d.day, TH_S[d.month], by % 100), txt)
    vals = {'ปริมาณน้ำ ': [], 'คิดเป็น': [], 'inflow': [], 'outflow': [], 'ปริมาณฝน': []}
    for r in range(11, 19):
        vals['ปริมาณน้ำ '].append('%.3f' % f('E%d' % r)); vals['คิดเป็น'].append('%.2f' % f('F%d' % r))
        vals['inflow'].append('%.3f' % max(f('I%d' % r), 0))
        vals['outflow'].append('%.3f' % sum(f(c + str(r)) for c in 'JLPR'))
        vals['ปริมาณฝน'].append('%.1f' % f('X%d' % r))
    cnt = {k: 0 for k in vals}; out = []
    for line in txt.split('\n'):
        for k in vals:
            if line.startswith('-' + k) and not line.startswith('-ปริมาณน้ำเก็บกัก') and cnt[k] < len(vals[k]):
                line = re.sub(r'-?\d+(\.\d+)?', vals[k][cnt[k]], line, count=1); cnt[k] += 1; break
        out.append(line)
    return '\n'.join(out)

# ---------------- ภาพจากเว็บ ----------------
def get(u, **kw):
    r = requests.get(u, headers=UA, timeout=40, **kw); r.raise_for_status(); return r

def save_img(path, data):
    Image.open(io.BytesIO(data)).verify()   # ต้องเป็นภาพจริง
    open(path, 'wb').write(data)

def web_images(d, out):
    ymd = d.strftime('%Y%m%d'); err = {}
    def tmd(kind, name):
        page = 'https://www.tmd.go.th/forecast/' + ('daily' if kind == 'daily' else 'heavyrainriskarea')
        try:
            m = re.search(r'(?:https://www\.tmd\.go\.th)?/media/forecast/daily-graphic/' + kind + r'-[^"\'\s?]+\.png', get(page).text)
            if m:
                u = m.group(0); u = u if u.startswith('http') else 'https://www.tmd.go.th' + u
                return get(u).content
        except Exception: pass
        for hh in ['0600', '0500', '0400', '1200', '1800', '0000']:
            try: return get('https://www.tmd.go.th/media/forecast/daily-graphic/%s-%d-%s-%d-%s.png' % (kind, d.day, EN_M[d.month], d.year, hh)).content
            except Exception: pass
        raise RuntimeError('ไม่พบภาพ')
    def sat():
        prev = (d - datetime.timedelta(days=1)).strftime('%Y%m%d')
        tries = [(ymd, h) for h in ['0700', '0600', '0500', '0400', '0300', '0200', '0100', '0000']] + [(prev, h) for h in ['2300', '2200', '2100']]
        for day, hh in tries:
            try:
                b = get('https://satda.tmd.go.th/wp-content/uploads/data/%s/%s%s_sat.jpg' % (day, day, hh)).content
                if len(b) > 10000: return b
            except Exception: pass
        raise RuntimeError('ไม่พบภาพดาวเทียม')
    jobs = {'5.png': lambda: tmd('daily', 5), '6.png': lambda: tmd('risk', 6), '7.jpg': sat,
            '8.jpg': lambda: get('https://weather.tmd.go.th/ryg/ryg240_latest.jpg').content}
    for name, fn in jobs.items():
        try: save_img(os.path.join(out, name), fn())
        except Exception as e: err[name] = str(e)
    try:
        lst = get('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain7day_forecast').json()['data']['pre_rain']['data']
        for i in range(3):
            u = 'https://api-v3.thaiwater.net/api/v1/thaiwater30//shared/image?_csrf=&image=' + requests.utils.quote(lst[i]['media_path'], safe='')
            save_img(os.path.join(out, '%d.jpg' % (11 + i)), get(u).content)
    except Exception as e: err['11-13'] = str(e)
    return err

def rain24():
    j = get('https://api-v3.thaiwater.net/api/v1/thaiwater30/public/rain_24h?province_code=77').json()
    out = []
    for x in j.get('data') or []:
        st = x.get('station') or {}; g = x.get('geocode') or {}
        th = lambda o: (o or {}).get('th', '') if isinstance(o, dict) else ''
        lat = next((st[k] for k in st if 'lat' in k.lower()), None); lon = next((st[k] for k in st if 'long' in k.lower() or 'lon' in k.lower()), None)
        v = float(x.get('rain_24h') or 0)
        tm = (re.search(r'(\d{2}:\d{2})', str(x.get('rainfall_datetime') or '')) or [None, ''])[1]
        if v > 0 and th(st.get('tele_station_name')) and lat and lon:
            out.append(dict(lat=float(lat), lon=float(lon), st=th(st.get('tele_station_name')),
                            loc='ต.%s อ.%s' % (th(g.get('tumbon_name')), th(g.get('amphoe_name'))), t=tm, v=v))
    out.sort(key=lambda r: -r['v'])
    return out

# ---------------- ภาพที่วาดเอง ----------------
def b64(p): return base64.b64encode(open(p, 'rb').read()).decode()

def render_html(D, RAIN):
    fonts = ''.join("@font-face{font-family:'Sarabun';font-weight:%s;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s;}" % (o['w'], o['b64'], o['r'])
                    for o in json.load(open(A('sarabun.json'))))
    tpl = {str(i): 'data:image/jpeg;base64,' + b64(A('t%d.jpg' % i)) for i in range(1, 5)}
    return ('<!doctype html><html><head><meta charset=utf-8><style>%s</style></head><body>'
            '<div style="font-family:Sarabun">ก <b>ข</b> <span style=font-weight:600>ค</span></div><script>%s</script><script>'
            'var TPL=%s, D=%s, RAIN=%s, BASE=%s;'
            'function loadImg(s){return new Promise(function(o,n){var i=new Image();i.onload=function(){o(i)};i.onerror=n;i.src=s;});}'
            "window.run=async function(){await Promise.all(['400 15px Sarabun','600 20px Sarabun','700 20px Sarabun'].map(function(f){return document.fonts.load(f)}));"
            "var out={};for(var n=1;n<=4;n++){out[n]=RR.render(n,await loadImg(TPL[n]),JSON.parse(JSON.stringify(D)),'Sarabun').toDataURL('image/jpeg',0.95);}"
            "out[9]=(await RR9.render(RAIN,D.iso,BASE,'Sarabun')).toDataURL('image/jpeg',0.95);return out;};</script></body></html>") % (
        fonts, open(A('rr.js'), encoding='utf-8').read(), json.dumps(tpl), json.dumps(D, ensure_ascii=False),
        json.dumps(RAIN, ensure_ascii=False), open(A('basemap.json')).read())

def onesheet_html(D, d):
    t = D['t10']; pos = json.load(open(A('positions.json'), encoding='utf-8'))
    res = [('เขื่อนปราณบุรี', 'ปราณบุรี', 391, 10, 'ปราณบุรี'), ('ห้วยไทรงาม', 'หัวหิน', 9.75, 11, 'ไทรงาม'), ('ห้วยมงคล', 'หัวหิน', 5.85, 12, 'มงคล'),
           ('ยางชุม', 'กุยบุรี', 41.1, 13, 'ยางชุม'), ('ห้วยวังเต็น', 'กุยบุรี', 11.4, 14, 'วังเต็น'), ('คลองบึง', 'เมืองฯ', 22.2, 15, 'คลองบึง'),
           ('ห้วยอ่างหิน', 'เมืองฯ', 2.8, 16, 'อ่างหิน'), ('คลองช่องลม', 'ทับสะแก', 5.5, 17, 'ช่องลม'), ('คลองจะกระ', 'ทับสะแก', 10.4, 18, 'จะกระ')]
    R = [dict(size=('l' if cap > 100 else 'm'), n=nm, a=a, cap=cap, s=t['E%d' % r], p=t['F%d' % r], room=t['H%d' % r],
              inf=max(0, t.get('I%d' % r) or 0), out=sum((t.get(c + str(r)) or 0) for c in 'JLNPR'),
              lat=pos[k][0], lon=pos[k][1], rain=D['rain'][k]) for nm, a, cap, r, k in res]
    G = [('GT7', 'Gt.7', 'คลองบางสะพาน', 'บ้านวังยาง', 7.5), ('GT20', 'Gt.20', 'คลองบางสะพาน', 'อ.บางสะพาน', 6), ('KY3', 'Ky.3', 'คลองกุยบุรี', 'บ้านทุ่งแฝก', 4.4),
         ('GT9', 'Gt.9', 'คลองทับสะแก', 'บ้านกลาง', 4), ('GT10', 'Gt.10', 'คลองกรูด', 'บ้านหนองหญ้าปล้อง', 3.5)]
    g = [dict(c=c, n=nm, p=pl, bank=b, **D['g'][k]) for k, c, nm, pl, b in G]
    order = ['ไทรงาม', 'มงคล', 'ปราณบุรี', 'สามร้อยยอด', 'ยางชุม', 'วังเต็น', 'คลองบึง', 'อ่างหิน', 'ช่องลม', 'จะกระ', 'บางสะพาน', 'บางสะพานน้อย']
    rain = [dict(n=k, y=D['rain'][k][0], t=D['rain'][k][1], c=D['rain'][k][2], lat=pos[k][0], lon=pos[k][1]) for k in order]
    data = dict(R=R, g=g, rain=rain, tot=dict(s=t['E19'], p=t['F19'], inf=t['I19'], out=sum(x['out'] for x in R), room=t['H19']))
    ff = ''.join("@font-face{font-family:'%s';font-weight:%s;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s;}" % (o['fam'], o['w'], o['b64'], o['r'])
                 for o in json.load(open(A('f2.json'))))
    html = open(A('onesheet.html'), encoding='utf-8').read()
    for k, v in [('/*FONT*/', ff), ('__DATA__', json.dumps(data, ensure_ascii=False)), ('__LOGO__', 'data:image/png;base64,' + b64(A('rid_logo_w.png'))),
                 ('__PROV__', open(A('prov.json')).read()), ('__GEO__', open(A('geo.json')).read()),
                 ('__TERR__', 'data:image/webp;base64,' + b64(A('terrain.webp'))), ('__DATE__', '%d %s %d' % (d.day, TH_S[d.month], d.year + 543))]:
        html = html.replace(k, v)
    return html

async def render_all(D, d, RAIN, out, tmp):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') and not os.environ.get('CI') else None
        b = await p.chromium.launch(executable_path=exe) if exe else await p.chromium.launch()
        h1 = os.path.join(tmp, 'r.html'); open(h1, 'w', encoding='utf-8').write(render_html(D, RAIN))
        pg = await b.new_page(); await pg.goto('file://' + h1); await pg.wait_for_timeout(300)
        res = await pg.evaluate('run()')
        for k, v in res.items(): open(os.path.join(out, '%s.jpg' % k), 'wb').write(base64.b64decode(v.split(',')[1]))
        await pg.close()
        h2 = os.path.join(tmp, 'o.html'); open(h2, 'w', encoding='utf-8').write(onesheet_html(D, d))
        pg = await b.new_page(viewport={'width': 1920, 'height': 1600}, device_scale_factor=2)
        await pg.goto('file://' + h2); await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(800)
        els = await pg.query_selector_all('.pg')
        await els[-4].screenshot(path=os.path.join(tmp, '14.png')); await els[1].screenshot(path=os.path.join(tmp, '15.png'))
        for n in (14, 15): Image.open(os.path.join(tmp, '%d.png' % n)).convert('RGB').save(os.path.join(out, '%d.jpg' % n), quality=92)
        await b.close()

# ---------------- หน้าเว็บของวัน ----------------
def write_page(out, iso, d, text, order):
    import zipfile, html as H
    have = [f for f in order if os.path.exists(os.path.join(out, f))]
    zname = 'รายงานน้ำ_%s.zip' % iso
    with zipfile.ZipFile(os.path.join(out, 'images.zip'), 'w', zipfile.ZIP_STORED) as z:
        for f in have: z.write(os.path.join(out, f), 'ภาพ%s%s' % (f.split('.')[0].zfill(2), os.path.splitext(f)[1]))
        if os.path.exists(os.path.join(out, 'report_1-4.pdf')): z.write(os.path.join(out, 'report_1-4.pdf'), 'รายงานภาพ1-4_%s.pdf' % iso)
    page_url = PAGES + 'line/daily/%s/' % iso
    title = '%d %s %d' % (d.day, TH_M[d.month], d.year + 543)
    cards = ''.join('<figure><a href="%s" target=_blank><img loading=lazy src="%s"></a><figcaption>ภาพที่ %s <a href="%s" download>⬇︎ บันทึก</a></figcaption></figure>'
                    % (f, f.split('.')[0] + '_pv.jpg', f.split('.')[0], f) for f in have)
    page = """<!doctype html><html lang=th><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>รายงานน้ำประจำวัน %(iso)s</title><style>
body{font-family:system-ui,sans-serif;margin:0;background:#eef2f6;color:#0f2a4a}header{background:#0f2a4a;color:#fff;padding:14px 16px}
h1{font-size:18px;margin:0}main{max-width:960px;margin:auto;padding:12px}.bar{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 14px}
.b{display:inline-flex;align-items:center;gap:6px;padding:11px 16px;border:0;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;color:#fff}
.copy{background:#06c755}.sh{background:#e8590c}.b:disabled{opacity:.6}.dl{background:#1a73e8}.pdf{background:#5b6b7f}.share{background:#00a64f}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}figure{margin:0;background:#fff;border-radius:8px;overflow:hidden}
figure img{width:100%%;display:block}figcaption{display:flex;justify-content:space-between;padding:6px 10px;font-size:13px}figcaption a{color:#1a73e8;text-decoration:none}
h2{font-size:16px;margin:18px 0 6px}pre{white-space:pre-wrap;background:#fff;padding:12px;border-radius:8px;font-size:14px;font-family:inherit}
#t{position:fixed;left:50%%;bottom:24px;transform:translateX(-50%%);background:#0f2a4a;color:#fff;padding:10px 16px;border-radius:8px;opacity:0;transition:.3s}#t.on{opacity:1}
</style></head><body><header><h1>รายงานสถานการณ์น้ำประจำวัน คป.ประจวบคีรีขันธ์ — %(title)s</h1></header><main>
<div class=bar>
<button class="b sh" id=shb onclick="shareAll()" disabled>⏳ กำลังเตรียมภาพ…</button>
<button class="b copy" onclick="cp()">📋 คัดลอกข้อความส่ง LINE</button>
<a class="b dl" href="images.zip" download="%(zname)s">⬇︎ ดาวน์โหลดภาพทั้งหมด (.zip)</a>
<a class="b pdf" href="report_1-4.pdf" target=_blank>📄 PDF ภาพ 1–4</a>
<a class="b share" href="https://line.me/R/share?text=%(share)s">💬 แชร์ลิงก์นี้ใน LINE</a>
</div>
<div class=g>%(cards)s</div>
<h2>ข้อความส่ง LINE</h2><pre id=msg>%(text)s</pre></main><div id=t></div>
<script>
function toast(s){var t=document.getElementById('t');t.textContent=s;t.className='on';setTimeout(function(){t.className=''},2000)}
var SH=%(shfiles)s, FILES=null;
(function(){var bt=document.getElementById('shb');
 if(!(navigator.canShare&&window.File)){bt.textContent='📤 แชร์ข้อความ+ภาพ 1–13';bt.disabled=false;return;}
 Promise.all(SH.map(function(f){return fetch(f).then(function(r){return r.blob()}).then(function(b){return new File([b],'ภาพ'+f.split('.')[0]+'.'+f.split('.')[1],{type:b.type||'image/jpeg'})})}))
 .then(function(fs){FILES=fs;bt.textContent='📤 แชร์ข้อความ+ภาพ 1–13';bt.disabled=false})
 .catch(function(){bt.textContent='📤 แชร์ข้อความ+ภาพ 1–13';bt.disabled=false})})();
function shareAll(){var s=document.getElementById('msg').innerText;
 if(!(FILES&&navigator.canShare&&navigator.canShare({files:FILES}))){toast('เบราว์เซอร์นี้แชร์ภาพไม่ได้ ให้เปิดหน้านี้ใน Chrome หรือ Safari');return;}
 try{navigator.clipboard&&navigator.clipboard.writeText(s)}catch(e){}
 navigator.share({files:FILES,text:s}).then(function(){toast('แชร์แล้ว — ถ้าข้อความไม่ติดไป ให้กดวางในแชต (คัดลอกไว้ให้แล้ว)')}).catch(function(){});}
function cp(){var s=document.getElementById('msg').innerText;
 if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(s).then(function(){toast('คัดลอกข้อความแล้ว')},fb)}else fb();
 function fb(){var a=document.createElement('textarea');a.value=s;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();a.setSelectionRange(0,s.length);
  var ok=false;try{ok=document.execCommand('copy')}catch(e){}document.body.removeChild(a);toast(ok?'คัดลอกข้อความแล้ว':'กดค้างที่ข้อความด้านล่างเพื่อคัดลอก')}}
</script></body></html>""" % dict(iso=iso, title=title, zname=zname, cards=cards, text=H.escape(text), shfiles=json.dumps([f for f in have if int(f.split('.')[0]) <= 13]),
                       share=requests.utils.quote('รายงานสถานการณ์น้ำประจำวัน คป.ประจวบฯ %s\n%s' % (title, page_url), safe=''))
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(page)

# ---------------- หลัก ----------------
def main(src, run_id='local'):
    P = json.load(open(src, encoding='utf-8')) if src.endswith('.json') else cells_from_xlsx(src)
    D, d = build_D(P); iso = D['iso']
    out = os.path.join(ROOT, 'line', 'daily', iso); os.makedirs(out, exist_ok=True)
    tmp = os.path.join(ROOT, '.tmp_daily'); os.makedirs(tmp, exist_ok=True)
    text = line_text(D, d); open(os.path.join(out, 'line_text.txt'), 'w', encoding='utf-8').write(text)
    err = web_images(d, out)
    try: RAIN = rain24()
    except Exception as e: RAIN = []; err['rain24'] = str(e)
    asyncio.run(render_all(D, d, RAIN, out, tmp))
    # PDF ภาพ 1–4
    pages = [Image.open(os.path.join(out, '%d.jpg' % i)).convert('RGB') for i in range(1, 5)]
    pages[0].save(os.path.join(out, 'report_1-4.pdf'), save_all=True, append_images=pages[1:], resolution=200)
    order = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.png', '6.png', '7.jpg', '8.jpg', '9.jpg', '11.jpg', '12.jpg', '13.jpg', '14.jpg', '15.jpg']
    # ส่ง LINE แบบประหยัดโควตา: 3 ข้อความ = ข้อความรายงาน + การ์ดเลื่อนดู 2 ชุด (กดการ์ด = เปิดภาพเต็ม)
    base = REPO_RAW + 'line/daily/%s/' % iso
    page_url = PAGES + 'line/daily/%s/' % iso
    pdf_url = PAGES + 'line/daily/%s/report_1-4.pdf' % iso
    thd = '%d %s %d' % (d.day, TH_S[d.month], (d.year + 543) % 100)
    def bubble(f):
        p = os.path.join(out, f); stem = f.split('.')[0]
        im = Image.open(p); w, h = im.size
        pv = im.convert('RGB'); pv.thumbnail((1024, 1024)); pv.save(os.path.join(out, stem + '_pv.jpg'), quality=85)
        r = max(1 / 3, min(3, w / h)); ar = '%d:%d' % (round(r * 100), 100)
        return {'type': 'bubble', 'size': 'giga',
                'hero': {'type': 'image', 'url': base + stem + '_pv.jpg', 'size': 'full', 'aspectRatio': ar, 'aspectMode': 'fit',
                         'action': {'type': 'uri', 'label': 'ดูภาพเต็ม', 'uri': base + f}},
                'footer': {'type': 'box', 'layout': 'horizontal', 'paddingAll': '8px', 'contents': [
                    {'type': 'text', 'text': 'ภาพที่ %s' % stem, 'size': 'sm', 'color': '#0f2a4a', 'weight': 'bold', 'flex': 1},
                    {'type': 'text', 'text': 'แตะเพื่อดูภาพเต็ม', 'size': 'xs', 'color': '#888888', 'align': 'end', 'flex': 2}]}}
    have = [f for f in order if os.path.exists(os.path.join(out, f))]
    first = [f for f in have if int(f.split('.')[0]) <= 9]
    second = [f for f in have if int(f.split('.')[0]) > 9]
    links = {'type': 'bubble', 'size': 'giga', 'body': {'type': 'box', 'layout': 'vertical', 'spacing': 'md', 'contents': [
        {'type': 'text', 'text': 'รายงานน้ำประจำวัน %s' % thd, 'weight': 'bold', 'size': 'lg', 'color': '#0f2a4a', 'wrap': True},
        {'type': 'text', 'text': 'คป.ประจวบคีรีขันธ์', 'size': 'sm', 'color': '#666666'},
        {'type': 'button', 'style': 'primary', 'color': '#1a73e8', 'action': {'type': 'uri', 'label': '📄 PDF รายงานภาพ 1–4', 'uri': pdf_url}},
        {'type': 'button', 'style': 'secondary', 'action': {'type': 'uri', 'label': 'ดูรายงานทั้งหมด', 'uri': page_url}}]}}
    def carousel(files, extra, alt):
        return {'type': 'flex', 'altText': alt, 'contents': {'type': 'carousel', 'contents': [bubble(f) for f in files] + extra}}
    msgs = [dict(type='text', text=text)]
    if first: msgs.append(carousel(first, [], 'ภาพรายงาน 1–9 วันที่ %s' % thd))
    msgs.append(carousel(second, [links], 'ภาพรายงาน 11–15 และ PDF วันที่ %s' % thd))
    # หน้าเว็บรวมรายงานของวัน (คัดลอกข้อความ / ดาวน์โหลดภาพทั้งหมด / แชร์ลิงก์)
    write_page(out, iso, d, text, order)
    feed = 'test_latest.json' if os.environ.get('NOSEND') else 'latest.json'   # ทดสอบ: ไม่ส่งเข้า LINE
    feed_obj = dict(id='daily-%s-%s' % (iso, run_id), messages=msgs)
    if P.get('to'): feed_obj['to'] = P['to']   # ส่งกลับแชตที่ส่งไฟล์มา
    json.dump(feed_obj, open(os.path.join(ROOT, 'line', feed), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(dict(iso=iso, errors=err, images=len(have)), open(os.path.join(out, 'status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('OK', iso, 'images', len(have), 'messages', len(msgs), 'errors', err)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'local')
