/**
 * ส่งรายงานฝน (ภาพ + ข้อความ) เข้า LINE OA อัตโนมัติ
 * โครงการชลประทานประจวบคีรีขันธ์
 *
 * วิธีตั้งค่า (ทำครั้งเดียว)
 * 1. เปิด https://script.google.com → New project → วางโค้ดนี้ทั้งหมด → บันทึก
 * 2. Project Settings (รูปเฟือง) → Script Properties → Add property
 *      ชื่อ  LINE_TOKEN   ค่า = Channel access token (long-lived) ของ LINE OA
 *      (ได้จาก https://developers.line.biz → Provider → Channel ของ OA → Messaging API)
 *    ถ้าต้องการส่งเข้ากลุ่ม/คนเดียวแทน Broadcast ให้เพิ่ม
 *      ชื่อ  LINE_TO      ค่า = groupId หรือ userId
 * 3. เลือกฟังก์ชัน testSend → กด Run → อนุญาตสิทธิ์ → ระบบจะส่งรายงานล่าสุดทันที
 * 4. เลือกฟังก์ชัน setupTrigger → Run ครั้งเดียว → ระบบจะตรวจทุก 5 นาที
 *    และส่งเฉพาะเมื่อมีรายงานใหม่ (ไม่ส่งซ้ำ)
 */

const FEED_URL = 'https://raw.githubusercontent.com/thongyoy1918-collab/prachuap-water/main/line/latest.json';

function checkAndSend() {
  const props = PropertiesService.getScriptProperties();
  const feed = JSON.parse(UrlFetchApp.fetch(FEED_URL + '?t=' + Date.now()).getContentText());
  if (!feed.id || feed.id === props.getProperty('LAST_ID')) return;   // ไม่มีรายงานใหม่
  sendToLine_(feed);
  props.setProperty('LAST_ID', feed.id);
}

function testSend() {
  const feed = JSON.parse(UrlFetchApp.fetch(FEED_URL + '?t=' + Date.now()).getContentText());
  sendToLine_(feed);
  PropertiesService.getScriptProperties().setProperty('LAST_ID', feed.id);
  Logger.log('ส่งแล้ว: ' + feed.id);
}

function sendToLine_(feed) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_TOKEN');
  if (!token) throw new Error('ยังไม่ได้ตั้ง LINE_TOKEN ใน Script Properties');
  const to = props.getProperty('LINE_TO');
  const messages = [
    { type: 'image', originalContentUrl: feed.img, previewImageUrl: feed.preview || feed.img },
    { type: 'text', text: feed.text }
  ];
  const url = to ? 'https://api.line.me/v2/bot/message/push' : 'https://api.line.me/v2/bot/message/broadcast';
  const body = to ? { to: to, messages: messages } : { messages: messages };
  const res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify(body)
  });
  if (res.getResponseCode() !== 200) throw new Error('LINE ' + res.getResponseCode() + ': ' + res.getContentText());
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkAndSend').timeBased().everyMinutes(5).create();
  Logger.log('ตั้งเวลาตรวจทุก 5 นาทีแล้ว');
}
