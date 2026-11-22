/* ภาพรายงาน 1–4: เอาภาพแม่แบบ (ภาพของวันก่อน) มาลบตัวเลขเก่าแล้วเขียนค่าวันนี้ทับ
 * RR.render(n, img, D, font) -> canvas (ขยาย 2 เท่า)
 * D = { iso, t10:{E10..Y19}, rain:{k:[เมื่อวาน,วันนี้,สะสม]}, g:{KY3:{lv,q,ylv},...} }
 */
var RR = (function () {
  var TH_M = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var EN_S = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var K = 2, FONT = 'Sarabun';
  function num(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function fx(v, n) { return num(v).toFixed(n); }
  function dash(v, n) { return Math.abs(num(v)) < 0.0005 ? '-' : fx(v, n); }
  function gen(v) { var x = Math.round(num(v) * 1000) / 1000; return Math.abs(x) < 0.0005 ? '-' : String(x); }
  function pctColor(p) { return p <= 30 ? '#ffff00' : p <= 50 ? '#00e400' : p <= 80 ? '#66ffff' : '#ff0000'; }
  function date(iso, off) { var p = iso.split('-').map(Number); var d = new Date(p[0], p[1] - 1, p[2] + (off || 0)); return d; }
  function thDate(d) { return d.getDate() + ' ' + TH_M[d.getMonth() + 1] + ' ' + (d.getFullYear() + 543); }

  function setup(img) {
    var c = document.createElement('canvas'); c.width = img.naturalWidth * K; c.height = img.naturalHeight * K;
    var g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    g.scale(K, K); g.textBaseline = 'middle';
    return { c: c, g: g };
  }
  // สีพื้นหลังของช่อง (ค่ากลางของพิกเซลขอบซ้าย/ขวา)
  function bg(ctx, x0, y0, x1, y1) {
    var g = ctx.g, pts = [], ys = [y0 + 3, (y0 + y1) / 2, y1 - 3];
    ys.forEach(function (y) { [x0 + 3, x1 - 3].forEach(function (x) { var d = g.getImageData(Math.round(x * K), Math.round(y * K), 1, 1).data; pts.push([d[0], d[1], d[2]]); }); });
    var m = [0, 1, 2].map(function (i) { var a = pts.map(function (p) { return p[i]; }).sort(function (a, b) { return a - b; }); return a[Math.floor(a.length / 2)]; });
    return 'rgb(' + m.join(',') + ')';
  }
  function clear(ctx, x0, y0, x1, y1, color) { ctx.g.fillStyle = color || bg(ctx, x0, y0, x1, y1); ctx.g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  function text(ctx, s, x, y, o) {
    o = o || {}; var g = ctx.g;
    g.font = (o.w || 'normal') + ' ' + (o.size || 15) + 'px ' + FONT + ', Loma, sans-serif';
    g.fillStyle = o.color || '#000'; g.textAlign = o.align || 'center';
    if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || '#fff'; g.strokeText(s, x, y); }
    g.fillText(s, x, y);
  }
  // ลบแล้วเขียนในช่อง
  function cell(ctx, x0, y0, x1, y1, s, o) {
    o = o || {}; var pad = o.pad === undefined ? 2 : o.pad;
    clear(ctx, x0 + pad, y0 + pad, x1 - pad, y1 - pad, o.fill);
    if (s === '' || s === null || s === undefined) return;
    var al = o.align || (s === '-' ? 'center' : 'right');
    var x = al === 'right' ? x1 - 5 : al === 'left' ? x0 + 5 : (x0 + x1) / 2;
    text(ctx, s, x, (y0 + y1) / 2 + (o.dy || 1), { align: al, size: o.size, w: o.w, color: o.color, stroke: o.stroke, strokeColor: o.strokeColor });
  }

  // ---------- ภาพ 1 ตารางรายงาน ----------
  function img1(ctx, D) {
    var d = date(D.iso), t = D.t10;
    cell(ctx, 520, 86, 1080, 124, 'ประจำวัน' + TH_D[d.getDay()] + 'ที่ ' + thDate(d), { align: 'center', size: 21, w: '600', pad: 0 });
    // หัวคอลัมน์วันที่ฝน (ตั้ง)
    [[1450, 1494, -3], [1494, 1532, -2], [1532, 1570, -1]].forEach(function (h) {
      var dd = date(D.iso, h[2]), s = dd.getDate() + '-' + EN_S[dd.getMonth() + 1] + '-' + String(dd.getFullYear()).slice(2);
      var x0 = h[0] + 3, x1 = h[1] - 3; clear(ctx, x0, 262, x1, 362);
      var g = ctx.g; g.save(); g.translate((h[0] + h[1]) / 2 + 1, 312); g.rotate(-Math.PI / 2); text(ctx, s, 0, 0, { size: 14 }); g.restore();
    });
    var Y = [367, 398, 430, 461, 493, 524, 556, 587, 619, 650, 682];
    var C = [390, 461, 524, 572, 639, 721, 778, 843, 901, 966, 1023, 1088, 1148, 1208, 1273, 1330, 1390, 1450, 1494, 1532, 1570, 1625];
    // คอลัมน์: [ตัวอักษรในชีต 1.0, รูปแบบ]
    var spec = [['E', 3], ['F', 2], ['#', 0], ['H', 'g'], ['I', 3], ['J', 3], ['K', 2], ['L', 3], ['M', 2], ['N', 3], ['O', 2], ['P', 3], ['Q', 2], ['R', 3], ['S', 2], ['T', 3], ['U', 2], ['V', 2], ['W', 2], ['X', 2], ['Y', 2]];
    for (var i = 0; i < 10; i++) {
      var r = 10 + i, y0 = Y[i], y1 = Y[i + 1];
      spec.forEach(function (sp, j) {
        var x0 = C[j], x1 = C[j + 1], v = t[sp[0] + r], s;
        if (sp[0] === '#') { if (r < 19) clear(ctx, x0 + 2, y0 + 2, x1 - 2, y1 - 2, pctColor(num(t['F' + r]))); return; }
        if (sp[1] === 'g') s = gen(v);
        else if (/[VWXY]/.test(sp[0]) || sp[0] === 'E' || sp[0] === 'F') s = fx(v, sp[1]);
        else if (/[NO]/.test(sp[0]) && r !== 10 && r !== 19) s = '';
        else s = dash(v, r === 19 && /[KMOQSU]/.test(sp[0]) ? 3 : sp[1]);
        cell(ctx, x0, y0, x1, y1, s, { size: /[VWXY]/.test(sp[0]) ? 13 : 14 });
      });
    }
    // ตารางน้ำท่า
    var GY = [880, 912, 943, 975, 1006, 1038, 1069], GO = ['KY3', 'GT7B', 'GT7', 'GT20', 'GT9', 'GT10'];
    GO.forEach(function (k, i) {
      var g = D.g[k]; if (!g) return;
      var y0 = GY[i], y1 = GY[i + 1];
      cell(ctx, 524, y0, 639, y1, fx(g.q, 2), { align: 'center', size: 15, color: '#e00000' });
      cell(ctx, 721, y0, 966, y1, (g.lv >= 0 ? '+' : '') + fx(g.lv, 2), { align: 'center', size: 15, color: '#e00000' });
      var df = g.lv - g.bank; cell(ctx, 966, y0, 1273, y1, (df >= 0 ? '+' : '') + fx(df, 2), { align: 'center', size: 15 });
      cell(ctx, 1273, y0, 1625, y1, trend(g), { align: 'center', size: 20, w: '700', color: '#0b3d0b' });
    });
  }
  function trend(g) { if (g.ylv === undefined || g.ylv === null) return 'ทรงตัว'; var d = Math.round((g.lv - g.ylv) * 100); return d > 0 ? 'เพิ่มขึ้น' : d < 0 ? 'ลดลง' : 'ทรงตัว'; }

  // ---------- ภาพ 2 แผนที่ฝน ----------
  var R2 = { // กล่อง [x เริ่มช่องส้ม, y, x ช่องแดง, x ช่องฟ้า, x สิ้นสุด, y ล่าง], หยดน้ำ [x,y,w,h]
    'มงคล': [968, 340, 1056, 1143, 1228, 398, [761, 321, 61, 77]], 'ไทรงาม': [55, 446, 152, 249, 342, 504, [662, 313, 63, 78]],
    'สามร้อยยอด': [941, 535, 1038, 1135, 1228, 592, [777, 514, 65, 80]], 'ปราณบุรี': [55, 588, 153, 248, 342, 646, [748, 408, 66, 81]],
    'ยางชุม': [941, 740, 1038, 1134, 1228, 797, [724, 663, 66, 82]], 'วังเต็น': [53, 756, 149, 245, 339, 813, [665, 599, 63, 78]],
    'อ่างหิน': [945, 876, 1042, 1138, 1232, 933, [692, 746, 64, 79]], 'คลองบึง': [61, 962, 158, 254, 348, 1019, [707, 834, 61, 76]],
    'ช่องลม': [892, 1106, 988, 1085, 1178, 1163, [608, 1054, 66, 81]], 'จะกระ': [59, 1127, 155, 252, 345, 1184, [515, 1042, 67, 82]],
    'บางสะพาน': [55, 1251, 151, 246, 339, 1308, [501, 1202, 66, 82]], 'บางสะพานน้อย': [53, 1366, 149, 244, 337, 1423, [464, 1346, 66, 83]]
  };
  function dropColor(v) { return v > 75 ? [255, 0, 0] : v > 35 ? [255, 255, 0] : v > 10 ? [0, 220, 0] : [255, 255, 255]; }
  function recolorDrop(ctx, b, rgb) {
    var g = ctx.g, x = Math.round(b[0] * K), y = Math.round(b[1] * K), w = Math.round(b[2] * K), h = Math.round(b[3] * K);
    var im = g.getImageData(x, y, w, h), p = im.data, seen = new Uint8Array(w * h), st = [Math.floor(w / 2) + Math.floor(h * 0.62) * w];
    var c0 = st[0] * 4, r0 = p[c0], g0 = p[c0 + 1], b0 = p[c0 + 2];
    while (st.length) {
      var i = st.pop(); if (seen[i]) continue; seen[i] = 1;
      var q = i * 4; if (Math.abs(p[q] - r0) + Math.abs(p[q + 1] - g0) + Math.abs(p[q + 2] - b0) > 150) continue;
      p[q] = rgb[0]; p[q + 1] = rgb[1]; p[q + 2] = rgb[2];
      var cx = i % w, cy = (i / w) | 0;
      if (cx > 0) st.push(i - 1); if (cx < w - 1) st.push(i + 1); if (cy > 0) st.push(i - w); if (cy < h - 1) st.push(i + w);
    }
    g.putImageData(im, x, y);
  }
  function img2(ctx, D) {
    cell(ctx, 645, 180, 1172, 232, thDate(date(D.iso)), { align: 'center', size: 30, color: '#1f3864', pad: 0, dy: 2 });
    var sum = 0, n = 0;
    Object.keys(R2).forEach(function (k) {
      var b = R2[k], v = D.rain[k] || [0, 0, 0], o = { align: 'center', size: 21, w: '600', color: '#000', pad: 5 };
      cell(ctx, b[0], b[1], b[2] - 3, b[5], fx(v[0], 1), o);
      cell(ctx, b[2], b[1], b[3] - 3, b[5], fx(v[1], 1), o);
      cell(ctx, b[3], b[1], b[4], b[5], fx(v[2], 1), o);
      recolorDrop(ctx, b[6], dropColor(num(v[1])));
      sum += num(v[1]); n++;
    });
    cell(ctx, 212, 1492, 312, 1534, n ? fx(sum / n, 1) : '-', { align: 'center', size: 24, w: '600', color: '#c00000', pad: 0, fill: '#ffff00' });
  }

  // ---------- ภาพ 3 น้ำท่า ----------
  // [x กล่อง, x น้ำ0, x น้ำ1, y0 ระดับ 0, พิกเซล/ม., ระดับตลิ่ง]
  var R3 = { GT7: [45, 176, 335, 873.4, 49.43, 7.5], GT20: [362, 524, 648, 854.3, 48, 6], KY3: [680, 827, 978, 851.6, 52.75, 4.4], GT9: [997, 1158, 1306, 853.8, 55.67, 4], GT10: [1313, 1454, 1576, 877.4, 54.33, 3.5] };
  function isCyan(p, q) { return p[q] < 110 && p[q + 1] > 170 && p[q + 2] > 200; }
  function water(ctx, s, lvOld, lvNew) {
    var g = ctx.g, yOld = s[3] - lvOld * s[4], yNew = Math.max(s[3] - s[5] * s[4], s[3] - Math.max(0, lvNew) * s[4]);
    if (Math.abs(yNew - yOld) < 0.5) return;
    var x0 = Math.round(s[1] * K), x1 = Math.round(s[2] * K), top = Math.round(Math.min(yOld, yNew) * K) - 2, bot = Math.round(Math.max(yOld, yNew) * K) + 2;
    var im = g.getImageData(x0, top, x1 - x0, bot - top), p = im.data, w = x1 - x0;
    // ช่วงคอลัมน์ที่เป็นบ่อ (มีสีฟ้า หรือลายเฉียง) ในแต่ละแถว ใช้แถวน้ำเดิมเป็นแนว
    var ref = g.getImageData(x0, Math.round((yOld + 3) * K), w, 1).data, inWell = [];
    for (var x = 0; x < w; x++) inWell[x] = isCyan(ref, x * 4);
    var yo = yOld * K - top, yn = yNew * K - top;
    for (var y = 0; y < bot - top; y++) {
      for (x = 0; x < w; x++) {
        if (!inWell[x]) continue;
        var q = (y * w + x) * 4;
        if (yNew < yOld && y >= yn && y < yo) { p[q] = 0; p[q + 1] = 204; p[q + 2] = 255; }          // น้ำขึ้น → ฟ้า
        else if (yNew > yOld && y >= yo && y < yn) {                                                  // น้ำลง → ลายเฉียง
          var on = ((x + top + y) % (11 * K)) < 4 * K;
          p[q] = on ? 74 : 255; p[q + 1] = on ? 46 : 255; p[q + 2] = on ? 22 : 255;
        }
      }
    }
    g.putImageData(im, x0, top);
  }
  function img3(ctx, D) {
    cell(ctx, 380, 168, 1150, 222, 'สถานการณ์น้ำท่า วันที่  ' + thDate(date(D.iso)), { align: 'center', size: 38, color: '#fff', pad: 0, fill: '#1f4e79' });
    Object.keys(R3).forEach(function (k) {
      var s = R3[k], g = D.g[k]; if (!g) return; var x = s[0];
      if (g.old !== undefined) water(ctx, s, g.old, g.lv);
      var gold = { align: 'center', size: 32, w: '700', color: '#ffc000', pad: 0, stroke: 3, strokeColor: '#7a5a1a' };
      cell(ctx, x + 101, 912, x + 178, 956, fx(g.lv, 2), gold);
      cell(ctx, x + 145, 964, x + 220, 1008, fx(Math.abs(g.lv - g.bank), 2), gold);
      var lab = g.lv >= g.bank ? 'สูงกว่าตลิ่ง=' : 'ต่ำกว่าตลิ่ง=';
      cell(ctx, x + 18, 1021, x + 284, 1063, trend(g), { align: 'center', size: 28, w: '700', color: '#ffc000', pad: 0 });
      var st = g.lv >= g.bank ? 'ล้นตลิ่ง' : g.lv >= g.bank - 1 ? 'เฝ้าระวัง' : 'ปกติ';
      cell(ctx, x + 18, 1075, x + 284, 1117, st, { align: 'center', size: 28, w: '700', color: st === 'ปกติ' ? '#92d050' : st === 'เฝ้าระวัง' ? '#ffff00' : '#ff3030', pad: 0 });
      g._lab = lab;
    });
  }

  // ---------- ภาพ 4 สภาพอ่าง ----------
  // [x กล่อง, y แถวเบจ, y แถวส้ม, x ขอบขวาแถว, หมุดบนแผนที่ x,y,x1,y1]
  var R4 = {
    'ไทรงาม': [103, 352, 388, 365, [760, 287, 814, 327]], 'มงคล': [1150, 337, 373, 1412, [844, 294, 899, 333]],
    'ปราณบุรี': [1143, 495, 531, 1405, [777, 353, 877, 426]], 'วังเต็น': [103, 531, 567, 364, [751, 494, 806, 533]],
    'ยางชุม': [1016, 665, 701, 1278, [816, 523, 891, 576]], 'คลองบึง': [101, 711, 747, 363, [752, 626, 821, 675]],
    'อ่างหิน': [862, 839, 875, 1124, [777, 572, 832, 612]], 'จะกระ': [99, 897, 932, 361, [668, 770, 717, 809]],
    'ช่องลม': [853, 1002, 1038, 1118, [722, 800, 762, 830]]
  };
  function recolorMarker(ctx, b, hex, label) {
    var g = ctx.g, x = Math.round(b[0] * K) - 2, y = Math.round(b[1] * K) - 2, w = Math.round((b[2] - b[0]) * K) + 4, h = Math.round((b[3] - b[1]) * K) + 4;
    var im = g.getImageData(x, y, w, h), p = im.data, rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    var sat = function (q) { var mx = Math.max(p[q], p[q + 1], p[q + 2]), mn = Math.min(p[q], p[q + 1], p[q + 2]); return mx - mn > 110; };
    for (var yy = 0; yy < h; yy++) {
      var a = -1, z = -1;
      for (var xx = 0; xx < w; xx++) if (sat((yy * w + xx) * 4)) { if (a < 0) a = xx; z = xx; }
      if (a < 0 || z - a < 4) continue;
      for (xx = a; xx <= z; xx++) { var q = (yy * w + xx) * 4; p[q] = rgb[0]; p[q + 1] = rgb[1]; p[q + 2] = rgb[2]; }
    }
    g.putImageData(im, x, y);
    var bw = b[2] - b[0];
    text(ctx, label, (b[0] + b[2]) / 2, b[1] + (b[3] - b[1]) * 0.4, { size: Math.max(9, Math.min(15, bw / 5)), color: '#202020' });
  }
  function img4(ctx, D) {
    var d = date(D.iso);
    cell(ctx, 300, 145, 1530, 198, 'รายการสภาพอ่างเก็บน้ำประจำวันที่ ' + d.getDate() + ' ' + TH_M[d.getMonth() + 1], { align: 'center', size: 36, color: '#fff', pad: 0, fill: '#203864' });
    var rowOf = { 'ปราณบุรี': 10, 'ไทรงาม': 11, 'มงคล': 12, 'ยางชุม': 13, 'วังเต็น': 14, 'คลองบึง': 15, 'อ่างหิน': 16, 'ช่องลม': 17, 'จะกระ': 18 };
    Object.keys(R4).forEach(function (k) {
      var b = R4[k], r = rowOf[k], t = D.t10, x0 = b[0], yb = b[1], ys = b[2], xr = b[3];
      var red = { align: 'center', size: 25, color: '#e00000', pad: 0 }, navy = { align: 'center', size: 25, color: '#1f2f9f', pad: 0 };
      cell(ctx, x0 + 74, yb - 34, x0 + 150, yb - 5, fx(t['E' + r], 3), red);
      cell(ctx, x0 + 112, yb + 2, x0 + 212, yb + 28, fx(t['F' + r], 2) + ' %', red);
      cell(ctx, x0 + 94, ys + 3, x0 + 176, ys + 30, gen(t['H' + r]), red);
      cell(ctx, xr + 10, yb - 17, xr + 95, yb + 20, fx(t['I' + r], 3), navy);
      var sj = num(t['J' + r]);
      cell(ctx, xr + 10, ys + 2, xr + 97, ys + 31, Math.abs(sj) < 0.0005 ? '-' : fx(sj, 3), navy);
      recolorMarker(ctx, b[4], pctColor(num(t['F' + r])), fx(t['E' + r], 3));
    });
  }

  var BANK = { KY3: 4.4, GT7B: 4.5, GT7: 7.5, GT20: 6, GT9: 4, GT10: 3.5 }, OLD = { KY3: 1.13, GT7: 1.99, GT20: 0.09, GT9: 0.32, GT10: 1.13 };
  function prep(D) { Object.keys(D.g || {}).forEach(function (k) { var g = D.g[k]; g.bank = BANK[k]; g.old = OLD[k]; g.lv = num(g.lv); g.q = num(g.q); }); }

  // ---------- ภาพ 9–10 ตารางฝน 24 ชม. จ.ประจวบฯ (จาก thaiwater) ----------
  function rainColor(v) { return v > 90 ? ['#e00000', '#fff'] : v > 70 ? ['#e8601c', '#fff'] : v > 50 ? ['#ffa500', '#000'] : v > 35 ? ['#ffe14d', '#000'] : v > 20 ? ['#3cb043', '#fff'] : v > 10 ? ['#a7f0a7', '#000'] : ['#b9dcff', '#000']; }
  function rainTable(list, page, iso, font) {
    if (font) FONT = font;
    var W = 1400, rows = list.slice(page * 12, page * 12 + 12), H = 220 + 12 * 86 + 90;
    var c = document.createElement('canvas'); c.width = W * K; c.height = H * K;
    var g = c.getContext('2d'); g.scale(K, K); g.textBaseline = 'middle'; var ctx = { g: g, c: c };
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    var gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#0b4f78'); gr.addColorStop(1, '#1b8fcf');
    g.fillStyle = gr; g.fillRect(0, 0, W, 120);
    text(ctx, 'ปริมาณฝน 24 ชั่วโมง จังหวัดประจวบคีรีขันธ์', 40, 48, { align: 'left', size: 40, w: '700', color: '#fff' });
    var d = date(iso);
    text(ctx, 'ข้อมูลวันที่ ' + thDate(d) + '  ·  ที่มา: คลังข้อมูลน้ำแห่งชาติ (thaiwater.net)  ·  หน้า ' + (page + 1) + '/' + Math.max(1, Math.ceil(list.length / 12)), 40, 95, { align: 'left', size: 22, color: '#e6f3fb' });
    var cols = [40, 520, 1080, 1210, 1360];
    g.fillStyle = '#e9eef2'; g.fillRect(20, 140, W - 40, 70);
    ['ชื่อสถานี', 'ที่ตั้ง', 'เวลา', 'ฝน (มม.)'].forEach(function (h, i) { text(ctx, h, i < 2 ? cols[i] : (cols[i] + cols[i + 1]) / 2, 175, { align: i < 2 ? 'left' : 'center', size: 26, w: '700', color: '#333' }); });
    rows.forEach(function (r, i) {
      var y = 210 + i * 86;
      if (i % 2) { g.fillStyle = '#f6f8fa'; g.fillRect(20, y, W - 40, 86); }
      g.fillStyle = '#d9e1e7'; g.fillRect(20, y + 85, W - 40, 1);
      var nm = r.st; g.font = '600 25px ' + FONT + ', Loma, sans-serif';
      while (g.measureText(nm).width > 460 && nm.length > 4) nm = nm.slice(0, -1);
      text(ctx, nm + (nm !== r.st ? '…' : ''), cols[0], y + 43, { align: 'left', size: 25, w: '600', color: '#1a2a33' });
      text(ctx, r.loc, cols[1], y + 43, { align: 'left', size: 22, color: '#333' });
      text(ctx, r.t, (cols[2] + cols[3]) / 2, y + 43, { size: 24, color: '#333' });
      var cc = rainColor(r.v); g.fillStyle = cc[0]; g.beginPath();
      var bx = (cols[3] + cols[4]) / 2 - 55, by = y + 22; if (g.roundRect) g.roundRect(bx, by, 110, 42, 8); else g.rect(bx, by, 110, 42); g.fill();
      text(ctx, num(r.v).toFixed(1), bx + 55, by + 22, { size: 26, w: '700', color: cc[1] });
    });
    if (!rows.length) text(ctx, 'ไม่มีข้อมูลฝน', W / 2, 400, { size: 30, color: '#777' });
    var ly = H - 55, lab = [['>0-10', 5], ['>10-20', 15], ['>20-35', 30], ['>35-50', 40], ['>50-70', 60], ['>70-90', 80], ['>90', 99]];
    lab.forEach(function (l, i) { var cc = rainColor(l[1]), x = 40 + i * 150; g.fillStyle = cc[0]; g.fillRect(x, ly - 18, 140, 36); text(ctx, l[0], x + 70, ly, { size: 20, w: '600', color: cc[1] }); });
    return c;
  }

  function render(n, img, D, font) {
    prep(D);
    if (font) FONT = font;
    var ctx = setup(img);
    [null, img1, img2, img3, img4][n](ctx, D);
    return ctx.c;
  }
  return { render: render, rainTable: rainTable, K: K };
})();

// ---------- ภาพ 9 ฝน 24 ชม. จ.ประจวบฯ: แผนที่ + ตาราง (แบบหน้าเว็บ thaiwater) ----------
var RAIN_PROV = [[99.503,10.997],[99.479,10.994],[99.475,10.992],[99.464,10.99],[99.461,10.989],[99.458,10.988],[99.455,10.986],[99.453,10.983],[99.451,10.981],[99.449,10.978],[99.446,10.976],[99.441,10.973],[99.434,10.97],[99.43,10.97],[99.424,10.967],[99.418,10.963],[99.414,10.958],[99.411,10.956],[99.404,10.956],[99.358,10.959],[99.351,10.959],[99.347,10.958],[99.343,10.957],[99.339,10.957],[99.335,10.958],[99.329,10.962],[99.322,10.964],[99.31,10.965],[99.286,10.964],[99.283,10.963],[99.278,10.959],[99.273,10.958],[99.266,10.958],[99.252,10.961],[99.245,10.962],[99.236,10.965],[99.226,10.969],[99.184,10.991],[99.168,10.997],[99.154,11.005],[99.15,11.009],[99.148,11.012],[99.144,11.03],[99.141,11.039],[99.152,11.048],[99.158,11.057],[99.168,11.078],[99.175,11.087],[99.185,11.093],[99.206,11.1],[99.213,11.108],[99.243,11.198],[99.256,11.22],[99.288,11.258],[99.301,11.281],[99.316,11.321],[99.326,11.336],[99.364,11.377],[99.371,11.393],[99.372,11.411],[99.378,11.436],[99.387,11.452],[99.416,11.48],[99.428,11.497],[99.437,11.517],[99.441,11.533],[99.439,11.574],[99.441,11.597],[99.45,11.614],[99.466,11.624],[99.489,11.628],[99.531,11.631],[99.543,11.64],[99.607,11.726],[99.615,11.749],[99.63,11.816],[99.628,11.825],[99.611,11.83],[99.592,11.842],[99.574,11.858],[99.561,11.873],[99.554,11.895],[99.557,11.916],[99.573,11.956],[99.574,11.976],[99.567,11.993],[99.553,12.006],[99.534,12.012],[99.518,12.026],[99.522,12.054],[99.538,12.101],[99.539,12.112],[99.544,12.122],[99.546,12.132],[99.542,12.141],[99.533,12.145],[99.523,12.144],[99.466,12.126],[99.452,12.129],[99.449,12.147],[99.454,12.157],[99.464,12.165],[99.472,12.174],[99.474,12.187],[99.47,12.197],[99.459,12.217],[99.456,12.228],[99.455,12.238],[99.457,12.256],[99.454,12.267],[99.448,12.278],[99.432,12.296],[99.427,12.309],[99.423,12.328],[99.421,12.383],[99.414,12.405],[99.391,12.445],[99.387,12.466],[99.39,12.476],[99.4,12.497],[99.404,12.508],[99.407,12.53],[99.407,12.551],[99.405,12.567],[99.436,12.575],[99.475,12.586],[99.494,12.588],[99.516,12.586],[99.571,12.573],[99.575,12.572],[99.578,12.571],[99.581,12.568],[99.583,12.566],[99.586,12.56],[99.59,12.556],[99.596,12.552],[99.611,12.546],[99.619,12.545],[99.625,12.545],[99.627,12.547],[99.629,12.55],[99.633,12.556],[99.635,12.558],[99.639,12.56],[99.652,12.564],[99.659,12.567],[99.665,12.57],[99.67,12.574],[99.674,12.576],[99.709,12.584],[99.715,12.584],[99.745,12.58],[99.753,12.58],[99.759,12.58],[99.762,12.582],[99.806,12.616],[99.808,12.618],[99.812,12.621],[99.817,12.624],[99.825,12.627],[99.886,12.626],[99.898,12.628],[99.919,12.628],[99.926,12.628],[99.961,12.636],[99.961,12.625],[99.978,12.561],[99.981,12.54],[99.977,12.477],[99.981,12.455],[100.011,12.383],[100.012,12.369],[100.004,12.354],[99.982,12.28],[99.983,12.27],[99.992,12.259],[100.002,12.25],[100.009,12.241],[100.014,12.231],[100.017,12.21],[100.02,12.202],[100.02,12.193],[100.016,12.18],[100.01,12.175],[99.994,12.163],[99.988,12.153],[99.981,12.117],[99.977,12.108],[99.955,12.072],[99.855,11.968],[99.831,11.925],[99.823,11.879],[99.837,11.843],[99.834,11.838],[99.82,11.836],[99.813,11.832],[99.81,11.825],[99.81,11.813],[99.817,11.776],[99.815,11.77],[99.812,11.762],[99.811,11.753],[99.817,11.741],[99.78,11.737],[99.752,11.71],[99.671,11.578],[99.666,11.567],[99.661,11.551],[99.642,11.523],[99.638,11.505],[99.636,11.482],[99.632,11.461],[99.626,11.44],[99.6,11.384],[99.597,11.375],[99.593,11.364],[99.574,11.344],[99.569,11.334],[99.566,11.276],[99.569,11.256],[99.586,11.214],[99.586,11.195],[99.569,11.179],[99.562,11.199],[99.546,11.198],[99.529,11.187],[99.515,11.173],[99.508,11.162],[99.501,11.149],[99.496,11.133],[99.494,11.115],[99.498,11.093],[99.512,11.057],[99.515,11.039],[99.512,11.019],[99.503,10.997]];
var RR9 = (function () {
  var K = 2, F = 'Sarabun';
  var TH_M = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function col(v) { return v > 90 ? ['#e53935', '#fff'] : v > 70 ? ['#d1691f', '#fff'] : v > 50 ? ['#f39c3c', '#000'] : v > 35 ? ['#f7d64a', '#000'] : v > 20 ? ['#7cc142', '#000'] : v > 10 ? ['#a6e8a1', '#000'] : ['#a9d2f5', '#000']; }
  function T(g, s, x, y, o) { o = o || {}; g.font = (o.w || '400') + ' ' + (o.size || 16) + 'px ' + F + ', Loma, sans-serif'; g.fillStyle = o.color || '#222'; g.textAlign = o.align || 'left'; g.fillText(s, x, y); }
  function merc(lon, lat, z) { var n = Math.pow(2, z), r = lat * Math.PI / 180; return [(lon + 180) / 360 * n * 256, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n * 256]; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drop(g, x, y, c) { g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, -15); g.bezierCurveTo(7, -6, 9, -1, 9, 3); g.arc(0, 3, 9, 0, Math.PI); g.bezierCurveTo(-9, -1, -7, -6, 0, -15); g.closePath(); g.fillStyle = c; g.fill(); g.lineWidth = 1.4; g.strokeStyle = '#1f4e79'; g.stroke(); g.restore(); }
  async function render(list, iso, base, font) {
    if (font) F = font;
    var W = 1720, H = 1060, c = document.createElement('canvas'); c.width = W * K; c.height = H * K;
    var g = c.getContext('2d'); g.scale(K, K); g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // แถบหัว
    g.fillStyle = '#1976d2'; g.fillRect(0, 0, W, 70);
    T(g, 'แผนที่ปริมาณสะสม 24 ชม. ย้อนหลัง · จังหวัดประจวบคีรีขันธ์', 24, 36, { size: 26, w: '700', color: '#fff' });
    var p = iso.split('-').map(Number), last = list.reduce(function (a, r) { return r.t > a ? r.t : a; }, '');
    T(g, 'ข้อมูลวันที่ ' + p[2] + ' ' + TH_M[p[1]] + ' ' + (p[0] + 543) + (last ? ' เวลา ' + last + ' น.' : ''), W - 24, 36, { size: 20, color: '#fff', align: 'right' });
    // แผนที่
    var mx = 16, my = 86, mw = 520, mh = 880;
    g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
    g.fillStyle = '#aad3df'; g.fillRect(mx, my, mw, mh);
    var z = base ? base.z : 10, lon0 = 99.05, lon1 = 100.15, lat0 = 10.85, lat1 = 12.75;
    var a = merc(lon0, lat1, z), b = merc(lon1, lat0, z);
    var sc = Math.min(mw / (b[0] - a[0]), mh / (b[1] - a[1])), cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    var P = function (lon, lat) { var m = merc(lon, lat, z); return [mx + mw / 2 + (m[0] - cx) * sc, my + mh / 2 + (m[1] - cy) * sc]; };
    if (base && base.tiles) {
      for (var j = 0; j < base.tiles.length; j++) for (var i = 0; i < base.tiles[j].length; i++) {
        var src = base.tiles[j][i]; if (!src) continue;
        var im = await new Promise(function (ok) { var x = new Image(); x.onload = function () { ok(x); }; x.onerror = function () { ok(null); }; x.src = src; });
        if (!im) continue;
        var px = (base.x0 + i) * 256, py = (base.y0 + j) * 256;
        g.drawImage(im, mx + mw / 2 + (px - cx) * sc, my + mh / 2 + (py - cy) * sc, 256 * sc + 0.5, 256 * sc + 0.5);
      }
    }
    // ขอบเขตจังหวัด
    g.beginPath(); RAIN_PROV.forEach(function (q, k) { var s = P(q[0], q[1]); if (k) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); g.closePath();
    g.lineWidth = 2.5; g.strokeStyle = '#e53935'; g.stroke();
    list.slice().sort(function (u, v) { return u.v - v.v; }).forEach(function (r) { if (r.lat && r.lon) { var s = P(r.lon, r.lat); drop(g, s[0], s[1], col(r.v)[0]); } });
    g.restore(); g.strokeStyle = '#ccc'; g.lineWidth = 1; g.strokeRect(mx, my, mw, mh);
    T(g, '© OpenStreetMap contributors', mx + mw - 6, my + mh - 10, { size: 11, color: '#555', align: 'right' });
    // แถบเกณฑ์สี
    var L = [['>0-10', 5, 'เล็กน้อย'], ['>10-20', 15, ''], ['>20-35', 30, 'ปานกลาง'], ['>35-50', 40, ''], ['>50-70', 60, 'หนัก'], ['>70-90', 80, ''], ['>90', 99, 'หนักมาก']], lw = mw / 7;
    L.forEach(function (l, k) { var cc = col(l[1]); g.fillStyle = cc[0]; g.fillRect(mx + k * lw, my + mh + 8, lw, 26); T(g, l[0], mx + k * lw + lw / 2, my + mh + 21, { size: 14, color: cc[1], align: 'center' }); if (l[2]) T(g, l[2], mx + k * lw + lw / 2, my + mh + 48, { size: 14, color: '#444', align: 'center' }); });
    // ตาราง
    var tx = 560, tw = W - tx - 16, rows = list.slice(0, 14), rh = Math.min(62, Math.floor((H - 210) / Math.max(rows.length, 1)));
    g.fillStyle = '#1976d2'; rr(g, tx + 40, 86, 230, 48, 4); g.fill();
    T(g, 'ฝน 24 ชั่วโมง', tx + 155, 110, { size: 20, w: '700', color: '#fff', align: 'center' });
    g.fillStyle = '#eceff1'; g.fillRect(tx, 146, tw, 50);
    var cs = [tx + 24, tx + 420, tx + 860, tx + 1010];
    T(g, 'ชื่อสถานี', cs[0], 171, { size: 19, w: '700' }); T(g, 'ที่ตั้ง', cs[1], 171, { size: 19, w: '700' });
    T(g, 'เวลา', cs[2], 171, { size: 19, w: '700', align: 'center' }); T(g, 'ฝนล่าสุด (มม.) ↓', cs[3], 171, { size: 19, w: '700', align: 'center' });
    rows.forEach(function (r, k) {
      var y = 196 + k * rh;
      if (k % 2) { g.fillStyle = '#f5f5f5'; g.fillRect(tx, y, tw, rh); }
      g.fillStyle = '#e0e0e0'; g.fillRect(tx, y + rh - 1, tw, 1);
      var nm = r.st; g.font = '400 19px ' + F; while (g.measureText(nm).width > 380 && nm.length > 3) nm = nm.slice(0, -1);
      T(g, nm + (nm !== r.st ? '…' : ''), cs[0], y + rh / 2, { size: 19 });
      T(g, r.loc + ' จ.ประจวบคีรีขันธ์', cs[1], y + rh / 2, { size: 18 });
      T(g, r.t, cs[2], y + rh / 2, { size: 19, align: 'center' });
      var cc = col(r.v); g.fillStyle = cc[0]; rr(g, cs[3] - 42, y + rh / 2 - 15, 84, 30, 3); g.fill();
      T(g, Number(r.v).toFixed(1), cs[3], y + rh / 2 + 1, { size: 19, color: cc[1], align: 'center' });
    });
    if (!rows.length) T(g, 'ไม่มีฝนตกใน 24 ชม.ที่ผ่านมา', tx + tw / 2, 400, { size: 24, color: '#777', align: 'center' });
    T(g, 'ที่มา: คลังข้อมูลน้ำแห่งชาติ (thaiwater.net)' + (list.length > 14 ? ' · แสดง 14 จาก ' + list.length + ' สถานี' : ' · ' + list.length + ' สถานี'), W - 24, H - 22, { size: 16, color: '#666', align: 'right' });
    return c;
  }
  return { render: render };
})();
