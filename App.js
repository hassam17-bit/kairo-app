import React, { useState, useEffect, useCallback } from 'react';
import { View, Text as RNText, ScrollView, Pressable as RNPressable, StyleSheet, useColorScheme, ActivityIndicator, StatusBar, TextInput, Switch, Modal, KeyboardAvoidingView, Platform, Share, Alert, Keyboard, Dimensions, AppState, Image, Linking, BackHandler, Animated, Easing, LayoutAnimation, UIManager, AccessibilityInfo, Vibration, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFonts } from 'expo-font';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { Sora_700Bold } from '@expo-google-fonts/sora';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { fetch as xfetch } from 'expo/fetch';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TYPE = { faith: '#F5B84B', uni: '#7C5CFF', skill: '#35D0E0', project: '#5C9CFF', study: '#B58CFF', teach: '#FF7DB0', life: '#8A93AD', sleep: '#3A4262' };
const DARK = { bg: '#0B1020', card: '#151B30', ink: '#EDEFF7', mute: '#98A0BD', line: '#232B47' };
const LIGHT = { bg: '#F4F5FB', card: '#FFFFFF', ink: '#14172B', mute: '#6A708A', line: '#E3E6F2' };
const VIOLET = '#7C5CFF', AMBER = '#F5B84B';
const DEFAULTS = { method: 1, school: 1, theme: 'system', remBlocks: true, remPrayers: true, remMorning: true, remEvening: true, tone: 'gentle', snooze: 15, examMode: 'auto', remReport: true, remDisc: false, remMoney: true, remTargets: true, showQuote: true, quoteTopic: 'Motivation', quoteCustom: '', examLead: 14, sleepGoal: 8, remSleep: true };
let EXAM = { on: false, course: '' };
let SET = { ...DEFAULTS };
function Text({ style, ...p }) {
  const f = StyleSheet.flatten(style) || {};
  const w = parseInt(f.fontWeight || '400', 10) || 400, big = (f.fontSize || 14) >= 18;
  const fam = w >= 700 ? (big ? 'Sora_700Bold' : 'DMSans_700Bold') : w >= 500 ? 'DMSans_500Medium' : 'DMSans_400Regular';
  return <RNText textBreakStrategy="simple" maxFontSizeMultiplier={1.25} {...p} style={[style, { fontFamily: fam, fontWeight: 'normal' }]} />;
}
/* ---------- Motion ---------- */
let REDUCE = false;
try { AccessibilityInfo.isReduceMotionEnabled().then((v) => { REDUCE = !!v; }).catch(() => {}); } catch (e) {}
try { if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true); } catch (e) {}
const anim = () => { if (REDUCE) return; try { LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)); } catch (e) {} };
function Pressable({ style, ...p }) {
  return <RNPressable {...p} style={({ pressed }) => [style, pressed && { opacity: 0.86, transform: [{ scale: 0.98 }] }]} />;
}
function FadeIn({ children, delay = 0, y = 10, dur = 260, style }) {
  const v = React.useRef(new Animated.Value(REDUCE ? 1 : 0)).current;
  useEffect(() => { if (!REDUCE) Animated.timing(v, { toValue: 1, duration: dur, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, []);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) }] }]}>{children}</Animated.View>;
}
function GrowBar({ pct, color, bg, h = 7, delay = 0 }) {
  const v = React.useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: Math.max(0, Math.min(100, pct || 0)), duration: REDUCE ? 0 : 650, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [pct]);
  return (
    <View style={{ height: h, backgroundColor: bg, borderRadius: h / 2, overflow: 'hidden' }}>
      <Animated.View style={{ height: h, width: v.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }), backgroundColor: color }} />
    </View>
  );
}
function GrowH({ target, style }) {
  const v = React.useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: target, duration: REDUCE ? 0 : 550, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); }, [target]);
  return <Animated.View style={[style, { height: v }]} />;
}

/* ---------- prayer times: offline calculation (Karachi method, Hanafi Asr) ---------- */
const R = Math.PI / 180;
const sin = (d) => Math.sin(d * R), cos = (d) => Math.cos(d * R), tan = (d) => Math.tan(d * R);
const acos = (x) => Math.acos(Math.max(-1, Math.min(1, x))) / R;
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
function calcTimesRaw(date, lat, lng) {
  const tz = -date.getTimezoneOffset() / 60;
  const AN = ({ 1: [18, 18], 2: [15, 15], 3: [18, 17] })[SET.method] || [18, 18];
  const jd = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5 + 2440587.5 - lng / 360, D = jd - 2451545;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360), e = 23.439 - 3.6e-7 * D;
  const RA = fix(Math.atan2(cos(e) * sin(L), cos(L)) / R, 360) / 15;
  let eqt = q / 15 - RA; if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
  const dc = Math.asin(sin(e) * sin(L)) / R, noon = 12 + tz - lng / 15 - eqt;
  const t = (a) => acos((-sin(a) - sin(dc) * sin(lat)) / (cos(dc) * cos(lat))) / 15;
  const A = -Math.atan(1 / ((SET.school === 1 ? 2 : 1) + tan(Math.abs(lat - dc)))) / R;
  const m = (h) => Math.round(h * 60);
  return { fajr: m(noon - t(AN[0])), sunrise: m(noon - t(0.833)), dhuhr: m(noon + 1 / 60), asr: m(noon + t(A)), maghrib: m(noon + t(0.833)), isha: m(noon + t(AN[1])) };
}
const CT_CACHE = new Map();
function calcTimes(date, lat, lng) {
  const k = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}|${lat.toFixed(3)}|${lng.toFixed(3)}|${SET.method}|${SET.school}|${date.getTimezoneOffset()}`;
  let v = CT_CACHE.get(k);
  if (!v) { v = calcTimesRaw(date, lat, lng); CT_CACHE.set(k, v); if (CT_CACHE.size > 400) CT_CACHE.clear(); }
  return v;
}
const toMin = (s) => parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10);
async function getTimes(date, c) {
  try {
    const ds = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
    const url = `https://api.aladhan.com/v1/timings/${ds}?latitude=${c.lat}&longitude=${c.lng}&method=${SET.method}&school=${SET.school}`;
    const res = await Promise.race([fetch(url), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
    const t = (await res.json()).data.timings;
    return { t: { fajr: toMin(t.Fajr), sunrise: toMin(t.Sunrise), dhuhr: toMin(t.Dhuhr), asr: toMin(t.Asr), maghrib: toMin(t.Maghrib), isha: toMin(t.Isha) }, src: 'Live from Aladhan' };
  } catch (e) {
    return { t: calcTimes(date, c.lat, c.lng), src: 'Calculated offline' };
  }
}

/* ---------- schedule ---------- */
// The schedule is NOT hard-coded. It is built from: your classes, the routine the AI made for you,
// and one-time blocks. Prayer times move the anchored blocks every day.
const PROF_DEFAULT = { classes: {}, routine: [], extras: [] };
let PROF = PROF_DEFAULT;
let ONE = [];
let BD_VER = 0, BD_ON = true;
const BD_CACHE = new Map();
const ANCHORS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
const RTYPES = ['faith', 'life', 'study', 'project', 'skill', 'teach'];
const PRI = { uni: 100, teach: 90, faith: 80 };
let OVR = [], OFFS = [];
const offOfIso = (k) => OFFS.find((o) => k >= o.from && k <= o.to);
const isClassLinked = (r) => r.cd === true || (r.cd === undefined && /commute|travel|to uni|from uni|campus/i.test(r.title));
function rawDay(d, P, dt) {
  const B = [];
  const od = dt ? iso(dt) : null;
  const hidden = (rid) => !!od && OVR.some((o) => o.date === od && o.rid === rid);
  const offDay = !!od && !!offOfIso(od);
  const add = (s, e, t, y, id, pr, meta) => { s = Math.max(0, Math.round(s)); e = Math.min(1440, Math.round(e)); if (e - s >= 5) B.push({ s, e, t, y, id, pr, meta }); };
  ((PROF.classes || {})[d] || []).forEach((x) => { if (!offDay && !hidden('c:' + x.t)) add(x.s, x.e, x.t, 'uni', 'c:' + x.t, 100, { src: 'c' }); });
  (PROF.routine || []).forEach((r, i) => {
    if (!(r.days || []).includes(d) || hidden(r.id) || (offDay && isClassLinked(r))) return;
    const st = r.a === 'clock' ? r.o : P[r.a] != null ? P[r.a] + r.o : null;
    if (st == null) return;
    let t = r.title, y = r.type;
    if (EXAM.on && y === 'project') { t = 'Exam revision' + (EXAM.course ? ': ' + EXAM.course : ''); y = 'study'; }
    else if (EXAM.on && y === 'skill') { t = 'Past papers practice'; y = 'study'; }
    add(st, st + r.m, t, y, 'r:' + r.id, (PRI[r.type] || 50) + i / 1000, { src: 'r', rid: r.id });
  });
  (PROF.extras || []).filter((x) => (x.days || []).includes(d)).forEach((x) => add(x.s, x.e, x.title, TYPE[x.type] ? x.type : 'life', 'x:' + x.title, 60, { src: 'x' }));
  if (od) ONE.filter((x) => x.date === od).forEach((x) => add(x.s, x.e, x.title, TYPE[x.type] ? x.type : 'study', 'o:' + x.id, 70, { src: 'o', oid: x.id }));
  return B;
}
function resolveDay(B) {
  const placed = [], out = [];
  [...B].sort((a, b) => b.pr - a.pr || a.s - b.s).forEach((b) => {
    let segs = [[b.s, b.e]];
    placed.forEach((p) => {
      const nx = [];
      segs.forEach((g) => {
        if (p[1] <= g[0] || p[0] >= g[1]) nx.push(g);
        else { if (p[0] - g[0] >= 10) nx.push([g[0], p[0]]); if (g[1] - p[1] >= 10) nx.push([p[1], g[1]]); }
      });
      segs = nx;
    });
    segs.forEach((g) => { out.push({ ...b, s: g[0], e: g[1] }); placed.push([g[0], g[1]]); });
  });
  return out.sort((a, b) => a.s - b.s);
}
function buildDay(d, P, dt) {
  const ck = BD_ON ? `${BD_VER}|${d}|${dt ? iso(dt) : ''}|${P.fajr}|${P.sunrise}|${P.dhuhr}|${P.asr}|${P.maghrib}|${P.isha}` : null;
  if (ck) { const v = BD_CACHE.get(ck); if (v) return v; }
  const body = resolveDay(rawDay(d, P, dt)), B = [];
  if (body.length) {
    const f = body[0], l = body[body.length - 1];
    if (f.s >= 5) B.push({ s: 0, e: f.s, t: 'Sleep', y: 'sleep', id: 'sleep' });
    body.forEach((x) => B.push(x));
    if (1440 - l.e >= 5) B.push({ s: l.e, e: 1440, t: 'Sleep', y: 'sleep', id: 'sleep' });
  }
  if (ck) { BD_CACHE.set(ck, B); if (BD_CACHE.size > 600) BD_CACHE.clear(); }
  return B;
}
function wakeOf(bl) { const f = bl.find((b) => b.y !== 'sleep'); return f ? f.s : null; }
const toHM = (m) => String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0') + ':' + String(((m % 60) + 60) % 60).padStart(2, '0');
function keepIds(nr, old) {
  const pool = [...(old || [])];
  return nr.map((r) => { const i = pool.findIndex((o) => o.title.toLowerCase() === r.title.toLowerCase()); if (i < 0) return r; const o = pool.splice(i, 1)[0]; return { ...r, id: o.id, by: o.by || r.by, ts: o.ts || r.ts }; });
}
function normRoutine(arr, by) {
  const out = [];
  (Array.isArray(arr) ? arr : []).forEach((x, i) => {
    if (!x || !x.title) return;
    const days = (Array.isArray(x.days) ? x.days : []).map(Number).filter((v, j, a) => v >= 0 && v <= 6 && a.indexOf(v) === j);
    const m = Math.round(Number(x.minutes != null ? x.minutes : x.m));
    if (!days.length || !(m >= 5 && m <= 720)) return;
    let a = 'clock', o = null;
    const an = x.anchor ? String(x.anchor).toLowerCase() : '';
    if (ANCHORS.includes(an)) { a = an; o = Math.round(Number(x.offset || 0)); if (!(o >= -300 && o <= 300)) return; }
    else { o = hm(x.start); if (o == null) return; }
    const ty = x.type || x.kind;
    out.push({ id: Date.now().toString(36) + i, title: String(x.title).trim().slice(0, 50), type: RTYPES.includes(ty) ? ty : 'life', days, a, o, m, by: by || 'ai', ts: Date.now(), cd: x.classDay != null ? !!x.classDay : x.cd != null ? !!x.cd : undefined });
  });
  return out.slice(0, 60);
}
const dShort = (days) => (days.length === 7 ? 'daily' : [1, 2, 3, 4, 5].every((x) => days.includes(x)) && days.length === 5 ? 'Mon-Fri' : [1, 2, 3, 4, 5, 6, 0].filter((x) => days.includes(x)).map((x) => DN[x]).join(','));
const ruleOf = (r) => (r.a === 'clock' ? fmt(r.o) : `${r.a} ${r.o >= 0 ? '+' : ''}${r.o} min`);
function routineText(prof) { return (prof.routine || []).map((r, i) => `${i + 1} | ${r.title} | ${r.type} | ${dShort(r.days)} | ${ruleOf(r)} | ${r.m} min`).join('\n'); }
function routineIssues(prof, co) {
  const sP = PROF, sOn = BD_ON, sE = EXAM;
  PROF = prof; BD_ON = false; EXAM = { on: false, course: '' };
  const out = [];
  try {
    const P = calcTimes(new Date(), co.lat, co.lng);
    for (let d = 0; d < 7 && out.length < 12; d++) {
      const raw = rawDay(d, P, null).sort((a, b) => a.s - b.s);
      for (let i = 1; i < raw.length; i++) for (let j = 0; j < i; j++) {
        const ov = Math.min(raw[i].e, raw[j].e) - Math.max(raw[i].s, raw[j].s);
        if (ov >= 10 && out.length < 12) out.push(`${DN[d]}: "${raw[j].t}" (${fmt(raw[j].s)}-${fmt(raw[j].e)}) overlaps "${raw[i].t}" (${fmt(raw[i].s)}-${fmt(raw[i].e)})`);
      }
    }
  } finally { PROF = sP; BD_ON = sOn; EXAM = sE; }
  return out;
}

const fmt = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
const dur = (m) => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const dayKey = (d) => `prayed_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/* ---------- Notifications ---------- */
const NCH = 'kairo';
const DATE_T = Notifications.SchedulableTriggerInputTypes;
const trig = (d) => (DATE_T ? { type: DATE_T.DATE, date: d, channelId: NCH } : { date: d, channelId: NCH });
const atMin = (d, m) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return new Date(x.getTime() + m * 60000); };
async function setupNotifications() {
  try {
    Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync(NCH, { name: 'Kairo reminders', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#7C5CFF' });
    const act = (id, t) => ({ identifier: id, buttonTitle: t, options: { opensAppToForeground: true } });
    await Notifications.setNotificationCategoryAsync('block', [act('start', 'Start'), act('snooze', 'Snooze'), act('cant', "Can't do it")]);
    await Notifications.setNotificationCategoryAsync('blockend', [act('done', 'Done'), act('cant', 'Missed')]);
    await Notifications.setNotificationCategoryAsync('prayer', [act('prayed', 'Prayed'), act('snooze', 'Remind me')]);
    await Notifications.setNotificationCategoryAsync('task', [act('done', 'Done'), act('snooze', 'Snooze')]);
    await Notifications.setNotificationCategoryAsync('reminder', [act('done', 'Done'), act('snooze10', '+10 min'), act('snooze60', '+1 hour')]);
  } catch (e) {}
}
async function notifStatus() { try { const p = await Notifications.getPermissionsAsync(); return p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'ask'; } catch (e) { return 'ask'; } }
async function askNotif() { try { const p = await Notifications.requestPermissionsAsync(); return !!p.granted; } catch (e) { return false; } }
async function sched(content, when) {
  if (when.getTime() < Date.now() + 2000) return false;
  try { await Notifications.scheduleNotificationAsync({ content: { sound: true, ...content }, trigger: trig(when) }); return true; } catch (e) { return false; }
}
async function clearPresented(dk, key) {
  try {
    const list = await Notifications.getPresentedNotificationsAsync();
    for (const n of list) { const d = (n.request && n.request.content && n.request.content.data) || {}; if (d.dk === dk && d.key === key) await Notifications.dismissNotificationAsync(n.request.identifier); }
  } catch (e) {}
}
let SCHED_BUSY = false, SCHED_NEXT = null;
async function scheduleAll(args) {
  if (SCHED_BUSY) { SCHED_NEXT = args; return 0; }
  SCHED_BUSY = true;
  let n = 0;
  try { n = await scheduleAllRun(args); } catch (e) {}
  SCHED_BUSY = false;
  if (SCHED_NEXT) { const a = SCHED_NEXT; SCHED_NEXT = null; scheduleAll(a); }
  return n;
}
async function scheduleAllRun({ tasks, exams, settings, co, log, targets, reminders, loans }) {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted) return 0;
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.content && n.content.data && n.content.data.auto).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (e) { return 0; }
  if (!co) return 0;
  const S = settings, firm = S.tone === 'firm', t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const list = [];
  const go = (content, when) => { list.push({ content: { ...content, data: { ...(content.data || {}), auto: true } }, when }); };
  const PNM = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  const tOpen = (t) => !(log[t.date] && log[t.date]['t:' + t.id]);
  const KIND = { uni: 'Class', study: 'Study', project: 'Project', skill: 'Skill', teach: 'Tuition', faith: 'Worship', teach2: '' };
  for (let i = 0; i < 4; i++) {
    const d = addDays(t0, i), P = calcTimes(d, co.lat, co.lng), dk = dayKey(d), l = log[dk] || {}, cnt = {};
    const blocks = buildDay(d.getDay(), P, d), nb = blocks.filter((b) => b.y !== 'sleep');
    const dayTasks = tasks.filter((t) => t.date === dk && tOpen(t));
    if (S.remMorning) {
      const cls = nb.filter((b) => b.y === 'uni'), lv = nb.find((b) => b.t === 'Commute to uni');
      const wk = nb.length ? nb[0].s : P.fajr - 10;
      const lines = [`Wake-up ${fmt(wk)} · Fajr ${fmt(P.fajr)}`];
      if (cls.length) lines.push('Classes: ' + cls.slice(0, 4).map((b) => `${b.t} ${fmt(b.s)}`).join(', ') + (cls.length > 4 ? '…' : ''));
      if (lv) lines.push('Leave home at ' + fmt(lv.s));
      if (dayTasks.length) lines.push('Tasks: ' + dayTasks.slice(0, 4).map((t) => t.title).join(', '));
      const ex = exams.filter((e) => e.ts >= d.getTime() && e.ts - d.getTime() <= 3 * 864e5)[0];
      if (ex) lines.push(`Exam: ${ex.course} ${ex.ts === d.getTime() ? 'today' : 'on ' + new Date(ex.ts).toDateString().slice(0, 10)}`);
      go({ title: 'Good morning · ' + FULLDAY[d.getDay()], body: lines.join('\n'), data: { kind: 'plain', tab: 0 } }, atMin(d, wk));
    }
    for (let bi = 0; bi < nb.length; bi++) {
      const b = nb[bi], nxt = nb[bi + 1];
      cnt[b.id] = (cnt[b.id] || 0) + 1;
      const key = 'b:' + b.id + '#' + cnt[b.id];
      if (/^(wake|fajr|dhuhr|zuhr|asr|maghrib|isha|jumu)/i.test(b.t) || l[key] || !S.remBlocks) continue;
      const range = `${fmt(b.s)} to ${fmt(b.e)} (${dur(b.e - b.s)})`, kind = KIND[b.y] || 'Routine';
      const body = `${kind} · ${range}` + (nxt ? `\nNext: ${nxt.t} at ${fmt(nxt.s)}` : '');
      go({ title: b.t === 'Commute to uni' ? (firm ? 'Leave for uni now' : 'Time to leave for uni') : (firm ? 'Start now: ' : 'Time for ') + b.t, body, categoryIdentifier: 'block', data: { kind: 'block', dk, key, title: b.t, bdy: body, endTs: atMin(d, b.e).getTime() } }, atMin(d, b.s));
      if ((['uni', 'study', 'project', 'skill', 'teach'].includes(b.y) || b.t === 'Commute to uni') && b.e - b.s >= 25) go({ title: 'Coming up: ' + b.t, body: `Starts in 5 minutes at ${fmt(b.s)}\n${range}`, data: { kind: 'plain', tab: 0 } }, atMin(d, b.s - 5));
    }
    if (S.remPrayers) {
      const W = [['fajr', P.sunrise, 'sunrise'], ['dhuhr', P.asr, 'Asr'], ['asr', P.maghrib, 'Maghrib'], ['maghrib', P.isha, 'Isha'], ['isha', P.fajr + 1440, 'Fajr']];
      W.forEach((w, pi) => {
        const id = w[0];
        if (l['p:' + id]) return;
        const nm = id === 'dhuhr' && d.getDay() === 5 ? "Jumu'ah" : PNM[id], end = w[1], nx = W[pi + 1] ? W[pi + 1][0] : null;
        const body = `${fmt(P[id])} · ends ${w[2] === 'sunrise' ? 'at sunrise' : 'when ' + w[2] + ' starts'} (${fmt(end)})` + (nx ? `\nNext: ${PNM[nx]} at ${fmt(P[nx])}` : '');
        go({ title: nm + ' time', body: (firm ? 'Do not delay. ' : '') + body, categoryIdentifier: 'prayer', data: { kind: 'prayer', dk, id, key: 'p:' + id, title: nm + ' time', bdy: body } }, atMin(d, P[id]));
        if (id !== 'isha' && end - P[id] > 40) go({ title: nm + ' ends soon', body: `${nm} time ends at ${fmt(end)}. Pray now if you have not yet.`, categoryIdentifier: 'prayer', data: { kind: 'prayer', dk, id, key: 'p:' + id, title: nm + ' time', bdy: 'Time is running out.' } }, atMin(d, end - 20));
      });
    }
    tasks.forEach((t) => {
      if (t.date !== dk || !tOpen(t) || t.time == null) return;
      const body = `${t.cat}${t.urgent ? ' · URGENT' : ''} · due ${fmt(t.time)}`, dt = { kind: 'task', dk, key: 't:' + t.id, title: t.title, bdy: body, tab: 1 };
      go({ title: (firm || t.urgent ? 'Due now: ' : 'Task: ') + t.title, body, categoryIdentifier: 'task', data: dt }, atMin(d, t.time));
      if (t.time >= 15) go({ title: 'Due soon: ' + t.title, body: `In 15 minutes · ${t.cat}`, categoryIdentifier: 'task', data: dt }, atMin(d, t.time - 15));
      if (t.urgent && t.time >= 60) go({ title: 'Urgent in 1 hour: ' + t.title, body, categoryIdentifier: 'task', data: dt }, atMin(d, t.time - 60));
    });
    if (dayTasks.length && S.remMorning) go({ title: `${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'} still open today`, body: dayTasks.slice(0, 5).map((t) => t.title + (t.time != null ? ' (' + fmt(t.time) + ')' : '')).join('\n'), data: { kind: 'plain', tab: 1 } }, atMin(d, 15 * 60));
    const over = tasks.filter((t) => t.ts < d.getTime() && tOpen(t)).slice(0, 3);
    if (over.length && S.remMorning) go({ title: 'Overdue tasks', body: over.map((t) => t.title).join('\n'), data: { kind: 'plain', tab: 1 } }, atMin(d, 9 * 60));
    if (S.remTargets) (targets || []).filter((t) => tProg(t) < 1 && t.due && t.due - d.getTime() >= 0 && t.due - d.getTime() <= 7 * 864e5).slice(0, 3).forEach((t) => { const days = Math.round((t.due - d.getTime()) / 864e5); go({ title: 'Target: ' + t.title, body: `${days === 0 ? 'Due today' : days + ' day' + (days === 1 ? '' : 's') + ' left'} · ${Math.round(tProg(t) * 100)}% done · ${t.area}`, data: { kind: 'plain', tab: 1 } }, atMin(d, 9 * 60 + 30)); });
    if (S.remMoney) go({ title: "Log today's spending", body: 'Add any income or expenses. It takes 10 seconds.', data: { kind: 'plain', tab: 3 } }, atMin(d, 20 * 60 + 30));
    if (S.remDisc) go({ title: 'Wind down', body: 'Phone away. Make wudu, read a little and sleep early.', data: { kind: 'plain', tab: 2 } }, atMin(d, 22 * 60 + 30));
    if (S.remEvening) {
      const dn = addDays(d, 1), Pn = calcTimes(dn, co.lat, co.lng), bn = buildDay(dn.getDay(), Pn, dn).filter((b) => b.y !== 'sleep'), first = bn.find((b) => b.y === 'uni') || bn.find((b) => ['study', 'project', 'skill', 'teach'].includes(b.y) && b.t.indexOf('Flex') !== 0);
      const tt = tasks.filter((t) => t.date === dayKey(dn) && tOpen(t));
      go({ title: 'Evening review', body: 'Tick what you finished today.\nTomorrow: wake ' + fmt(bn.length ? bn[0].s : Pn.fajr - 10) + (first ? ', first ' + first.t + ' at ' + fmt(first.s) : '') + (tt.length ? '\nTasks tomorrow: ' + tt.slice(0, 3).map((t) => t.title).join(', ') : ''), data: { kind: 'plain', tab: 0 } }, atMin(d, 21 * 60));
    }
  }
  for (const e of exams) {
    if (e.ts - t0.getTime() > 30 * 864e5) continue;
    const base = new Date(e.ts);
    go({ title: 'Exam in a week', body: e.course + '. Plan your revision.', data: { kind: 'plain', tab: 1 } }, atMin(addDays(base, -7), 18 * 60));
    go({ title: 'Exam in 3 days', body: e.course, data: { kind: 'plain', tab: 1 } }, atMin(addDays(base, -3), 18 * 60));
    go({ title: 'Exam tomorrow', body: e.course + '. Revise lightly and sleep early.', data: { kind: 'plain', tab: 1 } }, atMin(addDays(base, -1), 20 * 60));
    go({ title: 'Exam today', body: e.course + '. Good luck.', data: { kind: 'plain', tab: 0 } }, atMin(base, 7 * 60));
  }
  if (S.remSleep !== false) {
    const t00 = new Date(); t00.setHours(0, 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const d = addDays(t00, i), dn = addDays(d, 1), bn = buildDay(dn.getDay(), calcTimes(dn, co.lat, co.lng), dn).filter((b) => b.y !== 'sleep');
      if (!bn.length) continue;
      const gh = S.sleepGoal || 8, bed = bn[0].s - gh * 60 - 15;
      if (bed - 30 >= 0) go({ title: 'Wind down for sleep', body: `Be in bed by ${fmt(bed)} to get ${gh} hours before ${fmt(bn[0].s)}.`, data: { kind: 'plain', tab: 2 } }, atMin(d, bed - 30));
    }
  }
  const nowMs = Date.now();
  (reminders || []).forEach((r) => {
    if (r.done && (!r.rep || r.rep === 'none')) return;
    occsOf(r, nowMs, !r.rep || r.rep === 'none' ? nowMs + 60 * 864e5 : nowMs + 8 * 864e5).slice(0, 12).forEach((ts) => {
      go({ title: 'Reminder', body: r.text, categoryIdentifier: 'reminder', data: { kind: 'rem', id: r.id, title: r.text, bdy: r.text } }, new Date(ts));
      if (r.early > 0 && ts - r.early * 60000 > nowMs) go({ title: 'Coming up in ' + (r.early >= 1440 ? '1 day' : r.early >= 60 ? r.early / 60 + ' h' : r.early + ' min'), body: r.text, data: { kind: 'plain', tab: 1 } }, new Date(ts - r.early * 60000));
    });
  });
  if (S.remMoney) (loans || []).filter((l) => !l.settled && l.due).forEach((l) => {
    const left = Math.max(0, l.amount - loanPaid(l)), dd = new Date(l.due); dd.setHours(0, 0, 0, 0);
    [[-1, 'Due tomorrow'], [0, 'Due today']].forEach((x) => go({ title: x[1] + ': ' + (l.dir === 'lent' ? l.who + ' owes you' : 'you owe ' + l.who), body: rs(left) + (l.note ? ' · ' + l.note : ''), data: { kind: 'plain', tab: 3 } }, atMin(addDays(dd, x[0]), 9 * 60)));
  });
  if (S.remReport) { const sun = addDays(t0, (7 - t0.getDay()) % 7); go({ title: 'Weekly report', body: 'Your week is ready to review in Stats.', data: { kind: 'plain', tab: 4 } }, atMin(sun, 20 * 60)); }
  let n = 0;
  for (let i = 0; i < list.length; i += 8) { const res = await Promise.all(list.slice(i, i + 8).map((x) => sched(x.content, x.when))); n += res.filter(Boolean).length; }
  return n;
}

/* ---------- Missed work ---------- */
function missedOf(log, co, days = 6) {
  if (!co) return [];
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i <= days; i++) {
    const d = addDays(t0, -i), P = calcTimes(d, co.lat, co.lng), l = log[dayKey(d)] || {}, cnt = {};
    buildDay(d.getDay(), P, d).forEach((b) => {
      if (b.y === 'sleep') return;
      cnt[b.id] = (cnt[b.id] || 0) + 1;
      const key = 'b:' + b.id + '#' + cnt[b.id];
      if ((i === 0 && b.e > nm) || l[key]) return;
      if (!['study', 'project', 'skill'].includes(b.y) && !/exercise|gym|workout|run|walk/i.test(b.t)) return;
      out.push({ d, key, title: b.t, y: b.y, mins: b.e - b.s, skipped: !!l['x:' + key] });
    });
  }
  return out;
}

/* ---------- Plan screen ---------- */
function Plan({ c, log, mark, tasks, exams, bump, askAI, onSettings, sched, settings, saveSet }) {
  const s = mk(c);
  const [now, setNow] = useState(new Date());
  const [coords, setCoords] = useState(null);
  const [ready, setReady] = useState(false);
  const [pd, setPd] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [place, setPlace] = useState('');
  const [view, setView] = useState(new Date().getDay());
  const [ftOpen, setFtOpen] = useState(false);
  const [bsel, setBsel] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [ftDay, setFtDay] = useState(0);
  const [ftS, setFtS] = useState('');
  const [ftE, setFtE] = useState('');
  const [ftErr, setFtErr] = useState('');

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { (async () => {
    try { const v = await AsyncStorage.getItem('coords'); if (v) setCoords(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('place'); if (v) setPlace(v); } catch (e) {}
    setReady(true);
  })(); }, []);
  const load = useCallback(async () => { if (coords) setPd(await getTimes(new Date(), coords)); }, [coords, SET.method, SET.school]);
  useEffect(() => { load(); }, [load]);

  const toggle = (id) => mark(dayKey(new Date()), 'p:' + id);
  const locate = async () => {
    setBusy(true); setMsg('');
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') { setMsg('Location permission is off. Allow it in phone settings and try again.'); setBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const c2 = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let nameP = 'Current location';
      try { const g = await Location.reverseGeocodeAsync({ latitude: c2.lat, longitude: c2.lng }); const a = g && g[0]; if (a) nameP = [a.district || a.city || a.subregion, a.region].filter(Boolean).join(', ') || nameP; } catch (e) {}
      await AsyncStorage.setItem('coords', JSON.stringify(c2)); await AsyncStorage.setItem('place', nameP); setPlace(nameP); setCoords(c2); if (bump) bump(); setMsg('Location updated. Prayer times refreshed.');
    } catch (e) { setMsg("Couldn't get your location. Try again."); }
    setBusy(false);
  };

  if (!ready) return <View style={s.center}><ActivityIndicator color={VIOLET} /></View>;
  if (!coords) return (
    <View style={[s.center, { padding: 24 }]}>
      <Text style={[s.h1, { textAlign: 'center' }]}>Set your location</Text>
      <Text style={[s.mute, { textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>Kairo needs your location once to find accurate prayer times and build your day around them.</Text>
      <Pressable onPress={locate} style={{ backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 }}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Use my location</Text>}
      </Pressable>
      {!!msg && <Text style={{ color: '#FF6B6B', marginTop: 14, textAlign: 'center' }}>{msg}</Text>}
    </View>
  );
  if (!pd) return <View style={s.center}><ActivityIndicator color={VIOLET} /></View>;
  const P = pd.t, nm = now.getHours() * 60 + now.getMinutes(), today = now.getDay();
  const todayLog = log[dayKey(now)] || {};
  const prayed = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].filter((id) => todayLog['p:' + id]);
  const dateOf = (d) => { const x = new Date(now); x.setDate(x.getDate() + ((d + 6) % 7) - ((today + 6) % 7)); return x; };
  const keyed = (d) => { const cnt = {}; return buildDay(d, P, dateOf(d)).map((b) => { cnt[b.id] = (cnt[b.id] || 0) + 1; return { ...b, key: 'b:' + b.id + '#' + cnt[b.id] }; }); };
  const tasksOf = (d) => tasks.filter((t) => t.date === dayKey(dateOf(d)));
  const stat = (d) => { const l = log[dayKey(dateOf(d))] || {}; const tr = keyed(d).filter((b) => b.y !== 'sleep'), tk = tasksOf(d); const n = tr.filter((b) => l[b.key]).length + tk.filter((t) => l['t:' + t.id]).length; const total = tr.length + tk.length; return { n, total, pct: total ? Math.round((n / total) * 100) : 0 }; };
  const pr = [['fajr', 'Fajr', P.fajr, P.sunrise], ['dhuhr', today === 5 ? "Jumu'ah" : 'Dhuhr', P.dhuhr, P.asr], ['asr', 'Asr', P.asr, P.maghrib], ['maghrib', 'Maghrib', P.maghrib, P.isha], ['isha', 'Isha', P.isha, P.fajr + 1440]];
  const adj = nm < P.fajr ? nm + 1440 : nm;
  const curP = pr.find((x) => adj >= x[2] && adj < x[3]);
  const nextP = pr.find((x) => x[2] > adj) || ['fajr', 'Fajr (tomorrow)', P.fajr + 1440, 0];
  const todayB = buildDay(today, P, now);
  const firstOf = (bl) => { const f = bl.find((b) => b.y !== 'sleep'); return f ? f.s : null; };
  const wakeTxt = (() => { const a1 = firstOf(todayB); if (a1 != null && nm < a1) return fmt(a1); const tm = addDays(now, 1), a2 = firstOf(buildDay(tm.getDay(), calcTimes(tm, coords.lat, coords.lng), tm)); return a2 != null ? fmt(a2) : 'not set'; })();
  const cur = todayB.find((b) => nm >= b.s && nm < b.e);
  const nxt = cur ? todayB.find((b) => b.s >= cur.e && b.y !== 'sleep') : null;
  const missed = missedOf(log, coords);
  const vDate = dateOf(view), vIso = iso(vDate), vP = calcTimes(vDate, coords.lat, coords.lng);
  const preset = (h) => { const n = new Date(); const m = Math.ceil((n.getHours() * 60 + n.getMinutes()) / 5) * 5; setFtDay(0); setFtS(fmt(m)); setFtE(fmt(Math.min(m + h * 60, 1439))); };
  const goFree = () => {
    const a = parseT(ftS), b = parseT(ftE);
    if (a == null || b == null || b - a < 20) { setFtErr('Enter a start and end like 4:00 PM and 6:00 PM (at least 20 minutes).'); return; }
    const d = addDays(new Date(), ftDay);
    setFtOpen(false); setFtErr('');
    askAI(`I have free time ${ftDay === 0 ? 'today' : 'tomorrow'} (${iso(d)}) from ${fmt(a)} to ${fmt(b)}. Please recover what I missed: choose the most important missed work, tasks and targets, and arrange them in this window in a smart order with short breaks. Do not overlap prayer times or my fixed blocks.`);
  };
  const isToday = view === today;
  const sv = stat(view), vk = dayKey(dateOf(view)), vl = log[vk] || {}, canMark = dateOf(view) <= now;
  const items = [...keyed(view).map((b) => ({ k: 'b' + b.s, s: b.s, b })), ...pr.map((p) => ({ k: p[0], s: p[2] + 0.5, p })), ...tasksOf(view).map((t) => ({ k: 't' + t.id, s: t.time == null ? -1 : t.time, t }))].sort((a, b) => a.s - b.s);
  const prog = cur ? Math.min(1, (nm - cur.s) / (cur.e - cur.s)) : 0;

  const changeDay = (dir) => { const i = ORDER.indexOf(view), j = dir === 'left' ? Math.min(6, i + 1) : Math.max(0, i - 1); if (j !== i) setView(ORDER[j]); };
  return (
    <Swipe onSwipe={changeDay} can={(d) => (d === 'left' ? ORDER.indexOf(view) < 6 : ORDER.indexOf(view) > 0)}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Plan</Text>
          <Text style={s.mute}>{DN[today]}, {now.getDate()}/{now.getMonth() + 1}</Text>
          {place ? <Text style={[s.mute, { marginTop: 2 }]}>📍 {place}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setFtOpen(true)} accessibilityLabel="I have free time" style={s.iconBtn}><Ionicons name="flash-outline" size={20} color={c.ink} /></Pressable>
          <Pressable onPress={locate} accessibilityLabel="Update location" style={s.iconBtn}>{busy ? <ActivityIndicator color={VIOLET} /> : <Ionicons name="navigate-outline" size={20} color={c.ink} />}</Pressable>
          <Pressable onPress={onSettings} accessibilityLabel="Settings" style={s.iconBtn}><Ionicons name="settings-outline" size={20} color={c.ink} /></Pressable>
        </View>
      </View>
      {!!msg && <Text style={[s.mute, { marginBottom: 8 }]}>{msg}</Text>}

      {(() => {
        const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
        const nx = (exams || []).filter((e) => e.ts >= d0.getTime()).sort((a, b) => a.ts - b.ts)[0];
        if (!nx) return null;
        const dd = Math.round((nx.ts - d0.getTime()) / 864e5);
        if (dd > 30) return null;
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: dd <= 3 ? CORAL : c.line, borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <Ionicons name="school-outline" size={20} color={dd <= 3 ? CORAL : AMBER} />
            <Text style={{ color: c.ink, marginLeft: 10, flex: 1, fontWeight: '600' }}>{nx.course} exam {dd === 0 ? 'is today' : dd === 1 ? 'is tomorrow' : 'in ' + dd + ' days'}</Text>
            {EXAM.on ? <Text style={{ color: AMBER, fontSize: 12, fontWeight: '700' }}>EXAM MODE</Text> : null}
          </View>
        );
      })()}
      <View style={s.hero}>
        <Text style={s.heroTag}>NOW</Text>
        <Text style={s.heroTitle}>{cur ? cur.t : 'Free'}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${prog * 100}%` }]} /></View>
        {cur && <Text style={s.heroSub}>{cur.y === 'sleep' ? `Wake-up at ${wakeTxt}` : `${fmt(cur.s)} to ${fmt(cur.e)} · ${dur(cur.e - nm)} left${nxt ? ' · Next: ' + nxt.t : ''}`}</Text>}
        <View style={s.heroPill}>
          <Text style={s.heroPillT}>
            {curP ? (prayed.includes(curP[0]) ? `${curP[1]} prayed. Next: ${nextP[1]} in ${dur(nextP[2] - adj)}` : `${curP[1]} time is open until ${fmt(curP[3])} (${dur(curP[3] - adj)} left). Tap it below when done.`) : `Next: ${nextP[1]} at ${fmt(nextP[2])}, in ${dur(nextP[2] - adj)}`}
          </Text>
        </View>
      </View>

      {missed.length > 0 && (
        <Pressable onPress={() => setFtOpen(true)} style={[s.card, { flexDirection: 'row', alignItems: 'center', borderColor: ORANGE }]}>
          <Ionicons name="refresh-circle-outline" size={26} color={ORANGE} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{missed.length} missed block{missed.length === 1 ? '' : 's'} this week</Text>
            <Text style={s.mute}>{Math.round(missed.reduce((a, m) => a + m.mins, 0) / 60 * 10) / 10} h of work to recover. Tap when you have free time.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.mute} />
        </Pressable>
      )}
      <View style={s.card}>
        <View style={{ flexDirection: 'row' }}>
          {pr.map((p) => {
            const done = prayed.includes(p[0]), isCur = curP && curP[0] === p[0], isNext = !curP && nextP[0] === p[0];
            return (
              <Pressable key={p[0]} onPress={() => toggle(p[0])} style={[s.chip, done && { backgroundColor: AMBER }, (isCur || isNext) && { borderColor: AMBER }, isCur && { borderWidth: 2 }]}>
                <Text style={{ fontSize: 11, color: done ? '#222' : c.mute }}>{p[1]}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: done ? '#222' : c.ink, textAlign: 'center' }}>{fmt(p[2]).replace(' ', '\n')}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[s.mute, { fontSize: 11, marginTop: 8 }]}>Sunrise {fmt(P.sunrise)} · Wake-up {wakeTxt} · {prayed.length} of 5 prayed · {pd.src}</Text>
      </View>

      {settings.showQuote !== false && <QuoteCard c={c} settings={settings} saveSet={saveSet} />}
      <View style={{ flexDirection: 'row', marginVertical: 12 }}>
        {ORDER.map((d) => (
          <Pressable key={d} onPress={() => { anim(); setView(d); }} style={[s.day, view === d && { backgroundColor: VIOLET, borderColor: VIOLET }]}>
            <Text style={{ fontSize: 12, color: view === d ? '#fff' : c.ink, textAlign: 'center' }}>{DN[d]}{d === today ? ' •' : ''}{'\n'}{stat(d).pct}%</Text>
          </Pressable>
        ))}
      </View>

      {offOfIso(vIso) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5B84B22', borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <Ionicons name="sunny-outline" size={18} color={AMBER} />
          <Text style={{ color: c.ink, flex: 1, marginLeft: 8, fontWeight: '600' }}>University off · {offOfIso(vIso).label}</Text>
          <Pressable onPress={() => askAI({ text: `University is off on ${vIso} (${offOfIso(vIso).label}). Plan this day for me.`, day: vIso })}><Text style={{ color: VIOLET, fontWeight: '700' }}>Plan with AI</Text></Pressable>
        </View>
      )}
      <View style={[s.row, { marginBottom: 8 }]}>
        <Text style={[s.mute, { flex: 1 }]}>{sv.n} of {sv.total} done {isToday ? 'today' : 'on ' + DN[view]}{canMark ? '' : ' (future day, marking opens that day)'}</Text>
        <Pressable onPress={() => setAddOpen(true)} style={[s.btn, { minWidth: 0, paddingVertical: 7, paddingHorizontal: 14, flexDirection: 'row' }]}><Ionicons name="add" size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 4 }}>Add block</Text></Pressable>
      </View>
      {items.map((it) => {
        if (it.p) {
          const p = it.p, done = prayed.includes(p[0]);
          return (
            <View key={it.k} style={[s.row, { paddingHorizontal: 4, marginBottom: 8 }]}>
              <Text style={{ color: AMBER, fontWeight: '700', flex: 1 }}>☾  {p[1]} · {fmt(p[2])}</Text>
              {isToday && (
                <Pressable onPress={() => toggle(p[0])} style={[s.pray, done && { backgroundColor: AMBER }]}>
                  <Text style={{ color: done ? '#222' : AMBER, fontWeight: '600', fontSize: 13 }}>{done ? 'Prayed' : 'Mark prayed'}</Text>
                </Pressable>
              )}
            </View>
          );
        }
        if (it.t) {
          const t = it.t, dn = !!vl['t:' + t.id], tc = t.urgent ? '#FF6B6B' : '#FF9F5C';
          return (
            <View key={it.k} style={[s.block, { borderLeftColor: tc }]}>
              <Text style={s.time}>{t.time == null ? 'Task' : fmt(t.time)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15, textDecorationLine: dn ? 'line-through' : 'none' }}>{t.title}</Text>
                <Text style={[s.mute, t.urgent && { color: '#FF6B6B', fontWeight: '700' }]}>{t.urgent ? 'Urgent · ' : ''}{t.cat}</Text>
              </View>
              <Pressable disabled={!canMark} onPress={() => mark(vk, 't:' + t.id)} hitSlop={8} accessibilityLabel="Mark done" style={[s.tick, { borderColor: tc, opacity: canMark ? 1 : 0.35 }, dn && { backgroundColor: tc }]}>
                {dn ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
              </Pressable>
            </View>
          );
        }
        const b = it.b, isNow = isToday && nm >= b.s && nm < b.e, past = isToday && b.e <= nm;
        return (
          <Pressable key={it.k} onPress={() => { if (b.y !== 'sleep') setBsel(b); }} style={[s.block, { borderLeftColor: TYPE[b.y], opacity: past ? 0.45 : 1 }, isNow && { borderColor: TYPE[b.y], borderWidth: 2, borderLeftWidth: 5 }]}>
            <Text style={s.time}>{fmt(b.s)}{'\n'}to {fmt(b.e)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15, textDecorationLine: vl[b.key] ? 'line-through' : 'none' }}>{b.t}</Text>
              <Text style={[s.mute, vl['x:' + b.key] && { color: '#FF6B6B', fontWeight: '700' }]}>{dur(b.e - b.s)}{vl['x:' + b.key] ? ' · Skipped' : vl['s:' + b.key] && !vl[b.key] ? ' · Started' : ''}</Text>
            </View>
            {b.y !== 'sleep' && (
              <Pressable disabled={!canMark} onPress={() => mark(vk, b.key)} hitSlop={8} accessibilityLabel="Mark done" style={[s.tick, { borderColor: TYPE[b.y], opacity: canMark ? 1 : 0.35 }, vl[b.key] && { backgroundColor: TYPE[b.y] }]}>
                {vl[b.key] ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : vl['x:' + b.key] ? <Text style={{ color: TYPE[b.y], fontWeight: '800' }}>✕</Text> : null}
              </Pressable>
            )}
          </Pressable>
        );
      })}
      <BlockSheet c={c} blk={bsel} dateIso={vIso} P={vP} sched={sched} onClose={() => setBsel(null)} />
      <AddBlockSheet c={c} visible={addOpen} dateIso={vIso} dayNo={view} sched={sched} onClose={() => setAddOpen(false)} />
      <Sheet c={c} visible={ftOpen} onClose={() => setFtOpen(false)} title="I have free time" onSave={goFree} saveLabel="Ask AI to plan it">
        <Text style={s.mute}>Tell me when you are free. The AI picks what you missed and arranges it in a smart order.</Text>
        {lab(s, 'Quick')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[1, 2, 3].map((h) => <Chip key={h} s={s} c={c} on={false} label={'Next ' + h + ' h'} onPress={() => preset(h)} />)}</View>
        {lab(s, 'Day')}
        <View style={{ flexDirection: 'row' }}>
          <Chip s={s} c={c} on={ftDay === 0} label="Today" onPress={() => setFtDay(0)} />
          <Chip s={s} c={c} on={ftDay === 1} label="Tomorrow" onPress={() => setFtDay(1)} />
        </View>
        {lab(s, 'From and to')}
        <View style={{ flexDirection: 'row' }}>
          <TextInput value={ftS} onChangeText={setFtS} placeholder="4:00 PM" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1, marginRight: 8, textAlign: 'center' }]} />
          <TextInput value={ftE} onChangeText={setFtE} placeholder="6:00 PM" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1, textAlign: 'center' }]} />
        </View>
        {!!ftErr && <Text style={{ color: CORAL, marginTop: 10 }}>{ftErr}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </ScrollView>
    </Swipe>
  );
}

/* ---------- shared bits ---------- */
const CATS = ['Uni', 'AI SaaS', 'Home', 'Tuition'];
const CORAL = '#FF6B6B', ORANGE = '#FF9F5C', CYAN = '#35D0E0';
function Chip({ s, c, on, label, onPress }) {
  return (
    <Pressable onPress={onPress} style={[{ flexGrow: 0, flexShrink: 0, paddingVertical: 9, paddingHorizontal: 16, marginRight: 8, marginBottom: 6, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }, on && { backgroundColor: VIOLET, borderColor: VIOLET }]}>
      <Text numberOfLines={1} style={{ color: on ? '#fff' : c.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
function Seg({ c, value, items, onPick, style }) {
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: c.line }, style]}>
      {items.map((it) => {
        const on = value === it[0];
        return (
          <Pressable key={it[0]} onPress={() => onPick(it[0])} style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: on ? VIOLET : 'transparent' }}>
            <Text numberOfLines={1} style={{ color: on ? '#fff' : c.ink, fontWeight: '600', fontSize: 13 }}>{it[1]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
function Sheet({ c, visible, onClose, title, children, onSave, saveLabel, onDelete }) {
  const s = mk(c);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: 16 }}>
          <View style={s.row}>
            <Text style={[s.h1, { flex: 1, fontSize: 22 }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: c.mute, fontSize: 22 }}>✕</Text></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 10 }}>{children}</ScrollView>
          <Pressable onPress={onSave} style={{ backgroundColor: VIOLET, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{saveLabel}</Text>
          </Pressable>
          {onDelete ? <Pressable onPress={onDelete} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: '#FF6B6B', fontWeight: '700' }}>Delete</Text></Pressable> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const stepStyle = (c) => ({ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' });
const lab = (s, t) => <Text style={[s.mute, { marginTop: 14, marginBottom: 6, fontWeight: '600' }]}>{t}</Text>;
const inputStyle = (c) => ({ fontFamily: 'DMSans_400Regular', borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 });

/* ---------- Tasks screen ---------- */
function TaskSheet({ c, visible, task, date, onSave, onDelete, onClose }) {
  const s = mk(c);
  const [title, setTitle] = useState('');
  const [dt, setDt] = useState(new Date());
  const [hasTime, setHasTime] = useState(false);
  const [tm, setTm] = useState(9 * 60);
  const [cat, setCat] = useState('Uni');
  const [urgent, setUrgent] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    setErr('');
    if (task) { setTitle(task.title); setDt(new Date(task.ts)); setHasTime(task.time != null); setTm(task.time != null ? task.time : 9 * 60); setCat(task.cat); setUrgent(!!task.urgent); }
    else { setTitle(''); setDt(date ? new Date(date) : new Date()); setHasTime(false); setTm(9 * 60); setCat('Uni'); setUrgent(false); }
  }, [visible, task]);
  const save = () => {
    if (!title.trim()) { setErr('Write the task name first.'); return; }
    const d = new Date(dt); d.setHours(0, 0, 0, 0);
    onSave({ title: title.trim().slice(0, 80), date: dayKey(d), ts: d.getTime(), cat, time: hasTime ? tm : null, urgent });
  };
  return (
    <Sheet c={c} visible={visible} onClose={onClose} title={task ? 'Edit task' : 'New task'} onSave={save} saveLabel="Save" onDelete={task ? () => Alert.alert('Delete this task?', task.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]) : undefined}>
      <TextInput value={title} onChangeText={setTitle} placeholder="What do you need to do?" placeholderTextColor={c.mute} style={inputStyle(c)} />
      {lab(s, 'Date')}
      <DateField c={c} value={dt} onChange={(d) => setDt(d || new Date())} />
      {lab(s, 'Time')}
      <View style={{ flexDirection: 'row' }}>
        <Chip s={s} c={c} on={!hasTime} label="No time" onPress={() => setHasTime(false)} />
        <Chip s={s} c={c} on={hasTime} label="Set time" onPress={() => setHasTime(true)} />
      </View>
      {hasTime && <View style={{ marginTop: 10 }}><TimePick c={c} value={tm} onChange={setTm} /></View>}
      {lab(s, 'Category')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{CATS.map((k) => <Chip key={k} s={s} c={c} on={cat === k} label={k} onPress={() => setCat(k)} />)}</View>
      <View style={[s.row, { marginTop: 16 }]}>
        <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>Urgent</Text><Text style={s.mute}>Louder reminder</Text></View>
        <Switch value={urgent} onValueChange={setUrgent} trackColor={{ true: VIOLET }} />
      </View>
      {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
function Tasks({ c, tasks, log, mark, addTask, editTask, delTask }) {
  const s = mk(c);
  const [sheet, setSheet] = useState(null);
  const [filter, setFilter] = useState('All');
  const todayTs = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const isDone = (t) => !!(log[t.date] && log[t.date]['t:' + t.id]);
  const dayDiff = (t) => Math.round((t.ts - todayTs) / 864e5);
  const openN = tasks.filter((t) => !isDone(t)).length, overN = tasks.filter((t) => !isDone(t) && t.ts < todayTs).length, doneN = tasks.length - openN;
  const shown = tasks.filter((t) => filter === 'All' ? true : filter === 'Today' ? (dayDiff(t) === 0 && !isDone(t)) : filter === 'Week' ? (dayDiff(t) >= 0 && dayDiff(t) < 7 && !isDone(t)) : filter === 'Overdue' ? (dayDiff(t) < 0 && !isDone(t)) : filter === 'Urgent' ? (t.urgent && !isDone(t)) : isDone(t));
  const byTime = (a, b) => (a.ts - b.ts) || ((a.time == null ? 9999 : a.time) - (b.time == null ? 9999 : b.time));
  const groups = [
    ['Overdue', CORAL, shown.filter((t) => !isDone(t) && dayDiff(t) < 0).sort(byTime)],
    ['Today', VIOLET, shown.filter((t) => !isDone(t) && dayDiff(t) === 0).sort(byTime)],
    ['Tomorrow', c.ink, shown.filter((t) => !isDone(t) && dayDiff(t) === 1).sort(byTime)],
    ['Later', c.ink, shown.filter((t) => !isDone(t) && dayDiff(t) > 1).sort(byTime)],
    ['Done', c.mute, shown.filter(isDone).sort(byTime)],
  ].filter((g) => g[2].length);
  const row = (t) => {
    const dn = isDone(t), over = !dn && dayDiff(t) < 0, tc = over || t.urgent ? CORAL : ORANGE;
    return (
      <Pressable key={t.id} onPress={() => setSheet(t)} style={[s.block, { borderLeftColor: tc, opacity: dn ? 0.55 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15, textDecorationLine: dn ? 'line-through' : 'none' }}>{t.title}</Text>
          <Text style={[s.mute, t.urgent && { color: '#FF6B6B' }]}>{t.urgent ? 'Urgent · ' : ''}{t.cat}{t.time == null ? '' : ' · ' + fmt(t.time)}{dayDiff(t) > 1 || dayDiff(t) < 0 ? ' · ' + dateTxt(t.ts).slice(0, 10) : ''}</Text>
        </View>
        <Pressable onPress={() => mark(t.date, 't:' + t.id)} hitSlop={8} accessibilityLabel="Mark done" style={[s.tick, { borderColor: tc }, dn && { backgroundColor: tc }]}>
          {dn ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}
        </Pressable>
      </Pressable>
    );
  };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Tasks</Text>
            <Text style={s.mute}>{openN} open · {overN} overdue · {doneN} done</Text>
          </View>
          <Pressable onPress={() => setSheet('new')} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          {['All', 'Today', 'Week', 'Overdue', 'Urgent', 'Done'].map((f) => <Chip key={f} s={s} c={c} on={filter === f} label={f} onPress={() => setFilter(f)} />)}
        </ScrollView>
        {groups.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 4 }}>{tasks.length ? 'Nothing here' : 'No tasks yet'}</Text>
            <Text style={s.mute}>{tasks.length ? 'Try another filter.' : 'Tap "+ Add" to start.'}</Text>
          </View>
        )}
        {groups.map((g) => (
          <View key={g[0]} style={{ marginBottom: 6 }}>
            <Text style={{ color: g[1], fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginBottom: 8, marginTop: 6 }}>{g[0].toUpperCase()} · {g[2].length}</Text>
            {g[2].map(row)}
          </View>
        ))}
        <Text style={[s.mute, { fontSize: 12, marginTop: 8 }]}>Tap a task to edit, move or delete it. The Calendar tab shows tasks by day.</Text>
      </ScrollView>
      <TaskSheet c={c} visible={!!sheet} task={sheet && sheet !== 'new' ? sheet : null} date={null} onClose={() => setSheet(null)} onSave={(row) => { if (sheet === 'new') addTask({ id: Date.now(), ...row }); else editTask(sheet.id, row); setSheet(null); }} onDelete={() => { delTask(sheet.id); setSheet(null); }} />
    </View>
  );
}

/* ---------- Exams ---------- */
const EXAM_PROMPT = (today) => `This is a university exam schedule (date sheet). Extract every exam. Today is ${today}. Return ONLY JSON {"exams":[{"course":"","date":"YYYY-MM-DD","time":"HH:MM or empty"}]}. Use the course name as printed. If the year is missing, use the next upcoming occurrence of that date after today. Dates like 03/11 are day/month. If nothing can be read return {"exams":[]}.`;
async function readExamFile(key, b64, mime) {
  const txt = await gcall(key, { body: { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: EXAM_PROMPT(iso(new Date())) }] }] }, gc: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 3000 } });
  return parseLoose(txt, { exams: [] });
}
async function fileToB64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onloadend = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
}
function Exams({ c, exams, saveExams, examOn, settings, saveSet }) {
  const s = mk(c);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [course, setCourse] = useState('');
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yy, setYy] = useState(String(new Date().getFullYear()));
  const [err, setErr] = useState('');
  const [upOpen, setUpOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upMsg, setUpMsg] = useState('');
  const [found, setFound] = useState(null);
  const [fmode, setFmode] = useState('auto');
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const mode = settings.examMode || 'auto', lead = settings.examLead || 14;
  const box = { ...inputStyle(c), textAlign: 'center' };
  const openNew = () => { setEditId(null); setCourse(''); setDd(''); setMm(''); setYy(String(new Date().getFullYear())); setErr(''); setOpen(true); };
  const openEdit = (e) => { const d = new Date(e.ts); setEditId(e.id); setCourse(e.course); setDd(String(d.getDate())); setMm(String(d.getMonth() + 1)); setYy(String(d.getFullYear())); setErr(''); setOpen(true); };
  const submit = () => {
    if (!course.trim()) { setErr('Write the course name first.'); return; }
    const D = parseInt(dd, 10), M = parseInt(mm, 10), Y = parseInt(yy, 10), d = new Date(Y || 0, (M || 0) - 1, D || 0);
    if (!D || !M || !Y || d.getFullYear() !== Y || d.getMonth() !== M - 1 || d.getDate() !== D) { setErr('Enter a real date, like 15 / 12 / 2026.'); return; }
    if (!editId && d < d0) { setErr('That date has already passed.'); return; }
    const row = { id: editId || Date.now(), course: course.trim().slice(0, 40), ts: d.getTime() };
    anim(); saveExams(editId ? exams.map((x) => (x.id === editId ? { ...x, ...row } : x)) : [...exams, row]);
    setOpen(false);
  };
  const askDel = (e) => Alert.alert('Remove exam?', e.course, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { anim(); saveExams(exams.filter((x) => x.id !== e.id)); setOpen(false); } }]);
  const pick = async (kind) => {
    setUpMsg('');
    try {
      let b64, mime;
      if (kind === 'pdf') {
        const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
        if (r.canceled || !r.assets || !r.assets[0]) return;
        setBusy(true); b64 = await fileToB64(r.assets[0].uri); mime = r.assets[0].mimeType || 'application/pdf';
      } else {
        let res;
        if (kind === 'cam') { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { setUpMsg('Camera permission is off.'); return; } res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 }); }
        else res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
        if (res.canceled || !res.assets || !res.assets[0] || !res.assets[0].base64) return;
        setBusy(true); b64 = res.assets[0].base64; mime = res.assets[0].mimeType || 'image/jpeg';
      }
      const kk = await AsyncStorage.getItem('gemini_key');
      if (!kk) { setUpMsg('Add your Gemini key in Settings first.'); setBusy(false); return; }
      const out = await readExamFile(kk, b64, mime);
      const rows = (out.exams || []).map((x, i) => { const d = parseISO(x.date); return d && x.course ? { id: i, course: String(x.course).slice(0, 40), date: iso(d), on: true } : null; }).filter(Boolean);
      if (!rows.length) setUpMsg('I could not find any exams. Try a clearer photo, or add them by hand.');
      else { setFound(rows); setFmode(mode === 'off' ? 'auto' : mode); setUpOpen(false); }
    } catch (e) { setUpMsg(e && e.status === 429 ? 'All free AI limits are used up for today. They reset at about ' + resetLabel() + '.' : e && (e.status === 400 || e.status === 403) ? 'Gemini rejected the key.' : 'Could not read the file. Check your internet, or add the exams by hand.'); }
    setBusy(false);
  };
  const addFound = () => {
    const add = [];
    (found || []).filter((r) => r.on).forEach((r, i) => { const d = parseISO(r.date); if (!d || !r.course.trim()) return; if (exams.some((x) => x.course.toLowerCase() === r.course.trim().toLowerCase() && x.ts === d.getTime())) return; add.push({ id: Date.now() + i, course: r.course.trim().slice(0, 40), ts: d.getTime() }); });
    anim(); saveExams([...exams, ...add]); saveSet({ examMode: fmode }); setFound(null);
  };
  const list = [...exams].sort((a, b) => a.ts - b.ts);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Exams</Text>
            <Text style={s.mute}>{list.filter((e) => e.ts >= d0.getTime()).length} upcoming</Text>
          </View>
          <Pressable onPress={() => { setUpMsg(''); setUpOpen(true); }} style={[s.btn, { minWidth: 0, paddingHorizontal: 12, marginRight: 8, flexDirection: 'row' }]}><Ionicons name="cloud-upload-outline" size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Upload</Text></Pressable>
          <Pressable onPress={openNew} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text></Pressable>
        </View>
        <View style={[s.card, { marginTop: 12, borderColor: examOn ? AMBER : c.line }]}>
          <View style={s.row}>
            <Text style={{ color: examOn ? AMBER : c.ink, fontWeight: '800', fontSize: 13, letterSpacing: 0.6, flex: 1 }}>{examOn ? 'EXAM MODE IS ON' : 'EXAM MODE IS OFF'}</Text>
          </View>
          <Text style={[s.mute, { marginTop: 4, marginBottom: 10 }]}>{examOn ? 'Project and skill blocks became revision blocks in your Plan.' : mode === 'auto' ? 'It will turn on by itself before your first exam.' : mode === 'off' ? 'You turned it off.' : 'On now.'}</Text>
          <Seg c={c} value={mode} onPick={(v) => saveSet({ examMode: v })} items={[['auto', 'Auto'], ['on', 'On now'], ['off', 'Off']]} />
          {mode === 'auto' && (
            <View>
              <Text style={[s.mute, { marginTop: 10, marginBottom: 4 }]}>Start exam mode before the first exam</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[7, 14, 21, 30].map((n) => <Chip key={n} s={s} c={c} on={lead === n} label={n + ' days'} onPress={() => saveSet({ examLead: n })} />)}</View>
            </View>
          )}
        </View>
        {list.length === 0 && <Text style={[s.mute, { marginTop: 12 }]}>No exams yet. Upload your date sheet or tap "+ Add".</Text>}
        {list.map((e) => {
          const dd2 = Math.round((e.ts - d0.getTime()) / 864e5), past = dd2 < 0, col = past ? c.mute : dd2 <= 3 ? CORAL : dd2 <= 14 ? ORANGE : CYAN;
          return (
            <Pressable key={e.id} onPress={() => openEdit(e)} style={[s.block, { borderLeftColor: col, opacity: past ? 0.5 : 1, marginTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>{e.course}</Text>
                <Text style={s.mute}>{new Date(e.ts).toDateString().slice(0, 10)}</Text>
              </View>
              <Text style={{ color: col, fontWeight: '800' }}>{past ? 'Passed' : dd2 === 0 ? 'Today' : dd2 === 1 ? 'Tomorrow' : dd2 + ' days'}</Text>
              <Ionicons name="create-outline" size={18} color={c.mute} style={{ marginLeft: 10 }} />
            </Pressable>
          );
        })}
      </ScrollView>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title={editId ? 'Edit exam' : 'New exam'} onSave={submit} saveLabel="Save" onDelete={editId ? () => askDel(exams.find((x) => x.id === editId) || { course: '', id: editId }) : undefined}>
        <TextInput value={course} onChangeText={setCourse} placeholder="Course, e.g. Data Structures" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {lab(s, 'Date (day / month / year)')}
        <View style={{ flexDirection: 'row' }}>
          <TextInput value={dd} onChangeText={setDd} placeholder="DD" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={2} style={[box, { flex: 1, marginRight: 8 }]} />
          <TextInput value={mm} onChangeText={setMm} placeholder="MM" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={2} style={[box, { flex: 1, marginRight: 8 }]} />
          <TextInput value={yy} onChangeText={setYy} placeholder="YYYY" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={4} style={[box, { flex: 1.4 }]} />
        </View>
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
      <Sheet c={c} visible={upOpen} onClose={() => setUpOpen(false)} title="Upload exam schedule" onSave={() => setUpOpen(false)} saveLabel="Close">
        <Text style={s.mute}>Send a photo, screenshot or PDF of your date sheet. The AI reads it, and you check the result before anything is added.</Text>
        <View style={{ marginTop: 12 }}>
          {[['cam', 'camera-outline', 'Take a photo'], ['lib', 'image-outline', 'Choose an image or screenshot'], ['pdf', 'document-text-outline', 'Choose a PDF']].map((x) => (
            <Pressable key={x[0]} onPress={() => pick(x[0])} disabled={busy} style={[s.btn, { marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 14 }]}><Ionicons name={x[1]} size={20} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 10 }}>{x[2]}</Text></Pressable>
          ))}
        </View>
        {busy && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}><ActivityIndicator color={VIOLET} /><Text style={[s.mute, { marginLeft: 8 }]}>Reading your schedule...</Text></View>}
        {!!upMsg && <Text style={{ color: CORAL, marginTop: 10 }}>{upMsg}</Text>}
        <Text style={[s.mute, { fontSize: 12, marginTop: 10 }]}>The file is sent to Google's Gemini service only to read it.</Text>
        <View style={{ height: 8 }} />
      </Sheet>
      <Sheet c={c} visible={!!found} onClose={() => setFound(null)} title="Check your exams" onSave={addFound} saveLabel={'Add ' + (found ? found.filter((r) => r.on).length : 0) + ' exams'}>
        <Text style={s.mute}>Fix anything that is wrong. Untick an exam to skip it. Dates are year-month-day.</Text>
        {(found || []).map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <Pressable onPress={() => setFound(found.map((x) => (x.id === r.id ? { ...x, on: !x.on } : x)))} hitSlop={8} style={[s.tick, { width: 26, height: 26, borderRadius: 13, borderColor: VIOLET }, r.on && { backgroundColor: VIOLET }]}>{r.on ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}</Pressable>
            <TextInput value={r.course} onChangeText={(v) => setFound(found.map((x) => (x.id === r.id ? { ...x, course: v } : x)))} style={[inputStyle(c), { flex: 1, marginLeft: 8, paddingHorizontal: 10 }]} />
            <TextInput value={r.date} onChangeText={(v) => setFound(found.map((x) => (x.id === r.id ? { ...x, date: v } : x)))} style={[inputStyle(c), { width: 112, marginLeft: 6, paddingHorizontal: 6, textAlign: 'center' }]} />
          </View>
        ))}
        {lab(s, 'Exam mode')}
        <Seg c={c} value={fmode} onPick={setFmode} items={[['auto', 'Auto'], ['on', 'On now'], ['off', 'Off']]} />
        <Text style={[s.mute, { fontSize: 12, marginTop: 6 }]}>{fmode === 'auto' ? `Auto starts ${lead} days before your first exam.` : fmode === 'on' ? 'Exam mode starts right away.' : 'Exam mode stays off. You can change it later.'}</Text>
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ---------- Swipe + time picker + block editor ---------- */
function Swipe({ onSwipe, can, children, style }) {
  const W = Dimensions.get('window').width;
  const tx = React.useRef(new Animated.Value(0)).current, op = React.useRef(new Animated.Value(1)).current;
  const cb = React.useRef({ onSwipe, can }); cb.current = { onSwipe, can };
  const back = () => Animated.parallel([Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 6 }), Animated.timing(op, { toValue: 1, duration: 140, useNativeDriver: true })]).start();
  const pr = React.useRef(null);
  if (!pr.current) pr.current = PanResponder.create({
    onMoveShouldSetPanResponderCapture: (e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
    onPanResponderMove: (e, g) => {
      const dir = g.dx < 0 ? 'left' : 'right', ok = !cb.current.can || cb.current.can(dir);
      tx.setValue(g.dx * (ok ? 0.55 : 0.18)); op.setValue(1 - Math.min(0.5, (Math.abs(g.dx) / W) * (ok ? 0.8 : 0.3)));
    },
    onPanResponderRelease: (e, g) => {
      const dir = g.dx < 0 ? 'left' : 'right', ok = !cb.current.can || cb.current.can(dir);
      const go = ok && Math.abs(g.dx) > 40 && (Math.abs(g.dx) > W * 0.2 || Math.abs(g.vx) > 0.55);
      if (!go) { back(); return; }
      if (REDUCE) { tx.setValue(0); op.setValue(1); cb.current.onSwipe(dir); return; }
      const sign = dir === 'left' ? -1 : 1;
      Animated.parallel([Animated.timing(tx, { toValue: sign * W * 0.45, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }), Animated.timing(op, { toValue: 0, duration: 110, useNativeDriver: true })]).start(() => {
        cb.current.onSwipe(dir);
        tx.setValue(-sign * W * 0.28); op.setValue(0);
        Animated.parallel([Animated.spring(tx, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 4 }), Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true })]).start();
      });
    },
    onPanResponderTerminate: () => back(),
  });
  return (
    <View style={[{ flex: 1 }, style]} {...pr.current.panHandlers}>
      <Animated.View style={{ flex: 1, opacity: op, transform: [{ translateX: tx }] }}>{children}</Animated.View>
    </View>
  );
}
function TimePick({ c, value, onChange }) {
  const s = mk(c);
  const h24 = Math.floor(value / 60), mi = value % 60, ap = h24 >= 12 ? 'PM' : 'AM', h12 = h24 % 12 || 12;
  const put = (hh, mm, a) => onChange(Math.max(0, Math.min(1439, ((hh % 12) + (a === 'PM' ? 12 : 0)) * 60 + mm)));
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
        <Pressable onPress={() => put(h12 === 1 ? 12 : h12 - 1, mi, ap)} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>−</Text></Pressable>
        <Text style={{ fontSize: 34, fontWeight: '800', color: c.ink, minWidth: 120, textAlign: 'center' }}>{h12}:{String(mi).padStart(2, '0')}</Text>
        <Pressable onPress={() => put(h12 === 12 ? 1 : h12 + 1, mi, ap)} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>+</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        {[0, 10, 20, 30, 40, 50].map((m) => <Chip key={m} s={s} c={c} on={mi === m} label={':' + String(m).padStart(2, '0')} onPress={() => put(h12, m, ap)} />)}
        <Chip s={s} c={c} on={ap === 'AM'} label="AM" onPress={() => put(h12, mi, 'AM')} />
        <Chip s={s} c={c} on={ap === 'PM'} label="PM" onPress={() => put(h12, mi, 'PM')} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 2 }}>
        <Pressable onPress={() => onChange(Math.max(0, value - 5))} style={[s.btn, { minWidth: 0, paddingHorizontal: 16, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>−5 min</Text></Pressable>
        <Pressable onPress={() => onChange(Math.min(1439, value + 5))} style={[s.btn, { minWidth: 0, paddingHorizontal: 16 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>+5 min</Text></Pressable>
      </View>
    </View>
  );
}
function DurPick({ c, value, onChange }) {
  const s = mk(c);
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <Chip key={m} s={s} c={c} on={value === m} label={m < 60 ? m + ' min' : m % 60 ? m + ' min' : m / 60 + ' h'} onPress={() => onChange(m)} />)}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Pressable onPress={() => onChange(Math.max(5, value - 5))} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>−</Text></Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: c.ink, fontWeight: '800', fontSize: 18 }}>{dur(value)}</Text>
        <Pressable onPress={() => onChange(Math.min(720, value + 5))} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>+</Text></Pressable>
      </View>
    </View>
  );
}
const byLabel = (by) => (by === 'ai' ? 'AI assistant' : by === 'setup' ? 'AI setup' : by === 'you' ? 'You' : by === 'timetable' ? 'Your timetable' : 'System');
const dateLabel = (ts) => (ts ? new Date(ts).toDateString().slice(4, 10) + ' ' + new Date(ts).getFullYear() : 'an earlier version');
const TYPE_LABEL = { faith: 'Worship', life: 'Routine', study: 'Study', project: 'Project', skill: 'Skill', teach: 'Tuition', uni: 'Class', sleep: 'Sleep' };
const AN_LABEL = { clock: 'Clock time', fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
function BlockSheet({ c, blk, dateIso, P, sched, onClose }) {
  const s = mk(c);
  const m = blk && blk.meta ? blk.meta : {};
  const r = m.src === 'r' ? (PROF.routine || []).find((x) => x.id === m.rid) : null;
  const o = m.src === 'o' ? ONE.find((x) => x.id === m.oid) : null;
  const [mode, setMode] = useState('view');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('study');
  const [start, setStart] = useState(540);
  const [mins, setMins] = useState(60);
  const [days, setDays] = useState([]);
  const [anchor, setAnchor] = useState('clock');
  const [off, setOff] = useState(0);
  const [scope, setScope] = useState('perm');
  useEffect(() => {
    if (!blk) return;
    const rs = r ? (r.a === 'clock' ? r.o : (P[r.a] || 0) + r.o) : o ? o.s : blk.s;
    setMode('view'); setTitle(blk.t); setType(RTYPES.includes(blk.y) ? blk.y : 'study'); setStart(rs); setMins(r ? r.m : o ? o.e - o.s : blk.e - blk.s);
    setDays(r ? r.days : []); setAnchor(r ? r.a : 'clock'); setOff(r && r.a !== 'clock' ? r.o : 0); setScope(r ? 'perm' : 'temp');
  }, [blk]);
  if (!blk) return null;
  const editable = !!(r || o);
  const cur = anchor === 'clock' ? start : (P[anchor] || 0) + off;
  const pickAnchor = (a) => { if (a === anchor) return; if (a === 'clock') setStart(Math.max(0, Math.min(1439, cur))); else setOff(Math.round(cur - (P[a] || 0))); setAnchor(a); };
  const save = () => {
    const t = title.trim() || blk.t;
    if (r) {
      if (scope === 'perm') sched.updateRoutine(r.id, { title: t, type, days: days.length ? days : r.days, a: anchor, o: anchor === 'clock' ? Math.max(0, Math.min(1439, start)) : off, m: mins });
      else { sched.skipOnce(r.id, dateIso); sched.addOne({ date: dateIso, title: t, type, s: Math.max(0, Math.min(1439, cur)), e: Math.min(1440, Math.max(0, cur) + mins) }); }
    } else if (o) sched.updateOne(o.id, { title: t, type, s: Math.max(0, Math.min(1439, start)), e: Math.min(1440, start + mins) });
    onClose();
  };
  const info = m.src === 'r' && r ? [`Repeats ${dShort(r.days)} · ${ruleOf(r)}`, `Permanent routine block`, `Created by ${byLabel(r.by)} on ${dateLabel(r.ts)}`]
    : m.src === 'o' && o ? [`One-time block on ${new Date(dateIso + 'T12:00:00').toDateString().slice(0, 10)}`, 'Temporary', `Created by ${byLabel(o.by)} on ${dateLabel(o.ts)}`]
    : m.src === 'c' ? ['Class from your timetable', `Created by ${byLabel('timetable')}`, 'Change classes in Settings, then Run setup again']
    : ['Block from an earlier version', `Created by ${byLabel('system')}`];
  const askRemoveAll = () => Alert.alert('Remove permanently?', `"${blk.t}" will be removed from every day it repeats.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { sched.removeRoutine(r.id); onClose(); } }]);
  const title0 = mode === 'edit' ? 'Edit block' : mode === 'remove' ? 'Remove block' : blk.t;
  const onSave = mode === 'view' ? (editable ? () => setMode('edit') : onClose) : mode === 'edit' ? save : () => setMode('view');
  const label = mode === 'view' ? (editable ? 'Edit' : 'Close') : mode === 'edit' ? 'Save' : 'Back';
  const onDel = mode === 'view' ? () => setMode('remove') : undefined;
  return (
    <Sheet c={c} visible={!!blk} onClose={onClose} title={title0} onSave={onSave} saveLabel={label} onDelete={onDel}>
      {mode === 'view' && (
        <View>
          <View style={[s.row, { marginBottom: 10 }]}>
            <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: TYPE[blk.y] || c.mute, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '800', fontSize: 18 }}>{fmt(blk.s)} to {fmt(blk.e)}</Text>
              <Text style={s.mute}>{dur(blk.e - blk.s)} · {TYPE_LABEL[blk.y] || 'Block'}</Text>
            </View>
          </View>
          <View style={s.card}>{info.map((t, i) => <Text key={i} style={[{ color: i === 0 ? c.ink : c.mute, fontSize: 13, marginBottom: 3 }]}>{t}</Text>)}</View>
        </View>
      )}
      {mode === 'edit' && (
        <View>
          <TextInput value={title} onChangeText={setTitle} placeholder="Name" placeholderTextColor={c.mute} style={inputStyle(c)} />
          {lab(s, 'Type')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{RTYPES.map((k2) => <Chip key={k2} s={s} c={c} on={type === k2} label={TYPE_LABEL[k2]} onPress={() => setType(k2)} />)}</View>
          {r && (
            <View>
              {lab(s, 'Time is based on')}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{['clock', ...ANCHORS].map((a) => <Chip key={a} s={s} c={c} on={anchor === a} label={AN_LABEL[a]} onPress={() => pickAnchor(a)} />)}</View>
            </View>
          )}
          {lab(s, anchor === 'clock' ? 'Start time' : 'Minutes after ' + AN_LABEL[anchor] + ' (negative = before)')}
          {anchor === 'clock' ? <TimePick c={c} value={start} onChange={setStart} /> : (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPress={() => setOff(off - 5)} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>−</Text></Pressable>
                <Text style={{ flex: 1, textAlign: 'center', color: c.ink, fontWeight: '800', fontSize: 18 }}>{off > 0 ? '+' : ''}{off} min</Text>
                <Pressable onPress={() => setOff(off + 5)} style={stepStyle(c)}><Text style={{ color: c.ink, fontSize: 22 }}>+</Text></Pressable>
              </View>
              <Text style={[s.mute, { textAlign: 'center', marginTop: 6 }]}>Today that is {fmt(Math.max(0, cur))}</Text>
            </View>
          )}
          {lab(s, 'Length')}
          <DurPick c={c} value={mins} onChange={setMins} />
          {r && (
            <View>
              {lab(s, 'Apply to')}
              <Seg c={c} value={scope} onPick={setScope} items={[['perm', 'Every selected day'], ['temp', 'This day only']]} />
              {scope === 'perm' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{DAYS_ORDER.map((d) => <Chip key={d} s={s} c={c} on={days.includes(d)} label={DN[d]} onPress={() => setDays((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))} />)}</View>
              )}
            </View>
          )}
          <View style={{ height: 8 }} />
        </View>
      )}
      {mode === 'remove' && (
        <View>
          {m.src === 'r' && r && (
            <View>
              <Pressable onPress={() => { sched.skipOnce(r.id, dateIso); onClose(); }} style={[s.btn, { marginBottom: 10 }]}><Text style={{ color: c.ink, fontWeight: '700' }}>Remove for this day only</Text></Pressable>
              <Pressable onPress={askRemoveAll} style={[s.btn, { borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Remove permanently</Text></Pressable>
            </View>
          )}
          {m.src === 'o' && o && <Pressable onPress={() => { sched.removeOne(o.id); onClose(); }} style={[s.btn, { borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Delete this one-time block</Text></Pressable>}
          {m.src === 'c' && <Pressable onPress={() => { sched.skipOnce('c:' + blk.t, dateIso); onClose(); }} style={s.btn}><Text style={{ color: c.ink, fontWeight: '700' }}>Skip this class today</Text></Pressable>}
          {!['r', 'o', 'c'].includes(m.src) && <Text style={s.mute}>This block cannot be removed here.</Text>}
        </View>
      )}
    </Sheet>
  );
}
function AddBlockSheet({ c, visible, dateIso, sched, onClose, dayNo }) {
  const s = mk(c);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('study');
  const [start, setStart] = useState(16 * 60);
  const [mins, setMins] = useState(60);
  const [scope, setScope] = useState('one');
  const [days, setDays] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setTitle(''); setErr(''); setScope('one'); setDays([dayNo]); } }, [visible]);
  const save = () => {
    if (!title.trim()) { setErr('Give the block a name.'); return; }
    if (scope === 'one') sched.addOne({ date: dateIso, title: title.trim().slice(0, 50), type, s: start, e: Math.min(1440, start + mins) });
    else { if (!days.length) { setErr('Pick at least one day.'); return; } sched.addRoutine({ title: title.trim().slice(0, 50), type, days, a: 'clock', o: start, m: mins }); }
    onClose();
  };
  return (
    <Sheet c={c} visible={visible} onClose={onClose} title="Add a block" onSave={save} saveLabel="Add">
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Gym, English practice" placeholderTextColor={c.mute} style={inputStyle(c)} />
      {lab(s, 'Type')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{RTYPES.map((k2) => <Chip key={k2} s={s} c={c} on={type === k2} label={TYPE_LABEL[k2]} onPress={() => setType(k2)} />)}</View>
      {lab(s, 'Start time')}
      <TimePick c={c} value={start} onChange={setStart} />
      {lab(s, 'Length')}
      <DurPick c={c} value={mins} onChange={setMins} />
      {lab(s, 'How often')}
      <Seg c={c} value={scope} onPick={setScope} items={[['one', 'Only this day'], ['rep', 'Repeats weekly']]} />
      {scope === 'rep' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{DAYS_ORDER.map((d) => <Chip key={d} s={s} c={c} on={days.includes(d)} label={DN[d]} onPress={() => setDays((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))} />)}</View>}
      {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

/* ---------- Targets ---------- */
const AREAS = ['Study', 'Career', 'Health', 'Faith', 'Money', 'Skill', 'Personal'];
const AREA_COL = { Study: '#B58CFF', Career: '#5C9CFF', Health: '#FF9F5C', Faith: '#F5B84B', Money: '#35D0E0', Skill: '#FF7DB0', Personal: '#8A93AD' };
const tProg = (t) => (t.goal > 0 ? Math.min(1, t.cur / t.goal) : t.steps && t.steps.length ? t.steps.filter((x) => x.done).length / t.steps.length : 0);
function tStatus(t, c) {
  const now = Date.now(), p = tProg(t);
  if (p >= 1) return ['Done', CYAN];
  if (!t.due) return ['In progress', c.mute];
  if (now > t.due + 864e5 - 1) return ['Overdue', CORAL];
  const f = Math.min(1, Math.max(0, (now - t.ts) / Math.max(1, t.due - t.ts)));
  return f - p > 0.15 ? ['Behind', ORANGE] : ['On track', CYAN];
}
function Targets({ c, targets, saveTargets, askAI }) {
  const s = mk(c);
  const [open, setOpen] = useState(false);
  const [exp, setExp] = useState(null);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('Study');
  const [dd, setDd] = useState('');
  const [mm, setMm] = useState('');
  const [yy, setYy] = useState(String(new Date().getFullYear()));
  const [goal, setGoal] = useState('');
  const [unit, setUnit] = useState('');
  const [stepsTxt, setStepsTxt] = useState('');
  const [newStep, setNewStep] = useState('');
  const [err, setErr] = useState('');
  const box = { ...inputStyle(c), textAlign: 'center' };
  const upd = (id, patch) => saveTargets(targets.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const submit = () => {
    if (!title.trim()) { setErr('Write the target first.'); return; }
    let due = null;
    if (dd || mm) {
      const D = parseInt(dd, 10), M = parseInt(mm, 10), Y = parseInt(yy, 10), d = new Date(Y || 0, (M || 0) - 1, D || 0);
      if (!D || !M || !Y || d.getFullYear() !== Y || d.getMonth() !== M - 1 || d.getDate() !== D) { setErr('Enter a real date, like 15 / 12 / 2026, or leave it empty.'); return; }
      due = d.getTime();
    }
    const g = parseFloat(goal.replace(/,/g, '')) || 0;
    const steps = stepsTxt.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20).map((t, i) => ({ id: Date.now() + i, t: t.slice(0, 80), done: false }));
    anim();
    saveTargets([...targets, { id: Date.now(), title: title.trim().slice(0, 80), area, due, goal: g, unit: unit.trim().slice(0, 12), cur: 0, steps, ts: Date.now() }]);
    setTitle(''); setDd(''); setMm(''); setGoal(''); setUnit(''); setStepsTxt(''); setErr(''); setOpen(false);
  };
  const del = (t) => Alert.alert('Remove target?', t.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { anim(); saveTargets(targets.filter((x) => x.id !== t.id)); } }]);
  const sorted = [...targets].sort((a, b) => (tProg(a) >= 1 ? 1 : 0) - (tProg(b) >= 1 ? 1 : 0) || (a.due || 9e15) - (b.due || 9e15));
  const open2 = targets.filter((t) => tProg(t) < 1).length;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Targets</Text>
            <Text style={s.mute}>{open2} active · {targets.length - open2} done</Text>
          </View>
          <Pressable onPress={() => setOpen(true)} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text></Pressable>
        </View>
        {sorted.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 28, marginTop: 14 }]}>
            <Ionicons name="flag-outline" size={30} color={c.mute} />
            <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>No targets yet</Text>
            <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>Add a goal with a date. Kairo tracks your pace and the AI can plan the steps for you.</Text>
          </View>
        )}
        {sorted.map((t) => {
          const p = tProg(t), st = tStatus(t, c), col = AREA_COL[t.area] || VIOLET, isOpen = exp === t.id;
          const days = t.due ? Math.ceil((t.due - Date.now()) / 864e5) : null;
          const stepSize = t.goal >= 100 ? 10 : t.goal >= 20 ? 5 : 1;
          return (
            <View key={t.id} style={[s.card, { padding: 0, overflow: 'hidden' }]}>
              <Pressable onPress={() => setExp(isOpen ? null : t.id)} style={{ padding: 14 }}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{t.title}</Text>
                    <Text style={s.mute}>{t.area}{days != null ? (days >= 0 ? ' · ' + (days === 0 ? 'due today' : days + ' days left') : ' · ' + Math.abs(days) + ' days late') : ''}</Text>
                  </View>
                  <Text style={{ color: st[1], fontWeight: '800', fontSize: 12 }}>{st[0].toUpperCase()}</Text>
                </View>
                <View style={{ marginTop: 10 }}><GrowBar pct={p * 100} color={col} bg={c.line} h={8} /></View>
                <Text style={[s.mute, { marginTop: 4, fontSize: 12 }]}>{t.goal > 0 ? `${t.cur} of ${t.goal} ${t.unit || ''}` : t.steps.length ? `${t.steps.filter((x) => x.done).length} of ${t.steps.length} steps` : 'No steps yet'} · {Math.round(p * 100)}%</Text>
              </Pressable>
              {isOpen && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.line }}>
                  {t.goal > 0 && (
                    <View style={[s.row, { marginTop: 12 }]}>
                      <Pressable onPress={() => upd(t.id, { cur: Math.max(0, t.cur - stepSize) })} style={[s.tick, { width: 38, height: 38, borderRadius: 19, borderColor: c.line }]}><Text style={{ color: c.ink, fontSize: 20 }}>−</Text></Pressable>
                      <Text style={{ flex: 1, textAlign: 'center', color: c.ink, fontWeight: '800', fontSize: 18 }}>{t.cur} / {t.goal} {t.unit}</Text>
                      <Pressable onPress={() => upd(t.id, { cur: Math.min(t.goal, t.cur + stepSize) })} style={[s.tick, { width: 38, height: 38, borderRadius: 19, borderColor: col }]}><Text style={{ color: c.ink, fontSize: 20 }}>+</Text></Pressable>
                    </View>
                  )}
                  {t.steps.map((x) => (
                    <View key={x.id} style={[s.row, { marginTop: 10 }]}>
                      <Pressable onPress={() => upd(t.id, { steps: t.steps.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)) })} hitSlop={8} style={[s.tick, { width: 26, height: 26, borderRadius: 13, borderColor: col }, x.done && { backgroundColor: col }]}>{x.done ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}</Pressable>
                      <Text style={{ flex: 1, marginLeft: 10, color: x.done ? c.mute : c.ink, textDecorationLine: x.done ? 'line-through' : 'none' }}>{x.t}</Text>
                      <Pressable onPress={() => upd(t.id, { steps: t.steps.filter((y) => y.id !== x.id) })} hitSlop={8}><Text style={{ color: c.mute, fontSize: 16 }}>✕</Text></Pressable>
                    </View>
                  ))}
                  <View style={[s.row, { marginTop: 12 }]}>
                    <TextInput value={newStep} onChangeText={setNewStep} placeholder="Add a step" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1 }]} onSubmitEditing={() => { if (newStep.trim()) { upd(t.id, { steps: [...t.steps, { id: Date.now(), t: newStep.trim().slice(0, 80), done: false }] }); setNewStep(''); } }} />
                    <Pressable onPress={() => { if (newStep.trim()) { upd(t.id, { steps: [...t.steps, { id: Date.now(), t: newStep.trim().slice(0, 80), done: false }] }); setNewStep(''); } }} style={[s.btn, { marginLeft: 8, minWidth: 60 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Add</Text></Pressable>
                  </View>
                  <View style={[s.row, { marginTop: 12 }]}>
                    <Pressable onPress={() => askAI(`Please help me reach my target "${t.title}"${t.due ? ' by ' + iso(new Date(t.due)) : ''}. It is ${Math.round(tProg(t) * 100)}% done. Break it into clear steps, then schedule the work in my free time.`)} style={[s.btn, { flex: 1, marginRight: 8, flexDirection: 'row', justifyContent: 'center' }]}><Ionicons name="sparkles-outline" size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Plan with AI</Text></Pressable>
                    <Pressable onPress={() => del(t)} style={[s.btn, { minWidth: 0, paddingHorizontal: 16, borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Remove</Text></Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title="New target" onSave={submit} saveLabel="Save">
        <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Finish my SaaS MVP" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {lab(s, 'Area')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{AREAS.map((a) => <Chip key={a} s={s} c={c} on={area === a} label={a} onPress={() => setArea(a)} />)}</View>
        {lab(s, 'Due date (optional)')}
        <View style={{ flexDirection: 'row' }}>
          <TextInput value={dd} onChangeText={setDd} placeholder="DD" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={2} style={[box, { flex: 1, marginRight: 8 }]} />
          <TextInput value={mm} onChangeText={setMm} placeholder="MM" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={2} style={[box, { flex: 1, marginRight: 8 }]} />
          <TextInput value={yy} onChangeText={setYy} placeholder="YYYY" placeholderTextColor={c.mute} keyboardType="number-pad" maxLength={4} style={[box, { flex: 1.4 }]} />
        </View>
        {lab(s, 'Number goal (optional)')}
        <View style={{ flexDirection: 'row' }}>
          <TextInput value={goal} onChangeText={setGoal} placeholder="e.g. 20" placeholderTextColor={c.mute} keyboardType="numeric" style={[inputStyle(c), { flex: 1, marginRight: 8 }]} />
          <TextInput value={unit} onChangeText={setUnit} placeholder="unit, e.g. books" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1.4 }]} />
        </View>
        {lab(s, 'Steps (optional, one per line)')}
        <TextInput value={stepsTxt} onChangeText={setStepsTxt} multiline placeholder={'Plan the features\nBuild the login\nTest with 5 users'} placeholderTextColor={c.mute} style={[inputStyle(c), { minHeight: 90, maxHeight: 160, textAlignVertical: 'top' }]} />
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ---------- Focus timer ---------- */
function Focus({ c, sessions, addSession, openTasks }) {
  const s = mk(c);
  const [len, setLen] = useState(25);
  const [brk, setBrk] = useState(5);
  const [label, setLabel] = useState('');
  const [run, setRun] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(null);
  const busyRef = React.useRef(false);
  const save = async (r) => { try { if (r) await AsyncStorage.setItem('kairo_focus_run', JSON.stringify(r)); else await AsyncStorage.removeItem('kairo_focus_run'); } catch (e) {} };
  const cancelN = async () => { try { const all = await Notifications.getAllScheduledNotificationsAsync(); for (const n of all) { if (n.content && n.content.data && n.content.data.kind === 'focus') await Notifications.cancelScheduledNotificationAsync(n.identifier); } } catch (e) {} };
  const ping = (r) => sched({ title: r.mode === 'focus' ? 'Focus session complete' : 'Break is over', body: r.mode === 'focus' ? 'Well done. Take a short break.' : 'Ready for the next session?', data: { kind: 'focus', tab: 2 } }, new Date(r.endTs));
  const finish = async (r) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setRun(null); await save(null);
    if (r.mode === 'focus') addSession({ id: Date.now(), ts: r.endTs, min: Math.max(1, Math.round(r.total / 60000)), label: r.label || '' });
    setDone({ mode: r.mode, min: Math.round(r.total / 60000), label: r.label });
    try { Vibration.vibrate([0, 250, 150, 250]); } catch (e) {}
    busyRef.current = false;
  };
  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem('kairo_focus_run'); if (v) { const r = JSON.parse(v); if (r.paused == null && r.endTs <= Date.now()) finish(r); else setRun(r); } } catch (e) {} })(); }, []);
  useEffect(() => {
    if (!run || run.paused != null) return undefined;
    const i = setInterval(() => { const n = Date.now(); setNow(n); if (n >= run.endTs) finish(run); }, 500);
    return () => clearInterval(i);
  }, [run]);
  const start = async (mode, min) => {
    const total = min * 60000, r = { mode, total, endTs: Date.now() + total, label: label.trim().slice(0, 60), paused: null };
    setDone(null); setRun(r); setNow(Date.now()); await save(r); await cancelN(); await ping(r);
  };
  const pause = async () => { const r = { ...run, paused: Math.max(0, run.endTs - Date.now()) }; setRun(r); await save(r); await cancelN(); };
  const resume = async () => { const r = { ...run, endTs: Date.now() + run.paused, paused: null }; setRun(r); setNow(Date.now()); await save(r); await ping(r); };
  const stop = async () => {
    await cancelN();
    const el = run ? run.total - (run.paused != null ? run.paused : Math.max(0, run.endTs - Date.now())) : 0;
    if (run && run.mode === 'focus' && el >= 3 * 60000) addSession({ id: Date.now(), ts: Date.now(), min: Math.round(el / 60000), label: run.label || '' });
    setRun(null); await save(null);
  };
  const rem = run ? (run.paused != null ? run.paused : Math.max(0, run.endTs - now)) : len * 60000;
  const total = run ? run.total : len * 60000;
  const mmss = `${String(Math.floor(rem / 60000)).padStart(2, '0')}:${String(Math.floor((rem % 60000) / 1000)).padStart(2, '0')}`;
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const todayS = sessions.filter((x) => x.ts >= day0.getTime()).sort((a, b) => b.ts - a.ts);
  const todayMin = todayS.reduce((a, x) => a + x.min, 0);
  const wDays = Array.from({ length: 7 }, (_, i) => addDays(day0, i - 6));
  const wVals = wDays.map((d) => sessions.filter((x) => x.ts >= d.getTime() && x.ts < d.getTime() + 864e5).reduce((a, x) => a + x.min, 0));
  const weekMin = wVals.reduce((a, b) => a + b, 0);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Focus</Text>
      <Text style={s.mute}>{todayMin} min today · {weekMin} min this week</Text>
      <View style={[s.hero, { marginTop: 12, alignItems: 'center', backgroundColor: run && run.mode === 'break' ? '#2F8FA3' : VIOLET }]}>
        <Text style={s.heroTag}>{run ? (run.mode === 'focus' ? (run.paused != null ? 'PAUSED' : 'FOCUSING') : 'BREAK') : 'READY'}</Text>
        <Text style={{ color: '#fff', fontSize: 64, fontWeight: '800', marginVertical: 6 }}>{mmss}</Text>
        <View style={{ alignSelf: 'stretch', height: 6, backgroundColor: '#ffffff40', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: 6, width: `${Math.min(100, (1 - rem / total) * 100)}%`, backgroundColor: '#fff' }} /></View>
        {run && !!run.label && <Text style={{ color: '#fff', marginTop: 10, fontWeight: '600' }} numberOfLines={1}>{run.label}</Text>}
      </View>
      {done && (
        <View style={[s.card, { borderColor: CYAN }]}>
          <Text style={{ color: c.ink, fontWeight: '700' }}>{done.mode === 'focus' ? `Session complete: ${done.min} min` : 'Break is over'}</Text>
          {done.mode === 'focus' && <Pressable onPress={() => start('break', brk)} style={[s.btn, { marginTop: 8, alignSelf: 'flex-start' }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Start {brk} min break</Text></Pressable>}
        </View>
      )}
      {!run ? (
        <View>
          {lab(s, 'What are you working on? (optional)')}
          <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Data Structures assignment" placeholderTextColor={c.mute} style={inputStyle(c)} />
          {openTasks.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{openTasks.map((t) => <Chip key={t} s={s} c={c} on={label === t} label={t.length > 22 ? t.slice(0, 21) + '…' : t} onPress={() => setLabel(t)} />)}</View>}
          {lab(s, 'Focus length')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[15, 25, 45, 60, 90].map((m) => <Chip key={m} s={s} c={c} on={len === m} label={m + ' min'} onPress={() => setLen(m)} />)}</View>
          {lab(s, 'Break length')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[5, 10, 15].map((m) => <Chip key={m} s={s} c={c} on={brk === m} label={m + ' min'} onPress={() => setBrk(m)} />)}</View>
          <Pressable onPress={() => start('focus', len)} style={{ backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Start focus</Text></Pressable>
        </View>
      ) : (
        <View style={[s.row, { marginTop: 14 }]}>
          <Pressable onPress={run.paused != null ? resume : pause} style={{ flex: 1, backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{run.paused != null ? 'Resume' : 'Pause'}</Text></Pressable>
          <Pressable onPress={stop} style={[s.btn, { flex: 1, paddingVertical: 14, borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Stop</Text></Pressable>
        </View>
      )}
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Last 7 days</Text>
        <Bars c={c} vals={wVals} labels={wDays.map((d) => DN[d.getDay()])} color={VIOLET} hi={6} h={90} />
      </View>
      {todayS.length > 0 && (
        <View style={s.card}>
          <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>Today</Text>
          {todayS.map((x) => <View key={x.id} style={[s.row, { paddingVertical: 4 }]}><Text style={{ flex: 1, color: c.ink }} numberOfLines={1}>{x.label || 'Focus session'}</Text><Text style={s.mute}>{x.min} min</Text></View>)}
        </View>
      )}
    </ScrollView>
  );
}

/* ---------- Discipline (private) ---------- */
const MILES = [1, 3, 7, 14, 30, 60, 90, 180, 365];
const TRIGGERS = ['Boredom', 'Late night', 'Phone', 'Stress', 'Loneliness', 'Tiredness', 'Other'];
const URGE_TIPS = ['Make wudu and pray two rakat.', 'Leave the room and change your place.', 'Put your phone in another room.', 'Drink water and walk for a few minutes.', 'Do 20 push-ups or stretch.', 'Message or call a friend or family member.', 'Open the Quran or listen to a recitation.'];
function Discipline({ c, disc, saveDisc }) {
  const s = mk(c);
  const [now, setNow] = useState(Date.now());
  const [urge, setUrge] = useState(null);
  const [slip, setSlip] = useState(false);
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), urge ? 1000 : 30000); return () => clearInterval(i); }, [urge]);
  const log2 = disc.log || [];
  const days = disc.since ? Math.floor((now - disc.since) / 864e5) : 0, hours = disc.since ? Math.floor(((now - disc.since) % 864e5) / 36e5) : 0;
  const best = Math.max(disc.best || 0, days), next = MILES.find((m) => m > days) || null;
  const begin = () => { anim(); saveDisc({ ...disc, since: Date.now() }); };
  const logUrge = () => { anim(); saveDisc({ ...disc, log: [{ id: Date.now(), ts: Date.now(), k: 'urge', tag: '', note: '' }, ...log2].slice(0, 300) }); setUrge(null); };
  const doSlip = () => { anim(); saveDisc({ since: Date.now(), best: Math.max(disc.best || 0, days), log: [{ id: Date.now(), ts: Date.now(), k: 'slip', tag, note: note.trim().slice(0, 120) }, ...log2].slice(0, 300) }); setSlip(false); setTag(''); setNote(''); };
  const delEv = (id) => { anim(); saveDisc({ ...disc, log: log2.filter((e) => e.id !== id) }); };
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const since30 = d0.getTime() - 29 * 864e5, recent = log2.filter((e) => e.ts >= since30);
  const won = recent.filter((e) => e.k === 'urge').length, slips = recent.filter((e) => e.k === 'slip').length;
  const tc = {}; log2.filter((e) => e.k === 'slip' && e.tag).forEach((e) => { tc[e.tag] = (tc[e.tag] || 0) + 1; });
  const topT = Object.keys(tc).sort((a, b) => tc[b] - tc[a]).slice(0, 3);
  const bucket = (h) => (h >= 22 || h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening');
  const bc = {}; log2.forEach((e) => { const b = bucket(new Date(e.ts).getHours()); bc[b] = (bc[b] || 0) + 1; });
  const riskB = Object.keys(bc).sort((a, b) => bc[b] - bc[a])[0];
  const grid = Array.from({ length: 14 }, (_, i) => { const d = addDays(d0, i - 13), t0 = d.getTime(), sl = log2.some((e) => e.k === 'slip' && e.ts >= t0 && e.ts < t0 + 864e5); return { d, sl, ok: !sl && disc.since && t0 + 864e5 > disc.since }; });
  const urgeRem = urge ? Math.max(0, urge - now) : 0;
  const tip = URGE_TIPS[urge ? Math.floor((now - (urge - 600000)) / 60000) % URGE_TIPS.length : 0];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h1}>Discipline</Text>
      <View style={[s.row, { marginTop: 2 }]}><Ionicons name="lock-closed-outline" size={13} color={c.mute} /><Text style={[s.mute, { marginLeft: 5 }]}>Private. Stays on this phone and is never sent to the AI.</Text></View>
      {!disc.since ? (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 26, marginTop: 14 }]}>
          <Text style={{ color: c.ink, fontWeight: '800', fontSize: 18 }}>Start your streak</Text>
          <Text style={[s.mute, { textAlign: 'center', marginTop: 6 }]}>Count your clean days, ride out urges, and learn what triggers you. A slip never erases your best streak.</Text>
          <Pressable onPress={begin} style={{ backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28, marginTop: 16 }}><Text style={{ color: '#fff', fontWeight: '800' }}>Start today</Text></Pressable>
        </View>
      ) : (
        <View>
          <View style={[s.hero, { alignItems: 'center', marginTop: 14 }]}>
            <Text style={s.heroTag}>CURRENT STREAK</Text>
            <Text style={{ color: '#fff', fontSize: 64, fontWeight: '800', marginTop: 2 }}>{days}</Text>
            <Text style={{ color: '#fff' }}>{days === 1 ? 'day' : 'days'} · {hours} h · best {best}</Text>
            {next ? <View style={{ alignSelf: 'stretch', marginTop: 12 }}><View style={{ height: 6, backgroundColor: '#ffffff40', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: 6, width: `${Math.min(100, (days / next) * 100)}%`, backgroundColor: '#fff' }} /></View><Text style={{ color: '#ffffffcc', fontSize: 12, marginTop: 4 }}>Next milestone: {next} days</Text></View> : null}
          </View>
          <View style={[s.row, { marginTop: 12 }]}>
            <Pressable onPress={() => setUrge(Date.now() + 600000)} style={{ flex: 1.3, backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '800' }}>I have an urge</Text></Pressable>
            <Pressable onPress={() => setSlip(true)} style={[s.btn, { flex: 1, paddingVertical: 14 }]}><Text style={{ color: c.ink, fontWeight: '700' }}>I slipped</Text></Pressable>
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 8 }}>Milestones</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{MILES.map((m) => <View key={m} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, marginRight: 6, marginBottom: 6, backgroundColor: best >= m ? AMBER : 'transparent', borderWidth: 1, borderColor: best >= m ? AMBER : c.line }}><Text style={{ color: best >= m ? '#1b1b1b' : c.mute, fontWeight: '700', fontSize: 12 }}>{m}d</Text></View>)}</View>
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Last 14 days</Text>
            <View style={{ flexDirection: 'row' }}>{grid.map((g, i) => <View key={i} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: g.sl ? CORAL : g.ok ? CYAN : c.line }} /><Text style={{ color: c.mute, fontSize: 9, marginTop: 4 }}>{DN[g.d.getDay()][0]}</Text></View>)}</View>
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 8 }}>Last 30 days</Text>
            <View style={s.row}>
              <View style={{ flex: 1 }}><Text style={{ color: CYAN, fontSize: 24, fontWeight: '800' }}>{won}</Text><Text style={s.mute}>urges beaten</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: slips ? CORAL : c.ink, fontSize: 24, fontWeight: '800' }}>{slips}</Text><Text style={s.mute}>slips</Text></View>
            </View>
            {topT.length > 0 && <Text style={[s.mute, { marginTop: 10 }]}>Top triggers: {topT.join(', ')}</Text>}
            {riskB ? <Text style={[s.mute, { marginTop: 4 }]}>Riskiest time: {riskB}</Text> : null}
          </View>
          {log2.length > 0 && (
            <View style={s.card}>
              <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>History</Text>
              {log2.slice(0, 8).map((e) => (
                <View key={e.id} style={[s.row, { paddingVertical: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: e.k === 'slip' ? CORAL : CYAN, fontWeight: '700', fontSize: 13 }}>{e.k === 'slip' ? 'Slip' : 'Urge beaten'}{e.tag ? ' · ' + e.tag : ''}</Text>
                    <Text style={s.mute}>{new Date(e.ts).toDateString().slice(0, 10)} · {fmt(new Date(e.ts).getHours() * 60 + new Date(e.ts).getMinutes())}{e.note ? ' · ' + e.note : ''}</Text>
                  </View>
                  <Pressable onPress={() => delEv(e.id)} hitSlop={8}><Text style={{ color: c.mute, fontSize: 16 }}>✕</Text></Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      <Sheet c={c} visible={!!urge} onClose={() => setUrge(null)} title="Ride it out" onSave={logUrge} saveLabel="I got through it">
        <Text style={{ color: c.ink, fontSize: 40, fontWeight: '800', textAlign: 'center' }}>{String(Math.floor(urgeRem / 60000)).padStart(2, '0')}:{String(Math.floor((urgeRem % 60000) / 1000)).padStart(2, '0')}</Text>
        <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>Urges rise, peak and pass. Stay with the next ten minutes.</Text>
        <View style={[s.card, { marginTop: 14 }]}><Text style={{ color: c.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{tip}</Text></View>
        <Pressable onPress={() => { setUrge(null); setSlip(true); }} style={{ alignSelf: 'center', padding: 12 }}><Text style={{ color: c.mute, fontWeight: '600' }}>I slipped</Text></Pressable>
      </Sheet>
      <Sheet c={c} visible={slip} onClose={() => setSlip(false)} title="It's okay. Start again." onSave={doSlip} saveLabel="Reset my streak">
        <Text style={s.mute}>A slip does not erase your effort. Your best streak stays saved. Note what led to it so you can prepare next time.</Text>
        {lab(s, 'What triggered it?')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{TRIGGERS.map((t) => <Chip key={t} s={s} c={c} on={tag === t} label={t} onPress={() => setTag(tag === t ? '' : t)} />)}</View>
        {lab(s, 'Note (optional)')}
        <TextInput value={note} onChangeText={setNote} placeholder="Anything to remember" placeholderTextColor={c.mute} style={inputStyle(c)} />
        <View style={{ height: 8 }} />
      </Sheet>
    </ScrollView>
  );
}

/* ---------- Daily quote ---------- */
const QUOTES = {
  Motivation: [
    ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
    ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
    ['It is not that we have a short time to live, but that we waste much of it.', 'Seneca'],
    ['Do what you can, with what you have, where you are.', 'Proverb'],
    ['Well begun is half done.', 'Proverb'],
    ['Start where you are. Small steps still move you forward.', 'Kairo'],
    ['You do not need to feel ready. You only need to begin.', 'Kairo'],
    ['Progress is quiet. Show up anyway.', 'Kairo'],
  ],
  Discipline: [
    ['No man is free who is not master of himself.', 'Epictetus'],
    ['First say to yourself what you would be; then do what you have to do.', 'Epictetus'],
    ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
    ['Discipline is choosing what you want most over what you want now.', 'Kairo'],
    ['Small steps taken daily beat big plans never started.', 'Kairo'],
    ['Your habits are votes for the person you are becoming.', 'Kairo'],
    ['Do the hard thing first. The rest of the day gets easier.', 'Kairo'],
  ],
  Philosophy: [
    ['The unexamined life is not worth living.', 'Socrates'],
    ['Know thyself.', 'Delphic maxim'],
    ['We suffer more often in imagination than in reality.', 'Seneca'],
    ['Happiness depends upon ourselves.', 'Aristotle'],
    ['You have power over your mind, not outside events. Realize this and you will find strength.', 'Marcus Aurelius (paraphrase)'],
    ['The obstacle is the path.', 'Zen proverb'],
    ['Patience is bitter, but its fruit is sweet.', 'Proverb'],
  ],
  Relationships: [
    ['Listen more than you speak. People remember how you made them feel.', 'Kairo'],
    ['Be the kind of friend you wish you had.', 'Kairo'],
    ['Apologize quickly. Forgive generously.', 'Kairo'],
    ['Make time for the people you love before life makes you.', 'Kairo'],
    ['A real friend tells you the truth kindly.', 'Kairo'],
    ['Your family is not a task to finish. They are the reason for the tasks.', 'Kairo'],
    ['Reach out first. Most people are waiting for someone to.', 'Kairo'],
  ],
  Facts: [
    ['A day on Venus is longer than a year on Venus.', 'Did you know?'],
    ['Octopuses have three hearts.', 'Did you know?'],
    ['Honey stored in sealed containers can stay edible for thousands of years.', 'Did you know?'],
    ['Sleep helps your brain turn the day\'s learning into long-term memory.', 'Did you know?'],
    ['A short walk after studying can help you feel more alert.', 'Did you know?'],
    ['Water makes up roughly 60 percent of an adult\'s body.', 'Did you know?'],
    ['Writing a plan down makes you more likely to follow it.', 'Did you know?'],
  ],
  Faith: [
    ['Actions are judged by intentions.', 'Hadith (Bukhari and Muslim)'],
    ['Verily, with hardship comes ease.', 'Quran 94:6'],
    ['Allah does not change the condition of a people until they change what is within themselves.', 'Quran 13:11'],
    ['The best of you are those who are best to their families.', 'Hadith (Tirmidhi)'],
    ['The strong person is the one who controls himself when angry.', 'Hadith (Bukhari and Muslim)'],
    ['Whoever treads a path seeking knowledge, Allah makes easy for him a path to Paradise.', 'Hadith (Muslim)'],
    ['Take advantage of five before five: youth before old age, health before illness, wealth before poverty, free time before busyness, life before death.', 'Hadith'],
  ],
};
const Q_TOPICS = Object.keys(QUOTES);
const QSYS = 'Return ONLY JSON {"text":"","by":""}. Give ONE short saying (at most 25 words) for the topic: a well-known traditional or public-domain saying, or your own words. Never invent a quote and attribute it to a real person. If it is your own words set "by" to "Kairo".';
function QuoteCard({ c, settings, saveSet }) {
  const s = mk(c);
  const topic = settings.quoteTopic || 'Motivation', custom = settings.quoteCustom || '';
  const [off, setOff] = useState(0);
  const [aiq, setAiq] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [ct, setCt] = useState(custom);
  const list = QUOTES[topic];
  const q = aiq || (list ? list[(Math.floor(Date.now() / 864e5) + off) % list.length] : ['Tap the sparkle for a saying about ' + (custom || 'your topic') + '.', 'Kairo']);
  const fresh = async () => {
    setBusy(true);
    try {
      const key = await AsyncStorage.getItem('gemini_key');
      if (!key) { setAiq(['Add your Gemini key in Settings to get fresh sayings.', 'Kairo']); setBusy(false); return; }
      const out = await askGemini(key, QSYS, [], 'Topic: ' + (custom && !list ? custom : topic) + '. Give one saying. Variation ' + Math.floor(Math.random() * 1000));
      if (out && out.text) setAiq([String(out.text).slice(0, 220), String(out.by || 'Kairo').slice(0, 40)]);
    } catch (e) { setAiq(['Could not reach the AI. Try again later.', 'Kairo']); }
    setBusy(false);
  };
  return (
    <View style={s.card}>
      <View style={[s.row, { marginBottom: 8 }]}>
        <Pressable onPress={() => { setCt(custom); setOpen(true); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name="bulb-outline" size={16} color={AMBER} />
          <Text style={{ color: AMBER, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginLeft: 6 }}>{(list ? topic : custom || 'Custom').toUpperCase()}</Text>
          <Ionicons name="chevron-down" size={14} color={c.mute} style={{ marginLeft: 4 }} />
        </Pressable>
        <Pressable onPress={() => { setAiq(null); setOff(off + 1); }} hitSlop={8} accessibilityLabel="Next quote" style={{ padding: 6 }}><Ionicons name="refresh" size={18} color={c.mute} /></Pressable>
        <Pressable onPress={fresh} hitSlop={8} accessibilityLabel="New quote from AI" style={{ padding: 6, marginLeft: 4 }}>{busy ? <ActivityIndicator color={VIOLET} size="small" /> : <Ionicons name="sparkles" size={18} color={VIOLET} />}</Pressable>
      </View>
      <Text style={{ color: c.ink, fontSize: 16, lineHeight: 24 }}>{q[0]}</Text>
      <Text style={[s.mute, { marginTop: 6 }]}>{q[1]}</Text>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title="Quote topic" onSave={() => { saveSet({ quoteCustom: ct.trim().slice(0, 40) }); setOpen(false); setAiq(null); }} saveLabel="Save">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {Q_TOPICS.map((t) => <Chip key={t} s={s} c={c} on={topic === t} label={t} onPress={() => { saveSet({ quoteTopic: t }); setAiq(null); setOff(0); }} />)}
          <Chip s={s} c={c} on={topic === 'Custom'} label="My own topic" onPress={() => { saveSet({ quoteTopic: 'Custom' }); setAiq(null); }} />
        </View>
        {lab(s, 'Your own topic (used with the sparkle button)')}
        <TextInput value={ct} onChangeText={setCt} placeholder="e.g. patience, leadership, gratitude" placeholderTextColor={c.mute} style={inputStyle(c)} />
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ---------- Ask Kairo button on every screen ---------- */
const FAB_SUGG = {
  Plan: ['Optimize my day', 'I have free time', 'Is my day overloaded?'],
  Goals: ['What is due soon?', 'Prioritize my tasks', 'Plan my targets'],
  Grow: ['How is my focus?', 'Help me stay disciplined'],
  Money: ['Review my spending', 'How can I save more?'],
  Stats: ['Explain my week', 'What should I improve?'],
};
function AskFab({ c, tabName, bottom, onAsk }) {
  const s = mk(c);
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState('');
  const go = () => { const q = txt.trim(); if (!q) return; setOpen(false); setTxt(''); onAsk(q); };
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: 0, bottom: 0, left: 0, top: 0, zIndex: 20 }}>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel="Ask Kairo" style={{ position: 'absolute', right: 16, bottom, width: 52, height: 52, borderRadius: 26, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center', elevation: 6 }}>
        <Ionicons name="sparkles" size={22} color="#fff" />
      </Pressable>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title="Ask Kairo" onSave={go} saveLabel="Ask">
        <Text style={s.mute}>I can see what is on this screen. Ask anything, or tell me to change something.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{(FAB_SUGG[tabName] || []).map((q) => <Chip key={q} s={s} c={c} on={false} label={q} onPress={() => setTxt(q)} />)}</View>
        <TextInput value={txt} onChangeText={setTxt} multiline autoFocus placeholder={'Ask about ' + tabName} placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 10, minHeight: 80, maxHeight: 160, textAlignVertical: 'top' }]} />
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ---------- Reminders ---------- */
function occsOf(r, from, to) {
  const out = [], w = new Date(r.when), tm = w.getHours() * 60 + w.getMinutes();
  if (!r.rep || r.rep === 'none') { if (r.when >= from && r.when <= to) out.push(r.when); return out; }
  const st = new Date(Math.max(from, r.when)); st.setHours(0, 0, 0, 0);
  const wd = r.days && r.days.length ? r.days : [w.getDay()];
  for (let d = new Date(st); d.getTime() <= to && out.length < 60; d.setDate(d.getDate() + 1)) {
    const t = new Date(d); t.setHours(Math.floor(tm / 60), tm % 60, 0, 0);
    const ts = t.getTime();
    if (ts < from || ts < r.when || ts > to) continue;
    if (r.rep === 'daily' || (r.rep === 'weekly' && wd.includes(t.getDay())) || (r.rep === 'monthly' && t.getDate() === w.getDate())) out.push(ts);
  }
  return out;
}
const REP_LABEL = { none: 'Once', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };
function ReminderSheet({ c, visible, rem, prefill, onSave, onDelete, onClose }) {
  const s = mk(c);
  const [text, setText] = useState('');
  const [dt, setDt] = useState(new Date());
  const [tm, setTm] = useState(9 * 60);
  const [rep, setRep] = useState('none');
  const [days, setDays] = useState([]);
  const [early, setEarly] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    setErr('');
    if (rem) { const w = new Date(rem.when); setText(rem.text); setDt(w); setTm(w.getHours() * 60 + w.getMinutes()); setRep(rem.rep || 'none'); setDays(rem.days || []); setEarly(rem.early || 0); }
    else { const n = new Date(); const m = Math.min(1439, Math.ceil((n.getHours() * 60 + n.getMinutes() + 30) / 5) * 5); setText(prefill || ''); setDt(n); setTm(m); setRep('none'); setDays([]); setEarly(0); }
  }, [visible, rem]);
  const save = () => {
    if (!text.trim()) { setErr('What should I remind you about?'); return; }
    const d = new Date(dt); d.setHours(Math.floor(tm / 60), tm % 60, 0, 0);
    if ((rep === 'none') && d.getTime() < Date.now() - 60000) { setErr('That time has already passed.'); return; }
    onSave({ text: text.trim().slice(0, 120), when: d.getTime(), rep, days: rep === 'weekly' ? days : [], early, done: false });
  };
  return (
    <Sheet c={c} visible={visible} onClose={onClose} title={rem ? 'Edit reminder' : 'New reminder'} onSave={save} saveLabel="Save" onDelete={rem ? onDelete : undefined}>
      <TextInput value={text} onChangeText={setText} placeholder="e.g. Call the bank" placeholderTextColor={c.mute} style={inputStyle(c)} />
      {lab(s, rep === 'none' ? 'Date' : 'Starts on')}
      <DateField c={c} value={dt} onChange={(d) => setDt(d || new Date())} />
      {lab(s, 'Time')}
      <TimePick c={c} value={tm} onChange={setTm} />
      {lab(s, 'Repeat')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Object.keys(REP_LABEL).map((k) => <Chip key={k} s={s} c={c} on={rep === k} label={REP_LABEL[k]} onPress={() => setRep(k)} />)}</View>
      {rep === 'weekly' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{DAYS_ORDER.map((d) => <Chip key={d} s={s} c={c} on={days.includes(d)} label={DN[d]} onPress={() => setDays((a) => (a.includes(d) ? a.filter((x) => x !== d) : [...a, d]))} />)}</View>}
      {lab(s, 'Also warn me')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[[0, 'Only at the time'], [10, '10 min before'], [60, '1 hour before'], [1440, '1 day before']].map((x) => <Chip key={x[0]} s={s} c={c} on={early === x[0]} label={x[1]} onPress={() => setEarly(x[0])} />)}</View>
      {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
function Reminders({ c, reminders, saveReminders, prefill, clearPrefill }) {
  const s = mk(c);
  const [sheet, setSheet] = useState(null);
  const [pre, setPre] = useState('');
  useEffect(() => { if (prefill) { setPre(prefill); setSheet('new'); if (clearPrefill) clearPrefill(); } }, [prefill]);
  const now = Date.now();
  const nextOf = (r) => { const o = occsOf(r, now - 1, now + 400 * 864e5); return o.length ? o[0] : null; };
  const rows = reminders.map((r) => ({ r, nx: nextOf(r) }));
  const upcoming = rows.filter((x) => x.nx != null && !(x.r.done && (!x.r.rep || x.r.rep === 'none'))).sort((a, b) => a.nx - b.nx);
  const overdue = rows.filter((x) => x.nx == null && (!x.r.rep || x.r.rep === 'none') && !x.r.done);
  const done = rows.filter((x) => x.r.done && (!x.r.rep || x.r.rep === 'none'));
  const fmtWhen = (ts) => { const d = new Date(ts); return dateTxt(ts).slice(0, 10) + ' · ' + fmt(d.getHours() * 60 + d.getMinutes()); };
  const card = (x, col, dim) => (
    <Pressable key={x.r.id} onPress={() => { setPre(''); setSheet(x.r); }} style={[s.block, { borderLeftColor: col, opacity: dim ? 0.5 : 1 }]}>
      <Ionicons name={x.r.rep && x.r.rep !== 'none' ? 'repeat' : 'notifications-outline'} size={20} color={col} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: c.ink, fontWeight: '600', fontSize: 15, textDecorationLine: dim ? 'line-through' : 'none' }}>{x.r.text}</Text>
        <Text style={s.mute}>{x.nx ? fmtWhen(x.nx) : fmtWhen(x.r.when)} · {REP_LABEL[x.r.rep || 'none']}{x.r.early ? ' · warns ' + (x.r.early >= 1440 ? '1 day' : x.r.early >= 60 ? x.r.early / 60 + ' h' : x.r.early + ' min') + ' before' : ''}</Text>
      </View>
      {(!x.r.rep || x.r.rep === 'none') && (
        <Pressable onPress={() => { anim(); saveReminders(reminders.map((y) => (y.id === x.r.id ? { ...y, done: !y.done } : y))); }} hitSlop={8} style={[s.tick, { borderColor: col }, x.r.done && { backgroundColor: col }]}>{x.r.done ? <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text> : null}</Pressable>
      )}
    </Pressable>
  );
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={s.row}>
          <View style={{ flex: 1 }}><Text style={s.h1}>Reminders</Text><Text style={s.mute}>{upcoming.length} upcoming{overdue.length ? ' · ' + overdue.length + ' missed' : ''}</Text></View>
          <Pressable onPress={() => { setPre(''); setSheet('new'); }} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ Add</Text></Pressable>
        </View>
        {reminders.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 26, marginTop: 14 }]}>
            <Ionicons name="notifications-outline" size={30} color={c.mute} />
            <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>No reminders yet</Text>
            <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>Set a one-time or repeating reminder. Kairo notifies you, and you can snooze or finish it from the notification.</Text>
          </View>
        )}
        {overdue.length > 0 && <View><Text style={{ color: CORAL, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 14, marginBottom: 8 }}>MISSED</Text>{overdue.map((x) => card(x, CORAL, false))}</View>}
        {upcoming.length > 0 && <View><Text style={{ color: VIOLET, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 14, marginBottom: 8 }}>UPCOMING</Text>{upcoming.map((x) => card(x, VIOLET, false))}</View>}
        {done.length > 0 && <View><Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 14, marginBottom: 8 }}>DONE</Text>{done.map((x) => card(x, c.mute, true))}</View>}
      </ScrollView>
      <ReminderSheet c={c} visible={!!sheet} rem={sheet && sheet !== 'new' ? sheet : null} prefill={pre} onClose={() => setSheet(null)} onSave={(row) => { anim(); if (sheet === 'new') saveReminders([...reminders, { id: Date.now(), ts: Date.now(), ...row }]); else saveReminders(reminders.map((y) => (y.id === sheet.id ? { ...y, ...row } : y))); setSheet(null); }} onDelete={() => { anim(); saveReminders(reminders.filter((y) => y.id !== sheet.id)); setSheet(null); }} />
    </View>
  );
}

/* ---------- Notes ---------- */
const NOTE_COL = ['#7C5CFF', '#35D0E0', '#FF9F5C', '#FF7DB0', '#F5B84B', '#5C9CFF', '#8A93AD'];
function NoteSheet({ c, visible, note, onSave, onDelete, onClose, onRemind }) {
  const s = mk(c);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('text');
  const [body, setBody] = useState('');
  const [items, setItems] = useState([]);
  const [color, setColor] = useState(0);
  const [pin, setPin] = useState(false);
  const [ni, setNi] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!visible) return;
    setErr(''); setNi('');
    if (note) { setTitle(note.title || ''); setKind(note.kind || 'text'); setBody(note.body || ''); setItems(note.items || []); setColor(note.color || 0); setPin(!!note.pin); }
    else { setTitle(''); setKind('text'); setBody(''); setItems([]); setColor(0); setPin(false); }
  }, [visible, note]);
  const addItem = () => { const t = ni.trim(); if (!t) return; setItems((a) => [...a, { id: Date.now() + a.length, t: t.slice(0, 120), done: false }]); setNi(''); };
  const save = () => {
    const its = ni.trim() ? [...items, { id: Date.now() + items.length, t: ni.trim().slice(0, 120), done: false }] : items;
    if (!title.trim() && !body.trim() && its.length === 0) { setErr('Write something first.'); return; }
    onSave({ title: title.trim().slice(0, 60), kind, body: body.slice(0, 5000), items: kind === 'list' ? its : [], color, pin });
  };
  return (
    <Sheet c={c} visible={visible} onClose={onClose} title={note ? 'Edit note' : 'New note'} onSave={save} saveLabel="Save" onDelete={note ? () => Alert.alert('Delete this note?', note.title || 'Untitled', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]) : undefined}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={c.mute} style={[inputStyle(c), { fontWeight: '700', fontSize: 17 }]} />
      <View style={{ marginTop: 10 }}><Seg c={c} value={kind} onPick={setKind} items={[['text', 'Note'], ['list', 'Checklist']]} /></View>
      {kind === 'text' ? (
        <TextInput value={body} onChangeText={setBody} multiline placeholder="Write here..." placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 10, minHeight: 140, maxHeight: 260, textAlignVertical: 'top' }]} />
      ) : (
        <View style={{ marginTop: 10 }}>
          {items.map((it) => (
            <View key={it.id} style={[s.row, { marginBottom: 8 }]}>
              <Pressable onPress={() => setItems(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} hitSlop={8} style={[s.tick, { width: 26, height: 26, borderRadius: 13, borderColor: NOTE_COL[color] }, it.done && { backgroundColor: NOTE_COL[color] }]}>{it.done ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}</Pressable>
              <Text style={{ flex: 1, marginLeft: 10, color: it.done ? c.mute : c.ink, textDecorationLine: it.done ? 'line-through' : 'none' }}>{it.t}</Text>
              <Pressable onPress={() => setItems(items.filter((x) => x.id !== it.id))} hitSlop={8}><Text style={{ color: c.mute, fontSize: 16 }}>✕</Text></Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row' }}>
            <TextInput value={ni} onChangeText={setNi} placeholder="Add an item" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1 }]} onSubmitEditing={addItem} />
            <Pressable onPress={addItem} style={[s.btn, { marginLeft: 8, minWidth: 60 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Add</Text></Pressable>
          </View>
        </View>
      )}
      {lab(s, 'Colour')}
      <View style={{ flexDirection: 'row' }}>{NOTE_COL.map((k, i) => <Pressable key={i} onPress={() => setColor(i)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: k, marginRight: 10, alignItems: 'center', justifyContent: 'center', borderWidth: color === i ? 3 : 0, borderColor: c.ink }} />)}</View>
      <View style={[s.row, { marginTop: 14 }]}>
        <Text style={{ color: c.ink, fontWeight: '600', flex: 1 }}>Pin to the top</Text>
        <Switch value={pin} onValueChange={setPin} trackColor={{ true: VIOLET }} />
      </View>
      <Pressable onPress={() => onRemind(title.trim() || body.trim().slice(0, 60) || (items[0] && items[0].t) || 'Note')} style={[s.btn, { marginTop: 14, alignSelf: 'flex-start', flexDirection: 'row' }]}><Ionicons name="notifications-outline" size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Remind me about this</Text></Pressable>
      {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
function Notes({ c, notes, saveNotes, onRemind }) {
  const s = mk(c);
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(null);
  const text = (n) => (n.title + ' ' + (n.body || '') + ' ' + (n.items || []).map((i) => i.t).join(' ')).toLowerCase();
  const shown = notes.filter((n) => !q.trim() || text(n).includes(q.trim().toLowerCase())).sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.upd || 0) - (a.upd || 0));
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={s.row}>
          <View style={{ flex: 1 }}><Text style={s.h1}>Notes</Text><Text style={s.mute}>{notes.length} note{notes.length === 1 ? '' : 's'}</Text></View>
          <Pressable onPress={() => setSheet('new')} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ New</Text></Pressable>
        </View>
        {notes.length > 3 && <TextInput value={q} onChangeText={setQ} placeholder="Search notes" placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 12 }]} />}
        {shown.length === 0 && (
          <View style={[s.card, { alignItems: 'center', paddingVertical: 26, marginTop: 14 }]}>
            <Ionicons name="document-text-outline" size={30} color={c.mute} />
            <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>{notes.length ? 'No matches' : 'No notes yet'}</Text>
            <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>{notes.length ? 'Try a different search.' : 'Jot down ideas, lists and things to remember.'}</Text>
          </View>
        )}
        {shown.map((n) => {
          const col = NOTE_COL[n.color || 0], dn = (n.items || []).filter((i) => i.done).length;
          return (
            <Pressable key={n.id} onPress={() => setSheet(n)} style={[s.block, { borderLeftColor: col, alignItems: 'flex-start', marginTop: 8 }]}>
              <View style={{ flex: 1 }}>
                <View style={s.row}>{n.pin ? <Ionicons name="pin" size={14} color={col} style={{ marginRight: 6 }} /> : null}<Text style={{ color: c.ink, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>{n.title || 'Untitled'}</Text></View>
                <Text style={[s.mute, { marginTop: 3 }]} numberOfLines={2}>{n.kind === 'list' ? `${dn} of ${(n.items || []).length} done · ` + (n.items || []).slice(0, 3).map((i) => i.t).join(', ') : n.body}</Text>
                <Text style={{ color: c.mute, fontSize: 11, marginTop: 4 }}>{dateTxt(n.upd || n.ts).slice(0, 10)}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <NoteSheet c={c} visible={!!sheet} note={sheet && sheet !== 'new' ? sheet : null} onClose={() => setSheet(null)} onRemind={(t) => { setSheet(null); onRemind(t); }} onSave={(row) => { anim(); if (sheet === 'new') saveNotes([...notes, { id: Date.now(), ts: Date.now(), upd: Date.now(), ...row }]); else saveNotes(notes.map((x) => (x.id === sheet.id ? { ...x, ...row, upd: Date.now() } : x))); setSheet(null); }} onDelete={() => { anim(); saveNotes(notes.filter((x) => x.id !== sheet.id)); setSheet(null); }} />
    </View>
  );
}

/* ---------- Days off (vacation) ---------- */
function OffSheet({ c, visible, initial, offs, saveOffs, askAI, onClose }) {
  const s = mk(c);
  const [label, setLabel] = useState('');
  const [from, setFrom] = useState(new Date());
  const [to, setTo] = useState(null);
  const [plan, setPlan] = useState(true);
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setLabel(''); setFrom(initial ? new Date(initial) : new Date()); setTo(null); setPlan(true); setErr(''); } }, [visible]);
  const save = () => {
    const f = new Date(from); f.setHours(0, 0, 0, 0);
    const t = to ? new Date(to) : new Date(f); t.setHours(0, 0, 0, 0);
    if (t < f) { setErr('The last day is before the first day.'); return; }
    const row = { id: Date.now(), from: iso(f), to: iso(t), label: label.trim().slice(0, 40) || 'University off' };
    anim(); saveOffs([...offs, row]); onClose();
    if (plan && askAI) askAI({ text: `University is off ${row.from === row.to ? 'on ' + row.from : 'from ' + row.from + ' to ' + row.to} (${row.label}). Plan these free days for me. If you need to know my focus, ask one short question first. Otherwise propose temporary add_block actions: recover missed work, study, targets, exercise and rest, and keep prayer times free.`, day: row.from });
  };
  return (
    <Sheet c={c} visible={visible} onClose={onClose} title="University off" onSave={save} saveLabel="Mark as off">
      <Text style={s.mute}>Classes and the travel blocks for them disappear on these days, and the time becomes free for the AI to plan.</Text>
      <TextInput value={label} onChangeText={setLabel} placeholder="Reason, e.g. Eid break, strike" placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 12 }]} />
      {lab(s, 'First day')}
      <DateField c={c} value={from} onChange={(d) => setFrom(d || new Date())} />
      {lab(s, 'Last day (leave empty for one day)')}
      <DateField c={c} value={to} onChange={setTo} clearable placeholder="Same day" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{[[3, '3 days'], [7, '1 week'], [14, '2 weeks']].map((x) => <Chip key={x[0]} s={s} c={c} on={false} label={x[1]} onPress={() => setTo(addDays(from, x[0] - 1))} />)}</View>
      <View style={[s.row, { marginTop: 14 }]}>
        <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>Ask the AI to plan these days</Text><Text style={s.mute}>You approve every change</Text></View>
        <Switch value={plan} onValueChange={setPlan} trackColor={{ true: VIOLET }} />
      </View>
      {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}

/* ---------- Calendar ---------- */
function CalendarView({ c, tasks, log, mark, exams, targets, projects, reminders, offs, saveOffs, saveTasks, editTask, delTask, askAI, askDay }) {
  const s = mk(c);
  const mid = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const [month, setMonth] = useState(() => { const d = mid(new Date()); d.setDate(1); return d; });
  const [sel, setSel] = useState(() => mid(new Date()));
  const [tsheet, setTsheet] = useState(null);
  const [offOpen, setOffOpen] = useState(false);
  const today0 = mid(new Date());
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), lead = (month.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const tOn = (d) => tasks.filter((t) => t.date === dayKey(d));
  const done = (t) => !!(log[t.date] && log[t.date]['t:' + t.id]);
  const rOn = (d) => (reminders || []).filter((r) => !(r.done && (!r.rep || r.rep === 'none')) && occsOf(r, d.getTime(), d.getTime() + 864e5 - 1).length > 0);
  const offOf = (d) => { const k = iso(d); return (offs || []).find((o) => k >= o.from && k <= o.to); };
  const dlOn = (d) => {
    const k = d.getTime(), out = [];
    exams.forEach((e) => { if (mid(e.ts).getTime() === k) out.push({ t: e.course + ' exam', col: CORAL }); });
    targets.forEach((t) => { if (t.due && mid(t.due).getTime() === k && tProg(t) < 1) out.push({ t: 'Target: ' + t.title, col: AMBER }); });
    (projects || []).forEach((p) => { if (p.due && mid(p.due).getTime() === k) out.push({ t: 'Project due: ' + p.name, col: AMBER }); (p.milestones || []).forEach((m) => { if (m.due && mid(m.due).getTime() === k && (m.pct || 0) < 100) out.push({ t: p.name + ': ' + m.t, col: VIOLET }); }); });
    return out;
  };
  const go = (n) => { anim(); const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };
  const selT = tOn(sel).sort((a, b) => (a.time == null ? 9999 : a.time) - (b.time == null ? 9999 : b.time)), selD = dlOn(sel), selR = rOn(sel), selOff = offOf(sel), isPast = sel < today0;
  const moveTo = (t, d) => { const x = mid(d); editTask(t.id, { date: dayKey(x), ts: x.getTime() }); };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={s.row}>
        <Pressable onPress={() => go(-1)} hitSlop={10} style={s.iconBtn}><Ionicons name="chevron-back" size={20} color={c.ink} /></Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: c.ink, fontWeight: '800', fontSize: 18 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
        <Pressable onPress={() => go(1)} hitSlop={10} style={s.iconBtn}><Ionicons name="chevron-forward" size={20} color={c.ink} /></Pressable>
      </View>
      <Pressable onPress={() => { const d = mid(new Date()); const m0 = new Date(d); m0.setDate(1); setMonth(m0); setSel(d); }} style={{ alignSelf: 'center', paddingVertical: 8 }}><Text style={{ color: VIOLET, fontWeight: '700' }}>Today</Text></Pressable>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.mute, fontSize: 11 }}>{x}</Text>)}</View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
          {r.map((d, j) => {
            if (!d) return <View key={j} style={{ flex: 1, height: 50, marginHorizontal: 2 }} />;
            const ts = tOn(d), dl = dlOn(d), rm = rOn(d), isSel = d.getTime() === sel.getTime(), isT = d.getTime() === today0.getTime(), allDone = ts.length > 0 && ts.every(done), off = offOf(d);
            return (
              <Pressable key={j} onPress={() => setSel(d)} style={{ flex: 1, height: 50, marginHorizontal: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? VIOLET : off ? '#F5B84B33' : c.card, borderWidth: 1, borderColor: isT ? AMBER : c.line }}>
                <Text style={{ color: isSel ? '#fff' : d < today0 ? c.mute : c.ink, fontWeight: isT ? '800' : '600', fontSize: 14 }}>{d.getDate()}</Text>
                <View style={{ flexDirection: 'row', marginTop: 4, height: 6 }}>
                  {ts.length > 0 && <View style={{ width: 6, height: 6, borderRadius: 3, marginHorizontal: 1, backgroundColor: allDone ? CYAN : ORANGE }} />}
                  {rm.length > 0 && <View style={{ width: 6, height: 6, borderRadius: 3, marginHorizontal: 1, backgroundColor: isSel ? '#fff' : VIOLET }} />}
                  {dl.length > 0 && <View style={{ width: 6, height: 6, borderRadius: 3, marginHorizontal: 1, backgroundColor: isSel ? '#fff' : CORAL }} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 6 }}>
        {[[ORANGE, 'Tasks'], [CYAN, 'All done'], [VIOLET, 'Reminders'], [CORAL, 'Deadlines'], ['#F5B84B', 'Uni off']].map((x) => <View key={x[1]} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 4 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: x[0], marginRight: 5 }} /><Text style={{ color: c.mute, fontSize: 11 }}>{x[1]}</Text></View>)}
      </View>
      <View style={s.card}>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '800', fontSize: 16 }}>{sel.toDateString().slice(0, 10)}</Text>
            <Text style={s.mute}>{isPast ? 'Past day' : sel.getTime() === today0.getTime() ? 'Today' : 'Upcoming'} · {selT.length} task{selT.length === 1 ? '' : 's'}</Text>
          </View>
          <Pressable onPress={() => setTsheet('new')} style={{ backgroundColor: VIOLET, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ Task</Text></Pressable>
          <Pressable onPress={() => askDay(sel)} accessibilityLabel="Ask AI about this day" style={[s.iconBtn, { marginLeft: 0, width: 38, height: 38 }]}><Ionicons name="sparkles-outline" size={18} color={c.ink} /></Pressable>
        </View>
        {selOff ? (
          <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#F5B84B22', flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="sunny-outline" size={18} color={AMBER} />
            <Text style={{ color: c.ink, flex: 1, marginLeft: 8, fontWeight: '600' }}>University off · {selOff.label}</Text>
            <Pressable onPress={() => askAI({ text: `University is off on ${iso(sel)} (${selOff.label}). Plan this day for me.`, day: iso(sel) })} hitSlop={6} style={{ marginRight: 12 }}><Text style={{ color: VIOLET, fontWeight: '700' }}>Plan</Text></Pressable>
            <Pressable onPress={() => Alert.alert('Remove this off period?', selOff.label + '  ' + selOff.from + ' to ' + selOff.to, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { anim(); saveOffs(offs.filter((o) => o.id !== selOff.id)); } }])} hitSlop={6}><Text style={{ color: CORAL, fontWeight: '700' }}>Remove</Text></Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setOffOpen(true)} style={{ alignSelf: 'flex-start', marginTop: 10, flexDirection: 'row', alignItems: 'center' }}><Ionicons name="sunny-outline" size={16} color={c.mute} /><Text style={{ color: c.mute, fontWeight: '600', marginLeft: 6 }}>Mark university off</Text></Pressable>
        )}
        {selD.map((x, i) => <View key={'d' + i} style={[s.row, { marginTop: 10 }]}><View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: x.col, marginRight: 10 }} /><Text style={{ flex: 1, color: c.ink, fontWeight: '600' }}>{x.t}</Text></View>)}
        {selR.map((r) => <View key={'r' + r.id} style={[s.row, { marginTop: 10 }]}><Ionicons name="notifications-outline" size={18} color={VIOLET} /><Text style={{ flex: 1, color: c.ink, marginLeft: 10 }}>{r.text}</Text><Text style={s.mute}>{fmt(new Date(r.when).getHours() * 60 + new Date(r.when).getMinutes())}</Text></View>)}
        {selT.map((t) => (
          <View key={t.id} style={[s.row, { marginTop: 10 }]}>
            <Pressable onPress={() => mark(t.date, 't:' + t.id)} hitSlop={8} style={[s.tick, { width: 26, height: 26, borderRadius: 13, borderColor: ORANGE }, done(t) && { backgroundColor: ORANGE }]}>{done(t) ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✓</Text> : null}</Pressable>
            <Pressable onPress={() => setTsheet(t)} style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: done(t) ? c.mute : c.ink, textDecorationLine: done(t) ? 'line-through' : 'none', fontWeight: '600' }}>{t.title}</Text>
              <Text style={s.mute}>{t.cat}{t.time == null ? '' : ' · ' + fmt(t.time)}</Text>
            </Pressable>
            <Pressable onPress={() => moveTo(t, addDays(sel, 1))} hitSlop={8} accessibilityLabel="Move to the next day" style={{ padding: 6 }}><Ionicons name="arrow-forward-circle-outline" size={22} color={c.mute} /></Pressable>
          </View>
        ))}
        {selT.length === 0 && selD.length === 0 && selR.length === 0 && !selOff && <Text style={[s.mute, { marginTop: 10 }]}>Nothing on this day. Tap "+ Task" to add something.</Text>}
      </View>
      <TaskSheet c={c} visible={!!tsheet} task={tsheet && tsheet !== 'new' ? tsheet : null} date={sel} onClose={() => setTsheet(null)} onSave={(row) => { if (tsheet === 'new') saveTasks([...tasks, { id: Date.now(), ...row }]); else editTask(tsheet.id, row); setTsheet(null); }} onDelete={() => { delTask(tsheet.id); setTsheet(null); }} />
      <OffSheet c={c} visible={offOpen} initial={sel} offs={offs || []} saveOffs={saveOffs} askAI={askAI} onClose={() => setOffOpen(false)} />
    </ScrollView>
  );
}

/* ---------- AI helpers for forms ---------- */
async function aiJson(system, text, file) {
  const key = await AsyncStorage.getItem('gemini_key');
  if (!key) { const e = new Error('nokey'); e.nokey = true; throw e; }
  const parts = file ? [{ inlineData: { mimeType: file.mime, data: file.b64 } }, { text }] : [{ text }];
  const txt = await gcall(key, { body: { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }] }, gc: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 4000 } });
  return parseLoose(txt, null);
}
const aiErrText = (e) => (e && e.nokey ? 'Add your Gemini key in Settings first.' : e && e.status === 429 ? 'All free AI limits are used up for today. They reset at about ' + resetLabel() + '.' : e && (e.status === 400 || e.status === 403) ? 'Gemini rejected the key.' : 'Could not reach the AI. Check your internet.');
async function pickAny(kind) {
  if (kind === 'pdf') {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets || !r.assets[0]) return null;
    return { b64: await fileToB64(r.assets[0].uri), mime: r.assets[0].mimeType || 'application/pdf' };
  }
  let res;
  if (kind === 'cam') { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) throw new Error('cam'); res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 }); }
  else res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
  if (res.canceled || !res.assets || !res.assets[0] || !res.assets[0].base64) return null;
  return { b64: res.assets[0].base64, mime: res.assets[0].mimeType || 'image/jpeg' };
}

/* ---------- Sleep ---------- */
function sleepStats(sleep, goalH) {
  const now = Date.now(), done = sleep.filter((x) => x.wake && x.wake > x.bed).sort((a, b) => b.wake - a.wake);
  const last7 = done.filter((x) => x.wake >= now - 7 * 864e5), mins = (x) => (x.wake - x.bed) / 60000;
  const bedMin = (x) => { const d = new Date(x.bed); let m = d.getHours() * 60 + d.getMinutes(); if (m < 12 * 60) m += 1440; return m; };
  const wakeMin = (x) => { const d = new Date(x.wake); return d.getHours() * 60 + d.getMinutes(); };
  const sd = (arr) => { if (arr.length < 2) return null; const m = arr.reduce((a, b) => a + b, 0) / arr.length; return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / arr.length); };
  const n = last7.length;
  return { done, last7, mins, last: done[0] || null,
    avg: n ? last7.reduce((a, x) => a + mins(x), 0) / n : null,
    debt: last7.reduce((a, x) => a + Math.max(0, goalH * 60 - mins(x)), 0),
    avgBed: n ? last7.reduce((a, x) => a + bedMin(x), 0) / n : null, avgWake: n ? last7.reduce((a, x) => a + wakeMin(x), 0) / n : null, sdBed: sd(last7.map(bedMin)) };
}
function SleepView({ c, sleep, saveSleep, goal }) {
  const s = mk(c);
  const [sheet, setSheet] = useState(false);
  const [editId, setEditId] = useState(null);
  const [bd, setBd] = useState(new Date());
  const [bt, setBt] = useState(23 * 60);
  const [wd, setWd] = useState(new Date());
  const [wt, setWt] = useState(6 * 60);
  const [err, setErr] = useState('');
  const [nextWake, setNextWake] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);
  useEffect(() => { (async () => { try { const co = JSON.parse((await AsyncStorage.getItem('coords')) || 'null'); if (co) { const t = addDays(new Date(), 1), w = wakeOf(buildDay(t.getDay(), calcTimes(t, co.lat, co.lng), t)); setNextWake(w); } } catch (e) {} })(); }, []);
  const st = sleepStats(sleep, goal), open = sleep.find((x) => !x.wake);
  const hrs = (ms) => { const m = Math.round(ms / 60000); return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
  const bedAt = nextWake != null ? (((nextWake - goal * 60 - 15) % 1440) + 1440) % 1440 : null;
  const goSleep = () => { anim(); saveSleep([...sleep, { id: Date.now(), bed: Date.now(), wake: null, q: 0 }]); };
  const wake = () => { anim(); saveSleep(sleep.map((x) => (x.id === open.id ? { ...x, wake: Date.now() } : x))); };
  const setQ = (id, q) => saveSleep(sleep.map((x) => (x.id === id ? { ...x, q } : x)));
  const openNew = (x) => {
    setErr(''); setEditId(x ? x.id : null);
    if (x) { const b = new Date(x.bed), w = new Date(x.wake || Date.now()); setBd(b); setBt(b.getHours() * 60 + b.getMinutes()); setWd(w); setWt(w.getHours() * 60 + w.getMinutes()); }
    else { setBd(addDays(new Date(), -1)); setBt(23 * 60); setWd(new Date()); setWt(6 * 60); }
    setSheet(true);
  };
  const save = () => {
    const b = new Date(bd); b.setHours(Math.floor(bt / 60), bt % 60, 0, 0);
    const w = new Date(wd); w.setHours(Math.floor(wt / 60), wt % 60, 0, 0);
    const d = (w.getTime() - b.getTime()) / 36e5;
    if (d <= 0.25) { setErr('Wake-up must be after bedtime.'); return; }
    if (d > 20) { setErr('That is more than 20 hours. Check the dates.'); return; }
    anim();
    if (editId) saveSleep(sleep.map((x) => (x.id === editId ? { ...x, bed: b.getTime(), wake: w.getTime() } : x)));
    else saveSleep([...sleep, { id: Date.now(), bed: b.getTime(), wake: w.getTime(), q: 0 }]);
    setSheet(false);
  };
  const del = () => Alert.alert('Delete this night?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { anim(); saveSleep(sleep.filter((x) => x.id !== editId)); setSheet(false); } }]);
  const nights = Array.from({ length: 7 }, (_, i) => { const d = addDays(new Date(), i - 6), k = iso(d), x = st.done.find((y) => iso(new Date(y.wake)) === k); return { l: DN[d.getDay()][0], v: x ? (x.wake - x.bed) / 36e5 : 0 }; });
  const lastDur = st.last ? (st.last.wake - st.last.bed) / 36e5 : null;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <View style={s.row}><View style={{ flex: 1 }}><Text style={s.h1}>Sleep</Text><Text style={s.mute}>Goal {goal} hours a night</Text></View>
        <Pressable onPress={() => openNew(null)} style={[s.btn, { minWidth: 0, paddingHorizontal: 14 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>+ Add night</Text></Pressable></View>
      <View style={[s.hero, { marginTop: 12, backgroundColor: open ? '#3D4FA8' : VIOLET }]}>
        {open ? (
          <View>
            <Text style={s.heroTag}>SLEEPING</Text>
            <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', marginVertical: 4 }}>{hrs(now - open.bed)}</Text>
            <Text style={s.heroSub}>Since {fmt(new Date(open.bed).getHours() * 60 + new Date(open.bed).getMinutes())}</Text>
            <Pressable onPress={wake} style={{ backgroundColor: '#fff', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 }}><Text style={{ color: '#3D4FA8', fontWeight: '800', fontSize: 16 }}>I woke up</Text></Pressable>
          </View>
        ) : (
          <View>
            <Text style={s.heroTag}>{st.last ? 'LAST NIGHT' : 'GOOD NIGHT'}</Text>
            <Text style={{ color: '#fff', fontSize: 38, fontWeight: '800', marginVertical: 4 }}>{st.last ? hrs(st.last.wake - st.last.bed) : '--'}</Text>
            <Text style={s.heroSub}>{st.last ? (lastDur >= goal ? 'Goal reached' : (goal - lastDur).toFixed(1) + ' h short of your goal') : 'Tap below when you go to bed'}</Text>
            <Pressable onPress={goSleep} style={{ backgroundColor: '#ffffff30', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>I'm going to sleep</Text></Pressable>
          </View>
        )}
      </View>
      {st.last && !st.last.q && !open && (
        <View style={s.card}><Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>How did you sleep?</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[['1', 'Poor'], ['2', 'Fair'], ['3', 'Okay'], ['4', 'Good'], ['5', 'Great']].map((x) => <Chip key={x[0]} s={s} c={c} on={false} label={x[1]} onPress={() => setQ(st.last.id, Number(x[0]))} />)}</View></View>
      )}
      {bedAt != null && <View style={[s.card, { flexDirection: 'row', alignItems: 'center' }]}><Ionicons name="moon-outline" size={22} color={AMBER} /><View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: c.ink, fontWeight: '700' }}>Be in bed by {fmt(bedAt)}</Text><Text style={s.mute}>For {goal} hours before your {fmt(nextWake)} wake-up tomorrow</Text></View></View>}
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Last 7 nights</Text>
        <Bars c={c} vals={nights.map((n) => n.v)} labels={nights.map((n) => n.l)} color={VIOLET} hi={6} max={Math.max(goal + 1, ...nights.map((n) => n.v))} h={90} />
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '800', fontSize: 18 }}>{st.avg != null ? hrs(st.avg * 60000) : '--'}</Text><Text style={s.mute}>average</Text></View>
          <View style={{ flex: 1 }}><Text style={{ color: st.debt > 120 ? CORAL : c.ink, fontWeight: '800', fontSize: 18 }}>{hrs(st.debt * 60000)}</Text><Text style={s.mute}>sleep debt</Text></View>
          <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '800', fontSize: 18 }}>{st.sdBed != null ? (st.sdBed < 30 ? 'Steady' : st.sdBed < 60 ? 'Varied' : 'Irregular') : '--'}</Text><Text style={s.mute}>bedtime</Text></View>
        </View>
      </View>
      <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 6, marginBottom: 6 }}>HISTORY</Text>
      {st.done.length === 0 && <Text style={s.mute}>No nights yet.</Text>}
      {st.done.slice(0, 14).map((x) => (
        <Pressable key={x.id} onPress={() => openNew(x)} style={[s.block, { borderLeftColor: (x.wake - x.bed) / 36e5 >= goal ? CYAN : ORANGE }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{hrs(x.wake - x.bed)}{x.q ? ' · ' + ['', 'Poor', 'Fair', 'Okay', 'Good', 'Great'][x.q] : ''}</Text>
            <Text style={s.mute}>{fmt(new Date(x.bed).getHours() * 60 + new Date(x.bed).getMinutes())} to {fmt(new Date(x.wake).getHours() * 60 + new Date(x.wake).getMinutes())} · {dateTxt(x.wake).slice(0, 10)}</Text>
          </View>
          <Ionicons name="create-outline" size={18} color={c.mute} />
        </Pressable>
      ))}
      <Sheet c={c} visible={sheet} onClose={() => setSheet(false)} title={editId ? 'Edit night' : 'Add a night'} onSave={save} saveLabel="Save" onDelete={editId ? del : undefined}>
        {lab(s, 'Went to bed')}
        <DateField c={c} value={bd} onChange={(d) => setBd(d || new Date())} />
        <View style={{ marginTop: 10 }}><TimePick c={c} value={bt} onChange={setBt} /></View>
        {lab(s, 'Woke up')}
        <DateField c={c} value={wd} onChange={(d) => setWd(d || new Date())} />
        <View style={{ marginTop: 10 }}><TimePick c={c} value={wt} onChange={setWt} /></View>
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </ScrollView>
  );
}

/* ---------- Trainer ---------- */
const GOALS_T = ['Build muscle', 'Lose fat', 'Stay fit', 'Get stronger', 'Endurance'];
const EQUIP = ['No equipment', 'Dumbbells', 'Resistance bands', 'Pull-up bar', 'Bench', 'Gym access'];
const SORE = ['Legs', 'Back', 'Arms', 'Chest', 'Core', 'None'];
const TRAIN_SYS = `You are a careful personal trainer. Build ONE workout for today. Return ONLY JSON {"title":"","focus":"","warmup":["..."],"exercises":[{"name":"","sets":3,"reps":"10","rest":"60 s","note":""}],"cooldown":["..."],"tip":""}.
Use ONLY the equipment listed (bodyweight moves are always allowed). Fit the time available, including warm-up and rest. Choose exercises by the goal and level, avoid the sore areas and any limits, and adjust for energy. Use the previous workouts to rotate muscle groups and progress gradually (a little more reps or one more set), never big jumps. Give 4 to 7 exercises. For timed holds use reps like "30 s". If a MODIFIER is given (easier or harder) apply it. This is general fitness guidance, not medical advice.`;
function fallbackPlan(mins, equip) {
  const db = equip.includes('Dumbbells'), bar = equip.includes('Pull-up bar');
  const ex = [['Push-ups', 3, '10', '45 s'], ['Bodyweight squats', 3, '15', '45 s'], ['Reverse lunges', 3, '10 each', '45 s'], ['Plank', 3, '30 s', '30 s'], ['Glute bridges', 3, '15', '30 s']];
  if (db) ex.splice(1, 0, ['Dumbbell rows', 3, '10', '60 s'], ['Dumbbell shoulder press', 3, '10', '60 s']);
  if (bar) ex.splice(1, 0, ['Pull-ups or negatives', 3, '5', '90 s']);
  const n = mins <= 20 ? 4 : mins <= 30 ? 5 : 6;
  return { title: 'Simple full-body session', focus: 'Full body', warmup: ['Jog in place 2 min', 'Arm circles and hip circles 1 min'], exercises: ex.slice(0, n).map((e) => ({ name: e[0], sets: e[1], reps: e[2], rest: e[3], note: '' })), cooldown: ['Gentle stretching 3 min'], tip: 'Made without the AI, so it is a basic plan.' };
}
function TrainView({ c, train, saveTrain, sleepLast }) {
  const s = mk(c);
  const logs = train.logs || [], prof = train.prof;
  const [mins, setMins] = useState(30);
  const [equip, setEquip] = useState((logs[0] && logs[0].equip) || ['No equipment']);
  const [energy, setEnergy] = useState('ok');
  const [sore, setSore] = useState(['None']);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [pOpen, setPOpen] = useState(false);
  const [goal, setGoal] = useState((prof && prof.goal) || 'Stay fit');
  const [level, setLevel] = useState((prof && prof.level) || 'Beginner');
  const [limits, setLimits] = useState((prof && prof.limits) || '');
  const today = iso(new Date());
  useEffect(() => { const t = logs.find((l) => l.date === today && !l.finished); if (t && !plan) setPlan({ ...t.plan, logId: t.id }); }, []);
  const toggle = (arr, set, v, none) => { let a = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr.filter((x) => x !== none), v]; if (v === none) a = [none]; if (!a.length) a = [none]; set(a); };
  const recent = logs.filter((l) => l.finished).slice(0, 5).map((l) => `${l.date}: ${l.plan.title} (${l.plan.focus || ''}); ${l.setsDone}/${l.setsTotal} sets; ${l.plan.exercises.map((e) => e.name + ' ' + e.sets + 'x' + e.reps).join(', ')}`);
  const generate = async (modifier) => {
    setBusy(true); setMsg('');
    let p = null;
    try {
      const out = await aiJson(TRAIN_SYS, JSON.stringify({ goal: prof ? prof.goal : goal, level: prof ? prof.level : level, limits: prof ? prof.limits : limits, minutesAvailable: mins, equipment: equip, energy, soreAreas: sore.filter((x) => x !== 'None'), lastNightSleepHours: sleepLast != null ? Math.round(sleepLast * 10) / 10 : 'unknown', modifier: modifier || 'none', previousWorkouts: recent }));
      if (out && Array.isArray(out.exercises) && out.exercises.length) p = { title: String(out.title || 'Today\'s workout').slice(0, 50), focus: String(out.focus || '').slice(0, 40), warmup: (out.warmup || []).slice(0, 5).map(String), cooldown: (out.cooldown || []).slice(0, 5).map(String), tip: String(out.tip || '').slice(0, 160), exercises: out.exercises.slice(0, 8).map((e) => { const n = Math.max(1, Math.min(6, parseInt(e.sets, 10) || 3)); return { name: String(e.name || 'Exercise').slice(0, 40), sets: n, reps: String(e.reps || '10').slice(0, 14), rest: String(e.rest || '60 s').slice(0, 12), note: String(e.note || '').slice(0, 100), done: Array(n).fill(false) }; }) };
    } catch (e) { setMsg(aiErrText(e) + ' Here is a basic plan instead.'); }
    if (!p) { const f = fallbackPlan(mins, equip); p = { ...f, exercises: f.exercises.map((e) => ({ ...e, done: Array(e.sets).fill(false) })) }; }
    const id = Date.now(), row = { id, date: today, ts: id, mins, equip, energy, plan: p, finished: false, setsDone: 0, setsTotal: p.exercises.reduce((a, e) => a + e.sets, 0) };
    anim(); saveTrain({ ...train, logs: [row, ...logs.filter((l) => !(l.date === today && !l.finished))].slice(0, 120) });
    setPlan({ ...p, logId: id }); setBusy(false);
  };
  const setDone = (ei, si) => {
    const p = { ...plan, exercises: plan.exercises.map((e, i) => (i === ei ? { ...e, done: e.done.map((d, j) => (j === si ? !d : d)) } : e)) };
    setPlan(p); saveTrain({ ...train, logs: logs.map((l) => (l.id === plan.logId ? { ...l, plan: p, setsDone: p.exercises.reduce((a, e) => a + e.done.filter(Boolean).length, 0) } : l)) });
  };
  const finish = () => { anim(); saveTrain({ ...train, logs: logs.map((l) => (l.id === plan.logId ? { ...l, finished: true } : l)) }); setPlan(null); };
  const saveProf = () => { saveTrain({ ...train, prof: { goal, level, limits: limits.trim().slice(0, 120) } }); setPOpen(false); };
  const wk = new Date(); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7)); wk.setHours(0, 0, 0, 0);
  const weekN = logs.filter((l) => l.finished && l.ts >= wk.getTime()).length, setsDone = plan ? plan.exercises.reduce((a, e) => a + e.done.filter(Boolean).length, 0) : 0, setsAll = plan ? plan.exercises.reduce((a, e) => a + e.sets, 0) : 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <View style={s.row}><View style={{ flex: 1 }}><Text style={s.h1}>Trainer</Text><Text style={s.mute}>{weekN} workout{weekN === 1 ? '' : 's'} this week{prof ? ' · ' + prof.goal : ''}</Text></View>
        <Pressable onPress={() => { setPOpen(true); }} style={s.iconBtn}><Ionicons name="person-outline" size={20} color={c.ink} /></Pressable></View>
      {!prof && <Pressable onPress={() => setPOpen(true)} style={[s.card, { borderColor: VIOLET, marginTop: 12 }]}><Text style={{ color: c.ink, fontWeight: '700' }}>Tell me about you first</Text><Text style={s.mute}>Your goal, level and any limits. It takes 20 seconds and makes the plans better.</Text></Pressable>}
      {!plan ? (
        <View>
          <View style={[s.card, { marginTop: 12 }]}>
            <Text style={{ color: c.ink, fontWeight: '800', fontSize: 16 }}>Today's check-in</Text>
            {lab(s, 'Time you have')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[15, 20, 30, 45, 60, 90].map((m) => <Chip key={m} s={s} c={c} on={mins === m} label={m + ' min'} onPress={() => setMins(m)} />)}</View>
            {lab(s, 'What you can use')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{EQUIP.map((e) => <Chip key={e} s={s} c={c} on={equip.includes(e)} label={e} onPress={() => toggle(equip, setEquip, e, 'No equipment')} />)}</View>
            {lab(s, 'Energy today')}
            <View style={{ flexDirection: 'row' }}>{[['low', 'Low'], ['ok', 'Okay'], ['high', 'High']].map((x) => <Chip key={x[0]} s={s} c={c} on={energy === x[0]} label={x[1]} onPress={() => setEnergy(x[0])} />)}</View>
            {lab(s, 'Sore anywhere?')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{SORE.map((x) => <Chip key={x} s={s} c={c} on={sore.includes(x)} label={x} onPress={() => toggle(sore, setSore, x, 'None')} />)}</View>
            <Pressable onPress={() => generate('')} disabled={busy} style={{ backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Get today's workout</Text>}</Pressable>
            {!!msg && <Text style={{ color: ORANGE, marginTop: 10 }}>{msg}</Text>}
          </View>
          {logs.filter((l) => l.finished).length > 0 && (
            <View style={s.card}>
              <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>Recent workouts</Text>
              {logs.filter((l) => l.finished).slice(0, 6).map((l) => <View key={l.id} style={[s.row, { paddingVertical: 6 }]}><View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>{l.plan.title}</Text><Text style={s.mute}>{dateTxt(l.ts).slice(0, 10)} · {l.plan.focus || 'Workout'} · {l.mins} min</Text></View><Text style={{ color: CYAN, fontWeight: '700' }}>{l.setsDone}/{l.setsTotal}</Text></View>)}
            </View>
          )}
        </View>
      ) : (
        <View>
          <View style={[s.hero, { marginTop: 12 }]}>
            <Text style={s.heroTag}>{(plan.focus || 'WORKOUT').toUpperCase()}</Text>
            <Text style={s.heroTitle}>{plan.title}</Text>
            <View style={{ height: 6, backgroundColor: '#ffffff40', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}><View style={{ height: 6, width: `${setsAll ? (setsDone / setsAll) * 100 : 0}%`, backgroundColor: '#fff' }} /></View>
            <Text style={[s.heroSub, { marginTop: 6 }]}>{setsDone} of {setsAll} sets done · {mins} min</Text>
          </View>
          {plan.warmup && plan.warmup.length > 0 && <View style={s.card}><Text style={{ color: AMBER, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>WARM-UP</Text>{plan.warmup.map((w, i) => <Text key={i} style={{ color: c.ink, marginTop: 4 }}>• {w}</Text>)}</View>}
          {plan.exercises.map((e, ei) => (
            <View key={ei} style={s.card}>
              <View style={s.row}><Text style={{ color: c.ink, fontWeight: '800', fontSize: 16, flex: 1 }}>{e.name}</Text><Text style={{ color: VIOLET, fontWeight: '800' }}>{e.sets} × {e.reps}</Text></View>
              <Text style={s.mute}>Rest {e.rest}{e.note ? ' · ' + e.note : ''}</Text>
              <View style={{ flexDirection: 'row', marginTop: 10 }}>{e.done.map((d, si) => <Pressable key={si} onPress={() => setDone(ei, si)} style={[s.tick, { width: 40, height: 40, borderRadius: 20, marginRight: 10, borderColor: VIOLET }, d && { backgroundColor: VIOLET }]}><Text style={{ color: d ? '#fff' : c.mute, fontWeight: '800' }}>{si + 1}</Text></Pressable>)}</View>
            </View>
          ))}
          {plan.cooldown && plan.cooldown.length > 0 && <View style={s.card}><Text style={{ color: CYAN, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>COOL-DOWN</Text>{plan.cooldown.map((w, i) => <Text key={i} style={{ color: c.ink, marginTop: 4 }}>• {w}</Text>)}</View>}
          {!!plan.tip && <Text style={[s.mute, { marginBottom: 8 }]}>{plan.tip}</Text>}
          <Pressable onPress={finish} style={{ backgroundColor: VIOLET, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Finish workout</Text></Pressable>
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            <Pressable onPress={() => generate('easier')} disabled={busy} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Make it easier</Text></Pressable>
            <Pressable onPress={() => generate('harder')} disabled={busy} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Make it harder</Text></Pressable>
          </View>
          <Pressable onPress={() => setPlan(null)} style={{ alignSelf: 'center', padding: 12 }}><Text style={{ color: c.mute, fontWeight: '600' }}>Change my check-in</Text></Pressable>
        </View>
      )}
      <Sheet c={c} visible={pOpen} onClose={() => setPOpen(false)} title="About you" onSave={saveProf} saveLabel="Save">
        {lab(s, 'Your goal')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{GOALS_T.map((g) => <Chip key={g} s={s} c={c} on={goal === g} label={g} onPress={() => setGoal(g)} />)}</View>
        {lab(s, 'Your level')}
        <View style={{ flexDirection: 'row' }}>{['Beginner', 'Intermediate', 'Advanced'].map((g) => <Chip key={g} s={s} c={c} on={level === g} label={g} onPress={() => setLevel(g)} />)}</View>
        {lab(s, 'Injuries or limits (optional)')}
        <TextInput value={limits} onChangeText={setLimits} placeholder="e.g. weak left knee" placeholderTextColor={c.mute} style={inputStyle(c)} />
        <Text style={[s.mute, { fontSize: 12, marginTop: 10 }]}>This is general fitness guidance, not medical advice. Stop if something hurts, and see a doctor for pain or health problems.</Text>
        <View style={{ height: 8 }} />
      </Sheet>
    </ScrollView>
  );
}

/* ---------- Projects ---------- */
const projPct = (p) => { const ms = p.milestones || []; if (!ms.length) return 0; const w = ms.reduce((a, m) => a + (m.w || 1), 0); return Math.round(ms.reduce((a, m) => a + (m.pct || 0) * (m.w || 1), 0) / w); };
const PROJ_READ = (today) => `You read a project description, roadmap or plan (text, photo or PDF) and turn it into a project. Today is ${today}. Return ONLY JSON {"name":"","summary":"one or two sentences","due":"YYYY-MM-DD or empty","milestones":[{"title":"","due":"YYYY-MM-DD or empty"}]}. Use 3 to 12 clear milestones in order. Only use dates that are written in the material.`;
const PROJ_SYS = `You track progress on a student's project. You get the project, its milestones with the current percent complete (0 to 100), and the student's update about what they did today. Return ONLY JSON {"updates":[{"milestone":1,"pct":40}],"comment":"one or two honest sentences","next":"the single best next step"}. Only raise a milestone when the update clearly shows progress. Be realistic. Never go above 100 or below the current value.`;
function ProjectsView({ c, projects, saveProjects }) {
  const s = mk(c);
  const [nOpen, setNOpen] = useState(false);
  const [name, setName] = useState('');
  const [sum, setSum] = useState('');
  const [due, setDue] = useState(null);
  const [ms, setMs] = useState([]);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [upd, setUpd] = useState('');
  const [uBusy, setUBusy] = useState(false);
  const [uMsg, setUMsg] = useState('');
  const [newM, setNewM] = useState('');
  const parseD = (v) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || '').trim()); if (!m) return null; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] ? d.getTime() : null; };
  const openNew = () => { setName(''); setSum(''); setDue(null); setMs([]); setErr(''); setBusy(''); setNOpen(true); };
  const read = async (kind) => {
    setErr('');
    try {
      const f = await pickAny(kind);
      if (!f) return;
      setBusy('read');
      const out = await aiJson(PROJ_READ(iso(new Date())), 'Read this project material.', f);
      if (!out || !Array.isArray(out.milestones) || !out.milestones.length) { setErr('I could not find a roadmap in that. Try a clearer file, or add milestones by hand.'); }
      else { if (out.name && !name) setName(String(out.name).slice(0, 40)); if (out.summary && !sum) setSum(String(out.summary).slice(0, 300)); const d = parseD(out.due); if (d && !due) setDue(new Date(d)); setMs(out.milestones.slice(0, 15).map((m, i) => ({ id: Date.now() + i, t: String(m.title || '').slice(0, 80), due: String(m.due || '') })).filter((m) => m.t)); }
    } catch (e) { setErr(e && e.message === 'cam' ? 'Camera permission is off.' : aiErrText(e)); }
    setBusy('');
  };
  const create = () => {
    if (!name.trim()) { setErr('Give the project a name.'); return; }
    const items = ms.filter((m) => m.t.trim()).map((m) => ({ id: m.id, t: m.t.trim().slice(0, 80), due: parseD(m.due), pct: 0, w: 1 }));
    anim(); saveProjects([...projects, { id: Date.now(), name: name.trim().slice(0, 40), summary: sum.trim().slice(0, 300), due: due ? due.getTime() : null, milestones: items, logs: [], ts: Date.now() }]);
    setNOpen(false);
  };
  const p = projects.find((x) => x.id === sel);
  const edit = (patch) => saveProjects(projects.map((x) => (x.id === sel ? { ...x, ...patch } : x)));
  const setPct = (mid, v) => edit({ milestones: p.milestones.map((m) => (m.id === mid ? { ...m, pct: v } : m)) });
  const addM = () => { const t = newM.trim(); if (!t) return; edit({ milestones: [...p.milestones, { id: Date.now(), t: t.slice(0, 80), due: null, pct: 0, w: 1 }] }); setNewM(''); };
  const analyze = async () => {
    if (!upd.trim()) { setUMsg('Tell me what you did today.'); return; }
    setUBusy(true); setUMsg('');
    try {
      const out = await aiJson(PROJ_SYS, JSON.stringify({ project: p.name, summary: p.summary, milestones: p.milestones.map((m, i) => ({ number: i + 1, title: m.t, pct: m.pct })), update: upd.trim() }));
      if (!out) throw new Error('bad');
      const nm = p.milestones.map((m, i) => { const u = (out.updates || []).find((x) => Number(x.milestone) === i + 1); const v = u ? Math.max(m.pct, Math.min(100, Math.round(Number(u.pct) || 0))) : m.pct; return { ...m, pct: v }; });
      const np = { ...p, milestones: nm }, overall = projPct(np);
      anim(); edit({ milestones: nm, logs: [{ id: Date.now(), ts: Date.now(), text: upd.trim().slice(0, 300), pct: overall, note: String(out.comment || '').slice(0, 220), next: String(out.next || '').slice(0, 140) }, ...(p.logs || [])].slice(0, 60) });
      setUpd(''); setUMsg('');
    } catch (e) { setUMsg(aiErrText(e)); }
    setUBusy(false);
  };
  const delProj = () => Alert.alert('Delete this project?', p.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { anim(); saveProjects(projects.filter((x) => x.id !== sel)); setSel(null); } }]);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <View style={s.row}><View style={{ flex: 1 }}><Text style={s.h1}>Projects</Text><Text style={s.mute}>{projects.length} project{projects.length === 1 ? '' : 's'}</Text></View>
        <Pressable onPress={openNew} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}><Text style={{ color: '#fff', fontWeight: '700' }}>+ New</Text></Pressable></View>
      {projects.length === 0 && <View style={[s.card, { alignItems: 'center', paddingVertical: 26, marginTop: 14 }]}><Ionicons name="rocket-outline" size={30} color={c.mute} /><Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>Control your projects</Text><Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>Upload your roadmap and deadlines, then tell Kairo what you did each day. The AI tracks your completion.</Text></View>}
      {projects.map((x) => {
        const pc = projPct(x), days = x.due ? Math.ceil((x.due - Date.now()) / 864e5) : null, nm = x.milestones.filter((m) => m.pct < 100).sort((a, b) => (a.due || 9e15) - (b.due || 9e15))[0];
        return (
          <Pressable key={x.id} onPress={() => { setSel(x.id); setUpd(''); setUMsg(''); }} style={[s.card, { marginTop: 12 }]}>
            <View style={s.row}><Text style={{ color: c.ink, fontWeight: '800', fontSize: 16, flex: 1 }}>{x.name}</Text><Text style={{ color: pc >= 100 ? CYAN : c.ink, fontWeight: '800' }}>{pc}%</Text></View>
            <View style={{ marginTop: 10 }}><GrowBar pct={pc} color={pc >= 100 ? CYAN : VIOLET} bg={c.line} h={8} /></View>
            <Text style={[s.mute, { marginTop: 6, fontSize: 12 }]}>{days == null ? 'No deadline' : days >= 0 ? days + ' days left' : Math.abs(days) + ' days late'}{nm ? ' · next: ' + nm.t : ''}</Text>
          </Pressable>
        );
      })}
      <Sheet c={c} visible={nOpen} onClose={() => setNOpen(false)} title="New project" onSave={create} saveLabel="Create project">
        <TextInput value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={c.mute} style={inputStyle(c)} />
        <TextInput value={sum} onChangeText={setSum} multiline placeholder="What is it about? (optional)" placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 8, minHeight: 60, maxHeight: 120, textAlignVertical: 'top' }]} />
        {lab(s, 'Final deadline (optional)')}
        <DateField c={c} value={due} onChange={setDue} clearable placeholder="No deadline" />
        {lab(s, 'Let the AI read your roadmap')}
        <View style={{ flexDirection: 'row' }}>
          {[['cam', 'camera-outline', 'Photo'], ['lib', 'image-outline', 'Image'], ['pdf', 'document-text-outline', 'PDF / file']].map((x) => <Pressable key={x[0]} onPress={() => read(x[0])} disabled={!!busy} style={[s.btn, { flex: 1, marginRight: 6, flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 4 }]}><Ionicons name={x[1]} size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>{x[2]}</Text></Pressable>)}
        </View>
        {busy === 'read' && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}><ActivityIndicator color={VIOLET} /><Text style={[s.mute, { marginLeft: 8 }]}>Reading...</Text></View>}
        {lab(s, 'Milestones')}
        {ms.map((m) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <TextInput value={m.t} onChangeText={(v) => setMs(ms.map((x) => (x.id === m.id ? { ...x, t: v } : x)))} style={[inputStyle(c), { flex: 1, paddingHorizontal: 10 }]} />
            <TextInput value={m.due} onChangeText={(v) => setMs(ms.map((x) => (x.id === m.id ? { ...x, due: v } : x)))} placeholder="YYYY-MM-DD" placeholderTextColor={c.mute} style={[inputStyle(c), { width: 108, marginLeft: 6, paddingHorizontal: 6, textAlign: 'center' }]} />
            <Pressable onPress={() => setMs(ms.filter((x) => x.id !== m.id))} hitSlop={8} style={{ paddingLeft: 8 }}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
          </View>
        ))}
        <Pressable onPress={() => setMs([...ms, { id: Date.now(), t: '', due: '' }])}><Text style={{ color: VIOLET, fontWeight: '700', marginTop: 4 }}>+ Add milestone</Text></Pressable>
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
      <Sheet c={c} visible={!!p} onClose={() => setSel(null)} title={p ? p.name : ''} onSave={() => setSel(null)} saveLabel="Close" onDelete={p ? delProj : undefined}>
        {p && (
          <View>
            <View style={s.row}><Text style={{ color: c.ink, fontSize: 30, fontWeight: '800', flex: 1 }}>{projPct(p)}%</Text><Text style={s.mute}>{p.due ? 'Due ' + dateTxt(p.due).slice(0, 10) : 'No deadline'}</Text></View>
            <View style={{ marginTop: 6 }}><GrowBar pct={projPct(p)} color={VIOLET} bg={c.line} h={8} /></View>
            {!!p.summary && <Text style={[s.mute, { marginTop: 8 }]}>{p.summary}</Text>}
            <Text style={{ color: c.ink, fontWeight: '700', marginTop: 16, marginBottom: 6 }}>Today's update</Text>
            <TextInput value={upd} onChangeText={setUpd} multiline placeholder="What did you do today on this project?" placeholderTextColor={c.mute} style={[inputStyle(c), { minHeight: 70, maxHeight: 140, textAlignVertical: 'top' }]} />
            <Pressable onPress={analyze} disabled={uBusy} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 }}>{uBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Analyze my progress</Text>}</Pressable>
            {!!uMsg && <Text style={{ color: CORAL, marginTop: 8 }}>{uMsg}</Text>}
            {(p.logs || [])[0] && <View style={[s.card, { marginTop: 10 }]}><Text style={{ color: c.ink }}>{p.logs[0].note}</Text>{!!p.logs[0].next && <Text style={{ color: VIOLET, fontWeight: '600', marginTop: 6 }}>Next: {p.logs[0].next}</Text>}</View>}
            <Text style={{ color: c.ink, fontWeight: '700', marginTop: 16, marginBottom: 6 }}>Milestones</Text>
            {p.milestones.map((m) => (
              <View key={m.id} style={{ marginBottom: 12 }}>
                <View style={s.row}><Text style={{ color: c.ink, flex: 1, fontWeight: '600' }}>{m.t}</Text><Text style={s.mute}>{m.due ? dateTxt(m.due).slice(0, 10) : ''}</Text></View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>{[0, 25, 50, 75, 100].map((v) => <Chip key={v} s={s} c={c} on={m.pct === v} label={v + '%'} onPress={() => setPct(m.id, v)} />)}</View>
              </View>
            ))}
            <View style={{ flexDirection: 'row' }}>
              <TextInput value={newM} onChangeText={setNewM} placeholder="Add a milestone" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1 }]} onSubmitEditing={addM} />
              <Pressable onPress={addM} style={[s.btn, { marginLeft: 8, minWidth: 60 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Add</Text></Pressable>
            </View>
            {(p.logs || []).length > 1 && <View style={{ marginTop: 14 }}><Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>Progress over time</Text><Bars c={c} vals={[...p.logs].slice(0, 8).reverse().map((l) => l.pct)} labels={[...p.logs].slice(0, 8).reverse().map((l) => new Date(l.ts).getDate() + '/' + (new Date(l.ts).getMonth() + 1))} color={VIOLET} max={100} h={70} /></View>}
            <View style={{ height: 8 }} />
          </View>
        )}
      </Sheet>
    </ScrollView>
  );
}

/* ---------- Hubs ---------- */
const nextSeg = (list, cur, dir) => { const i = list.indexOf(cur), j = dir === 'left' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1); return list[j]; };
function GoalsHub(p) {
  const [seg, setSeg] = useState('tasks');
  const [pre, setPre] = useState('');
  const SEG = ['tasks', 'reminders', 'notes', 'targets', 'projects', 'exams', 'calendar'];
  const LABEL = { tasks: 'Tasks', reminders: 'Reminders', notes: 'Notes', targets: 'Targets', projects: 'Projects', exams: 'Exams', calendar: 'Calendar' };
  const s = mk(p.c);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingLeft: 16, marginTop: 10 }} contentContainerStyle={{ paddingRight: 16 }}>
        {SEG.map((k) => <Chip key={k} s={s} c={p.c} on={seg === k} label={LABEL[k] + (k === 'exams' && p.exams.length ? ' ' + p.exams.length : '')} onPress={() => setSeg(k)} />)}
      </ScrollView>
      <Swipe onSwipe={(d) => setSeg(nextSeg(SEG, seg, d))} can={(d) => nextSeg(SEG, seg, d) !== seg}>
        <FadeIn key={seg} y={0} dur={200} style={{ flex: 1 }}>
          {seg === 'tasks' ? <Tasks c={p.c} tasks={p.tasks} log={p.log} mark={p.mark} addTask={p.addTask} editTask={p.editTask} delTask={p.delTask} />
            : seg === 'reminders' ? <Reminders c={p.c} reminders={p.reminders} saveReminders={p.saveReminders} prefill={pre} clearPrefill={() => setPre('')} />
            : seg === 'notes' ? <Notes c={p.c} notes={p.notes} saveNotes={p.saveNotes} onRemind={(t) => { setPre(t); setSeg('reminders'); }} />
            : seg === 'targets' ? <Targets c={p.c} targets={p.targets} saveTargets={p.saveTargets} askAI={p.askAI} />
            : seg === 'projects' ? <ProjectsView c={p.c} projects={p.projects} saveProjects={p.saveProjects} />
            : seg === 'exams' ? <Exams c={p.c} exams={p.exams} saveExams={p.saveExams} examOn={p.examOn} settings={p.settings} saveSet={p.saveSet} />
            : <CalendarView c={p.c} tasks={p.tasks} log={p.log} mark={p.mark} exams={p.exams} targets={p.targets} projects={p.projects} reminders={p.reminders} offs={p.offs} saveOffs={p.saveOffs} saveTasks={p.saveTasks} editTask={p.editTask} delTask={p.delTask} askAI={p.askAI} askDay={p.askDay} />}
        </FadeIn>
      </Swipe>
    </View>
  );
}
function GrowHub(p) {
  const [seg, setSeg] = useState('focus');
  const SEG = ['focus', 'sleep', 'train', 'disc'];
  const LABEL = { focus: 'Focus', sleep: 'Sleep', train: 'Trainer', disc: 'Discipline' };
  const s = mk(p.c);
  const open = p.tasks.filter((t) => !(p.log[t.date] && p.log[t.date]['t:' + t.id])).slice(0, 4).map((t) => t.title);
  const goalH = p.settings.sleepGoal || 8, st = sleepStats(p.sleep, goalH);
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingLeft: 16, marginTop: 10 }} contentContainerStyle={{ paddingRight: 16 }}>
        {SEG.map((k) => <Chip key={k} s={s} c={p.c} on={seg === k} label={LABEL[k]} onPress={() => setSeg(k)} />)}
      </ScrollView>
      <Swipe onSwipe={(d) => setSeg(nextSeg(SEG, seg, d))} can={(d) => nextSeg(SEG, seg, d) !== seg}>
        <FadeIn key={seg} y={0} dur={200} style={{ flex: 1 }}>
          {seg === 'focus' ? <Focus c={p.c} sessions={p.sessions} addSession={p.addSession} openTasks={open} />
            : seg === 'sleep' ? <SleepView c={p.c} sleep={p.sleep} saveSleep={p.saveSleep} goal={goalH} />
            : seg === 'train' ? <TrainView c={p.c} train={p.train} saveTrain={p.saveTrain} sleepLast={st.last ? (st.last.wake - st.last.bed) / 36e5 : null} />
            : <Discipline c={p.c} disc={p.disc} saveDisc={p.saveDisc} />}
        </FadeIn>
      </Swipe>
    </View>
  );
}

/* ---------- Money ---------- */
const EXP = ['Food', 'Transport', 'Uni', 'Skill', 'Bills', 'Other'], INC = ['Pocket', 'Freelance', 'Salary', 'Other'];
const rs = (n) => 'Rs ' + Math.round(n).toLocaleString('en-US');
const Big = ({ children, style }) => <Text numberOfLines={1} adjustsFontSizeToFit style={style}>{children}</Text>;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TAG_COL = ['#7C5CFF', '#35D0E0', '#FF9F5C', '#FF7DB0', '#F5B84B', '#5C9CFF', '#B58CFF'];
function moneyCalc(money, sav, loans) {
  const sum = (a, k) => a.filter((m) => m.k === k).reduce((x, m) => x + m.a, 0);
  const inc = sum(money, 'in'), out = sum(money, 'out'), saved = (sav || []).reduce((a, e) => a + e.amt, 0);
  let lentLeft = 0, borrLeft = 0, flow = 0;
  (loans || []).forEach((l) => {
    const paid = (l.pays || []).reduce((a, p) => a + p.amt, 0), left = Math.max(0, l.amount - paid);
    if (!l.settled) { if (l.dir === 'lent') lentLeft += left; else borrLeft += left; }
    if (l.bal !== false) flow += l.dir === 'lent' ? -l.amount + paid : l.amount - paid;
  });
  const balance = inc - out + flow;
  return { inc, out, saved, lentLeft, borrLeft, flow, balance, avail: balance - saved };
}
const loanPaid = (l) => (l.pays || []).reduce((a, p) => a + p.amt, 0);
const dateTxt = (ts) => { const d = new Date(ts); return `${DN[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
function DateField({ c, value, onChange, clearable, placeholder }) {
  const s = mk(c);
  const mid = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => { const d = value ? mid(value) : mid(new Date()); d.setDate(1); return d; });
  const today0 = mid(new Date());
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(), lead = (month.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const rows = []; for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  const pickD = (d) => { onChange(d); setOpen(false); };
  const go = (n) => { const d = new Date(month); d.setMonth(d.getMonth() + n); setMonth(d); };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => setOpen(!open)} style={[inputStyle(c), { flex: 1, flexDirection: 'row', alignItems: 'center' }]}>
          <Ionicons name="calendar-outline" size={18} color={c.mute} />
          <Text style={{ color: value ? c.ink : c.mute, marginLeft: 8, fontSize: 15 }}>{value ? dateTxt(value.getTime()) : placeholder || 'Pick a date'}</Text>
        </Pressable>
        {clearable && value ? <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ padding: 10 }}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable> : null}
      </View>
      {open && (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 10, backgroundColor: c.card }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
            <Chip s={s} c={c} on={false} label="Today" onPress={() => pickD(today0)} />
            <Chip s={s} c={c} on={false} label="Tomorrow" onPress={() => pickD(addDays(today0, 1))} />
            <Chip s={s} c={c} on={false} label="Next week" onPress={() => pickD(addDays(today0, 7))} />
            <Chip s={s} c={c} on={false} label="In a month" onPress={() => { const d = new Date(today0); d.setMonth(d.getMonth() + 1); pickD(d); }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => go(-1)} hitSlop={8} style={{ padding: 8 }}><Ionicons name="chevron-back" size={20} color={c.ink} /></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', color: c.ink, fontWeight: '700' }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</Text>
            <Pressable onPress={() => go(1)} hitSlop={8} style={{ padding: 8 }}><Ionicons name="chevron-forward" size={20} color={c.ink} /></Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.mute, fontSize: 11 }}>{x}</Text>)}</View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', marginTop: 4 }}>
              {r.map((d, j) => {
                if (!d) return <View key={j} style={{ flex: 1, height: 38 }} />;
                const isSel = value && mid(value).getTime() === d.getTime(), isT = d.getTime() === today0.getTime();
                return <Pressable key={j} onPress={() => pickD(d)} style={{ flex: 1, height: 38, marginHorizontal: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? VIOLET : 'transparent', borderWidth: isT ? 1 : 0, borderColor: AMBER }}><Text style={{ color: isSel ? '#fff' : d < today0 ? c.mute : c.ink, fontWeight: isT ? '800' : '500' }}>{d.getDate()}</Text></Pressable>;
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/* ----- Savings ----- */
function SavingsView({ c, money, sav, saveSav, sgoals, saveSgoals, calc, addMoney }) {
  const s = mk(c);
  const [dep, setDep] = useState(null);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [gSel, setGSel] = useState(null);
  const [err, setErr] = useState('');
  const [gOpen, setGOpen] = useState(false);
  const [gEdit, setGEdit] = useState(null);
  const [gName, setGName] = useState('');
  const [gTar, setGTar] = useState('');
  const [gDue, setGDue] = useState(null);
  const now = Date.now(), ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const monthNet = sav.filter((e) => e.ts >= ms.getTime()).reduce((a, e) => a + e.amt, 0);
  const incM = money.filter((m) => m.k === 'in' && m.ts >= ms.getTime()).reduce((a, m) => a + m.a, 0);
  const rate = incM > 0 ? Math.round((monthNet / incM) * 100) : null;
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(ms); d.setMonth(d.getMonth() - (5 - i)); const e = new Date(d); e.setMonth(e.getMonth() + 1); return { l: MONTHS[d.getMonth()].slice(0, 3), v: Math.max(0, sav.filter((x) => x.ts >= d.getTime() && x.ts < e.getTime()).reduce((a, x) => a + x.amt, 0)) }; });
  const gSaved = (g) => sav.filter((e) => e.goal === g.id).reduce((a, e) => a + e.amt, 0);
  const active = sgoals.filter((g) => !g.done), doneG = sgoals.filter((g) => g.done);
  const general = calc.saved - sgoals.reduce((a, g) => a + gSaved(g), 0);
  const openDep = (mode, goalId) => { setDep(mode); setAmt(''); setNote(''); setGSel(goalId || null); setErr(''); };
  const saveDep = () => {
    const n = parseFloat(amt.replace(/,/g, ''));
    if (!n || n <= 0) { setErr('Enter an amount above 0.'); return; }
    if (dep === 'in' && n > calc.avail + 0.5) { setErr('Only ' + rs(Math.max(0, calc.avail)) + ' is available to save.'); return; }
    const pool = gSel ? sav.filter((e) => e.goal === gSel).reduce((a, e) => a + e.amt, 0) : general;
    if (dep === 'out' && n > pool + 0.5) { setErr('Only ' + rs(Math.max(0, pool)) + ' is saved there.'); return; }
    anim(); saveSav([...sav, { id: Date.now(), ts: Date.now(), amt: dep === 'in' ? n : -n, goal: gSel, note: note.trim().slice(0, 60) }]);
    setDep(null);
  };
  const openGoal = (g) => { setGEdit(g || null); setGName(g ? g.name : ''); setGTar(g ? String(g.target) : ''); setGDue(g && g.due ? new Date(g.due) : null); setErr(''); setGOpen(true); };
  const saveGoal = () => {
    const t = parseFloat(gTar.replace(/,/g, ''));
    if (!gName.trim()) { setErr('Name your goal.'); return; }
    if (!t || t <= 0) { setErr('Enter the target amount.'); return; }
    const row = { name: gName.trim().slice(0, 40), target: t, due: gDue ? gDue.getTime() : null };
    anim(); saveSgoals(gEdit ? sgoals.map((g) => (g.id === gEdit.id ? { ...g, ...row } : g)) : [...sgoals, { id: Date.now(), ts: Date.now(), ...row }]);
    setGOpen(false);
  };
  const delGoal = (g) => Alert.alert('Remove goal?', gSaved(g) > 0 ? `The ${rs(gSaved(g))} stays in your savings as general savings.` : g.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { anim(); saveSav(sav.map((e) => (e.goal === g.id ? { ...e, goal: null } : e))); saveSgoals(sgoals.filter((x) => x.id !== g.id)); setGOpen(false); } }]);
  const spendGoal = (g) => Alert.alert('Use the money?', `${rs(gSaved(g))} will leave your savings and be recorded as spending on "${g.name}".`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Use it', onPress: () => { const v = gSaved(g); anim(); saveSav([...sav, { id: Date.now(), ts: Date.now(), amt: -v, goal: g.id, note: 'Used for ' + g.name }]); addMoney({ id: Date.now() + 1, k: 'out', a: v, cat: 'Other', note: g.name + ' (goal)', ts: Date.now() }); saveSgoals(sgoals.map((x) => (x.id === g.id ? { ...x, done: true, usedTs: Date.now() } : x))); } }]);
  const delEntry = (e) => Alert.alert('Delete this entry?', (e.amt > 0 ? 'Saved ' : 'Withdrawn ') + rs(Math.abs(e.amt)), [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { anim(); saveSav(sav.filter((x) => x.id !== e.id)); } }]);
  const gName2 = (id) => { const g = sgoals.find((x) => x.id === id); return g ? g.name : id ? 'Completed goal' : 'General'; };
  return (
    <View>
      <View style={s.hero}>
        <Text style={s.heroTag}>SAVED</Text>
        <Big style={s.heroTitle}>{rs(calc.saved)}</Big>
        <Text style={s.heroSub}>This month {monthNet >= 0 ? '+' : ''}{rs(monthNet)}{rate != null ? ` · ${rate}% of income` : ''}</Text>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Pressable onPress={() => openDep('in', null)} style={{ flex: 1, backgroundColor: '#ffffff30', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '800' }}>+ Save money</Text></Pressable>
          <Pressable onPress={() => openDep('out', null)} style={{ flex: 1, backgroundColor: '#ffffff20', borderRadius: 12, paddingVertical: 11, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Withdraw</Text></Pressable>
        </View>
      </View>
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Saved each month</Text>
        <Bars c={c} vals={months.map((m) => m.v)} labels={months.map((m) => m.l)} color={CYAN} hi={5} h={80} />
      </View>
      <View style={[s.row, { marginTop: 4, marginBottom: 6 }]}>
        <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, flex: 1 }}>SAVING GOALS · {active.length}</Text>
        <Pressable onPress={() => openGoal(null)} hitSlop={8}><Text style={{ color: VIOLET, fontWeight: '700' }}>+ New goal</Text></Pressable>
      </View>
      {active.length === 0 && <Text style={s.mute}>No goals yet. Add one, like "New laptop" or "Emergency fund", and save towards it.</Text>}
      {active.map((g) => {
        const sv = gSaved(g), p = Math.min(1, sv / g.target), days = g.due ? Math.ceil((g.due - now) / 864e5) : null, weeks = days != null ? Math.max(1, Math.ceil(days / 7)) : null;
        return (
          <View key={g.id} style={s.card}>
            <Pressable onPress={() => openGoal(g)}>
              <View style={s.row}>
                <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{g.name}</Text><Text style={s.mute}>{days == null ? 'No deadline' : days >= 0 ? days + ' days left' : Math.abs(days) + ' days late'}</Text></View>
                <Text style={{ color: p >= 1 ? CYAN : c.ink, fontWeight: '800' }}>{Math.round(p * 100)}%</Text>
              </View>
              <View style={{ marginTop: 10 }}><GrowBar pct={p * 100} color={p >= 1 ? CYAN : AMBER} bg={c.line} h={8} /></View>
              <Text style={[s.mute, { marginTop: 4, fontSize: 12 }]}>{rs(sv)} of {rs(g.target)}{weeks != null && p < 1 && days >= 0 ? ` · save about ${rs((g.target - sv) / weeks)} a week` : ''}</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {p >= 1 ? <Pressable onPress={() => spendGoal(g)} style={[s.btn, { flex: 1, borderColor: CYAN }]}><Text style={{ color: CYAN, fontWeight: '700' }}>Goal reached. Use the money</Text></Pressable> : (
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <Pressable onPress={() => openDep('in', g.id)} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '700' }}>+ Add</Text></Pressable>
                  {sv > 0 && <Pressable onPress={() => openDep('out', g.id)} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Withdraw</Text></Pressable>}
                </View>
              )}
            </View>
          </View>
        );
      })}
      {general > 0.5 && <View style={[s.card, { flexDirection: 'row', alignItems: 'center' }]}><Ionicons name="wallet-outline" size={20} color={c.mute} /><Text style={{ color: c.ink, flex: 1, marginLeft: 10 }}>General savings</Text><Text style={{ color: c.ink, fontWeight: '800' }}>{rs(general)}</Text></View>}
      {doneG.length > 0 && <Text style={[s.mute, { marginTop: 4 }]}>{doneG.length} goal{doneG.length === 1 ? '' : 's'} completed</Text>}
      <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 14, marginBottom: 6 }}>HISTORY</Text>
      {sav.length === 0 && <Text style={s.mute}>Nothing saved yet.</Text>}
      {[...sav].sort((a, b) => b.ts - a.ts).slice(0, 15).map((e) => (
        <View key={e.id} style={[s.block, { borderLeftColor: e.amt > 0 ? CYAN : ORANGE }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{e.amt > 0 ? '+ ' : '- '}{rs(Math.abs(e.amt))}</Text>
            <Text style={s.mute} numberOfLines={1}>{gName2(e.goal)} · {dateTxt(e.ts)}{e.note ? ' · ' + e.note : ''}</Text>
          </View>
          <Pressable onPress={() => delEntry(e)} hitSlop={8}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
        </View>
      ))}
      <Sheet c={c} visible={!!dep} onClose={() => setDep(null)} title={dep === 'in' ? 'Save money' : 'Withdraw'} onSave={saveDep} saveLabel={dep === 'in' ? 'Save' : 'Withdraw'}>
        <Text style={s.mute}>{dep === 'in' ? 'Available to save: ' + rs(Math.max(0, calc.avail)) : 'Choose where to take it from.'}</Text>
        {lab(s, 'Amount (PKR)')}
        <TextInput value={amt} onChangeText={setAmt} placeholder="0" placeholderTextColor={c.mute} keyboardType="numeric" style={[inputStyle(c), { fontSize: 24, fontWeight: '700' }]} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{[500, 1000, 5000, 10000].map((v) => <Chip key={v} s={s} c={c} on={false} label={'+' + v} onPress={() => setAmt(String((parseFloat(amt) || 0) + v))} />)}</View>
        {lab(s, 'For')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Chip s={s} c={c} on={gSel === null} label="General" onPress={() => setGSel(null)} />
          {active.map((g) => <Chip key={g.id} s={s} c={c} on={gSel === g.id} label={g.name.length > 16 ? g.name.slice(0, 15) + '…' : g.name} onPress={() => setGSel(g.id)} />)}
        </View>
        {lab(s, 'Note (optional)')}
        <TextInput value={note} onChangeText={setNote} placeholder="e.g. from freelance" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
      <Sheet c={c} visible={gOpen} onClose={() => setGOpen(false)} title={gEdit ? 'Edit goal' : 'New saving goal'} onSave={saveGoal} saveLabel="Save" onDelete={gEdit ? () => delGoal(gEdit) : undefined}>
        <TextInput value={gName} onChangeText={setGName} placeholder="e.g. New laptop" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {lab(s, 'Target amount (PKR)')}
        <TextInput value={gTar} onChangeText={setGTar} placeholder="e.g. 80000" placeholderTextColor={c.mute} keyboardType="numeric" style={inputStyle(c)} />
        {lab(s, 'Deadline (optional)')}
        <DateField c={c} value={gDue} onChange={setGDue} clearable placeholder="No deadline" />
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ----- Trips and tags ----- */
function TagsView({ c, money, mtags, saveMtags, onAdd, onEditEntry }) {
  const s = mk(c);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [name, setName] = useState('');
  const [bud, setBud] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const spentOf = (t) => money.filter((m) => m.k === 'out' && m.tag === t.id);
  const sum = (a) => a.reduce((x, m) => x + m.a, 0);
  const openTag = (t) => { setEdit(t || null); setName(t ? t.name : ''); setBud(t && t.budget ? String(t.budget) : ''); setErr(''); setOpen(true); };
  const save = () => {
    if (!name.trim()) { setErr('Give the trip or tag a name.'); return; }
    const row = { name: name.trim().slice(0, 30), budget: parseFloat(bud.replace(/,/g, '')) || 0 };
    anim(); saveMtags(edit ? mtags.map((t) => (t.id === edit.id ? { ...t, ...row } : t)) : [...mtags, { id: Date.now(), ts: Date.now(), closed: false, ...row }]);
    setOpen(false);
  };
  const del = (t) => Alert.alert('Delete this tag?', 'Your expenses stay. They just lose this tag.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { anim(); saveMtags(mtags.filter((x) => x.id !== t.id)); setSel(null); setOpen(false); } }]);
  const act = mtags.filter((t) => !t.closed), closed = mtags.filter((t) => t.closed);
  const card = (t, i) => {
    const sp = sum(spentOf(t)), col = TAG_COL[i % TAG_COL.length], over = t.budget > 0 && sp > t.budget;
    return (
      <Pressable key={t.id} onPress={() => setSel(t.id)} style={[s.card, { opacity: t.closed ? 0.6 : 1 }]}>
        <View style={s.row}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: col, marginRight: 8 }} />
          <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16, flex: 1 }}>{t.name}</Text>
          <Text style={{ color: over ? CORAL : c.ink, fontWeight: '800' }}>{rs(sp)}</Text>
        </View>
        {t.budget > 0 && <View style={{ marginTop: 10 }}><GrowBar pct={(sp / t.budget) * 100} color={over ? CORAL : col} bg={c.line} h={8} /></View>}
        <Text style={[s.mute, { marginTop: 6, fontSize: 12 }]}>{t.budget > 0 ? (over ? 'Over by ' + rs(sp - t.budget) : rs(t.budget - sp) + ' left of ' + rs(t.budget)) : 'No budget set'} · {spentOf(t).length} expense{spentOf(t).length === 1 ? '' : 's'}</Text>
      </Pressable>
    );
  };
  const t = mtags.find((x) => x.id === sel), te = t ? spentOf(t) : [], tcat = {};
  te.forEach((m) => { tcat[m.cat] = (tcat[m.cat] || 0) + m.a; });
  const tc = Object.keys(tcat).sort((a, b) => tcat[b] - tcat[a]);
  return (
    <View>
      <View style={[s.row, { marginBottom: 6 }]}>
        <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, flex: 1 }}>TRIPS AND TAGS · {act.length}</Text>
        <Pressable onPress={() => openTag(null)} hitSlop={8}><Text style={{ color: VIOLET, fontWeight: '700' }}>+ New</Text></Pressable>
      </View>
      {mtags.length === 0 && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Ionicons name="pricetags-outline" size={30} color={c.mute} />
          <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>Group your spending</Text>
          <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>Create a tag like "Islamabad trip" with a budget. Tag your expenses and see exactly where the money went.</Text>
        </View>
      )}
      {act.map((x, i) => card(x, mtags.indexOf(x)))}
      {closed.length > 0 && <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, marginTop: 10, marginBottom: 6 }}>CLOSED</Text>}
      {closed.map((x) => card(x, mtags.indexOf(x)))}
      <Sheet c={c} visible={!!t} onClose={() => setSel(null)} title={t ? t.name : ''} onSave={() => { const id = t.id; setSel(null); onAdd(id); }} saveLabel="Add an expense">
        {t && (
          <View>
            <View style={s.row}>
              <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 24, fontWeight: '800' }}>{rs(sum(te))}</Text><Text style={s.mute}>{t.budget > 0 ? 'of ' + rs(t.budget) + ' budget' : 'No budget'} · {te.length} expenses</Text></View>
            </View>
            {t.budget > 0 && <View style={{ marginTop: 10 }}><GrowBar pct={(sum(te) / t.budget) * 100} color={sum(te) > t.budget ? CORAL : VIOLET} bg={c.line} h={8} /></View>}
            {tc.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 8 }}>Where it went</Text>
                {tc.map((k) => <PRow key={k} c={c} label={k} pct={Math.round((tcat[k] / sum(te)) * 100)} color={VIOLET} right={rs(tcat[k]) + ' · ' + Math.round((tcat[k] / sum(te)) * 100) + '%'} />)}
              </View>
            )}
            {te.length > 0 && <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>Expenses</Text>}
            {[...te].sort((a, b) => b.ts - a.ts).map((m) => (
              <Pressable key={m.id} onPress={() => { setSel(null); onEditEntry(m); }} style={[s.row, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }]}>
                <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>{rs(m.a)} · {m.cat}</Text><Text style={s.mute} numberOfLines={1}>{dateTxt(m.ts)}{m.note ? ' · ' + m.note : ''}</Text></View>
                <Ionicons name="create-outline" size={16} color={c.mute} />
              </Pressable>
            ))}
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <Pressable onPress={() => { const x = t; setSel(null); openTag(x); }} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Edit</Text></Pressable>
              <Pressable onPress={() => { anim(); saveMtags(mtags.map((x) => (x.id === t.id ? { ...x, closed: !x.closed } : x))); setSel(null); }} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>{t.closed ? 'Reopen' : 'Close trip'}</Text></Pressable>
            </View>
          </View>
        )}
      </Sheet>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title={edit ? 'Edit tag' : 'New trip or tag'} onSave={save} saveLabel="Save" onDelete={edit ? () => del(edit) : undefined}>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Islamabad trip" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {lab(s, 'Budget for it (optional, PKR)')}
        <TextInput value={bud} onChangeText={setBud} placeholder="e.g. 15000" placeholderTextColor={c.mute} keyboardType="numeric" style={inputStyle(c)} />
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ----- Loans ----- */
function LoansView({ c, loans, saveLoans }) {
  const s = mk(c);
  const [flt, setFlt] = useState('Active');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [dir, setDir] = useState('lent');
  const [who, setWho] = useState('');
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [given, setGiven] = useState(new Date());
  const [due, setDue] = useState(null);
  const [bal, setBal] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payErr, setPayErr] = useState('');
  const now0 = new Date(); now0.setHours(0, 0, 0, 0);
  const tot = (d) => loans.filter((l) => l.dir === d && !l.settled).reduce((a, l) => a + Math.max(0, l.amount - loanPaid(l)), 0);
  const openNew = (l) => { setEdit(l || null); setDir(l ? l.dir : 'lent'); setWho(l ? l.who : ''); setAmt(l ? String(l.amount) : ''); setNote(l ? l.note || '' : ''); setGiven(l ? new Date(l.ts) : new Date()); setDue(l && l.due ? new Date(l.due) : null); setBal(l ? l.bal !== false : true); setErr(''); setOpen(true); };
  const save = () => {
    const n = parseFloat(amt.replace(/,/g, ''));
    if (!who.trim()) { setErr('Who is it with?'); return; }
    if (!n || n <= 0) { setErr('Enter the amount.'); return; }
    const row = { dir, who: who.trim().slice(0, 40), amount: n, note: note.trim().slice(0, 80), ts: given.getTime(), due: due ? due.getTime() : null, bal };
    anim(); saveLoans(edit ? loans.map((l) => (l.id === edit.id ? { ...l, ...row } : l)) : [...loans, { id: Date.now(), pays: [], settled: false, ...row }]);
    setOpen(false);
  };
  const del = (l) => Alert.alert('Delete this loan record?', l.who, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { anim(); saveLoans(loans.filter((x) => x.id !== l.id)); setSel(null); setOpen(false); } }]);
  const l = loans.find((x) => x.id === sel), paid = l ? loanPaid(l) : 0, left = l ? Math.max(0, l.amount - paid) : 0;
  const pay = (full) => {
    const n = full ? left : parseFloat(payAmt.replace(/,/g, ''));
    if (!n || n <= 0) { setPayErr('Enter an amount.'); return; }
    if (n > left + 0.5) { setPayErr('That is more than the ' + rs(left) + ' left.'); return; }
    anim(); saveLoans(loans.map((x) => (x.id === l.id ? { ...x, pays: [...(x.pays || []), { id: Date.now(), ts: Date.now(), amt: n, note: payNote.trim().slice(0, 60) }], settled: left - n <= 0.5 } : x)));
    setPayAmt(''); setPayNote(''); setPayErr('');
  };
  const writeOff = () => Alert.alert('Write off the rest?', `${rs(left)} will be counted as lost and the loan is closed.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Write off', style: 'destructive', onPress: () => { anim(); saveLoans(loans.map((x) => (x.id === l.id ? { ...x, settled: true, writtenOff: true } : x))); } }]);
  const shown = loans.filter((x) => (flt === 'Active' ? !x.settled : flt === 'Settled' ? x.settled : true)).sort((a, b) => (a.settled - b.settled) || ((a.due || 9e15) - (b.due || 9e15)));
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <View style={[s.card, { flex: 1, marginRight: 5 }]}><Text style={s.mute}>Owed to you</Text><Big style={{ color: CYAN, fontSize: 20, fontWeight: '800' }}>{rs(tot('lent'))}</Big></View>
        <View style={[s.card, { flex: 1, marginLeft: 5 }]}><Text style={s.mute}>You owe</Text><Big style={{ color: CORAL, fontSize: 20, fontWeight: '800' }}>{rs(tot('borrowed'))}</Big></View>
      </View>
      <View style={[s.row, { marginBottom: 6 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>{['Active', 'Settled', 'All'].map((f) => <Chip key={f} s={s} c={c} on={flt === f} label={f} onPress={() => setFlt(f)} />)}</ScrollView>
        <Pressable onPress={() => openNew(null)} hitSlop={8}><Text style={{ color: VIOLET, fontWeight: '700' }}>+ New</Text></Pressable>
      </View>
      {shown.length === 0 && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Ionicons name="swap-horizontal-outline" size={30} color={c.mute} />
          <Text style={{ color: c.ink, fontWeight: '700', marginTop: 8 }}>{loans.length ? 'Nothing here' : 'Track lent and borrowed money'}</Text>
          <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>{loans.length ? 'Try another filter.' : 'Record who you lent to or borrowed from, with due dates and repayments.'}</Text>
        </View>
      )}
      {shown.map((x) => {
        const pd = loanPaid(x), lf = Math.max(0, x.amount - pd), od = !x.settled && x.due && x.due < now0.getTime(), col = x.dir === 'lent' ? CYAN : CORAL;
        return (
          <Pressable key={x.id} onPress={() => { setSel(x.id); setPayAmt(''); setPayNote(''); setPayErr(''); }} style={[s.card, { opacity: x.settled ? 0.6 : 1, borderColor: od ? CORAL : c.line }]}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '700', fontSize: 16 }}>{x.who}</Text>
                <Text style={s.mute}>{x.dir === 'lent' ? 'You lent' : 'You borrowed'} {rs(x.amount)} · {dateTxt(x.ts)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: x.settled ? c.mute : col, fontWeight: '800' }}>{x.settled ? (x.writtenOff ? 'Written off' : 'Settled') : rs(lf)}</Text>
                {!x.settled && <Text style={s.mute}>{x.dir === 'lent' ? 'owed to you' : 'you owe'}</Text>}
              </View>
            </View>
            {pd > 0 && !x.settled && <View style={{ marginTop: 8 }}><GrowBar pct={(pd / x.amount) * 100} color={col} bg={c.line} h={6} /></View>}
            {!!x.due && !x.settled && <Text style={{ color: od ? CORAL : c.mute, fontSize: 12, marginTop: 6, fontWeight: od ? '700' : '400' }}>{od ? 'Overdue since ' : 'Due '}{dateTxt(x.due)}</Text>}
          </Pressable>
        );
      })}
      <Sheet c={c} visible={!!l} onClose={() => setSel(null)} title={l ? l.who : ''} onSave={() => setSel(null)} saveLabel="Close">
        {l && (
          <View>
            <Text style={{ color: l.dir === 'lent' ? CYAN : CORAL, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 }}>{l.dir === 'lent' ? 'YOU LENT' : 'YOU BORROWED'}</Text>
            <Text style={{ color: c.ink, fontSize: 26, fontWeight: '800', marginTop: 2 }}>{rs(l.amount)}</Text>
            <Text style={s.mute}>{dateTxt(l.ts)}{l.due ? ' · due ' + dateTxt(l.due) : ''}{l.bal === false ? ' · not counted in balance' : ''}</Text>
            {!!l.note && <Text style={{ color: c.ink, marginTop: 6 }}>{l.note}</Text>}
            <View style={{ marginTop: 12 }}><GrowBar pct={(paid / l.amount) * 100} color={l.dir === 'lent' ? CYAN : CORAL} bg={c.line} h={8} /></View>
            <Text style={[s.mute, { marginTop: 4 }]}>{rs(paid)} repaid · {rs(left)} left</Text>
            {!l.settled && (
              <View>
                {lab(s, l.dir === 'lent' ? 'Record a repayment' : 'Record a payment you made')}
                <TextInput value={payAmt} onChangeText={setPayAmt} placeholder="Amount" placeholderTextColor={c.mute} keyboardType="numeric" style={inputStyle(c)} />
                <TextInput value={payNote} onChangeText={setPayNote} placeholder="Note (optional)" placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 8 }]} />
                {!!payErr && <Text style={{ color: CORAL, marginTop: 6 }}>{payErr}</Text>}
                <View style={{ flexDirection: 'row', marginTop: 10 }}>
                  <Pressable onPress={() => pay(false)} style={{ flex: 1, backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginRight: 8 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Add payment</Text></Pressable>
                  <Pressable onPress={() => pay(true)} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Settle in full</Text></Pressable>
                </View>
                <Pressable onPress={writeOff} style={{ alignSelf: 'flex-start', paddingVertical: 10 }}><Text style={{ color: c.mute, fontWeight: '600' }}>Write off the rest</Text></Pressable>
              </View>
            )}
            {(l.pays || []).length > 0 && <Text style={{ color: c.ink, fontWeight: '700', marginTop: 10, marginBottom: 4 }}>Payments</Text>}
            {[...(l.pays || [])].reverse().map((p) => <View key={p.id} style={[s.row, { paddingVertical: 5 }]}><Text style={{ color: c.ink, flex: 1 }}>{rs(p.amt)}{p.note ? ' · ' + p.note : ''}</Text><Text style={s.mute}>{dateTxt(p.ts)}</Text></View>)}
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Pressable onPress={() => { const x = l; setSel(null); openNew(x); }} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Edit</Text></Pressable>
              <Pressable onPress={() => del(l)} style={[s.btn, { flex: 1, borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Delete</Text></Pressable>
            </View>
          </View>
        )}
      </Sheet>
      <Sheet c={c} visible={open} onClose={() => setOpen(false)} title={edit ? 'Edit loan' : 'New loan'} onSave={save} saveLabel="Save">
        <Seg c={c} value={dir} onPick={setDir} items={[['lent', 'I lent money'], ['borrowed', 'I borrowed']]} />
        {lab(s, dir === 'lent' ? 'Lent to' : 'Borrowed from')}
        <TextInput value={who} onChangeText={setWho} placeholder="Name" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {lab(s, 'Amount (PKR)')}
        <TextInput value={amt} onChangeText={setAmt} placeholder="0" placeholderTextColor={c.mute} keyboardType="numeric" style={[inputStyle(c), { fontSize: 22, fontWeight: '700' }]} />
        {lab(s, 'Date')}
        <DateField c={c} value={given} onChange={(d) => setGiven(d || new Date())} />
        {lab(s, 'Due date (optional)')}
        <DateField c={c} value={due} onChange={setDue} clearable placeholder="No due date" />
        {lab(s, 'Note (optional)')}
        <TextInput value={note} onChangeText={setNote} placeholder="e.g. for fees" placeholderTextColor={c.mute} style={inputStyle(c)} />
        <View style={[s.row, { marginTop: 14 }]}>
          <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>Counts in my balance</Text><Text style={s.mute}>{dir === 'lent' ? 'Lending reduces Available until it is repaid' : 'Borrowing adds to Available until you repay'}</Text></View>
          <Switch value={bal} onValueChange={setBal} trackColor={{ true: VIOLET }} />
        </View>
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ----- Money screen ----- */
function Money({ c, money, cfg, saveCfg, addMoney, editMoney, delMoney, sav, saveSav, sgoals, saveSgoals, loans, saveLoans, mtags, saveMtags }) {
  const s = mk(c);
  const SEG = ['Overview', 'Savings', 'Trips', 'Loans'];
  const [seg, setSeg] = useState('Overview');
  const [per, setPer] = useState('Month');
  const [flt, setFlt] = useState('All');
  const [catF, setCatF] = useState(null);
  const [tagF, setTagF] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [editId, setEditId] = useState(null);
  const [kind, setKind] = useState('out');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('Food');
  const [note, setNote] = useState('');
  const [tagId, setTagId] = useState(null);
  const [dayOff, setDayOff] = useState(0);
  const [err, setErr] = useState('');
  const [bud, setBud] = useState('');
  const [ntName, setNtName] = useState('');
  const calc = moneyCalc(money, sav, loans);
  const now = new Date();
  const day0 = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const start = (() => { const d = day0(now); if (per === 'Week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); if (per === 'Month') d.setDate(1); return per === 'All' ? 0 : d.getTime(); })();
  const monthStart = (() => { const d = day0(now); d.setDate(1); return d.getTime(); })();
  const sum = (arr, k) => arr.filter((m) => m.k === k).reduce((a, m) => a + m.a, 0);
  const inPer = money.filter((m) => m.ts >= start).sort((a, b) => b.ts - a.ts);
  const list = inPer.filter((m) => (flt === 'All' ? true : flt === 'In' ? m.k === 'in' : m.k === 'out') && (!catF || (m.k === 'out' && m.cat === catF)) && (!tagF || m.tag === tagF));
  const inc = sum(inPer, 'in'), spent = sum(inPer, 'out');
  const spentMonth = sum(money.filter((m) => m.ts >= monthStart), 'out');
  const cats = {}; inPer.filter((m) => m.k === 'out').forEach((m) => { cats[m.cat] = (cats[m.cat] || 0) + m.a; });
  const catList = Object.keys(cats).sort((a, b) => cats[b] - cats[a]);
  const activeTags = mtags.filter((t) => !t.closed);
  const pickKind = (k) => { setKind(k); setCat(k === 'out' ? EXP[0] : INC[0]); if (k === 'in') setTagId(null); };
  const openNew = (tid) => { setEditId(null); setKind('out'); setAmt(''); setCat('Food'); setNote(''); setTagId(tid || null); setDayOff(0); setErr(''); setNtName(''); setSeg('Overview'); setSheet('entry'); };
  const openEdit = (m) => { setEditId(m.id); setKind(m.k); setAmt(String(m.a)); setCat(m.cat); setNote(m.note || ''); setTagId(m.tag || null); setErr(''); setNtName(''); setSheet('entry'); };
  const submit = () => {
    const n = parseFloat(amt.replace(/,/g, ''));
    if (!n || n <= 0) { setErr('Enter an amount above 0.'); return; }
    const tg = kind === 'out' ? tagId : null;
    if (editId) { const old = money.find((m) => m.id === editId); editMoney({ ...old, k: kind, a: n, cat, note: note.trim(), tag: tg }); }
    else addMoney({ id: Date.now(), k: kind, a: n, cat, note: note.trim(), ts: Date.now() - dayOff * 864e5, tag: tg });
    setSheet(null);
  };
  const newTag = () => { const nm = ntName.trim(); if (!nm) return; const t = { id: Date.now(), ts: Date.now(), name: nm.slice(0, 30), budget: 0, closed: false }; saveMtags([...mtags, t]); setTagId(t.id); setNtName(''); };
  const openPlan = () => { setBud(cfg.budget ? String(cfg.budget) : ''); setSheet('plan'); };
  const savePlan = () => { saveCfg({ ...cfg, budget: parseFloat(bud.replace(/,/g, '')) || 0 }); setSheet(null); };
  const dayLabel = (ts) => { const diff = Math.round((day0(now).getTime() - day0(ts).getTime()) / 864e5); return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : new Date(ts).toDateString().slice(0, 10); };
  const bPct = cfg.budget ? spentMonth / cfg.budget : 0, bCol = bPct >= 1 ? CORAL : bPct >= 0.8 ? ORANGE : CYAN;
  let last = '';
  return (
    <View style={{ flex: 1 }}>
      <Swipe onSwipe={(d) => setSeg(nextSeg(SEG, seg, d))} can={(d) => nextSeg(SEG, seg, d) !== seg}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.h1}>Money</Text>
              <Text style={s.mute}>PKR · manual entry</Text>
            </View>
            <Pressable onPress={() => openNew(null)} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>+ Entry</Text>
            </Pressable>
          </View>
          <View style={s.hero}>
            <Text style={s.heroTag}>AVAILABLE</Text>
            <Big style={s.heroTitle}>{rs(calc.avail)}</Big>
            <Text style={s.heroSub}>Saved {rs(calc.saved)}{calc.lentLeft > 0 ? ` · Owed to you ${rs(calc.lentLeft)}` : ''}{calc.borrLeft > 0 ? ` · You owe ${rs(calc.borrLeft)}` : ''}</Text>
          </View>
          <Seg c={c} value={seg} onPick={setSeg} items={SEG.map((x) => [x, x])} style={{ marginTop: 12, marginBottom: 12 }} />
          <FadeIn key={seg} y={0} dur={200}>
            {seg === 'Overview' && (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  {['Today', 'Week', 'Month', 'All'].map((p) => <Chip key={p} s={s} c={c} on={per === p} label={p} onPress={() => setPer(p)} />)}
                </ScrollView>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <View style={[s.card, { flex: 1, marginTop: 0, marginRight: 5 }]}><Text style={s.mute}>In</Text><Big style={{ color: CYAN, fontSize: 19, fontWeight: '800' }}>{rs(inc)}</Big></View>
                  <View style={[s.card, { flex: 1, marginTop: 0, marginHorizontal: 5 }]}><Text style={s.mute}>Out</Text><Big style={{ color: CORAL, fontSize: 19, fontWeight: '800' }}>{rs(spent)}</Big></View>
                  <View style={[s.card, { flex: 1, marginTop: 0, marginLeft: 5 }]}><Text style={s.mute}>Net</Text><Big style={{ color: c.ink, fontSize: 19, fontWeight: '800' }}>{rs(inc - spent)}</Big></View>
                </View>
                <View style={s.card}>
                  <View style={s.row}>
                    <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>Monthly budget</Text>
                    <Pressable onPress={openPlan} hitSlop={8}><Text style={{ color: VIOLET, fontWeight: '700' }}>{cfg.budget > 0 ? 'Edit' : 'Set'}</Text></Pressable>
                  </View>
                  {cfg.budget > 0 ? (
                    <View style={{ marginTop: 10 }}>
                      <View style={s.row}><Text style={{ color: c.ink, flex: 1, fontSize: 13 }}>This month</Text><Text style={s.mute}>{rs(spentMonth)} of {rs(cfg.budget)}</Text></View>
                      <View style={{ marginTop: 5 }}><GrowBar pct={bPct * 100} color={bCol} bg={c.line} h={8} /></View>
                      <Text style={[s.mute, { marginTop: 4 }, bPct >= 0.8 && { color: bCol, fontWeight: '700' }]}>{bPct >= 1 ? 'Over by ' + rs(spentMonth - cfg.budget) : rs(cfg.budget - spentMonth) + ' left' + (bPct >= 0.8 ? ' · almost used' : '')}</Text>
                    </View>
                  ) : <Text style={[s.mute, { marginTop: 6 }]}>Set a monthly budget to get a warning at 80%.</Text>}
                </View>
                {catList.length > 0 && (
                  <View style={s.card}>
                    <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 2 }}>Spending</Text>
                    <Text style={[s.mute, { fontSize: 12, marginBottom: 8 }]}>Tap a category to see where it went</Text>
                    {catList.map((k) => (
                      <Pressable key={k} onPress={() => { anim(); setCatF(catF === k ? null : k); setFlt('All'); }} style={{ marginBottom: 8, opacity: catF && catF !== k ? 0.45 : 1 }}>
                        <View style={s.row}><Text style={{ color: c.ink, flex: 1, fontSize: 13, fontWeight: catF === k ? '800' : '400' }}>{k}</Text><Text style={s.mute}>{rs(cats[k])} · {Math.round((cats[k] / spent) * 100)}%</Text></View>
                        <View style={{ marginTop: 4 }}><GrowBar pct={(cats[k] / spent) * 100} color={VIOLET} bg={c.line} /></View>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={[s.row, { marginTop: 4 }]}>
                  <Text style={{ color: c.mute, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, flex: 1 }}>ENTRIES · {list.length}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                  {['All', 'In', 'Out'].map((f) => <Chip key={f} s={s} c={c} on={flt === f} label={f} onPress={() => setFlt(f)} />)}
                  {catF && <Chip s={s} c={c} on label={catF + '  ✕'} onPress={() => setCatF(null)} />}
                  {tagF && <Chip s={s} c={c} on label={((mtags.find((t) => t.id === tagF) || {}).name || 'Tag') + '  ✕'} onPress={() => setTagF(null)} />}
                  {!tagF && mtags.map((t) => <Chip key={t.id} s={s} c={c} on={false} label={'# ' + t.name} onPress={() => setTagF(t.id)} />)}
                </ScrollView>
                {list.length === 0 && <Text style={s.mute}>Nothing here yet. Tap "+ Entry".</Text>}
                {list.map((m) => {
                  const dl = dayLabel(m.ts), head = dl !== last; last = dl;
                  const tg = mtags.find((t) => t.id === m.tag);
                  return (
                    <View key={m.id}>
                      {head && <Text style={[s.mute, { marginTop: 8, marginBottom: 6 }]}>{dl}</Text>}
                      <Pressable onPress={() => openEdit(m)} style={[s.block, { borderLeftColor: m.k === 'in' ? CYAN : CORAL }]}>
                        <View style={{ flex: 1 }}>
                          <Big style={{ color: c.ink, fontWeight: '700', fontSize: 15 }}>{m.k === 'in' ? '+ ' : '- '}{rs(m.a)}</Big>
                          <Text style={s.mute} numberOfLines={1}>{m.cat}{m.note ? ' · ' + m.note : ''}</Text>
                          {tg && <Text style={{ color: VIOLET, fontSize: 12, fontWeight: '700', marginTop: 2 }}># {tg.name}</Text>}
                        </View>
                        <Text style={{ color: c.mute, fontSize: 12 }}>Edit</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
            {seg === 'Savings' && <SavingsView c={c} money={money} sav={sav} saveSav={saveSav} sgoals={sgoals} saveSgoals={saveSgoals} calc={calc} addMoney={addMoney} />}
            {seg === 'Trips' && <TagsView c={c} money={money} mtags={mtags} saveMtags={saveMtags} onAdd={(id) => openNew(id)} onEditEntry={openEdit} />}
            {seg === 'Loans' && <LoansView c={c} loans={loans} saveLoans={saveLoans} />}
          </FadeIn>
        </ScrollView>
      </Swipe>

      <Sheet c={c} visible={sheet === 'entry'} onClose={() => setSheet(null)} title={editId ? 'Edit entry' : 'New entry'} onSave={submit} saveLabel="Save" onDelete={editId ? () => { delMoney(editId); setSheet(null); } : null}>
        <View style={{ flexDirection: 'row' }}>
          <Chip s={s} c={c} on={kind === 'out'} label="Expense" onPress={() => pickKind('out')} />
          <Chip s={s} c={c} on={kind === 'in'} label="Income" onPress={() => pickKind('in')} />
        </View>
        {lab(s, 'Amount (PKR)')}
        <TextInput value={amt} onChangeText={setAmt} placeholder="0" placeholderTextColor={c.mute} style={[inputStyle(c), { fontSize: 24, fontWeight: '700' }]} keyboardType="numeric" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {[100, 500, 1000, 5000].map((v) => <Chip key={v} s={s} c={c} on={false} label={'+' + v} onPress={() => setAmt(String((parseFloat(amt) || 0) + v))} />)}
        </View>
        {lab(s, 'Category')}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {(kind === 'out' ? EXP : INC).map((k) => <Chip key={k} s={s} c={c} on={cat === k} label={k} onPress={() => setCat(k)} />)}
        </View>
        {kind === 'out' && (
          <View>
            {lab(s, 'Trip or tag (optional)')}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip s={s} c={c} on={tagId === null} label="None" onPress={() => setTagId(null)} />
              {activeTags.map((t) => <Chip key={t.id} s={s} c={c} on={tagId === t.id} label={'# ' + t.name} onPress={() => setTagId(t.id)} />)}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
              <TextInput value={ntName} onChangeText={setNtName} placeholder="New tag, e.g. Islamabad trip" placeholderTextColor={c.mute} style={[inputStyle(c), { flex: 1 }]} onSubmitEditing={newTag} />
              <Pressable onPress={newTag} style={[s.btn, { marginLeft: 8, minWidth: 60 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Add</Text></Pressable>
            </View>
          </View>
        )}
        {!editId && (
          <View>
            {lab(s, 'Date')}
            <View style={{ flexDirection: 'row' }}>
              {[['Today', 0], ['Yesterday', 1], ['2 days ago', 2]].map((d) => <Chip key={d[0]} s={s} c={c} on={dayOff === d[1]} label={d[0]} onPress={() => setDayOff(d[1])} />)}
            </View>
          </View>
        )}
        {lab(s, 'Note (optional)')}
        <TextInput value={note} onChangeText={setNote} placeholder="e.g. bus to Islamabad" placeholderTextColor={c.mute} style={inputStyle(c)} />
        {!!err && <Text style={{ color: CORAL, marginTop: 10 }}>{err}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
      <Sheet c={c} visible={sheet === 'plan'} onClose={() => setSheet(null)} title="Monthly budget" onSave={savePlan} saveLabel="Save" onDelete={cfg.budget > 0 ? () => { saveCfg({ ...cfg, budget: 0 }); setSheet(null); } : undefined}>
        {lab(s, 'Budget for each month (PKR)')}
        <TextInput value={bud} onChangeText={setBud} placeholder="e.g. 20000" placeholderTextColor={c.mute} style={inputStyle(c)} keyboardType="numeric" />
        <Text style={[s.mute, { marginTop: 10 }]}>You get a warning at 80% and again when you pass it.</Text>
        <View style={{ height: 8 }} />
      </Sheet>
    </View>
  );
}

/* ---------- Stats screen ---------- */
const TYPES = { uni: 'Classes', project: 'Project', study: 'Study', skill: 'Skill', faith: 'Worship', life: 'Daily life', teach: 'Tuition' };
const PIDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], PN = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const parseKey = (k) => { const m = /(\d+)-(\d+)-(\d+)$/.exec(k); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (d, k) => { const x = new Date(d); x.setDate(x.getDate() + k); return x; };
function Bars({ c, vals, labels, color, hi, max, h = 100 }) {
  const mx = max || Math.max(1, ...vals);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: h }}>
        {vals.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: h }}>
            <GrowH target={Math.max(3, (v / mx) * (h - 4))} style={{ width: '70%', maxWidth: 28, backgroundColor: i === hi ? AMBER : color, borderRadius: 4, opacity: v ? 1 : 0.25 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {labels.map((l, i) => <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: c.mute }}>{l}</Text>)}
      </View>
    </View>
  );
}
function PRow({ c, label, pct, color, right }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row' }}>
        <Text style={{ color: c.ink, flex: 1, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: c.mute, fontSize: 12 }}>{right || pct + '%'}</Text>
      </View>
      <View style={{ marginTop: 4 }}><GrowBar pct={pct} color={color} bg={c.line} /></View>
    </View>
  );
}
function Stats({ c, log, tasks, money, mcfg, exams, targets, focus, disc, sav = [], sgoals = [], loans = [], mtags = [], sleep = [], train = { logs: [] }, projects = [], sleepGoal = 8 }) {
  const s = mk(c);
  const [rng, setRng] = useState('Week');
  const [co, setCo] = useState(undefined);
  const [rep, setRep] = useState(null);
  const [repBusy, setRepBusy] = useState(false);
  const [repErr, setRepErr] = useState('');
  const [seg, setSeg] = useState('Overview');
  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem('coords'); setCo(v ? JSON.parse(v) : null); } catch (e) { setCo(null); } try { const r = await AsyncStorage.getItem('kairo_report'); if (r) setRep(JSON.parse(r)); } catch (e) {} })(); }, []);
  const genReport = async () => {
    setRepBusy(true); setRepErr('');
    try {
      const key = await AsyncStorage.getItem('gemini_key');
      if (!key) { setRepErr('Add your Gemini key in Settings, AI key.'); setRepBusy(false); return; }
      const ctx = buildContext({ log, tasks, money, mcfg, co, exams, targets, sav, sgoals, loans, mtags, offs: [], reminders: [] });
      const out = await askGemini(key, REPORT_SYSTEM + '\n\nAPP DATA\n' + ctx.text, [], 'Write my weekly report.');
      const r = { ts: Date.now(), text: String(out.reply || '').trim() };
      if (!r.text) throw new Error('empty');
      setRep(r); await AsyncStorage.setItem('kairo_report', JSON.stringify(r));
    } catch (e) { setRepErr(e && e.status === 429 ? 'All free AI limits are used up for today. They reset at about ' + resetLabel() + '.' : e && (e.status === 400 || e.status === 403) ? 'Gemini rejected the key.' : 'Could not make the report. Check your internet.'); }
    setRepBusy(false);
  };
  const msgView = (t, b) => <View style={[s.center, { padding: 24 }]}><Text style={[s.h1, { textAlign: 'center' }]}>{t}</Text><Text style={[s.mute, { textAlign: 'center', marginTop: 8 }]}>{b}</Text></View>;
  if (co === undefined) return <View style={s.center}><ActivityIndicator color={VIOLET} /></View>;
  if (!co) return msgView('Stats', 'Set your location in the Plan tab first, so Kairo can match your schedule to each day.');
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const keys = Object.keys(log).filter((k) => Object.keys(log[k]).length).map(parseKey).filter(Boolean);
  if (!keys.length) return msgView('Stats', 'Tick a few blocks in the Plan tab and your graphs will appear here.');
  const first = new Date(Math.min(...keys.map((d) => d.getTime())));
  const n = rng === 'Today' ? 1 : rng === 'Week' ? 7 : 30;
  const mkDays = (end, len) => { const o = []; for (let i = len - 1; i >= 0; i--) { const d = addDays(end, -i); if (d >= first && d <= today0) o.push(d); } return o; };
  const ds = (d) => {
    const P = calcTimes(d, co.lat, co.lng), l = log[dayKey(d)] || {}, cnt = {}, byType = {}, titles = [];
    let total = 0, done = 0;
    buildDay(d.getDay(), P, d).forEach((b) => {
      if (b.y === 'sleep') return;
      cnt[b.id] = (cnt[b.id] || 0) + 1;
      const ok = !!l['b:' + b.id + '#' + cnt[b.id]];
      total++; if (ok) done++;
      byType[b.y] = byType[b.y] || { t: 0, d: 0 }; byType[b.y].t++; if (ok) byType[b.y].d++;
      titles.push({ k: b.t.split(':')[0], ok });
    });
    const tk = tasks.filter((t) => t.date === dayKey(d)), tkd = tk.filter((t) => l['t:' + t.id]).length;
    total += tk.length; done += tkd;
    return { d, total, done, tk: tk.length, tkd, byType, titles, pr: PIDS.map((id) => !!l['p:' + id]), pct: total ? Math.round((done / total) * 100) : 0 };
  };
  const A = mkDays(today0, n).map(ds), B = mkDays(addDays(today0, -n), n).map(ds);
  const agg = (arr) => { const t = arr.reduce((a, x) => a + x.total, 0), d = arr.reduce((a, x) => a + x.done, 0); return { t, d, pct: t ? Math.round((d / t) * 100) : null }; };
  const cur = agg(A), prev = agg(B), delta = cur.pct != null && prev.pct != null ? cur.pct - prev.pct : null;
  // streak: days with 70%+ completion
  const long = mkDays(today0, 90).map(ds);
  let streak = 0, best = 0, run = 0;
  long.forEach((x) => { if (x.pct >= 70) { run++; best = Math.max(best, run); } else run = 0; });
  for (let i = long.length - 1; i >= 0; i--) { if (long[i].pct >= 70) streak++; else if (i === long.length - 1) continue; else break; }
  // prayers
  const prDone = A.reduce((a, x) => a + x.pr.filter(Boolean).length, 0), prAll = A.length * 5, prPct = prAll ? Math.round((prDone / prAll) * 100) : 0;
  const prMiss = PIDS.map((id, i) => A.filter((x) => !x.pr[i]).length), worstP = prMiss.indexOf(Math.max(...prMiss));
  // by area
  const area = {}; let tkT = 0, tkD = 0;
  A.forEach((x) => { Object.keys(x.byType).forEach((k) => { area[k] = area[k] || { t: 0, d: 0 }; area[k].t += x.byType[k].t; area[k].d += x.byType[k].d; }); tkT += x.tk; tkD += x.tkd; });
  const areaRows = Object.keys(area).map((k) => ({ k: TYPES[k] || k, y: k, pct: Math.round((area[k].d / area[k].t) * 100), d: area[k].d, t: area[k].t }));
  if (tkT) areaRows.push({ k: 'Tasks', y: null, pct: Math.round((tkD / tkT) * 100), d: tkD, t: tkT });
  areaRows.sort((a, b) => a.pct - b.pct);
  // weak spots
  const tt = {}; A.forEach((x) => x.titles.forEach((t) => { tt[t.k] = tt[t.k] || { t: 0, d: 0 }; tt[t.k].t++; if (t.ok) tt[t.k].d++; }));
  const weak = Object.keys(tt).filter((k) => tt[k].t >= (A.length > 1 ? 2 : 1) && tt[k].d < tt[k].t).map((k) => ({ k, pct: Math.round((tt[k].d / tt[k].t) * 100), t: tt[k].t })).sort((a, b) => a.pct - b.pct).slice(0, 3);
  // tasks (all time)
  const tDone = (t) => !!(log[t.date] && log[t.date]['t:' + t.id]);
  const tOpen = tasks.filter((t) => !tDone(t)), tOver = tOpen.filter((t) => t.ts < today0.getTime());
  const tCat = {}; tasks.forEach((t) => { tCat[t.cat] = tCat[t.cat] || { t: 0, d: 0 }; tCat[t.cat].t++; if (tDone(t)) tCat[t.cat].d++; });
  // money in range
  const mStart = addDays(today0, -(n - 1)).getTime(), mr = money.filter((m) => m.ts >= mStart);
  const mIn = mr.filter((m) => m.k === 'in').reduce((a, m) => a + m.a, 0), mOut = mr.filter((m) => m.k === 'out').reduce((a, m) => a + m.a, 0);
  const mCat = {}; mr.filter((m) => m.k === 'out').forEach((m) => { mCat[m.cat] = (mCat[m.cat] || 0) + m.a; });
  const mCats = Object.keys(mCat).sort((a, b) => mCat[b] - mCat[a]);
  const mDays = Array.from({ length: n }, (_, i) => addDays(today0, -(n - 1 - i)));
  const mVals = mDays.map((d) => mr.filter((m) => m.k === 'out' && dayKey(new Date(m.ts)) === dayKey(d)).reduce((a, m) => a + m.a, 0));
  const lbl = (arr) => arr.map((d, i) => (n <= 7 ? DN[d.getDay()] : i % 5 === 0 ? String(d.getDate()) : ''));
  // highlights
  const hl = [];
  if (delta != null && rng !== 'Today') hl.push(`Completion is ${Math.abs(delta)}% ${delta >= 0 ? 'higher' : 'lower'} than the previous ${rng.toLowerCase()}.`);
  const withData = A.filter((x) => x.total);
  if (withData.length > 1) { const bd = [...withData].sort((a, b) => b.pct - a.pct)[0], wd = [...withData].sort((a, b) => a.pct - b.pct)[0]; hl.push(`Best day: ${DN[bd.d.getDay()]} (${bd.pct}%). Weakest: ${DN[wd.d.getDay()]} (${wd.pct}%).`); }
  if (prAll && prDone < prAll) hl.push(`${prAll - prDone} prayer${prAll - prDone > 1 ? 's' : ''} not marked. ${PN[worstP]} is missed most.`);
  if (weak.length) hl.push(`Most skipped: ${weak[0].k} (${weak[0].pct}% done).`);
  if (mCats.length && mOut) hl.push(`${mCats[0]} is ${Math.round((mCat[mCats[0]] / mOut) * 100)}% of your spending.`);
  if (streak) hl.push(`${streak}-day streak of 70%+ days. Best: ${best}.`);
  const barVals = A.map((x) => x.pct);
  const todayIdx = A.length - 1;
  const grid = A.slice(-7);


  const hm0 = long.slice(-28), padN = hm0.length ? (hm0[0].d.getDay() + 6) % 7 : 0, cells = [...Array(padN).fill(null), ...hm0];
  while (cells.length % 7) cells.push(null);
  const hrows = []; for (let i = 0; i < cells.length; i += 7) hrows.push(cells.slice(i, i + 7));
  const hcol = (p) => (p >= 85 ? '#7C5CFF' : p >= 60 ? '#7C5CFFb3' : p >= 30 ? '#7C5CFF66' : p > 0 ? '#7C5CFF33' : c.line);
  const wdAvg = [1, 2, 3, 4, 5, 6, 0].map((wd) => { const xs = long.filter((x) => x.d.getDay() === wd && x.total); return xs.length ? Math.round(xs.reduce((a, x) => a + x.pct, 0) / xs.length) : 0; });
  let pStreak = 0, pBest = 0, pRun = 0;
  long.forEach((x) => { if (x.pr.every(Boolean)) { pRun++; pBest = Math.max(pBest, pRun); } else pRun = 0; });
  for (let i = long.length - 1; i >= 0; i--) { if (long[i].pr.every(Boolean)) pStreak++; else if (i === long.length - 1) continue; else break; }
  const dDays = disc && disc.since ? Math.floor((Date.now() - disc.since) / 864e5) : null, dBest = disc ? Math.max(disc.best || 0, dDays || 0) : 0;
  const fl = focus || [], fVals = mDays.map((d) => fl.filter((x) => x.ts >= d.getTime() && x.ts < d.getTime() + 864e5).reduce((a, x) => a + x.min, 0));
  const fTotal = fVals.reduce((a, b) => a + b, 0), fCount = fl.filter((x) => x.ts >= mStart).length, fAvg = fCount ? Math.round(fTotal / fCount) : 0, fActive = fVals.filter((v) => v > 0).length;
  const tl = targets || [];
  const missedL = missedOf(log, co), missedBy = {}; missedL.forEach((m) => { const k2 = m.title.split(':')[0]; missedBy[k2] = (missedBy[k2] || 0) + 1; });
  const missedTop = Object.keys(missedBy).sort((a, b) => missedBy[b] - missedBy[a]).slice(0, 4);
  const SEGS = ['Overview', 'Habits', 'Work', 'Money'];
  const swipeSeg = (d) => { const i = SEGS.indexOf(seg), j = d === 'left' ? Math.min(SEGS.length - 1, i + 1) : Math.max(0, i - 1); if (j !== i) setSeg(SEGS[j]); };
  return (
    <Swipe onSwipe={swipeSeg} can={(d) => (d === 'left' ? SEGS.indexOf(seg) < SEGS.length - 1 : SEGS.indexOf(seg) > 0)}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={s.h1}>Stats</Text>
      <Text style={[s.mute, { marginBottom: 10 }]}>Built from your ticks, tasks, focus and money</Text>
      <Seg c={c} value={seg} onPick={setSeg} items={[['Overview', 'Overview'], ['Habits', 'Habits'], ['Work', 'Work'], ['Money', 'Money']]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
        {['Today', 'Week', 'Month'].map((r) => <Chip key={r} s={s} c={c} on={rng === r} label={r} onPress={() => setRng(r)} />)}
      </ScrollView>
      <FadeIn key={seg} y={0} dur={200}>
      {seg === 'Overview' && (
        <View>
      <View style={[s.card, { marginTop: 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={20} color={VIOLET} />
          <Text style={{ color: c.ink, fontWeight: '700', marginLeft: 8, flex: 1 }}>Weekly report</Text>
          <Pressable onPress={genReport} disabled={repBusy} style={[s.btn, { minWidth: 0, paddingHorizontal: 16 }]}>
            {repBusy ? <ActivityIndicator color={VIOLET} /> : <Text style={{ color: c.ink, fontWeight: '600' }}>{rep ? 'Refresh' : 'Create'}</Text>}
          </Pressable>
        </View>
        {rep ? (
          <View>
            <Text style={[s.mute, { marginTop: 6, fontSize: 12 }]}>{new Date(rep.ts).toDateString()}</Text>
            <Text style={{ color: c.ink, lineHeight: 21, marginTop: 6 }}>{rep.text}</Text>
          </View>
        ) : <Text style={[s.mute, { marginTop: 6 }]}>Tap Create for an AI summary of your week with 3 steps for the next one.</Text>}
        {!!repErr && <Text style={{ color: CORAL, marginTop: 6 }}>{repErr}</Text>}
      </View>
      <View style={[s.hero, { marginTop: 8 }]}>
        <Text style={s.heroTag}>COMPLETION</Text>
        <Text style={s.heroTitle}>{cur.pct == null ? '—' : cur.pct + '%'}</Text>
        <Text style={s.heroSub}>{cur.d} of {cur.t} done{delta != null && rng !== 'Today' ? ` · ${delta >= 0 ? '+' : ''}${delta}% vs before` : ''}</Text>
        <View style={s.heroPill}><Text style={s.heroPillT}>Streak {streak} day{streak === 1 ? '' : 's'} · Best {best}</Text></View>
      </View>

      {rng !== 'Today' && (
        <View style={s.card}>
          <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Daily completion</Text>
          <Bars c={c} vals={barVals} labels={lbl(A.map((x) => x.d))} color={VIOLET} hi={todayIdx} max={100} />
        </View>
      )}


          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Last 4 weeks</Text>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.mute, fontSize: 10 }}>{x}</Text>)}</View>
            {hrows.map((r, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                {r.map((x, j) => <View key={j} style={{ flex: 1, height: 26, marginHorizontal: 2, borderRadius: 6, backgroundColor: x ? hcol(x.pct) : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{x ? <Text style={{ fontSize: 9, color: x.pct >= 60 ? '#fff' : c.mute }}>{x.d.getDate()}</Text> : null}</View>)}
              </View>
            ))}
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Your best weekdays</Text>
            <Bars c={c} vals={wdAvg} labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']} color={VIOLET} max={100} h={80} />
          </View>
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 8 }}>Highlights</Text>
        {hl.length === 0 && <Text style={s.mute}>Keep ticking. Insights appear as data grows.</Text>}
        {hl.map((t, i) => <Text key={i} style={{ color: c.ink, fontSize: 14, marginBottom: 6 }}>• {t}</Text>)}
        <Text style={[s.mute, { marginTop: 6, fontSize: 12 }]}>The AI assistant will read these same numbers, never your private notes.</Text>
      </View>
        </View>
      )}
      {seg === 'Habits' && (
        <View>
          {(() => {
            const st = sleepStats(sleep, sleepGoal), wk = new Date(); wk.setDate(wk.getDate() - ((wk.getDay() + 6) % 7)); wk.setHours(0, 0, 0, 0);
            const wl = (train.logs || []).filter((l) => l.finished), wN = wl.filter((l) => l.ts >= wk.getTime()).length, sN = wl.filter((l) => l.ts >= wk.getTime()).reduce((a, l) => a + l.setsDone, 0);
            const hr = (m) => Math.floor(m / 60) + 'h ' + Math.round(m % 60) + 'm';
            return (
              <View>
                <View style={s.card}>
                  <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Sleep</Text>
                  {st.last7.length === 0 ? <Text style={s.mute}>No nights recorded yet. Use Grow, then Sleep.</Text> : (
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{hr(st.avg)}</Text><Text style={s.mute}>average</Text></View>
                      <View style={{ flex: 1 }}><Text style={{ color: st.debt > 120 ? CORAL : c.ink, fontSize: 20, fontWeight: '800' }}>{hr(st.debt)}</Text><Text style={s.mute}>sleep debt</Text></View>
                      <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{fmt(st.avgBed % 1440)}</Text><Text style={s.mute}>usual bedtime</Text></View>
                    </View>
                  )}
                </View>
                <View style={s.card}>
                  <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Workouts</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1 }}><Text style={{ color: VIOLET, fontSize: 20, fontWeight: '800' }}>{wN}</Text><Text style={s.mute}>this week</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{sN}</Text><Text style={s.mute}>sets this week</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{wl.length}</Text><Text style={s.mute}>all time</Text></View>
                  </View>
                </View>
              </View>
            );
          })()}
      <View style={s.card}>
        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          <Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>Prayers</Text>
          <Text style={{ color: AMBER, fontWeight: '800' }}>{prPct}%</Text>
        </View>
        {PN.map((name, i) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ width: 62, color: c.mute, fontSize: 12 }}>{name}</Text>
            {grid.map((x, j) => <View key={j} style={{ flex: 1, alignItems: 'center' }}><View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: x.pr[i] ? AMBER : c.line }} /></View>)}
          </View>
        ))}
        <View style={{ flexDirection: 'row', marginTop: 2 }}>
          <View style={{ width: 62 }} />
          {grid.map((x, j) => <Text key={j} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: c.mute }}>{DN[x.d.getDay()][0]}</Text>)}
        </View>
      </View>


          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Prayer streak</Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}><Text style={{ color: AMBER, fontSize: 26, fontWeight: '800' }}>{pStreak}</Text><Text style={s.mute}>days, all five</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 26, fontWeight: '800' }}>{pBest}</Text><Text style={s.mute}>best</Text></View>
            </View>
          </View>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}><Text style={{ color: c.ink, fontWeight: '700', flex: 1 }}>Discipline streak</Text><Ionicons name="lock-closed-outline" size={14} color={c.mute} /></View>
            {dDays == null ? <Text style={s.mute}>Not started. Open Grow, then Discipline.</Text> : (
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}><Text style={{ color: CYAN, fontSize: 26, fontWeight: '800' }}>{dDays}</Text><Text style={s.mute}>days</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 26, fontWeight: '800' }}>{dBest}</Text><Text style={s.mute}>best</Text></View>
              </View>
            )}
            <Text style={[s.mute, { fontSize: 12, marginTop: 8 }]}>Private. Only the day counts show here.</Text>
          </View>
        </View>
      )}
      {seg === 'Work' && (
        <View>
          {projects.length > 0 && (
            <View style={s.card}>
              <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Projects</Text>
              {projects.map((p) => <PRow key={p.id} c={c} label={p.name} pct={projPct(p)} color={projPct(p) >= 100 ? CYAN : VIOLET} right={projPct(p) + '%' + (p.due ? ' · ' + Math.ceil((p.due - Date.now()) / 864e5) + 'd' : '')} />)}
            </View>
          )}
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>By area</Text>
        {areaRows.length === 0 && <Text style={s.mute}>No data yet.</Text>}
        {areaRows.map((r) => <PRow key={r.k} c={c} label={r.k} pct={r.pct} color={r.y ? TYPE[r.y] : ORANGE} right={`${r.d}/${r.t} · ${r.pct}%`} />)}
      </View>

      {weak.length > 0 && (
        <View style={s.card}>
          <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Weak spots</Text>
          {weak.map((w) => <PRow key={w.k} c={c} label={w.k} pct={w.pct} color={CORAL} right={`${w.pct}% of ${w.t}`} />)}
        </View>
      )}

      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Tasks</Text>
        <View style={{ flexDirection: 'row' }}>
          {[['Open', tOpen.length, c.ink], ['Overdue', tOver.length, CORAL], ['Done', tasks.length - tOpen.length, CYAN]].map((x) => (
            <View key={x[0]} style={{ flex: 1 }}><Text style={{ color: x[2], fontSize: 22, fontWeight: '800' }}>{x[1]}</Text><Text style={s.mute}>{x[0]}</Text></View>
          ))}
        </View>
        {Object.keys(tCat).length > 0 && <View style={{ marginTop: 12 }}>{Object.keys(tCat).map((k) => <PRow key={k} c={c} label={k} pct={Math.round((tCat[k].d / tCat[k].t) * 100)} color={ORANGE} right={`${tCat[k].d}/${tCat[k].t} done`} />)}</View>}
      </View>


          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Targets</Text>
            {tl.length === 0 ? <Text style={s.mute}>No targets yet. Add one in Goals.</Text> : tl.map((t) => { const p = tProg(t), stt = tStatus(t, c); return <PRow key={t.id} c={c} label={t.title} pct={Math.round(p * 100)} color={AREA_COL[t.area] || VIOLET} right={stt[0] + ' · ' + Math.round(p * 100) + '%'} />; })}
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Focus time</Text>
            <View style={{ flexDirection: 'row' }}>
              {[['Total', fTotal + ' min'], ['Sessions', String(fCount)], ['Average', fAvg + ' min'], ['Active days', String(fActive)]].map((x) => <View key={x[0]} style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>{x[1]}</Text><Text style={[s.mute, { fontSize: 11 }]}>{x[0]}</Text></View>)}
            </View>
            {rng !== 'Today' && fTotal > 0 && <View style={{ marginTop: 12 }}><Bars c={c} vals={fVals} labels={lbl(mDays)} color={VIOLET} h={80} /></View>}
            {fTotal === 0 && <Text style={[s.mute, { marginTop: 8 }]}>No focus sessions in this period. Start one in Grow.</Text>}
          </View>
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 6 }}>Missed work to recover</Text>
            {missedL.length === 0 ? <Text style={s.mute}>Nothing missed this week. Nice.</Text> : (
              <View>
                <Text style={s.mute}>{missedL.length} blocks, about {Math.round(missedL.reduce((a, m) => a + m.mins, 0) / 6) / 10} h. Most missed: {missedTop.join(', ')}.</Text>
                <Text style={[s.mute, { fontSize: 12, marginTop: 6 }]}>Tap the lightning icon in Plan when you have free time and the AI will arrange it.</Text>
              </View>
            )}
          </View>
        </View>
      )}
      {seg === 'Money' && (
        <View>
          {(() => {
            const mc = moneyCalc(money, sav, loans), ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
            const mNet = sav.filter((e) => e.ts >= ms.getTime()).reduce((a, e) => a + e.amt, 0), incM = money.filter((m) => m.k === 'in' && m.ts >= ms.getTime()).reduce((a, m) => a + m.a, 0);
            const gs = sgoals.filter((g) => !g.done), tg = mtags.filter((t) => !t.closed);
            return (
              <View>
                <View style={s.card}>
                  <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Savings</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <View style={{ flex: 1 }}><Text style={{ color: CYAN, fontSize: 20, fontWeight: '800' }}>{rs(mc.saved)}</Text><Text style={s.mute}>saved in total</Text></View>
                    <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{mNet >= 0 ? '+' : ''}{rs(mNet)}</Text><Text style={s.mute}>this month{incM > 0 ? ' · ' + Math.round((mNet / incM) * 100) + '% of income' : ''}</Text></View>
                  </View>
                  {gs.length > 0 && <View style={{ marginTop: 12 }}>{gs.map((g) => { const sv = sav.filter((e) => e.goal === g.id).reduce((a, e) => a + e.amt, 0); return <PRow key={g.id} c={c} label={g.name} pct={Math.round(Math.min(1, sv / g.target) * 100)} color={AMBER} right={rs(sv) + ' of ' + rs(g.target)} />; })}</View>}
                </View>
                {tg.length > 0 && (
                  <View style={s.card}>
                    <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Trips and tags</Text>
                    {tg.map((t) => { const sp = money.filter((m) => m.k === 'out' && m.tag === t.id).reduce((a, m) => a + m.a, 0); return <PRow key={t.id} c={c} label={t.name} pct={t.budget > 0 ? Math.round((sp / t.budget) * 100) : 0} color={t.budget > 0 && sp > t.budget ? CORAL : VIOLET} right={rs(sp) + (t.budget > 0 ? ' of ' + rs(t.budget) : '')} />; })}
                  </View>
                )}
                {(mc.lentLeft > 0 || mc.borrLeft > 0) && (
                  <View style={s.card}>
                    <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Loans</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ flex: 1 }}><Text style={{ color: CYAN, fontSize: 20, fontWeight: '800' }}>{rs(mc.lentLeft)}</Text><Text style={s.mute}>owed to you</Text></View>
                      <View style={{ flex: 1 }}><Text style={{ color: CORAL, fontSize: 20, fontWeight: '800' }}>{rs(mc.borrLeft)}</Text><Text style={s.mute}>you owe</Text></View>
                    </View>
                  </View>
                )}
              </View>
            );
          })()}
      <View style={s.card}>
        <Text style={{ color: c.ink, fontWeight: '700', marginBottom: 10 }}>Money</Text>
        <View style={{ flexDirection: 'row' }}>
          {[['In', mIn, CYAN], ['Out', mOut, CORAL], ['Net', mIn - mOut, c.ink]].map((x) => (
            <View key={x[0]} style={{ flex: 1 }}><Text numberOfLines={1} adjustsFontSizeToFit style={{ color: x[2], fontSize: 18, fontWeight: '800' }}>{rs(x[1])}</Text><Text style={s.mute}>{x[0]}</Text></View>
          ))}
        </View>
        {mOut > 0 && (
          <View style={{ marginTop: 14 }}>
            {rng !== 'Today' && <Bars c={c} vals={mVals} labels={lbl(mDays)} color={CORAL} h={80} />}
            <View style={{ marginTop: 12 }}>{mCats.map((k) => <PRow key={k} c={c} label={k} pct={Math.round((mCat[k] / mOut) * 100)} color={VIOLET} right={`${rs(mCat[k])} · ${Math.round((mCat[k] / mOut) * 100)}%`} />)}</View>
          </View>
        )}
        {mOut === 0 && <Text style={[s.mute, { marginTop: 8 }]}>No spending in this period.</Text>}
      </View>

        </View>
      )}
      </FadeIn>
    </ScrollView>
    </Swipe>
  );
}
/* ---------- First-time setup ---------- */
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const FULLDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TT_PROMPT = `This image is a weekly class timetable of a university student. Extract every class.
Return ONLY JSON: {"classes":[{"day":"Mon|Tue|Wed|Thu|Fri|Sat|Sun","start":"HH:MM","end":"HH:MM","title":"course name"}]}.
Use 24-hour times (2:00pm becomes 14:00). Merge back-to-back slots of the same course on the same day into one entry. Keep Lab in the title for labs. If an end time looks wrong because of an am/pm typo, correct it so the end is after the start. If you cannot read it, return {"classes":[]}.`;
const parseT = (str) => {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?m?\.?\s*$/i.exec(String(str));
  if (!m) return null;
  let h = +m[1]; const mi = m[2] ? +m[2] : 0, ap = m[3] && m[3].toLowerCase();
  if (mi > 59 || h > 24) return null;
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (h === 24) h = 0;
  return h * 60 + mi;
};
const toRows = (cl, start) => { const r = []; let n = start || 0; DAYS_ORDER.forEach((d) => (cl[d] || []).forEach((x) => r.push({ id: ++n, day: d, title: x.t, st: fmt(x.s), en: fmt(x.e) }))); return r; };
async function fixLocation() {
  try {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') return { ok: false, msg: 'Location permission is off. Allow it in phone settings and try again.' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    let nameP = 'Current location';
    try { const g = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); const a = g && g[0]; if (a) nameP = [a.district || a.city || a.subregion, a.region].filter(Boolean).join(', ') || nameP; } catch (e) {}
    await AsyncStorage.setItem('coords', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
    await AsyncStorage.setItem('place', nameP);
    return { ok: true, place: nameP };
  } catch (e) { return { ok: false, msg: "Couldn't get your location. Try again." }; }
}
async function readTimetableImage(key, b64, mime) {
  const txt = await gcall(key, { body: { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: b64 } }, { text: TT_PROMPT }] }] }, gc: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 4000 } });
  return parseLoose(txt, { classes: [] });
}
const LOGO_URI = 'data:image/png;base64,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';
function Logo({ c, size = 92 }) {
  if (LOGO_URI) return <Image source={{ uri: LOGO_URI }} style={{ width: size, height: size, borderRadius: size * 0.22 }} resizeMode="contain" />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.52, fontWeight: '800' }}>K</Text>
    </View>
  );
}
const hm = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
const numIn = (v, lo, hi) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null; };
const SETUP_SYSTEM = `You are Kairo's setup guide. You talk to a university student to learn how they live, so a weekly routine can be built around the five daily prayers.
You receive KNOWN DATA (place, today's prayer times, class timetable, and any current routine). Ask ONE short, relevant question at a time, in simple friendly English. Never ask about something already known. Cover, in a sensible order and only when relevant: usual wake-up time and bedtime; Quran and exercise habits; how they travel to uni and how long it takes; meals and rest; evening tuition, teaching or work with times and days; their main project or goal and hours per week; a skill they want to learn and daily minutes; weekend preferences; any other fixed activity such as gym or family time; the Asr rule (Hanafi or Shafi). Ask about 6 to 10 questions in total, then finish.
Return ONLY JSON: {"reply":"your next question or closing message","ready":false,"school":1,"method":1}.
Include "school" (1 Hanafi, 0 Shafi) and "method" (1 Karachi, 3 MWL, 2 ISNA) only when you have learned them. Set "ready": true when you have enough to build the routine; the reply should then say you will build it now for them to review.
If the student asks for a change after seeing the schedule, acknowledge it briefly and set "ready": true.`;
const GEN_SYSTEM = `You build a weekly routine for a university student from a chat and KNOWN DATA. Return ONLY JSON: {"routine":[...],"notes":"one or two short sentences about the plan"}.
Each routine item: {"title":"","type":"faith|life|study|project|skill|teach","days":[0-6],"anchor":"fajr|sunrise|dhuhr|asr|maghrib|isha" OR "start":"HH:MM","offset":minutes,"minutes":duration}. Use "anchor" with "offset" (negative means before the prayer) for items tied to a prayer time, otherwise use "start" (24-hour HH:MM). Days: 0 is Sunday, 6 is Saturday.
Classes are fixed (given in KNOWN DATA). They are NOT part of the routine and nothing may overlap them.
Rules:
- Morning items (wake-up, Fajr, Quran, exercise) use anchor "fajr" so they shift with the seasons. Evening items use "maghrib" or "isha" anchors, or clock times.
- On class days include a get-ready block and a commute block before the first class, and a commute home after the last class. Mark those blocks with "classDay": true so they disappear on days when university is off.
- Every block must be separate: no overlaps, with a few minutes gap. Check your times against the prayer times and the classes. Leave the minutes around each prayer time free for praying.
- Do not include a Sleep block (the app adds it). Include Jumu'ah (type faith) on Friday around Dhuhr.
- Only include activities the student mentioned or that are clearly needed (meals, rest, commute). Do not invent hobbies. Titles are short and plain. About 15 to 35 items.
- If a current routine is given, change only what the student asked and keep the rest.`;
function previewDay(d, prof, sp, co) {
  const sP = PROF, sS = SET, sE = EXAM, sOn = BD_ON;
  PROF = prof; SET = { ...SET, ...sp }; EXAM = { on: false, course: '' }; BD_ON = false;
  try { const date = addDays(new Date(), ((d + 6) % 7) - ((new Date().getDay() + 6) % 7)); const P = calcTimes(date, co.lat, co.lng); return { blocks: buildDay(d, P, date), P }; }
  finally { PROF = sP; SET = sS; EXAM = sE; BD_ON = sOn; }
}
const N_STEPS = 6;
function Setup({ c, settings, initial, rerun, onFinish, onCancel }) {
  const s = mk(c);
  const k = useKb();
  const lift = k.h ? Math.max(k.h, k.y != null ? Dimensions.get('screen').height - k.y : 0) + 6 : 0;
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [place, setPlace] = useState('');
  const [hasLoc, setHasLoc] = useState(false);
  const [co, setCo] = useState(null);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyOk, setKeyOk] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const ins = useSafeAreaInsets();
  const bp = k.h ? 12 : Math.max(12, ins.bottom + 6);
  const [rows, setRows] = useState(() => toRows(initial.classes));
  const nid = React.useRef(1000);
  const [routine, setRoutine] = useState(initial.routine || []);
  const [notes, setNotes] = useState('');
  const [gen, setGen] = useState(false);
  const [sp, setSp] = useState({ method: settings.method, school: settings.school });
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [cbusy, setCbusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [final, setFinal] = useState(null);
  const [vday, setVday] = useState(new Date().getDay());
  const [nstat, setNstat] = useState('ask');
  const chatRef = React.useRef(null);
  useEffect(() => { (async () => {
    try {
      if (!rerun) await AsyncStorage.multiRemove(['coords', 'place']);
      const p = await AsyncStorage.getItem('place'), cc = await AsyncStorage.getItem('coords'), kk = await AsyncStorage.getItem('gemini_key');
      setPlace(p || ''); setHasLoc(!!cc); setCo(cc ? JSON.parse(cc) : null); setKey(kk || ''); setHasKey(!!kk); setKeyOk(!!kk);
    } catch (e) {}
    setNstat(await notifStatus());
  })(); }, []);
  const inp = inputStyle(c);
  const upRow = (id, p) => setRows((a) => a.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addRow = (d) => setRows((a) => [...a, { id: ++nid.current, day: d, title: '', st: '9:00 AM', en: '10:30 AM' }]);
  const locate = async () => { setBusy('loc'); setMsg(''); const r = await fixLocation(); setBusy(''); if (r.ok) { setPlace(r.place); setHasLoc(true); try { setCo(JSON.parse(await AsyncStorage.getItem('coords'))); } catch (e) {} } else setMsg(r.msg); };
  const checkKey = async () => {
    const kk = key.trim();
    if (!kk) { setMsg('Paste your key first.'); return; }
    setKeyBusy(true); setMsg('');
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=5&key=' + encodeURIComponent(kk));
      if (r.ok) { await AsyncStorage.setItem('gemini_key', kk); setHasKey(true); setKeyOk(true); }
      else setMsg(r.status === 400 || r.status === 403 ? 'Google rejected this key. Check that you copied all of it.' : 'Could not check the key (' + r.status + '). Try again.');
    } catch (e) { setMsg('No internet. Connect and try again.'); }
    setKeyBusy(false);
  };
  const aiErr = (e) => (e && (e.status === 400 || e.status === 403) ? 'Gemini rejected the key.' : e && e.status === 429 ? 'All free AI limits are used up for today. They reset at about ' + resetLabel() + '.' : 'Could not reach the AI. Check your internet.');
  const pick = async (cam) => {
    setMsg(''); setErr('');
    try {
      let res;
      if (cam) { const p = await ImagePicker.requestCameraPermissionsAsync(); if (!p.granted) { setMsg('Camera permission is off.'); return; } res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 }); }
      else res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
      if (res.canceled || !res.assets || !res.assets[0] || !res.assets[0].base64) return;
      setBusy('read');
      const a = res.assets[0], kk = (await AsyncStorage.getItem('gemini_key')) || key;
      const out = await readTimetableImage(kk, a.base64, a.mimeType || 'image/jpeg');
      const map = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }, list = [];
      (out.classes || []).forEach((x) => {
        const d = map[String(x.day || '').slice(0, 3).toLowerCase()], m1 = /^(\d{1,2}):(\d{2})/.exec(String(x.start || '')), m2 = /^(\d{1,2}):(\d{2})/.exec(String(x.end || ''));
        if (d == null || !m1 || !m2 || !x.title) return;
        const st = +m1[1] * 60 + +m1[2]; let en = +m2[1] * 60 + +m2[2];
        if (en <= st) en += 720;
        if (en <= st) return;
        list.push({ id: ++nid.current, day: d, title: String(x.title).slice(0, 40), st: fmt(st), en: fmt(en) });
      });
      if (!list.length) setMsg('I could not read any classes. Try a clearer photo, or add them by hand below.');
      else { setRows(list); setMsg(`Found ${list.length} classes. Please check them below.`); }
    } catch (e) { setMsg(aiErr(e) === 'Gemini rejected the key.' || (e && e.status) ? aiErr(e) : 'Could not read the photo. Check your internet, or add classes by hand.'); }
    setBusy('');
  };
  const parseClasses = () => {
    const classes = {};
    for (const r of rows) {
      if (!r.title.trim()) continue;
      const a = parseT(r.st), b = parseT(r.en);
      if (a == null || b == null || b <= a) return { error: `Check the times for "${r.title}". Use a format like 9:00 AM.` };
      (classes[r.day] = classes[r.day] || []).push({ s: a, e: b, t: r.title.trim().slice(0, 40) });
    }
    Object.keys(classes).forEach((d) => classes[d].sort((x, y) => x.s - y.s));
    return { classes };
  };
  const known = () => {
    const pc = parseClasses();
    const lines = DAYS_ORDER.map((d) => { const l = (pc.classes || {})[d]; return l && l.length ? `${FULLDAY[d]} (day ${d}): ` + l.map((x) => `${x.t} ${fmt(x.s)}-${fmt(x.e)} (${toHM(x.s)}-${toHM(x.e)})`).join('; ') : null; }).filter(Boolean);
    let pt = '';
    if (co) { const P = calcTimes(new Date(), co.lat, co.lng); pt = `Today's prayer times: Fajr ${fmt(P.fajr)}, Sunrise ${fmt(P.sunrise)}, Dhuhr ${fmt(P.dhuhr)}, Asr ${fmt(P.asr)}, Maghrib ${fmt(P.maghrib)}, Isha ${fmt(P.isha)}.`; }
    return `Place: ${place || 'unknown'}.\n${pt}\nClasses:\n${lines.length ? lines.join('\n') : 'none added'}\n${routine.length ? 'Current routine (number | title | type | days | time rule | minutes):\n' + routineText({ routine }) : 'No routine yet.'}\n${rerun ? 'This is a re-run: the student already has a routine. Ask what they want to change first, and do not re-ask everything.' : 'This is the first setup.'}`;
  };
  const askAI = async (list, hiddenFirst) => {
    setCbusy(true); setErr('');
    try {
      const kk = (await AsyncStorage.getItem('gemini_key')) || key;
      if (!kk) { setErr('Add your Gemini key first (step 2).'); setCbusy(false); return; }
      const contents = [{ role: 'user', parts: [{ text: hiddenFirst }] }, ...list.map((m) => ({ role: m.r === 'u' ? 'user' : 'model', parts: [{ text: m.x }] }))];
      const txt = await gcall(kk, { body: { systemInstruction: { parts: [{ text: SETUP_SYSTEM + '\n\nKNOWN DATA\n' + known() }] }, contents }, gc: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 500 } }, undefined, 'fast');
      const out = parseLoose(txt, { reply: txt || 'Tell me a little more.', ready: false });
      const q = {}; if (out.school === 0 || out.school === 1) q.school = out.school; if ([1, 2, 3].includes(Number(out.method))) q.method = Number(out.method);
      if (Object.keys(q).length) setSp((o) => ({ ...o, ...q }));
      const next = [...list, { r: 'a', x: String(out.reply || 'Tell me a little more.') }];
      setMsgs(next);
      if (out.ready || next.filter((m) => m.r === 'a').length >= 12) setReady(true);
    } catch (e) { setErr(aiErr(e)); }
    setCbusy(false);
  };
  const goChat = () => {
    setErr(''); setMsg('');
    const pc = parseClasses(); if (pc.error) { setErr(pc.error); return; }
    setStep(4);
    if (!msgs.length) askAI([], rerun ? 'I want to review my setup. Please start.' : 'Hi, I am ready. Please start.');
  };
  const send = () => { const q = input.trim(); if (!q || cbusy) return; setInput(''); const list = [...msgs, { r: 'u', x: q }]; setMsgs(list); askAI(list, rerun ? 'I want to review my setup. Please start.' : 'Hi, I am ready. Please start.'); };
  const makeSchedule = async () => {
    if (gen) return;
    const pc = parseClasses(); if (pc.error) { setErr(pc.error); setStep(3); return; }
    if (!co) { setErr('Location is missing. Go back to step 3.'); return; }
    setGen(true); setErr('');
    try {
      const kk = (await AsyncStorage.getItem('gemini_key')) || key;
      const transcript = msgs.map((m) => (m.r === 'u' ? 'Student: ' : 'Guide: ') + m.x).join('\n');
      const data = 'KNOWN DATA\n' + known() + '\n\nCHAT\n' + transcript;
      const call = (extra) => gcall(kk, { body: { systemInstruction: { parts: [{ text: GEN_SYSTEM }] }, contents: [{ role: 'user', parts: [{ text: data + (extra || '') }] }] }, gc: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 6000 } });
      let out = parseLoose(await call(), {}), r = keepIds(normRoutine(out.routine, 'setup'), routine), prof = { ...PROF_DEFAULT, classes: pc.classes, routine: r };
      const issues = r.length ? routineIssues(prof, co) : [];
      if (r.length && issues.length) {
        const o2 = parseLoose(await call('\n\nYOUR PREVIOUS ROUTINE:\n' + JSON.stringify(out.routine) + '\n\nThese overlaps were found. Return the full corrected routine with no overlaps:\n' + issues.join('\n')), {}), r2 = keepIds(normRoutine(o2.routine, 'setup'), routine);
        if (r2.length) { out = o2; r = r2; prof = { ...prof, routine: r2 }; }
      }
      if (!r.length) { setErr('I could not build a schedule from that. Please try again.'); setGen(false); return; }
      setRoutine(r); setNotes(String(out.notes || '')); setFinal(prof); setStep(5);
    } catch (e) { setErr(aiErr(e)); }
    setGen(false);
  };
  const changeSomething = () => { setReady(false); setMsgs((m) => [...m, { r: 'a', x: 'Sure. What would you like to change?' }]); setStep(4); };
  const enableN = async () => { const ok = await askNotif(); setNstat(ok ? 'granted' : 'denied'); };
  const titles = ['Welcome', 'Your AI key', 'Your location', 'Your timetable', 'A few questions', 'Your schedule'];
  const next = () => { setErr(''); setMsg(''); if (step === 1 && !keyOk) { setMsg('Save and check your key to continue.'); return; } if (step === 2 && !hasLoc) { setMsg('Test your location to continue.'); return; } if (step === 3) goChat(); else setStep(step + 1); };
  const view = final && co ? previewDay(vday, final, sp, co) : null;
  const wk0 = view ? wakeOf(view.blocks) : null;
  const canCreate = msgs.filter((m) => m.r === 'a').length >= 2;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top || StatusBar.currentHeight || 44, paddingBottom: lift }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row' }}>{titles.map((t, i) => <View key={t} style={{ height: 5, flex: 1, marginRight: 4, borderRadius: 3, backgroundColor: i <= step ? VIOLET : c.line }} />)}</View>
        {rerun ? <Pressable onPress={onCancel} hitSlop={10} style={{ marginLeft: 12 }}><Text style={{ color: c.mute, fontWeight: '600' }}>Cancel</Text></Pressable> : null}
      </View>

      {step === 4 ? (
        <View style={{ flex: 1 }}>
          <ScrollView ref={chatRef} onContentSizeChange={() => chatRef.current && chatRef.current.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
            <Text style={s.mute}>Step 5 of {N_STEPS}</Text>
            <Text style={[s.h1, { marginBottom: 8 }]}>A few questions</Text>
            {msgs.map((m, i) => (
              <FadeIn key={i} y={8} dur={240} style={{ flexDirection: 'row', justifyContent: m.r === 'u' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <View style={{ maxWidth: '88%', flexShrink: 1, backgroundColor: m.r === 'u' ? VIOLET : c.card, borderRadius: 16, padding: 12, borderWidth: m.r === 'u' ? 0 : 1, borderColor: c.line }}>
                  <Text style={{ flexShrink: 1, color: m.r === 'u' ? '#fff' : c.ink, fontSize: 15, lineHeight: 21 }}>{m.x}</Text>
                </View>
              </FadeIn>
            ))}
            {cbusy && <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}><ActivityIndicator color={VIOLET} /><Text style={[s.mute, { marginLeft: 8 }]}>Thinking...</Text></View>}
            {!!err && <Text style={{ color: CORAL, marginTop: 8 }}>{err}</Text>}
            {!!err && !cbusy && <Pressable onPress={() => askAI(msgs, rerun ? 'I want to review my setup. Please start.' : 'Hi, I am ready. Please start.')} style={[s.btn, { alignSelf: 'flex-start', marginTop: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Try again</Text></Pressable>}
          </ScrollView>
          <View style={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: bp, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg, flexShrink: 0 }}>
            {gen && <Text style={[s.mute, { textAlign: 'center', marginBottom: 8 }]}>Building and checking your schedule. This can take up to a minute.</Text>}
            {canCreate && <Pressable onPress={makeSchedule} disabled={gen} style={{ backgroundColor: ready ? VIOLET : c.card, borderWidth: ready ? 0 : 1, borderColor: c.line, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 }}>{gen ? <ActivityIndicator color={ready ? '#fff' : VIOLET} /> : <Text style={{ color: ready ? '#fff' : c.ink, fontWeight: '700' }}>{ready ? 'Create my schedule' : 'Skip the rest and create my schedule'}</Text>}</Pressable>}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextInput value={input} onChangeText={setInput} placeholder="Your answer" placeholderTextColor={c.mute} multiline style={[inp, { flex: 1, minHeight: 46, maxHeight: 120, textAlignVertical: 'center' }]} />
              <Pressable onPress={send} disabled={cbusy} accessibilityLabel="Send" style={{ backgroundColor: input.trim() && !cbusy ? VIOLET : c.line, borderRadius: 23, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}><Ionicons name="arrow-up" size={22} color="#fff" /></Pressable>
            </View>
            <Pressable onPress={() => setStep(3)} style={{ alignSelf: 'flex-start', paddingTop: 10 }}><Text style={{ color: c.mute, fontWeight: '600' }}>Back to timetable</Text></Pressable>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            <FadeIn key={step} y={14} dur={300}>
            {step === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: 28 }}>
                <Logo c={c} />
                <Text style={[s.h1, { fontSize: 30, marginTop: 20, textAlign: 'center' }]}>Welcome to Kairo</Text>
                <Text style={{ color: c.ink, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 12 }}>Your day, built around your prayers.</Text>
                <Text style={{ color: c.mute, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 }}>In a few minutes Kairo will learn your classes and habits, ask you a few questions, and create a schedule for you to review. Nothing is final until you approve it, and you can change it any time.</Text>
              </View>
            ) : (
              <View>
                <Text style={s.mute}>Step {step + 1} of {N_STEPS}</Text>
                <Text style={[s.h1, { marginBottom: 6 }]}>{titles[step]}</Text>
              </View>
            )}

            {step === 1 && (
              <View>
                <Text style={s.mute}>Kairo's AI reads your timetable, asks you a few questions and plans your day. It runs on Google's free Gemini service, so it needs a free key from you. It stays on this phone.</Text>
                <View style={[s.card, { marginTop: 14 }]}>
                  <Text style={{ color: c.ink, fontWeight: '700' }}>How to get your free key</Text>
                  <Text style={[s.mute, { marginTop: 6, lineHeight: 21 }]}>1. Open Google AI Studio and sign in{'\n'}2. Tap "Get API key"{'\n'}3. Tap "Create API key"{'\n'}4. Copy the key and paste it below</Text>
                  <Pressable onPress={() => Linking.openURL('https://aistudio.google.com/apikey')} style={[s.btn, { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row' }]}><Ionicons name="open-outline" size={16} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Open Google AI Studio</Text></Pressable>
                </View>
                {lab(s, 'Your key')}
                <View style={{ flexDirection: 'row' }}>
                  <TextInput value={key} onChangeText={(v) => { setKey(v); setKeyOk(false); }} placeholder="Paste key" placeholderTextColor={c.mute} autoCapitalize="none" autoCorrect={false} secureTextEntry={!showKey} style={[inp, { flex: 1 }]} />
                  <Pressable onPress={() => setShowKey(!showKey)} style={[s.btn, { marginLeft: 8, minWidth: 64 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>{showKey ? 'Hide' : 'Show'}</Text></Pressable>
                </View>
                <Pressable onPress={checkKey} disabled={keyBusy} style={{ backgroundColor: VIOLET, borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 12 }}>
                  {keyBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save and check key</Text>}
                </Pressable>
                {keyOk && !msg ? <Text style={{ color: CYAN, marginTop: 10 }}>{key.trim() ? 'Key works.' : 'A key is already saved on this phone.'}</Text> : null}
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={s.mute}>Kairo needs your location to find accurate prayer times. Tap the button to test it. You can't continue until it works.</Text>
                <View style={[s.card, { marginTop: 14 }]}>
                  <Text style={{ color: c.ink, fontWeight: '700' }}>{hasLoc ? (place || 'Location found') : 'Not set yet'}</Text>
                  <Pressable onPress={locate} style={{ backgroundColor: VIOLET, borderRadius: 12, padding: 13, alignItems: 'center', marginTop: 12 }}>
                    {busy === 'loc' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{hasLoc ? 'Test again' : 'Test my location'}</Text>}
                  </Pressable>
                </View>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={s.mute}>Take a photo of your timetable and the AI will read it, or add classes by hand. Check everything it reads. If you have no classes, just continue.</Text>
                {hasKey && (
                  <View style={{ flexDirection: 'row', marginTop: 12 }}>
                    <Pressable onPress={() => pick(true)} disabled={!!busy} style={[s.btn, { flex: 1, marginRight: 8, flexDirection: 'row', justifyContent: 'center' }]}><Ionicons name="camera-outline" size={18} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Take photo</Text></Pressable>
                    <Pressable onPress={() => pick(false)} disabled={!!busy} style={[s.btn, { flex: 1, flexDirection: 'row', justifyContent: 'center' }]}><Ionicons name="image-outline" size={18} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 6 }}>Choose photo</Text></Pressable>
                  </View>
                )}
                {busy === 'read' && <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}><ActivityIndicator color={VIOLET} /><Text style={[s.mute, { marginLeft: 8 }]}>Reading your timetable...</Text></View>}
                {hasKey && <Text style={[s.mute, { marginTop: 8, fontSize: 12 }]}>The photo is sent to Google's Gemini service only to read the text.</Text>}
                {DAYS_ORDER.map((d) => (
                  <View key={d} style={{ marginTop: 14 }}>
                    <Text style={{ color: c.ink, fontWeight: '700' }}>{FULLDAY[d]}</Text>
                    {rows.filter((r) => r.day === d).map((r) => (
                      <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <TextInput value={r.title} onChangeText={(v) => upRow(r.id, { title: v })} placeholder="Course" placeholderTextColor={c.mute} style={[inp, { flex: 1, paddingHorizontal: 10 }]} />
                        <TextInput value={r.st} onChangeText={(v) => upRow(r.id, { st: v })} placeholder="9:00 AM" placeholderTextColor={c.mute} style={[inp, { width: 86, marginLeft: 6, paddingHorizontal: 6, textAlign: 'center' }]} />
                        <TextInput value={r.en} onChangeText={(v) => upRow(r.id, { en: v })} placeholder="10:30 AM" placeholderTextColor={c.mute} style={[inp, { width: 86, marginLeft: 6, paddingHorizontal: 6, textAlign: 'center' }]} />
                        <Pressable onPress={() => setRows((a) => a.filter((x) => x.id !== r.id))} hitSlop={8} style={{ paddingLeft: 10 }}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
                      </View>
                    ))}
                    <Pressable onPress={() => addRow(d)} hitSlop={6}><Text style={{ color: VIOLET, fontWeight: '700', marginTop: 8 }}>+ Add class</Text></Pressable>
                  </View>
                ))}
              </View>
            )}

            {step === 5 && view && (
              <View>
                <Text style={s.mute}>Here is the schedule I built from your answers. Look through the week. If it looks right, approve it.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  {DAYS_ORDER.map((d) => <Chip key={d} s={s} c={c} on={vday === d} label={DN[d]} onPress={() => setVday(d)} />)}
                </ScrollView>
                <Text style={[s.mute, { marginBottom: 8 }]}>Wake up {wk0 != null ? fmt(wk0) : '—'} · Fajr {fmt(view.P.fajr)} · {place || 'your location'}</Text>
                {!!notes && <View style={[s.card, { marginBottom: 8 }]}><Text style={s.mute}>{notes}</Text></View>}
                {view.blocks.filter((b) => b.y !== 'sleep').map((b, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.line, borderLeftWidth: 5, borderLeftColor: TYPE[b.y] || c.mute, padding: 10, marginBottom: 6 }}>
                    <Text style={{ width: 78, fontSize: 12, fontWeight: '600', color: c.ink }}>{fmt(b.s)}{'\n'}{fmt(b.e)}</Text>
                    <Text style={{ flex: 1, color: c.ink, fontSize: 14, fontWeight: '600' }}>{b.t}</Text>
                  </View>
                ))}
                <View style={[s.row, { marginTop: 12 }]}>
                  <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600' }}>Reminders</Text><Text style={s.mute}>{nstat === 'granted' ? 'On' : nstat === 'denied' ? 'Blocked in phone settings' : 'For blocks, prayers and tasks'}</Text></View>
                  {nstat !== 'granted' && nstat !== 'denied' && <Pressable onPress={enableN} style={[s.btn, { backgroundColor: VIOLET, borderColor: VIOLET }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Enable</Text></Pressable>}
                </View>
              </View>
            )}
            {!!msg && <Text style={{ color: /Found|saved|updated/i.test(msg) ? CYAN : CORAL, marginTop: 12 }}>{msg}</Text>}
            {!!err && <Text style={{ color: CORAL, marginTop: 12 }}>{err}</Text>}
            </FadeIn>
          </ScrollView>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, paddingBottom: bp, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg, flexShrink: 0 }}>
            {step === 5 ? (
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => onFinish(final, sp)} style={{ backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Approve and start</Text></Pressable>
                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <Pressable onPress={changeSomething} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Change something</Text></Pressable>
                  <Pressable onPress={() => setStep(3)} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Edit timetable</Text></Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, flexDirection: 'row' }}>
                <Pressable onPress={() => { setErr(''); setMsg(''); setStep(Math.max(0, step - 1)); }} disabled={step === 0} style={[s.btn, { flex: 1, marginRight: 8, opacity: step === 0 ? 0.35 : 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Back</Text></Pressable>
                <Pressable onPress={next} style={{ flex: 2, backgroundColor: VIOLET, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{step === 0 ? 'Get started' : step === 3 ? 'Continue' : 'Next'}</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

/* ---------- Settings screen ---------- */
function Sec({ c, title, note, children }) {
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: c.line }}>
      <Text style={{ color: c.ink, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      {note ? <Text style={{ color: c.mute, fontSize: 12, marginTop: 2 }}>{note}</Text> : null}
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}
function SRow({ c, label, sub, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
        {sub ? <Text style={{ color: c.mute, fontSize: 12 }}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}
function Opts({ s, c, value, items, onPick }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
      {items.map((it) => <Chip key={String(it[0])} s={s} c={c} on={value === it[0]} label={it[1]} onPress={() => onPick(it[0])} />)}
    </View>
  );
}
function Settings({ c, set, saveSet, resetAll, exportData, restoreData, bump, rerun, routine = [], delRoutine, resetParts, offs = [], saveOffs }) {
  const s = mk(c);
  const [place, setPlace] = useState('');
  const [hasLoc, setHasLoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState('');
  const [skill, setSkill] = useState(set.skill);
  const [use, setUse] = useState(null);
  useEffect(() => { (async () => setUse({ ...(await usageGet()) }))(); }, []);
  const [ns, setNs] = useState('ask');
  const [cnt, setCnt] = useState(null);
  const [nmsg, setNmsg] = useState('');
  const [rsheet, setRsheet] = useState(false);
  const [rtxt, setRtxt] = useState('');
  const [rmsg, setRmsg] = useState('');
  useEffect(() => { (async () => { setNs(await notifStatus()); try { setCnt((await Notifications.getAllScheduledNotificationsAsync()).length); } catch (e) {} })(); }, []);
  const enableN = async () => { const ok = await askNotif(); setNs(ok ? 'granted' : 'denied'); if (ok) { setNmsg('Notifications are on.'); if (bump) bump(); } else setNmsg('Permission was not given. Allow notifications for Expo Go in your phone settings.'); };
  const testN = async () => {
    const dk = dayKey(new Date());
    await sched({ title: 'Time for Test block', body: 'Block reminder · try Start, Snooze or Can\'t do it', categoryIdentifier: 'block', data: { kind: 'block', dk, key: 'b:Test#1', title: 'Test block', bdy: 'Test', endTs: Date.now() + 90000 } }, new Date(Date.now() + 6000));
    await sched({ title: 'Asr time', body: 'Prayer reminder · try Prayed', categoryIdentifier: 'prayer', data: { kind: 'prayer', dk, id: 'test', title: 'Asr time', bdy: 'Test' } }, new Date(Date.now() + 14000));
    await sched({ title: 'Task: Test task', body: 'Task reminder · Uni', data: { kind: 'plain', tab: 1 } }, new Date(Date.now() + 22000));
    setNmsg('Three tests are coming: a block in 6 seconds, a prayer in 14, a task in 22. Lock your screen to see them.');
  };
  const [sl, setSl] = useState(null);
  const [showR, setShowR] = useState(false);
  const [rsOpen, setRsOpen] = useState(false);
  const [rs, setRs] = useState({ ticks: true, temp: true, tasks: false, focus: false, disc: false, chat: false, report: false, sleep: false, train: false });
  const [lr, setLr] = useState(null);
  useEffect(() => { (async () => { try { const v = await AsyncStorage.getItem('kairo_lastresp'); if (v) setLr(JSON.parse(v)); } catch (e) {} })(); }, []);
  const showList = async () => {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const rows2 = all.map((n) => { const t = n.trigger || {}, v = t.value || t.date || (t.seconds ? Date.now() + t.seconds * 1000 : null); const ms = typeof v === 'number' ? v : v ? new Date(v).getTime() : null; return { t: n.content.title, ms }; }).sort((a, b) => (a.ms || 0) - (b.ms || 0));
      setSl(Object.assign(rows2.slice(0, 25), { total: rows2.length }));
    } catch (e) { setSl([]); }
  };
  const doRestore = async () => { setRmsg(await restoreData(rtxt)); };
  useEffect(() => { (async () => {
    try {
      setPlace((await AsyncStorage.getItem('place')) || '');
      setHasLoc(!!(await AsyncStorage.getItem('coords')));
      setKey((await AsyncStorage.getItem('gemini_key')) || '');
    } catch (e) { setHasLoc(false); }
  })(); }, []);
  const locate = async () => {
    setBusy(true); setMsg('');
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') { setMsg('Location permission is off. Allow it in phone settings.'); setBusy(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      let nameP = 'Current location';
      try { const g = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); const a = g && g[0]; if (a) nameP = [a.district || a.city || a.subregion, a.region].filter(Boolean).join(', ') || nameP; } catch (e) {}
      await AsyncStorage.setItem('coords', JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }));
      await AsyncStorage.setItem('place', nameP);
      setPlace(nameP); setHasLoc(true); setMsg('Location updated.');
    } catch (e) { setMsg("Couldn't get your location. Try again."); }
    setBusy(false);
  };
  const clearLoc = async () => { try { await AsyncStorage.multiRemove(['coords', 'place']); } catch (e) {} setPlace(''); setHasLoc(false); setMsg('Location cleared. Plan will ask for it again.'); };
  const saveKey = async () => { try { await AsyncStorage.setItem('gemini_key', key.trim()); setKeyMsg(key.trim() ? 'Saved on this phone.' : 'Key removed.'); } catch (e) { setKeyMsg('Could not save.'); } };
  const testKey = async () => {
    if (!key.trim()) { setKeyMsg('Paste a key first.'); return; }
    setKeyMsg('Checking...');
    try { const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key.trim())); setKeyMsg(r.ok ? 'Key works.' : 'Key was rejected (' + r.status + ').'); } catch (e) { setKeyMsg('No internet, try again.'); }
  };
  const askReset = () => Alert.alert('Delete all data?', 'This removes your ticks, tasks and money entries from this phone. Settings and location stay.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: resetAll }]);
  const tog = (k) => <Switch value={!!set[k]} onValueChange={(v) => saveSet({ [k]: v })} trackColor={{ true: VIOLET }} />;
  const inp = inputStyle(c);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Settings</Text>
      <Text style={s.mute}>Everything is saved on this phone</Text>

      <Sec c={c} title="Location" note="Used for prayer times">
        <SRow c={c} label={hasLoc ? (place || 'Location saved') : 'Not set'} sub={hasLoc ? 'Current location' : 'Tap Update to set it'}>
          <Pressable onPress={locate} style={s.btn}>{busy ? <ActivityIndicator color={VIOLET} /> : <Text style={{ color: c.ink, fontWeight: '600' }}>Update</Text>}</Pressable>
        </SRow>
        {hasLoc ? <Pressable onPress={clearLoc}><Text style={{ color: CORAL, fontWeight: '600', paddingVertical: 6 }}>Clear location</Text></Pressable> : null}
        {!!msg && <Text style={[s.mute, { marginTop: 4 }]}>{msg}</Text>}
      </Sec>

      <Sec c={c} title="My routine" note="Built and maintained by the AI. Ask it in the AI tab to change anything, or remove a block here.">
        <Pressable onPress={() => { anim(); setShowR(!showR); }} style={[s.btn, { alignSelf: 'flex-start' }]}><Text style={{ color: c.ink, fontWeight: '600' }}>{showR ? 'Hide' : 'Show ' + routine.length + ' blocks'}</Text></Pressable>
        {showR && routine.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: TYPE[r.type] || c.mute, marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontWeight: '600', fontSize: 14 }}>{r.title}</Text>
              <Text style={s.mute}>{dShort(r.days)} · {ruleOf(r)} · {r.m} min · by {byLabel(r.by)}</Text>
            </View>
            <Pressable onPress={() => Alert.alert('Remove this block?', r.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { anim(); delRoutine(r.id); } }])} hitSlop={8}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
          </View>
        ))}
        {showR && routine.length === 0 && <Text style={[s.mute, { marginTop: 8 }]}>No routine yet. Run setup to let the AI build one.</Text>}
      </Sec>

      <Sec c={c} title="Sleep" note="Used by the sleep tracker and the bedtime reminder.">
        <Text style={s.mute}>Sleep goal</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>{[6, 7, 8, 9, 10].map((h) => <Chip key={h} s={s} c={c} on={(set.sleepGoal || 8) === h} label={h + ' h'} onPress={() => saveSet({ sleepGoal: h })} />)}</View>
        <SRow c={c} label="Bedtime reminder" sub="30 minutes before you should be in bed">{tog('remSleep')}</SRow>
      </Sec>

      <Sec c={c} title="Days off" note="Days when university is off. Classes are hidden on them. Mark them from the Calendar in Goals.">
        {offs.length === 0 && <Text style={s.mute}>None right now.</Text>}
        {[...offs].sort((a, b) => (a.from < b.from ? -1 : 1)).map((o) => (
          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <View style={{ flex: 1 }}><Text style={{ color: c.ink, fontWeight: '600', fontSize: 14 }}>{o.label}</Text><Text style={s.mute}>{o.from === o.to ? o.from : o.from + ' to ' + o.to}</Text></View>
            <Pressable onPress={() => { anim(); saveOffs(offs.filter((x) => x.id !== o.id)); }} hitSlop={8}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
          </View>
        ))}
      </Sec>

      <Sec c={c} title="Setup">
        <SRow c={c} label="Run setup again" sub="Timetable, commute, tuition and study times">
          <Pressable onPress={rerun} style={s.btn}><Text style={{ color: c.ink, fontWeight: '600' }}>Open</Text></Pressable>
        </SRow>
      </Sec>

      <Sec c={c} title="Look">
        <Opts s={s} c={c} value={set.theme} items={[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']]} onPick={(v) => saveSet({ theme: v })} />
        <SRow c={c} label="Daily quote card" sub="Shown in the Plan tab">{tog('showQuote')}</SRow>
      </Sec>

      <Sec c={c} title="Reminders" note="Scheduled for the next 3 days and refreshed whenever you open Kairo">
        <SRow c={c} label="Notifications" sub={ns === 'granted' ? (cnt != null ? cnt + ' scheduled' : 'On') : ns === 'denied' ? 'Blocked in phone settings' : 'Not allowed yet'}>
          {ns === 'granted'
            ? <Pressable onPress={testN} style={s.btn}><Text style={{ color: c.ink, fontWeight: '600' }}>Test</Text></Pressable>
            : <Pressable onPress={enableN} style={[s.btn, { backgroundColor: VIOLET, borderColor: VIOLET }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Enable</Text></Pressable>}
        </SRow>
        {!!nmsg && <Text style={[s.mute, { marginBottom: 6 }]}>{nmsg}</Text>}
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Pressable onPress={showList} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Show next reminders</Text></Pressable>
          <Pressable onPress={() => Linking.openSettings()} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Battery settings</Text></Pressable>
        </View>
        {sl && sl.length > 0 ? <Text style={{ color: c.ink, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>{sl.total} reminders scheduled. Next {sl.length}:</Text> : null}
        {sl && (sl.length === 0 ? <Text style={[s.mute, { marginBottom: 6 }]}>Nothing is scheduled yet.</Text> : sl.map((r, i) => <Text key={i} style={{ color: c.ink, fontSize: 13, marginBottom: 2 }}>{r.ms ? new Date(r.ms).toDateString().slice(0, 3) + ' ' + fmt(new Date(r.ms).getHours() * 60 + new Date(r.ms).getMinutes()) : ''}  {r.t}</Text>))}
        <Text style={[s.mute, { fontSize: 12, marginTop: 4 }]}>{lr ? `Last button tap received: "${lr.act}" on "${lr.title}" at ${fmt(new Date(lr.t).getHours() * 60 + new Date(lr.t).getMinutes())}` : 'No notification button tap has reached the app yet.'}</Text>
        <Text style={[s.mute, { fontSize: 12, marginVertical: 6 }]}>If reminders are late or missing, set Expo Go (later Kairo) to "Unrestricted" or "No battery limits" in Battery settings. Battery saver can block reminders.</Text>
        <SRow c={c} label="Before each block" sub="Heads-up 5 min before, then Start, Snooze, Can't do it">{tog('remBlocks')}</SRow>
        <SRow c={c} label="Prayer times" sub="With Prayed button">{tog('remPrayers')}</SRow>
        <SRow c={c} label="Morning plan">{tog('remMorning')}</SRow>
        <SRow c={c} label="Evening review">{tog('remEvening')}</SRow>
        <SRow c={c} label="Weekly report" sub="Sunday evening">{tog('remReport')}</SRow>
        <SRow c={c} label="Late-night check" sub="10:30 PM wind-down reminder">{tog('remDisc')}</SRow>
        <SRow c={c} label="Money log" sub="8:30 PM reminder to add spending">{tog('remMoney')}</SRow>
        <SRow c={c} label="Target check-ins" sub="Daily, for targets due within 7 days">{tog('remTargets')}</SRow>
        <Text style={s.mute}>Tone</Text>
        <Opts s={s} c={c} value={set.tone} items={[['gentle', 'Gentle'], ['firm', 'Firm']]} onPick={(v) => saveSet({ tone: v })} />
        <Text style={[s.mute, { marginTop: 8 }]}>Snooze for</Text>
        <Opts s={s} c={c} value={set.snooze} items={[[10, '10 min'], [15, '15 min'], [30, '30 min']]} onPick={(v) => saveSet({ snooze: v })} />
      </Sec>

      <Sec c={c} title="Exam mode" note="Auto turns on 14 days before your first exam">
        <Opts s={s} c={c} value={set.examMode} items={[['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]} onPick={(v) => saveSet({ examMode: v })} />
      </Sec>

      <Sec c={c} title="AI key" note="Free Gemini key from aistudio.google.com. Stays on this phone.">
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <TextInput value={key} onChangeText={setKey} placeholder="Paste key" placeholderTextColor={c.mute} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false} style={[inp, { flex: 1 }]} />
          <Pressable onPress={() => setShowKey(!showKey)} style={[s.btn, { marginLeft: 8, minWidth: 64 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>{showKey ? 'Hide' : 'Show'}</Text></Pressable>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Pressable onPress={saveKey} style={[s.btn, { flex: 1, marginRight: 8 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Save</Text></Pressable>
          <Pressable onPress={testKey} style={[s.btn, { flex: 1 }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Test</Text></Pressable>
        </View>
        {!!keyMsg && <Text style={[s.mute, { marginTop: 6 }]}>{keyMsg}</Text>}
        {use && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 13 }}>AI use today</Text>
            {Object.keys(use.counts).length === 0 ? <Text style={[s.mute, { marginTop: 2 }]}>No AI calls yet today.</Text> : Object.keys(use.counts).map((m) => <Text key={m} style={{ color: use.out[m] ? CORAL : c.mute, fontSize: 13, marginTop: 2 }}>{m}: {use.counts[m]} calls{use.out[m] ? ' (limit reached)' : ''}</Text>)}
            <Text style={[s.mute, { fontSize: 12, marginTop: 4 }]}>Free limits are counted per model. Kairo switches to the next model when one runs out. They reset at about {resetLabel()}.</Text>
          </View>
        )}
      </Sec>

      <Sec c={c} title="Reset" note="Start fresh without losing your routine, money or settings.">
        <Pressable onPress={() => setRsOpen(true)} style={[s.btn, { alignSelf: 'flex-start', borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Reset performance...</Text></Pressable>
      </Sec>
      <Sheet c={c} visible={rsOpen} onClose={() => setRsOpen(false)} title="Reset performance" onSave={() => Alert.alert('Reset now?', 'This cannot be undone. Export a backup first if you are unsure.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: async () => { await resetParts(rs); setRsOpen(false); } }])} saveLabel="Reset selected">
        <Text style={s.mute}>Choose what to clear.</Text>
        {[['ticks', 'Check marks and progress', 'Ticks, skipped and started marks on every day'], ['temp', 'Temporary changes', 'One-time blocks and one-day edits or skips'], ['tasks', 'All tasks', 'Every task, done or not'], ['focus', 'Focus sessions', 'Your focus time history'], ['disc', 'Discipline streak (private)', 'Streak, urges and history'], ['chat', 'AI chat history', 'All conversations'], ['report', 'Saved weekly report', 'The last AI weekly report'], ['sleep', 'Sleep log', 'Every night you recorded'], ['train', 'Workout history', 'Your finished workouts (your profile stays)']].map((x) => (
          <SRow key={x[0]} c={c} label={x[1]} sub={x[2]}><Switch value={!!rs[x[0]]} onValueChange={(v) => setRs({ ...rs, [x[0]]: v })} trackColor={{ true: VIOLET }} /></SRow>
        ))}
        <View style={{ height: 8 }} />
      </Sheet>

      <Sec c={c} title="Data">
        <SRow c={c} label="Backup" sub="Share all your data as text">
          <Pressable onPress={exportData} style={s.btn}><Text style={{ color: c.ink, fontWeight: '600' }}>Export</Text></Pressable>
        </SRow>
        <SRow c={c} label="Restore" sub="Paste a backup to load it">
          <Pressable onPress={() => { setRmsg(''); setRsheet(true); }} style={s.btn}><Text style={{ color: c.ink, fontWeight: '600' }}>Restore</Text></Pressable>
        </SRow>
        <SRow c={c} label="Delete all data" sub="Ticks, tasks and money">
          <Pressable onPress={askReset} style={[s.btn, { borderColor: CORAL }]}><Text style={{ color: CORAL, fontWeight: '700' }}>Delete</Text></Pressable>
        </SRow>
      </Sec>
      <Sheet c={c} visible={rsheet} onClose={() => setRsheet(false)} title="Restore backup" onSave={doRestore} saveLabel="Restore">
        <Text style={s.mute}>Paste the text you exported with Backup. This replaces your current data.</Text>
        <TextInput value={rtxt} onChangeText={setRtxt} multiline placeholder="Paste backup text" placeholderTextColor={c.mute} style={[inputStyle(c), { marginTop: 10, minHeight: 120, maxHeight: 220, textAlignVertical: 'top' }]} />
        {!!rmsg && <Text style={{ color: rmsg === 'Backup restored.' ? CYAN : CORAL, marginTop: 10 }}>{rmsg}</Text>}
        <View style={{ height: 8 }} />
      </Sheet>
      <Text style={[s.mute, { textAlign: 'center', marginTop: 16 }]}>Kairo · built step by step</Text>
    </ScrollView>
  );
}

/* ---------- AI assistant ---------- */
const ALLOWED = ['add_task', 'move_task', 'delete_task', 'complete_task', 'mark_block', 'add_money', 'set_budget', 'set_goal', 'set_setting', 'add_exam', 'add_target', 'update_target', 'add_block', 'routine_add', 'routine_update', 'routine_remove', 'skip_block', 'savings_add', 'loan_add', 'mark_off', 'clear_off', 'reminder_add', 'note_add', 'sleep_log', 'project_progress', 'open_tab'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (v) => { const t = new Date(); t.setHours(0, 0, 0, 0); if (!v || v === 'today') return t; if (v === 'tomorrow') return addDays(t, 1); const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v)); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const REPORT_SYSTEM = `You write a short weekly report for a university student using APP DATA. Return ONLY a JSON object {"reply": "...", "actions": []}. In reply use this plain-text layout with line breaks:
Week in one line: ...
Went well:
- ...
- ...
Needs work:
- ...
- ...
Next week, 3 steps:
1. ...
2. ...
3. ...
Use the real numbers, simple English, under 170 words, no markdown symbols like ** or #. If an exam is coming, include it in the steps.`;
const SYSTEM = `You are Kairo, a friendly personal assistant inside a phone app for a university student (BS Artificial Intelligence, Pakistan). The app has tabs: Plan (daily schedule with tick marks), Goals (targets, tasks and exams), Grow (focus timer and a private discipline tracker that you must never discuss or see), Money (PKR), Stats, AI (you). Settings open from the gear icon.
Reply in simple, short English, usually under 120 words. Be practical and kind. Use the APP DATA below and never invent data. If asked about performance, use the numbers and give 2 or 3 concrete suggestions. Money advice is only an opinion, not professional financial advice.
YOU ARE A FULL LIFE ASSISTANT for the whole app, not only a task editor: answer questions, explain the stats, coach habits, plan days, and help with money, study, targets and routine. Be a thoughtful coach, and when the student only wants advice, give advice and do not change anything.
SCOPE: each request states a SCOPE. PERMANENT means a recurring change (use routine_add, routine_update, routine_remove). TEMPORARY means one date only (use add_block, and skip_block to hide a routine block on one date). AUTO means decide from the words: permanent only when they say every, always, daily, weekly or from now on; otherwise temporary; if unsure, ask one short question first and do not change anything yet.
DAY MODE: when a FOCUS DAY is given, help only with that day and keep every change to that date.
THE SCHEDULE: the student's schedule is made of fixed Classes, a Routine (recurring blocks that you built and now maintain), and one-time blocks. You are responsible for keeping it correct and free of overlaps. To change the weekly schedule use the routine actions. For a change on one date only use add_block. Always check times against the plan lines for that day so nothing overlaps classes, other blocks or prayer times. The student confirms before anything is applied. You cannot change classes.
FORMAT: write your reply as plain text. ONLY if you need to change the app, end with a line containing exactly ###ACTIONS and then ONE JSON array of actions. Never write ###ACTIONS otherwise.
Action types (dates YYYY-MM-DD, times 24-hour HH:MM, numbers refer to the numbered lists in APP DATA):
{"type":"routine_add","title":"","kind":"faith|life|study|project|skill|teach","classDay":false,"days":[0-6],"start":"HH:MM" or "anchor":"fajr|sunrise|dhuhr|asr|maghrib|isha","offset":minutes,"minutes":duration}  (days: 0 is Sunday; offset is negative before the prayer)
{"type":"routine_update","block":1,"title":"","kind":"","days":[],"start":"","anchor":"","offset":0,"minutes":0}  (include only the fields that change)
{"type":"routine_remove","block":1}
{"type":"skip_block","block":1,"date":"YYYY-MM-DD"}  (hide one routine block on one date only)
{"type":"add_block","date":"","start":"HH:MM","end":"HH:MM","title":"","kind":"study|project|skill|life"}  (one-time block on one date)
{"type":"add_task","title":"","date":"","time":"optional","category":"Uni|AI SaaS|Home|Tuition","urgent":false}
{"type":"move_task","task":1,"date":"","time":"optional"}
{"type":"delete_task","task":1}
{"type":"complete_task","task":1,"done":true}
{"type":"mark_block","date":"","block":"words from the block title","done":true}
{"type":"add_money","kind":"in|out","amount":0,"category":"Food|Transport|Uni|Skill|Bills|Other|Pocket|Freelance|Salary","note":"","date":"optional","tag":"optional trip or tag name, e.g. Islamabad trip"}
{"type":"set_budget","amount":0}
{"type":"set_goal","name":"","target":0}  (creates a saving goal)
{"type":"set_setting","key":"tone|snooze|theme|examMode","value":"examMode is auto|on|off"}
{"type":"add_exam","course":"","date":"YYYY-MM-DD"}
{"type":"add_target","title":"","area":"Study|Career|Health|Faith|Money|Skill|Personal","due":"YYYY-MM-DD optional","goal":0,"unit":"","steps":["..."]}
{"type":"update_target","target":1,"current":0,"step_done":1}
{"type":"savings_add","goal":0,"amount":0,"note":""}  (move money into savings; goal is the number of a saving goal, or 0 for general savings)
{"type":"loan_add","who":"","dir":"lent|borrowed","amount":0,"due":"YYYY-MM-DD optional","note":""}
{"type":"mark_off","from":"YYYY-MM-DD","to":"YYYY-MM-DD","label":""}  (university is off; classes are hidden on those days)
{"type":"clear_off","date":"YYYY-MM-DD"}
{"type":"reminder_add","text":"","when":"YYYY-MM-DD HH:MM","repeat":"none|daily|weekly|monthly"}
{"type":"note_add","title":"","body":""}
{"type":"sleep_log","bed":"YYYY-MM-DD HH:MM","wake":"YYYY-MM-DD HH:MM"}  (record a night of sleep)
{"type":"project_progress","project":1,"milestone":1,"pct":50}  (set a milestone percent; numbers come from the Projects list)
{"type":"open_tab","tab":"plan|goals|grow|money|stats|settings"}
Free-time recovery: when the student says they have free time, use "Missed work blocks", overdue tasks, exams within 14 days and targets that are behind. Rank by urgency: exams soon, overdue or due-soon tasks, targets behind pace, then missed project or study blocks, then skill or exercise. Propose 1 to 4 add_block actions inside the free window only, each 25 to 90 minutes with a 10 minute gap, titled like "Recover: Data Structures". Explain the order in one or two short sentences.
Targets: when asked to plan a target use add_target with 3 to 7 concrete steps, or update_target to log progress, and add_block to schedule the first steps.
Resolve words like today, tomorrow, Friday into real dates using the current date in APP DATA.`;
function buildContext({ log, tasks, money, mcfg, co, exams, targets, need, scope, focusDay, ctxTab, sav, sgoals, loans, mtags, offs, reminders, sleep, train, projects, sleepGoal }) {
  const nd = need || { plan: true, miss: true, stats: true, money: true, targets: true, exams: true, routine: true };
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes(), today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const refs = tasks.map((t) => t.id), L = [];
  L.push(`Now: ${DN[now.getDay()]} ${iso(now)} ${fmt(nm)}.`);
  if (ctxTab) L.push(`The student is currently in the ${ctxTab} tab.`);
  L.push('SCOPE for this request: ' + (scope === 'temp' ? 'TEMPORARY (one date only).' : scope === 'perm' ? 'PERMANENT (recurring).' : 'AUTO.'));
  const dayInfo = (d) => {
    const P = calcTimes(d, co.lat, co.lng), l = log[dayKey(d)] || {}, cnt = {}, titles = [];
    let total = 0, done = 0;
    const plan = buildDay(d.getDay(), P, d).filter((b) => b.y !== 'sleep').map((b) => { cnt[b.id] = (cnt[b.id] || 0) + 1; const ok = !!l['b:' + b.id + '#' + cnt[b.id]]; total++; if (ok) done++; titles.push({ k: b.t.split(':')[0], ok }); return { b, ok }; });
    tasks.filter((t) => t.date === dayKey(d)).forEach((t) => { total++; if (l['t:' + t.id]) done++; });
    return { P, l, plan, titles, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
  };
  if (co) {
    const t0 = dayInfo(today0);
    L.push('Today plan:\n' + t0.plan.map((x) => `${fmt(x.b.s)}-${fmt(x.b.e)} ${x.b.t} [${x.ok ? 'done' : x.b.e <= nm ? 'not ticked' : 'pending'}]`).join('\n'));
    L.push('Prayer times today: ' + PIDS.map((id) => `${id} ${fmt(t0.P[id])}${t0.l['p:' + id] ? ' (prayed)' : ''}`).join(', ') + '.');
    if (focusDay) {
      const fd = new Date(focusDay + 'T00:00:00'), di = dayInfo(fd), past = fd < today0;
      L.push(`FOCUS DAY: help only with ${DN[fd.getDay()]} ${focusDay}. Its plan:\n` + di.plan.map((x) => `${fmt(x.b.s)}-${fmt(x.b.e)} ${x.b.t}${past ? (x.ok ? ' [done]' : ' [not ticked]') : ''}`).join('\n'));
      const ft = tasks.filter((t) => t.date === dayKey(fd));
      if (ft.length) L.push('Tasks that day: ' + ft.map((t) => `${t.title}${t.time != null ? ' ' + fmt(t.time) : ''}`).join('; '));
    }
    if (nd.plan) for (let i = 1; i <= 2; i++) { const dd = addDays(today0, i), di = dayInfo(dd); L.push(`Plan for ${DN[dd.getDay()]} ${iso(dd)}:\n` + di.plan.map((x) => `${fmt(x.b.s)}-${fmt(x.b.e)} ${x.b.t}`).join('\n')); }
    const miss = nd.miss ? missedOf(log, co).slice(0, 12) : [];
    if (miss.length) L.push('Missed work blocks (recoverable):\n' + miss.map((m) => `${DN[m.d.getDay()]} ${iso(m.d)} | ${m.title} | ${m.y} | ${m.mins} min${m.skipped ? ' | skipped' : ''}`).join('\n'));
    const keys = Object.keys(log).filter((k) => Object.keys(log[k]).length).map(parseKey).filter(Boolean);
    const first = keys.length ? new Date(Math.min(...keys.map((d) => d.getTime()))) : null;
    if (first && nd.stats) {
      const days = []; for (let i = 13; i >= 0; i--) { const d = addDays(today0, -i); if (d >= first) days.push(d); }
      const infos = days.map(dayInfo), last7 = infos.slice(-7);
      L.push('Daily completion, oldest to newest: ' + last7.map((x, i) => `${DN[days.slice(-7)[i].getDay()]} ${x.pct}%`).join(', ') + '.');
      const pr = infos.reduce((a, x) => a + PIDS.filter((id) => x.l['p:' + id]).length, 0);
      L.push(`Prayers marked in last ${infos.length} days: ${pr} of ${infos.length * 5}.`);
      const tt = {}; infos.forEach((x) => x.titles.forEach((t) => { tt[t.k] = tt[t.k] || { t: 0, d: 0 }; tt[t.k].t++; if (t.ok) tt[t.k].d++; }));
      const weak = Object.keys(tt).filter((k) => tt[k].t >= 2 && tt[k].d < tt[k].t).sort((a, b) => tt[a].d / tt[a].t - tt[b].d / tt[b].t).slice(0, 4).map((k) => `${k} ${Math.round((tt[k].d / tt[k].t) * 100)}%`);
      if (weak.length) L.push('Most skipped blocks: ' + weak.join(', ') + '.');
    }
  }
  const tdone = (t) => !!(log[t.date] && log[t.date]['t:' + t.id]);
  L.push(tasks.length ? 'Tasks (number | title | due | category | status):\n' + tasks.slice(-25).map((t, i) => `${Math.max(0, tasks.length - 25) + i + 1} | ${t.title} | ${iso(new Date(t.ts))}${t.time == null ? '' : ' ' + fmt(t.time)} | ${t.cat}${t.urgent ? ' | urgent' : ''} | ${tdone(t) ? 'done' : t.ts < today0.getTime() ? 'overdue' : 'open'}`).join('\n') : 'Tasks: none.');
  const trefs = targets ? targets.map((t) => t.id) : [];
  if (nd.targets && targets && targets.length) L.push('Targets (number | title | area | due | progress | status):\n' + targets.map((t, i) => `${i + 1} | ${t.title} | ${t.area} | ${t.due ? iso(new Date(t.due)) : 'no date'} | ${Math.round(tProg(t) * 100)}%${t.goal ? ' (' + t.cur + '/' + t.goal + ' ' + t.unit + ')' : ''} | ${tStatus(t, { mute: '' })[0]}${t.steps.length ? ' | steps left: ' + t.steps.filter((x) => !x.done).map((x) => x.t).join('; ') : ''}`).join('\n'));
  if (nd.exams && exams && exams.length) L.push('Exams (course | date | days left):\n' + [...exams].sort((a, b) => a.ts - b.ts).map((e) => `${e.course} | ${iso(new Date(e.ts))} | ${Math.round((e.ts - today0.getTime()) / 864e5)}`).join('\n') + (EXAM.on ? '\nExam mode is ON: project and skill blocks are replaced by revision.' : ''));
  const grefs = (sgoals || []).filter((g) => !g.done).map((g) => g.id);
  if (nd.money) {
  const m30 = money.filter((m) => m.ts >= addDays(today0, -29).getTime()), sum = (a, k) => a.filter((m) => m.k === k).reduce((x, m) => x + m.a, 0);
  const out = sum(m30, 'out'), cat = {}; m30.filter((m) => m.k === 'out').forEach((m) => { cat[m.cat] = (cat[m.cat] || 0) + m.a; });
  L.push(`Money last 30 days (PKR): income ${Math.round(sum(m30, 'in'))}, spent ${Math.round(out)}. Available ${Math.round(moneyCalc(money, sav || [], loans || []).avail)} PKR, in savings ${Math.round(moneyCalc(money, sav || [], loans || []).saved)}.` + (out ? ' Spending split: ' + Object.keys(cat).sort((a, b) => cat[b] - cat[a]).map((k) => `${k} ${Math.round((cat[k] / out) * 100)}%`).join(', ') + '.' : ''));
  if (mcfg.budget) { const ms = new Date(today0); ms.setDate(1); L.push(`Monthly budget ${mcfg.budget}, spent this month ${Math.round(sum(money.filter((m) => m.ts >= ms.getTime()), 'out'))}.`); }
  const gs = (sgoals || []).filter((g) => !g.done);
  if (gs.length) L.push('Saving goals (number | name | saved | target | due):\n' + gs.map((g, i) => `${i + 1} | ${g.name} | ${Math.round((sav || []).filter((e) => e.goal === g.id).reduce((a, e) => a + e.amt, 0))} | ${Math.round(g.target)} | ${g.due ? iso(new Date(g.due)) : 'no date'}`).join('\n'));
  const ln = (loans || []).filter((l) => !l.settled);
  if (ln.length) L.push('Open loans (who | direction | left | due):\n' + ln.map((l) => `${l.who} | ${l.dir} | ${Math.round(Math.max(0, l.amount - loanPaid(l)))} | ${l.due ? iso(new Date(l.due)) : 'no date'}`).join('\n'));
  const tg = (mtags || []).filter((t) => !t.closed);
  if (tg.length) L.push('Money tags (name | spent | budget):\n' + tg.map((t) => `${t.name} | ${Math.round(money.filter((m) => m.k === 'out' && m.tag === t.id).reduce((a, m) => a + m.a, 0))} | ${t.budget || 'none'}`).join('\n'));
  }
  const upOffs = (offs || []).filter((o) => o.to >= iso(today0)).slice(0, 6);
  if (upOffs.length) L.push('University off periods: ' + upOffs.map((o) => `${o.from}${o.to !== o.from ? ' to ' + o.to : ''} (${o.label})`).join('; ') + '. Classes are hidden on those days.');
  if (nd.plan) {
    const up = (reminders || []).filter((r) => !(r.done && (!r.rep || r.rep === 'none'))).map((r) => ({ r, nx: occsOf(r, Date.now(), Date.now() + 30 * 864e5)[0] })).filter((x) => x.nx).sort((a, b) => a.nx - b.nx).slice(0, 8);
    if (up.length) L.push('Reminders (text | next | repeat):\n' + up.map((x) => `${x.r.text} | ${iso(new Date(x.nx))} ${fmt(new Date(x.nx).getHours() * 60 + new Date(x.nx).getMinutes())} | ${x.r.rep || 'none'}`).join('\n'));
  }
  const ss = sleepStats(sleep || [], sleepGoal || 8);
  if (ss.last7.length) L.push(`Sleep, last 7 nights: average ${(ss.avg / 60).toFixed(1)} h (goal ${sleepGoal || 8} h), sleep debt ${(ss.debt / 60).toFixed(1)} h, usual bedtime ${fmt(ss.avgBed % 1440)}, usual wake ${fmt(ss.avgWake)}.`);
  const tl = ((train && train.logs) || []).filter((l) => l.finished).slice(0, 4);
  if (tl.length) L.push('Recent workouts: ' + tl.map((l) => `${l.date} ${l.plan.title} (${l.setsDone}/${l.setsTotal} sets)`).join('; ') + '.');
  const prj = projects || [], prrefs = prj.map((p) => p.id);
  if (prj.length) L.push('Projects (number | name | percent | due), with numbered milestones:\n' + prj.map((p, i) => `${i + 1} | ${p.name} | ${projPct(p)}% | ${p.due ? iso(new Date(p.due)) : 'no date'}\n` + p.milestones.map((m, j) => `   ${j + 1}) ${m.t} ${m.pct}%${m.due ? ' due ' + iso(new Date(m.due)) : ''}`).join('\n')).join('\n'));
  const rrefs = (PROF.routine || []).map((r) => r.id);
  if (nd.routine && rrefs.length) L.push('Routine blocks (number | title | type | days | time rule | minutes):\n' + routineText(PROF));
  return { text: L.join('\n'), refs, trefs, rrefs, grefs, prrefs };
}

/* ---------- Gemini: model chain, daily limits, usage ---------- */
let CHAIN = null, USAGE = null, NOTHINK = null;
function pacDay() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); } catch (e) { return new Date(Date.now() - 8 * 36e5).toISOString().slice(0, 10); }
}
function resetLabel() {
  let off = 8;
  try { const h = parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }), 10), u = new Date().getUTCHours(); off = (u - (h % 24) + 24) % 24; if (off !== 7 && off !== 8) off = 8; } catch (e) {}
  const d = new Date(); d.setUTCHours(off, 0, 0, 0);
  return fmt(d.getHours() * 60 + d.getMinutes());
}
async function usageGet() {
  const day = pacDay();
  if (!USAGE) { try { const v = await AsyncStorage.getItem('gemini_usage'); USAGE = v ? JSON.parse(v) : null; } catch (e) {} }
  if (!USAGE || USAGE.day !== day) USAGE = { day, counts: {}, out: {} };
  return USAGE;
}
async function usageSave() { try { await AsyncStorage.setItem('gemini_usage', JSON.stringify(USAGE)); } catch (e) {} }
async function nothinkGet() {
  if (!NOTHINK) { try { const v = await AsyncStorage.getItem('gemini_nothink'); NOTHINK = v ? JSON.parse(v) : {}; } catch (e) { NOTHINK = {}; } }
  return NOTHINK;
}
async function modelChain(key, prefer) {
  let list = CHAIN;
  if (!list) {
    try { const v = await AsyncStorage.getItem('gemini_chain'); if (v) { const o = JSON.parse(v); if (o.t > Date.now() - 3 * 864e5 && o.list && o.list.length) list = o.list; } } catch (e) {}
  }
  if (!list) {
    let l2 = [];
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=' + encodeURIComponent(key));
      const j = await r.json();
      l2 = (j.models || []).map((m) => {
        const name = (m.name || '').replace('models/', ''), mt = /^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(?:-\d+)?$/.exec(name);
        return mt && parseFloat(mt[1]) >= 2.5 && (m.supportedGenerationMethods || []).includes('generateContent') ? { name, v: parseFloat(mt[1]), lite: mt[2] ? 1 : 0 } : null;
      }).filter(Boolean).sort((a, b) => b.v - a.v || a.lite - b.lite).map((x) => x.name);
    } catch (e) {}
    if (!l2.length) l2 = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    list = l2.slice(0, 5);
    try { await AsyncStorage.setItem('gemini_chain', JSON.stringify({ t: Date.now(), list })); } catch (e) {}
  }
  CHAIN = list;
  return prefer === 'fast' ? [...list.filter((m) => /lite/.test(m)), ...list.filter((m) => !/lite/.test(m))] : list;
}
function parseLoose(txt, fb) {
  try { return JSON.parse(txt); } catch (e) { const m = /\{[\s\S]*\}/.exec(txt || ''); if (m) { try { return JSON.parse(m[0]); } catch (e2) {} } return fb; }
}
// prefer: 'fast' tries the lighter (lite) models first. onText: if given, the answer is streamed as it is written.
async function gcall(key, base, signal, prefer, onText) {
  const chain = await modelChain(key, prefer), use = await usageGet(), nt = await nothinkGet();
  const stream = !!onText && typeof xfetch === 'function';
  let last = 0, any429 = false;
  for (const model of chain) {
    if (use.out[model]) { any429 = true; continue; }
    const ver = parseFloat((/gemini-(\d+(?:\.\d+)?)/.exec(model) || [0, 2.5])[1]);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(key)}`;
    const send = (think) => {
      const gc = { ...base.gc };
      if (think) gc.thinkingConfig = ver >= 3 ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };
      return (stream ? xfetch : fetch)(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...base.body, generationConfig: gc }), signal });
    };
    const think = !nt[model];
    let r = await send(think);
    use.counts[model] = (use.counts[model] || 0) + 1;
    if (r.status === 400 && think) {
      const r2 = await send(false); use.counts[model] += 1;
      if (r2.ok) { nt[model] = 1; try { await AsyncStorage.setItem('gemini_nothink', JSON.stringify(nt)); } catch (e) {} }
      r = r2;
    }
    if (r.status === 429) {
      any429 = true;
      const t = await r.text().catch(() => '');
      if (/PerDay/i.test(t) || !/PerMinute/i.test(t)) use.out[model] = 1;
      await usageSave(); continue;
    }
    if (r.status === 404 || r.status === 403 || r.status >= 500) { last = r.status; await usageSave(); continue; }
    if (!r.ok) { await usageSave(); const e = new Error('http'); e.status = r.status; throw e; }
    await usageSave();
    if (stream) {
      let full = '', fin = false, rerr = null;
      try {
        const reader = r.body.getReader(), dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (line.indexOf('data:') !== 0) continue;
            try {
              const j = JSON.parse(line.slice(5).trim()), parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
              const t = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
              if (j.candidates && j.candidates[0] && j.candidates[0].finishReason) fin = true;
              if (t) { full += t; onText(full); }
            } catch (e) {}
          }
        }
      } catch (e) { if (e && e.name === 'AbortError') throw e; rerr = e; }
      if (full && (fin || !rerr)) return full;
      if (rerr) { const ne = new Error('network'); ne.net = true; throw ne; }
      return gcall(key, base, signal, prefer);
    }
    const j = await r.json();
    const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
    return parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
  }
  const e = new Error('http'); e.status = any429 ? 429 : last || 0; throw e;
}
async function askGemini(key, system, history, text, signal) {
  const txt = await gcall(key, { body: { systemInstruction: { parts: [{ text: system }] }, contents: [...history, { role: 'user', parts: [{ text }] }] }, gc: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 1200 } }, signal);
  return parseLoose(txt, { reply: txt || 'I could not read that. Try again.', actions: [] });
}
function waitActive() {
  return new Promise((res) => {
    if (AppState.currentState === 'active') return res();
    let done = false;
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && !done) { done = true; sub.remove(); res(); } });
    setTimeout(() => { if (!done) { done = true; sub.remove(); res(); } }, 45000);
  });
}
async function askChat(key, system, history, text, signal, onText) {
  return gcall(key, { body: { systemInstruction: { parts: [{ text: system }] }, contents: [...history, { role: 'user', parts: [{ text }] }] }, gc: { temperature: 0.3, maxOutputTokens: 900 } }, signal, 'fast', onText);
}
// The answer is plain text. Actions, if any, come after a line with ###ACTIONS as a JSON array.
function parseChat(txt) {
  const i = txt.indexOf('###ACTIONS'), reply = (i >= 0 ? txt.slice(0, i) : txt).trim();
  let acts = [];
  if (i >= 0) {
    const raw = txt.slice(i + 10).replace(/```(?:json)?/gi, '').trim();
    try { const j = JSON.parse(raw); acts = Array.isArray(j) ? j : j && Array.isArray(j.actions) ? j.actions : []; }
    catch (e) { const m = /\[[\s\S]*\]/.exec(raw); if (m) { try { const j = JSON.parse(m[0]); if (Array.isArray(j)) acts = j; } catch (e2) {} } }
  }
  return { reply: reply || (acts.length ? 'Here is what I suggest.' : 'Done.'), acts };
}
// Only send the parts of your data that the question needs. Less text means a faster answer.
function intentOf(q) {
  const t = String(q).toLowerCase(), has = (re) => re.test(t);
  const money = has(/money|spent|spend|budget|expense|income|salary|saving|\brs\b|pkr|cost|price|bought|paid/);
  const stats = has(/week|perform|stat|progress|streak|review|report|habit|how (am|was|did|is)|compare|trend|average/);
  const miss = has(/miss|free time|free|recover|catch up|behind|skipped/);
  const plan = has(/plan|schedule|routine|time|move|add|block|class|study|tomorrow|today|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|evening|afternoon|night|gym|exercise|quran|wake|sleep|remove|change|shift|swap|earlier|later|lunch|dinner|break/) || miss;
  const targets = has(/target|goal|milestone|deadline/) || miss;
  const exams = has(/exam|quiz|midterm|final|revis/) || miss;
  return { money, stats, miss, plan: plan || (!money && !stats && !targets && !exams), targets, exams, routine: plan || miss };
}
const describeAct = (a, refs, tasks) => {
  const tn = (n) => { const t = tasks.find((x) => x.id === refs[n - 1]); return t ? `"${t.title}"` : `task ${n}`; };
  switch (a.type) {
    case 'add_task': return `Add task "${a.title}" on ${a.date || 'today'}${a.time ? ' at ' + a.time : ''}`;
    case 'move_task': return `Move ${tn(a.task)} to ${a.date}${a.time ? ' at ' + a.time : ''}`;
    case 'delete_task': return `Delete ${tn(a.task)}`;
    case 'complete_task': return `${a.done === false ? 'Mark not done' : 'Mark done'}: ${tn(a.task)}`;
    case 'mark_block': return `Mark "${a.block}" ${a.done === false ? 'not done' : 'done'} on ${a.date || 'today'}`;
    case 'add_money': return `Add ${a.kind === 'in' ? 'income' : 'expense'} of Rs ${a.amount} (${a.category || 'Other'})`;
    case 'set_budget': return `Set monthly budget to Rs ${a.amount}`;
    case 'set_goal': return `Set goal "${a.name}" to Rs ${a.target}`;
    case 'set_skill': return `Set your skill to "${a.name}"`;
    case 'set_setting': return `Change ${a.key} to ${String(a.value)}`;
    case 'add_extra': return `Add weekly activity "${a.title}" ${a.start}-${a.end}`;
    case 'set_profile': return `Set ${a.key} to ${a.value} minutes`;
    case 'routine_add': return `Add to routine: "${a.title}"${Array.isArray(a.days) ? ' (' + dShort(a.days.map(Number)) + ')' : ''} ${a.start ? 'at ' + a.start : a.anchor ? a.anchor + (Number(a.offset) ? ' ' + (Number(a.offset) > 0 ? '+' : '') + a.offset + ' min' : '') : ''} for ${a.minutes} min`;
    case 'routine_update': { const r = (PROF.routine || [])[Number(a.block) - 1]; return `Change routine block ${r ? '"' + r.title + '"' : a.block}${a.title ? ' to "' + a.title + '"' : ''}${a.start ? ' at ' + a.start : ''}${a.minutes ? ' for ' + a.minutes + ' min' : ''}`; }
    case 'savings_add': return `Save Rs ${a.amount}${Number(a.goal) > 0 ? ' towards goal ' + a.goal : ''}`;
    case 'loan_add': return `Record loan: ${a.dir === 'lent' ? 'lent Rs ' + a.amount + ' to' : 'borrowed Rs ' + a.amount + ' from'} ${a.who}`;
    case 'mark_off': return `Mark university off ${a.from}${a.to && a.to !== a.from ? ' to ' + a.to : ''}`;
    case 'clear_off': return `Remove the university-off day ${a.date}`;
    case 'reminder_add': return `Reminder: "${a.text}" at ${a.when}${a.repeat && a.repeat !== 'none' ? ' (' + a.repeat + ')' : ''}`;
    case 'sleep_log': return `Log sleep: ${a.bed} to ${a.wake}`;
    case 'project_progress': return `Set project ${a.project}, milestone ${a.milestone} to ${a.pct}%`;
    case 'note_add': return `Add note "${a.title || 'Note'}"`;
    case 'skip_block': { const r = (PROF.routine || [])[Number(a.block) - 1]; return `Skip "${r ? r.title : 'block ' + a.block}" on ${a.date} only`; }
    case 'routine_remove': { const r = (PROF.routine || [])[Number(a.block) - 1]; return `Remove "${r ? r.title : 'block ' + a.block}" from your routine`; }
    case 'add_target': return `Add target "${a.title}"${a.due ? ' due ' + a.due : ''}${Array.isArray(a.steps) && a.steps.length ? ' with ' + a.steps.length + ' steps' : ''}`;
    case 'update_target': return `Update target ${a.target}${a.current != null ? ' to ' + a.current : ''}${a.step_done ? ', step ' + a.step_done + ' done' : ''}`;
    case 'add_block': return `Add "${a.title}" on ${a.date}, ${a.start} to ${a.end}`;
    case 'add_exam': return `Add exam "${a.course}" on ${a.date}`;
    case 'open_tab': return `Open the ${a.tab} tab`;
    default: return a.type;
  }
};
const QUICK = ['How was my week?', 'What should I do next?', 'Add a task for tomorrow', 'Review my spending'];
function useKb() {
  const [k, setK] = useState({ h: 0, y: null });
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const x = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setK({ h: e.endCoordinates.height, y: e.endCoordinates.screenY }));
    const y = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setK({ h: 0, y: null }));
    return () => { x.remove(); y.remove(); };
  }, []);
  return k;
}
const newChat = (day) => ({ id: Date.now(), title: day ? 'Day: ' + new Date(day + 'T12:00:00').toDateString().slice(0, 10) : 'New chat', ts: Date.now(), msgs: [], day: day || null });
const DAYQ = ['Plan this day', 'What did I miss?', 'Make this day lighter', 'Where can I fit study?'];
function Assistant({ c, settings, tasks, money, mcfg, log, applyActions, undo, hasUndo, goMe, kb, kbY, exams, targets, pending, clearPending, sav, sgoals, loans, mtags, offs, reminders, sleep, train, projects, sleepGoal }) {
  const s = mk(c);
  const [chats, setChats] = useState([]);
  const [curId, setCurId] = useState(null);
  const [input, setInput] = useState('');
  const [ih, setIh] = useState(46);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const [scope, setScope] = useState('auto');
  const [dayF, setDayF] = useState(null);
  const [ctxTab, setCtxTab] = useState(null);
  const [hasKey, setHasKey] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hist, setHist] = useState(false);
  const scroller = React.useRef(null);
  const root = React.useRef(null);
  const abortRef = React.useRef(null);
  const sh = Dimensions.get('screen').height;
  const lift = kb ? Math.max(kb, kbY != null ? sh - kbY : 0) + 6 : 0;
  useEffect(() => { (async () => {
    try { setHasKey(!!(await AsyncStorage.getItem('gemini_key'))); } catch (e) { setHasKey(false); }
    let cs = [], cur = null;
    try {
      const v = await AsyncStorage.getItem('kairo_chats');
      if (v) { const o = JSON.parse(v); cs = o.chats || []; cur = o.cur; }
      else { const old = await AsyncStorage.getItem('kairo_chat'); if (old) { const m = JSON.parse(old); if (m.length) { const f = m.find((x) => x.r === 'u'); cs = [{ id: Date.now(), title: f ? f.x.slice(0, 34) : 'Earlier chat', ts: Date.now(), msgs: m }]; cur = cs[0].id; } } }
    } catch (e) {}
    if (!cs.length) { const n = newChat(); cs = [n]; cur = n.id; }
    if (!cs.find((x) => x.id === cur)) cur = cs[0].id;
    setChats(cs); setCurId(cur); setLoaded(true);
  })(); }, []);
  useEffect(() => { if (loaded) { AsyncStorage.setItem('kairo_chats', JSON.stringify({ chats: chats.slice(0, 30).map((ch) => ({ ...ch, msgs: ch.msgs.slice(-40) })), cur: curId })).catch(() => {}); } }, [chats, curId, loaded]);
  const cur = chats.find((x) => x.id === curId);
  const msgs = cur ? cur.msgs : [];
  const upd = (id, v) => { anim(); setChats((cs) => cs.map((ch) => {
    if (ch.id !== id) return ch;
    const nm = typeof v === 'function' ? v(ch.msgs) : v, fu = nm.find((m) => m.r === 'u');
    return { ...ch, msgs: nm, ts: Date.now(), title: ch.title === 'New chat' && fu ? fu.x.slice(0, 34) : ch.title };
  })); };
  const lastApplied = msgs.map((m) => m.st).lastIndexOf('applied');
  const startNew = () => { if (cur && cur.msgs.length === 0) { setHist(false); return; } const n = newChat(dayF); setChats((cs) => [n, ...cs]); setCurId(n.id); setHist(false); };
  const openChat = (id) => { const ch = chats.find((x) => x.id === id); setDayF(ch ? ch.day || null : null); setCurId(id); setHist(false); };
  const selectDay = (iso0) => {
    setDayF(iso0);
    const ex = chats.find((ch) => (ch.day || null) === iso0);
    if (ex) { setCurId(ex.id); return; }
    const n = newChat(iso0); setChats((cs) => [n, ...cs]); setCurId(n.id);
  };
  const delChat = (id) => Alert.alert('Delete this chat?', 'This only removes the conversation, not your app data.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    const rest = chats.filter((x) => x.id !== id);
    if (!rest.length) { const n = newChat(); setChats([n]); setCurId(n.id); } else { setChats(rest); if (id === curId) setCurId(rest[0].id); }
  } }]);
  const send = async (text) => {
    const q = (text == null ? input : text).trim();
    if (!q || busy || !cur) return;
    const id = curId, base = msgs;
    setInput(''); setIh(46);
    const next = [...base, { r: 'u', x: q }];
    upd(id, next);
    let key = null;
    try { key = await AsyncStorage.getItem('gemini_key'); } catch (e) {}
    if (!key) { setHasKey(false); upd(id, [...next, { r: 'a', x: 'I need your free Gemini key first. Open Settings (the gear on Plan), then AI key.' }]); return; }
    setBusy(true);
    try {
      let co = null; try { co = JSON.parse((await AsyncStorage.getItem('coords')) || 'null'); } catch (e) {}
      const ctx = buildContext({ log, tasks, money, mcfg, co, exams, targets, need: dayF ? { ...intentOf(q), plan: true } : intentOf(q), scope, focusDay: dayF, ctxTab, sav, sgoals, loans, mtags, offs, reminders, sleep, train, projects, sleepGoal });
      setCtxTab(null);
      const hist8 = base.slice(-4).filter((m) => m.x).map((m) => ({ role: m.r === 'u' ? 'user' : 'model', parts: [{ text: m.x }] }));
      let lastT = 0;
      const onText = (t) => { const n = Date.now(); if (n - lastT > 70) { lastT = n; setStream(t.split('###')[0]); } };
      let txt = '', tries = 0;
      for (;;) {
        const ctrl2 = new AbortController(); abortRef.current = ctrl2;
        try { txt = await askChat(key, SYSTEM + '\n\nAPP DATA\n' + ctx.text, hist8, q, ctrl2.signal, onText); break; }
        catch (e2) {
          const net = e2 && !e2.status && e2.name !== 'AbortError';
          if (!net || tries >= 3) throw e2;
          tries++; setStream('Reconnecting…'); await waitActive(); await new Promise((r2) => setTimeout(r2, 700));
        }
      }
      const pc = parseChat(txt), acts = pc.acts.filter((a) => a && ALLOWED.includes(a.type)).slice(0, 8);
      setStream('');
      upd(id, [...next, { r: 'a', x: pc.reply, acts: acts.length ? acts : undefined, refs: ctx.refs, trefs: ctx.trefs, rrefs: ctx.rrefs, grefs: ctx.grefs, prrefs: ctx.prrefs, st: acts.length ? 'pending' : undefined }]);
    } catch (e) {
      if (e && e.name === 'AbortError') { upd(id, [...next, { r: 'a', x: 'Stopped.' }]); setStream(''); setBusy(false); return; }
      const m = e.status === 400 || e.status === 403 ? 'Gemini rejected the key. Check it in Settings, then AI key.' : e.status === 429 ? 'All free AI limits are used up for today. They reset at about ' + resetLabel() + '. The rest of Kairo still works.' : 'I could not reach the AI. Check your internet and try again.';
      upd(id, [...next, { r: 'a', x: m }]);
    }
    setStream('');
    setBusy(false);
  };
  const [auto, setAuto] = useState(null);
  useEffect(() => { if (pending && loaded) { const p = typeof pending === 'string' ? { text: pending } : pending, n = newChat(p.day || null); setChats((cs) => [n, ...cs]); setCurId(n.id); setDayF(p.day || null); setCtxTab(p.ctx || null); setAuto(p.text); if (clearPending) clearPending(); } }, [pending, loaded]);
  useEffect(() => { if (auto && cur && cur.msgs.length === 0 && !busy) { const m = auto; setAuto(null); send(m); } }, [auto, curId, chats]);
  const patch = (i, p) => upd(curId, (arr) => arr.map((m, k) => (k === i ? { ...m, ...p } : m)));
  const doApply = async (i) => { const m = msgs[i]; patch(i, { st: 'working' }); const res = await applyActions(m.acts, m.refs, m.trefs, m.rrefs, m.grefs, m.prrefs); patch(i, { st: 'applied', res }); };
  const doUndo = async (i) => { await undo(); patch(i, { st: 'undone' }); };
  const stop = () => { if (abortRef.current) abortRef.current.abort(); };
  const btn = (bg, bd) => ({ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: bg, borderWidth: 1, borderColor: bd });
  const small = { borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 };
  const Wrap = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const wrapProps = Platform.OS === 'ios' ? { behavior: 'padding' } : {};
  return (
    <Wrap ref={root} {...wrapProps} style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? lift : 0 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>AI</Text>
          <Text style={s.mute} numberOfLines={1}>{hasKey === false ? 'Needs a Gemini key' : cur && cur.msgs.length ? cur.title : 'New chat'}</Text>
        </View>
        <Pressable onPress={() => setHist(true)} accessibilityLabel="Chats" style={small}><Ionicons name="time-outline" size={22} color={c.ink} /></Pressable>
        <Pressable onPress={startNew} accessibilityLabel="New chat" style={[small, { backgroundColor: VIOLET, borderColor: VIOLET }]}><Ionicons name="add" size={22} color="#fff" /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, paddingLeft: 16, marginTop: 8 }} contentContainerStyle={{ paddingRight: 16 }}>
        <Chip s={s} c={c} on={dayF === null} label="All" onPress={() => selectDay(null)} />
        {[-3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((o2) => { const d2 = addDays(new Date(), o2), k2 = iso(d2); return <Chip key={o2} s={s} c={c} on={dayF === k2} label={o2 === 0 ? 'Today' : o2 === 1 ? 'Tomorrow' : o2 === -1 ? 'Yesterday' : DN[d2.getDay()] + ' ' + d2.getDate()} onPress={() => selectDay(k2)} />; })}
      </ScrollView>
      <ScrollView ref={scroller} onContentSizeChange={() => scroller.current && scroller.current.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
        {hasKey === false && (
          <View style={s.card}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>Add your free key</Text>
            <Text style={[s.mute, { marginTop: 4 }]}>Get a free Gemini key at aistudio.google.com, then paste it in Settings, AI key.</Text>
            <Pressable onPress={goMe} style={{ backgroundColor: VIOLET, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Open Settings</Text></Pressable>
          </View>
        )}
        {msgs.length === 0 && (
          <View>
            <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Hi, I'm your Kairo assistant.</Text>
            <Text style={[s.mute, { marginBottom: 12 }]}>Each chat is separate, so start a new one for a new topic. I can review your week, plan your day, answer about your money, and change the app after you confirm.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(dayF ? DAYQ : QUICK).map((q) => <Chip key={q} s={s} c={c} on={false} label={q} onPress={() => send(q)} />)}</View>
          </View>
        )}
        {msgs.map((m, i) => (
          <FadeIn key={i} y={8} dur={240} style={{ flexDirection: 'row', justifyContent: m.r === 'u' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <View style={{ maxWidth: '88%', flexShrink: 1, backgroundColor: m.r === 'u' ? VIOLET : c.card, borderRadius: 16, padding: 12, borderWidth: m.r === 'u' ? 0 : 1, borderColor: c.line }}>
              <Text style={{ flexShrink: 1, color: m.r === 'u' ? '#fff' : c.ink, fontSize: 15, lineHeight: 21 }}>{m.x}</Text>
              {m.acts && (
                <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 10 }}>
                  <Text style={{ color: AMBER, fontWeight: '800', fontSize: 12, letterSpacing: 0.6, marginBottom: 6 }}>{m.st === 'applied' ? 'DONE' : m.st === 'cancelled' ? 'CANCELLED' : m.st === 'undone' ? 'UNDONE' : 'PROPOSED CHANGES'}</Text>
                  {(m.st === 'applied' && m.res ? m.res : m.acts.map((a) => describeAct(a, m.refs || [], tasks))).map((t, k) => <Text key={k} style={{ color: c.ink, fontSize: 14, marginBottom: 3 }}>• {t}</Text>)}
                  {m.st === 'pending' && (
                    <View style={{ flexDirection: 'row', marginTop: 8 }}>
                      <Pressable onPress={() => doApply(i)} style={[btn(VIOLET, VIOLET), { marginRight: 8 }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text></Pressable>
                      <Pressable onPress={() => patch(i, { st: 'cancelled' })} style={btn(c.card, c.line)}><Text style={{ color: c.ink, fontWeight: '600' }}>Cancel</Text></Pressable>
                    </View>
                  )}
                  {m.st === 'working' && <ActivityIndicator color={VIOLET} style={{ marginTop: 8 }} />}
                  {m.st === 'applied' && i === lastApplied && hasUndo && (
                    <Pressable onPress={() => doUndo(i)} style={[btn(c.card, c.line), { marginTop: 8, flex: 0, paddingHorizontal: 18, alignSelf: 'flex-start' }]}><Text style={{ color: c.ink, fontWeight: '600' }}>Undo</Text></Pressable>
                  )}
                </View>
              )}
            </View>
          </FadeIn>
        ))}
        {busy && !stream && <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', padding: 8 }}><ActivityIndicator color={VIOLET} /><Text style={[s.mute, { marginLeft: 8 }]}>Thinking...</Text></View>}
        {busy && !!stream && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10 }}>
            <View style={{ maxWidth: '88%', flexShrink: 1, backgroundColor: c.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: c.line }}>
              <Text style={{ flexShrink: 1, color: c.ink, fontSize: 15, lineHeight: 21 }}>{stream}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: c.line, backgroundColor: c.bg }}>
        <Seg c={c} value={scope} onPick={setScope} items={[['auto', 'Auto'], ['temp', 'One-time'], ['perm', 'Permanent']]} style={{ marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Message Kairo" placeholderTextColor={c.mute} multiline style={[inputStyle(c), { flex: 1, minHeight: 46, maxHeight: 140, textAlignVertical: 'center' }]} />
        {busy
          ? <Pressable onPress={stop} accessibilityLabel="Stop" style={{ backgroundColor: CORAL, borderRadius: 23, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}><Ionicons name="stop" size={20} color="#fff" /></Pressable>
          : <Pressable onPress={() => send()} accessibilityLabel="Send" style={{ backgroundColor: input.trim() ? VIOLET : c.line, borderRadius: 23, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}><Ionicons name="arrow-up" size={22} color="#fff" /></Pressable>}
        </View>
      </View>

      <Sheet c={c} visible={hist} onClose={() => setHist(false)} title="Chats" onSave={startNew} saveLabel="+ New chat">
        {[...chats].sort((x, y) => y.ts - x.ts).map((ch) => (
          <View key={ch.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: ch.id === curId ? VIOLET : c.line, marginBottom: 8 }}>
            <Pressable onPress={() => openChat(ch.id)} style={{ flex: 1, padding: 12 }}>
              <Text numberOfLines={1} style={{ color: c.ink, fontWeight: '600', fontSize: 15 }}>{ch.title}</Text>
              <Text style={{ color: c.mute, fontSize: 12 }}>{ch.msgs.length} messages · {new Date(ch.ts).toDateString().slice(0, 10)}</Text>
            </Pressable>
            <Pressable onPress={() => delChat(ch.id)} hitSlop={8} style={{ padding: 12 }}><Text style={{ color: c.mute, fontSize: 18 }}>✕</Text></Pressable>
          </View>
        ))}
        <View style={{ height: 8 }} />
      </Sheet>
    </Wrap>
  );
}

/* ---------- app shell ---------- */
const NAVICON = ['calendar', 'flag', 'leaf', 'wallet', 'stats-chart', 'sparkles'];
const TABS = [['Plan'], ['Goals'], ['Grow'], ['Money'], ['Stats'], ['AI']];
function AppInner() {
  const sys = useColorScheme();
  const [tab, setTab] = useState(0);
  const [log, setLog] = useState({});
  const [tasks, setTasks] = useState([]);
  const [money, setMoney] = useState([]);
  const [mcfg, setMcfg] = useState({ budget: 0, goalName: '', goalTarget: 0 });
  const [settings, setSettings] = useState(DEFAULTS);
  const [exams, setExams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const [profile, setProfile] = useState(null);
  const [setup, setSetup] = useState(false);
  const [legacy, setLegacy] = useState(null);
  const [targets, setTargets] = useState([]);
  const [focusS, setFocusS] = useState([]);
  const [disc, setDisc] = useState({ since: null, best: 0, log: [] });
  const [oneoffs, setOneoffs] = useState([]);
  const [ovr, setOvr] = useState([]);
  const [sav, setSav] = useState([]);
  const [sgoals, setSgoals] = useState([]);
  const [loans, setLoans] = useState([]);
  const [mtags, setMtags] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [offs, setOffs] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [train, setTrain] = useState({ prof: null, logs: [] });
  const [projects, setProjects] = useState([]);
  const [showSet, setShowSet] = useState(false);
  const [pendingAI, setPendingAI] = useState(null);
  SET = settings;
  ONE = oneoffs;
  OVR = ovr;
  OFFS = offs;
  PROF = profile && profile.data ? { ...PROF_DEFAULT, ...profile.data } : legacy && legacy.classes ? { ...PROF_DEFAULT, classes: legacy.classes } : PROF_DEFAULT;
  { const d0 = new Date(); d0.setHours(0, 0, 0, 0); const nx = exams.filter((e) => e.ts >= d0.getTime()).sort((a, b) => a.ts - b.ts)[0]; const dd = nx ? Math.round((nx.ts - d0.getTime()) / 864e5) : null; EXAM = { on: settings.examMode === 'on' ? true : settings.examMode === 'off' ? false : dd != null && dd <= (settings.examLead || 14), course: nx ? nx.course : '' }; }
  const dayStamp = new Date().toDateString();
  React.useMemo(() => { BD_VER++; BD_CACHE.clear(); }, [profile, legacy, oneoffs, ovr, offs, settings.method, settings.school, settings.examMode, exams, dayStamp]);
  const c = settings.theme === 'light' || (settings.theme === 'system' && sys === 'light') ? LIGHT : DARK;
  useEffect(() => { (async () => {
    try { const v = await AsyncStorage.getItem('kairo_log'); if (v) setLog(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_tasks'); if (v) setTasks(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_money'); if (v) setMoney(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_money_cfg'); if (v) setMcfg(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_settings'); if (v) setSettings({ ...DEFAULTS, ...JSON.parse(v) }); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_exams'); if (v) setExams(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_profile3'); if (v) setProfile(JSON.parse(v)); else { const o = await AsyncStorage.getItem('kairo_profile2'); if (o) setLegacy(JSON.parse(o).data || null); } } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_targets'); if (v) setTargets(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_focus'); if (v) setFocusS(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_disc'); if (v) setDisc(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_oneoffs'); if (v) setOneoffs(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_ovr'); if (v) setOvr(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_sav'); if (v) setSav(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_loans'); if (v) setLoans(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_mtags'); if (v) setMtags(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_notes'); if (v) setNotes(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_rem'); if (v) setReminders(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_offs'); if (v) setOffs(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_sleep'); if (v) setSleep(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_train'); if (v) setTrain(JSON.parse(v)); } catch (e) {}
    try { const v = await AsyncStorage.getItem('kairo_projects'); if (v) setProjects(JSON.parse(v)); } catch (e) {}
    try {
      const g = await AsyncStorage.getItem('kairo_sgoals'), cv = await AsyncStorage.getItem('kairo_money_cfg'), cf = cv ? JSON.parse(cv) : null;
      if (g) setSgoals(JSON.parse(g));
      else if (cf && cf.goalTarget > 0) { const n = [{ id: Date.now(), ts: Date.now(), name: cf.goalName || 'My goal', target: cf.goalTarget, due: null }]; setSgoals(n); AsyncStorage.setItem('kairo_sgoals', JSON.stringify(n)).catch(() => {}); }
    } catch (e) {}
    setLoaded(true);
  })(); }, []);
  const mark = async (dk, key) => {
    const day = { ...(log[dk] || {}) };
    if (day[key]) delete day[key]; else { day[key] = 1; if (key.indexOf('x:') !== 0 && key.indexOf('s:') !== 0) clearPresented(dk, key); }
    const next = { ...log, [dk]: day };
    setLog(next);
    try { await AsyncStorage.setItem('kairo_log', JSON.stringify(next)); } catch (e) {}
  };
  const saveTasks = async (n) => { anim(); setTasks(n); try { await AsyncStorage.setItem('kairo_tasks', JSON.stringify(n)); } catch (e) {} };
  const saveMoney = async (n) => { anim(); setMoney(n); try { await AsyncStorage.setItem('kairo_money', JSON.stringify(n)); } catch (e) {} };
  const addMoney = (m) => {
    saveMoney([...money, m]);
    try {
      if (m.k === 'out' && mcfg.budget > 0) {
        const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
        const before = money.filter((x) => x.k === 'out' && x.ts >= ms.getTime()).reduce((a, x) => a + x.a, 0), after = before + m.a, b = mcfg.budget;
        const hit = after >= b && before < b ? 100 : after >= b * 0.8 && before < b * 0.8 ? 80 : 0;
        if (hit) Notifications.scheduleNotificationAsync({ content: { title: hit === 100 ? 'Budget used up' : 'Budget 80% used', body: `You have spent Rs ${Math.round(after).toLocaleString('en-US')} of Rs ${Math.round(b).toLocaleString('en-US')} this month.`, data: { kind: 'plain', tab: 3 } }, trigger: { channelId: NCH } }).catch(() => {});
      }
    } catch (e) {}
  };
  const saveCfg = async (n) => { setMcfg(n); try { await AsyncStorage.setItem('kairo_money_cfg', JSON.stringify(n)); } catch (e) {} };
  const saveSet = async (patch) => { const n = { ...settings, ...patch }; setSettings(n); try { await AsyncStorage.setItem('kairo_settings', JSON.stringify(n)); } catch (e) {} };
  const resetAll = async () => { setLog({}); setTasks([]); setMoney([]); setExams([]); setSav([]); setSgoals([]); setLoans([]); setMtags([]); setNotes([]); setReminders([]); setOffs([]); setSleep([]); setTrain({ prof: null, logs: [] }); setProjects([]); setTargets([]); setFocusS([]); setDisc({ since: null, best: 0, log: [] }); setOneoffs([]); setMcfg({ budget: 0, goalName: '', goalTarget: 0 }); try { await AsyncStorage.multiRemove(['kairo_log', 'kairo_tasks', 'kairo_money', 'kairo_money_cfg', 'kairo_exams', 'kairo_targets', 'kairo_focus', 'kairo_disc', 'kairo_oneoffs', 'kairo_ovr', 'kairo_sav', 'kairo_sgoals', 'kairo_loans', 'kairo_mtags', 'kairo_notes', 'kairo_rem', 'kairo_offs', 'kairo_sleep', 'kairo_train', 'kairo_projects']); } catch (e) {} };
  const exportData = () => Share.share({ message: JSON.stringify({ app: 'Kairo', log, tasks, money, mcfg, settings, exams, profile, targets, focus: focusS, disc, oneoffs, ovr, sav, sgoals, loans, mtags, notes, reminders, offs, sleep, train, projects }) });
  const [snap, setSnap] = useState(null);
  const kbd = useKb();
  const ins = useSafeAreaInsets();
  const kb = kbd.h;
  const saveLog = async (n) => { setLog(n); try { await AsyncStorage.setItem('kairo_log', JSON.stringify(n)); } catch (e) {} };
  const applyActions = async (acts, refs, trefs, rrefs, grefs, prrefs) => {
    setSnap({ tasks, money, mcfg, settings, log, exams, profile, targets, oneoffs, ovr, sav, sgoals, loans, mtags, notes, reminders, offs, sleep, train, projects });
    let T = tasks.map((t) => ({ ...t })), M = [...money], C = { ...mcfg }, L = { ...log }, S = {}, SV = [...sav], SG = [...sgoals], LN = [...loans], MT = [...mtags], OF = [...offs], NT = [...notes], RM = [...reminders], dirty = {}, SL = [...sleep], PJ = projects.map((p) => ({ ...p, milestones: p.milestones.map((m) => ({ ...m })) })), OV = [...ovr], tV = false, TG = targets.map((t) => ({ ...t, steps: t.steps.map((x) => ({ ...x })) })), O = [...oneoffs], tG = false, tO = false, PRF = profile && profile.data ? { ...profile.data, extras: [...((profile.data && profile.data.extras) || [])], routine: (profile.data.routine || []).map((r) => ({ ...r })) } : null, tP = false, E = [...exams], tT = false, tM = false, tC = false, tL = false, tE = false;
    const out = [];
    let co = null; try { co = JSON.parse((await AsyncStorage.getItem('coords')) || 'null'); } catch (e) {}
    const byRef = (n) => T.find((t) => t.id === (refs || [])[Number(n) - 1]);
    const toMin = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
    const okSet = { wake: (v) => [5, 10, 15, 20].includes(Number(v)), satTuition: (v) => typeof v === 'boolean', sunTuition: (v) => typeof v === 'boolean', tone: (v) => ['gentle', 'firm'].includes(v), snooze: (v) => [10, 15, 30].includes(Number(v)), theme: (v) => ['system', 'dark', 'light'].includes(v), examMode: (v) => ['auto', 'on', 'off'].includes(v) };
    const TABIDX = { plan: 0, goals: 1, tasks: 1, targets: 1, exams: 1, grow: 2, focus: 2, money: 3, stats: 4, ai: 5 };
    let k = 0;
    for (const a of acts) {
      k++;
      try {
        if (a.type === 'add_task') {
          const d = parseISO(a.date); if (!d || !a.title) throw new Error('bad');
          T.push({ id: Date.now() + k, title: String(a.title).slice(0, 80), date: dayKey(d), ts: d.getTime(), cat: CATS.includes(a.category) ? a.category : 'Uni', time: toMin(a.time), urgent: !!a.urgent });
          tT = true; out.push(`Added task "${a.title}"`);
        } else if (a.type === 'move_task') {
          const t = byRef(a.task), d = parseISO(a.date); if (!t || !d) throw new Error('bad');
          const old = t.date; t.date = dayKey(d); t.ts = d.getTime(); if (a.time) t.time = toMin(a.time);
          if (L[old] && L[old]['t:' + t.id]) { L[old] = { ...L[old] }; delete L[old]['t:' + t.id]; tL = true; }
          tT = true; out.push(`Moved "${t.title}" to ${iso(d)}`);
        } else if (a.type === 'delete_task') {
          const t = byRef(a.task); if (!t) throw new Error('bad');
          T = T.filter((x) => x.id !== t.id); tT = true; out.push(`Deleted "${t.title}"`);
        } else if (a.type === 'complete_task') {
          const t = byRef(a.task); if (!t) throw new Error('bad');
          L[t.date] = { ...(L[t.date] || {}) }; if (a.done === false) delete L[t.date]['t:' + t.id]; else L[t.date]['t:' + t.id] = 1;
          tL = true; out.push(`${a.done === false ? 'Marked not done' : 'Marked done'}: "${t.title}"`);
        } else if (a.type === 'mark_block') {
          const d = parseISO(a.date); if (!d || !co) throw new Error('bad');
          const P = calcTimes(d, co.lat, co.lng), cnt = {}, want = String(a.block || '').toLowerCase(); let hit = null;
          buildDay(d.getDay(), P, d).forEach((b) => { if (b.y === 'sleep') return; cnt[b.id] = (cnt[b.id] || 0) + 1; if (!hit && b.t.toLowerCase().indexOf(want) >= 0) hit = { b, key: 'b:' + b.id + '#' + cnt[b.id] }; });
          if (!hit) throw new Error('none');
          const dk = dayKey(d); L[dk] = { ...(L[dk] || {}) }; if (a.done === false) delete L[dk][hit.key]; else L[dk][hit.key] = 1;
          tL = true; out.push(`${a.done === false ? 'Unticked' : 'Ticked'} "${hit.b.t}" on ${iso(d)}`);
        } else if (a.type === 'add_money') {
          const n = Number(a.amount), kind = a.kind === 'in' ? 'in' : 'out'; if (!n || n <= 0) throw new Error('bad');
          const d = a.date ? parseISO(a.date) : null; const ts = d ? d.getTime() + 12 * 36e5 : Date.now();
          const list = kind === 'in' ? INC : EXP;
          let tid = null;
          if (a.tag && kind === 'out') { let tg2 = MT.find((x) => x.name.toLowerCase() === String(a.tag).toLowerCase()); if (!tg2) { tg2 = { id: Date.now() + k + 500, ts: Date.now(), name: String(a.tag).slice(0, 30), budget: 0, closed: false }; MT.push(tg2); dirty.mt = true; } tid = tg2.id; }
          M.push({ id: Date.now() + k, k: kind, a: n, cat: list.includes(a.category) ? a.category : 'Other', note: String(a.note || '').slice(0, 60), ts, tag: tid });
          tM = true; out.push(`Added ${kind === 'in' ? 'income' : 'expense'} Rs ${Math.round(n)}`);
        } else if (a.type === 'set_budget') {
          const n = Number(a.amount); if (!(n >= 0)) throw new Error('bad'); C.budget = n; tC = true; out.push(`Budget set to Rs ${Math.round(n)}`);
        } else if (a.type === 'set_goal') {
          const n = Number(a.target); if (!(n > 0) || !a.name) throw new Error('bad');
          SG.push({ id: Date.now() + k, ts: Date.now(), name: String(a.name).slice(0, 40), target: n, due: null }); dirty.sg = true; out.push(`Added saving goal "${a.name}" for Rs ${Math.round(n)}`);
        } else if (a.type === 'savings_add') {
          const n = Number(a.amount), gid = Number(a.goal) > 0 ? (grefs || [])[Number(a.goal) - 1] : null;
          if (!(n > 0) || n > moneyCalc(money, sav, loans).avail + 0.5 || (Number(a.goal) > 0 && !gid)) throw new Error('bad');
          SV.push({ id: Date.now() + k, ts: Date.now(), amt: n, goal: gid || null, note: String(a.note || '').slice(0, 60) }); dirty.sav = true; out.push(`Saved Rs ${Math.round(n)}`);
        } else if (a.type === 'loan_add') {
          const n = Number(a.amount), d = a.due ? parseISO(a.due) : null;
          if (!a.who || !(n > 0) || !['lent', 'borrowed'].includes(a.dir)) throw new Error('bad');
          LN.push({ id: Date.now() + k, who: String(a.who).slice(0, 40), dir: a.dir, amount: n, note: String(a.note || '').slice(0, 80), ts: Date.now(), due: d ? d.getTime() : null, bal: true, pays: [], settled: false }); dirty.ln = true; out.push(`Recorded: ${a.dir === 'lent' ? 'lent to' : 'borrowed from'} ${a.who}`);
        } else if (a.type === 'mark_off') {
          const f = parseISO(a.from), t = a.to ? parseISO(a.to) : f;
          if (!f || !t || t < f) throw new Error('bad');
          OF.push({ id: Date.now() + k, from: iso(f), to: iso(t), label: String(a.label || 'University off').slice(0, 40) }); dirty.of = true; out.push(`Marked university off ${iso(f)}${iso(t) !== iso(f) ? ' to ' + iso(t) : ''}`);
        } else if (a.type === 'clear_off') {
          const d = parseISO(a.date); if (!d) throw new Error('bad');
          const before = OF.length; OF = OF.filter((o) => !(iso(d) >= o.from && iso(d) <= o.to)); if (OF.length === before) throw new Error('bad');
          dirty.of = true; out.push(`Removed the day off on ${iso(d)}`);
        } else if (a.type === 'reminder_add') {
          const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(String(a.when || ''));
          if (!a.text || !m) throw new Error('bad');
          const w = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
          RM.push({ id: Date.now() + k, ts: Date.now(), text: String(a.text).slice(0, 120), when: w, rep: ['daily', 'weekly', 'monthly'].includes(a.repeat) ? a.repeat : 'none', days: [], early: 0, done: false }); dirty.rm = true; out.push(`Added reminder "${a.text}"`);
        } else if (a.type === 'sleep_log') {
          const pm = (v) => { const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(String(v || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : null; };
          const b = pm(a.bed), w = pm(a.wake);
          if (!b || !w || w <= b || w - b > 20 * 36e5) throw new Error('bad');
          SL.push({ id: Date.now() + k, bed: b, wake: w, q: 0 }); dirty.sl = true; out.push('Logged ' + ((w - b) / 36e5).toFixed(1) + ' hours of sleep');
        } else if (a.type === 'project_progress') {
          const pj = PJ.find((x) => x.id === (prrefs || [])[Number(a.project) - 1]), mi = pj ? pj.milestones[Number(a.milestone) - 1] : null, v = Number(a.pct);
          if (!pj || !mi || !(v >= 0 && v <= 100)) throw new Error('bad');
          mi.pct = Math.round(v); dirty.pj = true; out.push(`"${mi.t}" is now ${mi.pct}%`);
        } else if (a.type === 'note_add') {
          if (!a.title && !a.body) throw new Error('bad');
          NT.push({ id: Date.now() + k, ts: Date.now(), upd: Date.now(), title: String(a.title || '').slice(0, 60), kind: 'text', body: String(a.body || '').slice(0, 5000), items: [], color: 0, pin: false }); dirty.nt = true; out.push(`Added note "${a.title || 'Note'}"`);
        } else if (a.type === 'set_setting') {
          if (!okSet[a.key] || !okSet[a.key](a.value)) throw new Error('bad');
          S[a.key] = ['wake', 'snooze'].includes(a.key) ? Number(a.value) : a.value; out.push(`Changed ${a.key}`);
        } else if (a.type === 'add_exam') {
          const d = parseISO(a.date); if (!d || !a.course) throw new Error('bad');
          E.push({ id: Date.now() + k, course: String(a.course).slice(0, 40), ts: d.getTime() }); tE = true; out.push(`Added exam "${a.course}" on ${iso(d)}`);
        } else if (a.type === 'routine_add') {
          if (!PRF) throw new Error('bad');
          const it = normRoutine([{ title: a.title, type: a.kind, days: a.days, anchor: a.anchor, offset: a.offset, start: a.start, minutes: a.minutes, classDay: a.classDay }])[0];
          if (!it) throw new Error('bad');
          it.id = Date.now().toString(36) + k; PRF.routine.push(it); tP = true; out.push(`Added "${it.title}" to your routine`);
        } else if (a.type === 'routine_update') {
          const idx = PRF ? PRF.routine.findIndex((r) => r.id === (rrefs || [])[Number(a.block) - 1]) : -1;
          if (idx < 0) throw new Error('bad');
          const r = PRF.routine[idx], cand = { title: a.title || r.title, type: a.kind || r.type, days: Array.isArray(a.days) && a.days.length ? a.days : r.days, minutes: a.minutes || r.m };
          if (a.anchor) { cand.anchor = a.anchor; cand.offset = a.offset || 0; } else if (a.start) cand.start = a.start; else if (r.a === 'clock') cand.start = toHM(r.o); else { cand.anchor = r.a; cand.offset = r.o; }
          const it = normRoutine([cand])[0];
          if (!it) throw new Error('bad');
          PRF.routine[idx] = { ...it, id: r.id, by: r.by, ts: r.ts }; tP = true; out.push(`Updated "${it.title}"`);
        } else if (a.type === 'skip_block') {
          const idx = PRF ? PRF.routine.findIndex((r) => r.id === (rrefs || [])[Number(a.block) - 1]) : -1, d = parseISO(a.date);
          if (idx < 0 || !d) throw new Error('bad');
          const rid = PRF.routine[idx].id;
          if (!OV.some((o) => o.date === iso(d) && o.rid === rid)) OV.push({ date: iso(d), rid });
          tV = true; out.push(`Skipped "${PRF.routine[idx].title}" on ${iso(d)} only`);
        } else if (a.type === 'routine_remove') {
          const idx = PRF ? PRF.routine.findIndex((r) => r.id === (rrefs || [])[Number(a.block) - 1]) : -1;
          if (idx < 0) throw new Error('bad');
          out.push(`Removed "${PRF.routine[idx].title}"`); PRF.routine.splice(idx, 1); tP = true;
        } else if (a.type === 'add_extra') {
          const st = hm(a.start), en = hm(a.end), days = Array.isArray(a.days) ? a.days.map(Number).filter((x) => x >= 0 && x <= 6) : [];
          if (!PRF || !a.title || st == null || en == null || en <= st || !days.length) throw new Error('bad');
          PRF.extras = [...PRF.extras, { title: String(a.title).slice(0, 40), type: ['life', 'study', 'project', 'skill', 'teach', 'faith'].includes(a.kind) ? a.kind : 'life', days, s: st, e: en }]; tP = true; out.push(`Added "${a.title}" to your week`);
        } else if (a.type === 'set_profile') {
          const lim = { commute: [0, 180], buffer: [0, 60], prep: [10, 150], quranMin: [0, 120], exMin: [0, 150], skillMin: [0, 240] }[a.key], v = Number(a.value);
          if (!PRF || !lim || !(v >= lim[0] && v <= lim[1])) throw new Error('bad');
          PRF[a.key] = Math.round(v); tP = true; out.push(`Set ${a.key} to ${Math.round(v)}`);
        } else if (a.type === 'add_target') {
          if (!a.title) throw new Error('bad');
          const d = a.due ? parseISO(a.due) : null, goalN = Number(a.goal) > 0 ? Number(a.goal) : 0;
          const steps = (Array.isArray(a.steps) ? a.steps : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 12).map((t, i) => ({ id: Date.now() + k * 100 + i, t: t.slice(0, 80), done: false }));
          TG.push({ id: Date.now() + k, title: String(a.title).slice(0, 80), area: AREAS.includes(a.area) ? a.area : 'Personal', due: d ? d.getTime() : null, goal: goalN, unit: String(a.unit || '').slice(0, 12), cur: 0, steps, ts: Date.now() }); tG = true; out.push(`Added target "${a.title}"`);
        } else if (a.type === 'update_target') {
          const t = TG.find((x) => x.id === (trefs || [])[Number(a.target) - 1]); if (!t) throw new Error('bad');
          if (a.current != null && t.goal > 0) t.cur = Math.max(0, Math.min(t.goal, Number(a.current) || 0));
          if (a.step_done && t.steps[Number(a.step_done) - 1]) t.steps[Number(a.step_done) - 1].done = true;
          tG = true; out.push(`Updated target "${t.title}"`);
        } else if (a.type === 'add_block') {
          const d = parseISO(a.date), st = hm(a.start), en = hm(a.end);
          if (!d || !a.title || st == null || en == null || en <= st) throw new Error('bad');
          O.push({ by: 'ai', ts: Date.now(), id: Date.now() + k, date: iso(d), title: String(a.title).slice(0, 50), type: ['study', 'project', 'skill', 'life'].includes(a.kind) ? a.kind : 'study', s: st, e: en }); tO = true; out.push(`Added "${a.title}" on ${iso(d)} at ${fmt(st)}`);
        } else if (a.type === 'open_tab') {
          if (a.tab === 'me' || a.tab === 'settings') setShowSet(true);
          else { if (TABIDX[a.tab] == null) throw new Error('bad'); setTab(TABIDX[a.tab]); }
          out.push(`Opened ${a.tab}`);
        }
      } catch (e) { out.push(`Skipped one change (${a.type})`); }
    }
    if (dirty.sav) saveSav(SV);
    if (dirty.sg) saveSgoals(SG);
    if (dirty.ln) saveLoans(LN);
    if (dirty.mt) saveMtags(MT);
    if (dirty.of) saveOffs(OF);
    if (dirty.nt) saveNotes(NT);
    if (dirty.rm) saveReminders(RM);
    if (dirty.sl) saveSleep(SL);
    if (dirty.pj) saveProjects(PJ);
    if (tV) saveOvr(OV);
    if (tG) saveTargets(TG);
    if (tO) saveOneoffs(O);
    if (tP && PRF) await saveProfile({ ...profile, data: PRF });
    if (tE) await saveExams(E);
    if (tT) await saveTasks(T);
    if (tM) await saveMoney(M);
    if (tC) await saveCfg(C);
    if (tL) await saveLog(L);
    if (Object.keys(S).length) await saveSet(S);
    return out;
  };
  const undo = async () => {
    if (!snap) return;
    await saveTasks(snap.tasks); await saveMoney(snap.money); await saveCfg(snap.mcfg); await saveLog(snap.log); await saveExams(snap.exams || []); saveTargets(snap.targets || []); saveOneoffs(snap.oneoffs || []); saveOvr(snap.ovr || []); saveSav(snap.sav || []); saveSgoals(snap.sgoals || []); saveLoans(snap.loans || []); saveMtags(snap.mtags || []); saveNotes(snap.notes || []); saveReminders(snap.reminders || []); saveOffs(snap.offs || []); saveSleep(snap.sleep || []); saveProjects(snap.projects || []); if (snap.profile) await saveProfile(snap.profile);
    setSettings(snap.settings); try { await AsyncStorage.setItem('kairo_settings', JSON.stringify(snap.settings)); } catch (e) {}
    setSnap(null);
  };
  const finishSetup = async (data, patch) => {
    const p = { done: true, data }; setProfile(p);
    try { await AsyncStorage.setItem('kairo_profile3', JSON.stringify(p)); } catch (e) {}
    await saveSet(patch); setSetup(false); setTab(0); setTick((t) => t + 1);
  };
  const saveProfile = async (p) => { setProfile(p); try { await AsyncStorage.setItem('kairo_profile3', JSON.stringify(p)); } catch (e) {} };
  const persist = (k, v) => AsyncStorage.setItem(k, JSON.stringify(v)).catch(() => {});
  const saveTargets = (n) => { setTargets(n); persist('kairo_targets', n); };
  const saveFocus = (n) => { setFocusS(n); persist('kairo_focus', n); };
  const focusRef = React.useRef(focusS); focusRef.current = focusS;
  const addSession = (x) => saveFocus([...focusRef.current, x]);
  const saveDisc = (n) => { setDisc(n); persist('kairo_disc', n); };
  const saveOneoffs = (n) => { setOneoffs(n); persist('kairo_oneoffs', n); };
  const saveOvr = (n) => { setOvr(n); persist('kairo_ovr', n); };
  const saveSav = (n) => { setSav(n); persist('kairo_sav', n); };
  const saveSgoals = (n) => { setSgoals(n); persist('kairo_sgoals', n); };
  const saveLoans = (n) => { setLoans(n); persist('kairo_loans', n); };
  const saveMtags = (n) => { setMtags(n); persist('kairo_mtags', n); };
  const saveNotes = (n) => { setNotes(n); persist('kairo_notes', n); };
  const saveReminders = (n) => { setReminders(n); persist('kairo_rem', n); };
  const saveOffs = (n) => { setOffs(n); persist('kairo_offs', n); };
  const saveSleep = (n) => { setSleep(n); persist('kairo_sleep', n); };
  const saveTrain = (n) => { setTrain(n); persist('kairo_train', n); };
  const saveProjects = (n) => { setProjects(n); persist('kairo_projects', n); };
  const remRef = React.useRef(reminders); remRef.current = reminders;
  const editTask = (id, patch) => {
    const old = tasks.find((t) => t.id === id);
    if (!old) return;
    if (patch.date && patch.date !== old.date && log[old.date] && log[old.date]['t:' + id]) {
      const L = { ...log }; L[old.date] = { ...L[old.date] }; delete L[old.date]['t:' + id]; L[patch.date] = { ...(L[patch.date] || {}), ['t:' + id]: 1 }; saveLog(L);
    }
    saveTasks(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const editProfile = (fn) => { if (!profile || !profile.data) return; saveProfile({ ...profile, data: { ...profile.data, routine: fn(profile.data.routine || []) } }); };
  const schedApi = {
    addRoutine: (it) => editProfile((rt) => [...rt, { ...it, id: Date.now().toString(36), by: 'you', ts: Date.now() }]),
    updateRoutine: (id, patch) => editProfile((rt) => rt.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    removeRoutine: (id) => editProfile((rt) => rt.filter((r) => r.id !== id)),
    skipOnce: (rid, dateIso) => { if (!ovr.some((o) => o.date === dateIso && o.rid === rid)) saveOvr([...ovr, { date: dateIso, rid }]); },
    addOne: (x) => saveOneoffs([...oneoffs, { by: 'you', ts: Date.now(), ...x, id: Date.now() + Math.floor(Math.random() * 1000) }]),
    updateOne: (id, patch) => saveOneoffs(oneoffs.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    removeOne: (id) => saveOneoffs(oneoffs.filter((x) => x.id !== id)),
  };
  const askAI = (msg) => { setPendingAI(typeof msg === 'string' ? { text: msg } : msg); setTab(5); };
  const delRoutine = (id) => { if (!profile || !profile.data) return; saveProfile({ ...profile, data: { ...profile.data, routine: (profile.data.routine || []).filter((r) => r.id !== id) } }); };
  const resetParts = async (o) => {
    const rm = [];
    if (o.ticks) { setLog({}); rm.push('kairo_log'); }
    if (o.temp) { setOneoffs([]); setOvr([]); rm.push('kairo_oneoffs', 'kairo_ovr'); }
    if (o.tasks) { setTasks([]); rm.push('kairo_tasks'); }
    if (o.focus) { setFocusS([]); rm.push('kairo_focus', 'kairo_focus_run'); }
    if (o.disc) { setDisc({ since: null, best: 0, log: [] }); rm.push('kairo_disc'); }
    if (o.chat) rm.push('kairo_chats', 'kairo_chat');
    if (o.report) rm.push('kairo_report');
    if (o.sleep) { setSleep([]); rm.push('kairo_sleep'); }
    if (o.train) saveTrain({ prof: train.prof, logs: [] });
    try { if (rm.length) await AsyncStorage.multiRemove(rm); } catch (e) {}
  };
  const saveExams = async (n) => { anim(); setExams(n); try { await AsyncStorage.setItem('kairo_exams', JSON.stringify(n)); } catch (e) {} };
  const addExam = (e) => saveExams([...exams, e]);
  const delExam = (id) => saveExams(exams.filter((e) => e.id !== id));
  const restoreData = async (txt) => {
    let o; try { o = JSON.parse(txt); } catch (e) { return 'That is not valid backup text.'; }
    if (!o || o.app !== 'Kairo') return 'This is not a Kairo backup.';
    await saveLog(o.log || {}); await saveTasks(o.tasks || []); await saveMoney(o.money || []); await saveCfg(o.mcfg || { budget: 0, goalName: '', goalTarget: 0 }); await saveExams(o.exams || []); saveTargets(o.targets || []); saveSav(o.sav || []); saveSgoals(o.sgoals || []); saveLoans(o.loans || []); saveMtags(o.mtags || []); saveNotes(o.notes || []); saveReminders(o.reminders || []); saveOffs(o.offs || []); saveSleep(o.sleep || []); saveTrain(o.train || { prof: null, logs: [] }); saveProjects(o.projects || []); saveOvr(o.ovr || []); saveFocus(o.focus || []); saveDisc(o.disc || { since: null, best: 0, log: [] }); saveOneoffs(o.oneoffs || []);
    if (o.profile) { setProfile(o.profile); try { await AsyncStorage.setItem('kairo_profile3', JSON.stringify(o.profile)); } catch (e) {} }
    const st = { ...DEFAULTS, ...(o.settings || {}) }; setSettings(st); try { await AsyncStorage.setItem('kairo_settings', JSON.stringify(st)); } catch (e) {}
    return 'Backup restored.';
  };
  const logRef = React.useRef(log); logRef.current = log;
  const loadedRef = React.useRef(false); loadedRef.current = loaded;
  const markKey = async (dk, key, on) => { const L = { ...logRef.current }; L[dk] = { ...(L[dk] || {}) }; if (on) L[dk][key] = 1; else delete L[dk][key]; logRef.current = L; await saveLog(L); if (on && key.indexOf('x:') !== 0 && key.indexOf('s:') !== 0) clearPresented(dk, key); };
  const [quick, setQuick] = useState(null);
  const fgSince = React.useRef(Date.now());
  const respRef = React.useRef(null);
  respRef.current = async (r) => {
    try {
      for (let i = 0; i < 20 && !loadedRef.current; i++) await new Promise((x) => setTimeout(x, 300));
      const rid = r.notification.request.identifier + '|' + r.actionIdentifier;
      if ((await AsyncStorage.getItem('last_notif')) === rid) return;
      await AsyncStorage.setItem('last_notif', rid);
      const d = r.notification.request.content.data || {}, act = r.actionIdentifier;
      try { await AsyncStorage.setItem('kairo_lastresp', JSON.stringify({ t: Date.now(), act, title: d.title || r.notification.request.content.title || '' })); } catch (e) {}
      try { await Notifications.dismissNotificationAsync(r.notification.request.identifier); } catch (e) {}
      if (act === Notifications.DEFAULT_ACTION_IDENTIFIER) { if (d.tab != null) setTab(d.tab); return; }
      const again = { ...d, auto: false };
      let fb = '';
      if (d.kind === 'block') {
        if (act === 'done') { await markKey(d.dk, d.key, true); await markKey(d.dk, 'x:' + d.key, false); fb = `Marked "${d.title}" as done`; }
        else if (act === 'cant') { await markKey(d.dk, 'x:' + d.key, true); fb = `Marked "${d.title}" as missed`; }
        else if (act === 'start') { await markKey(d.dk, 's:' + d.key, true); if (d.endTs) await sched({ title: 'Finished ' + d.title + '?', body: 'Tap Done when you are finished.', categoryIdentifier: 'blockend', data: again }, new Date(d.endTs)); fb = `Started "${d.title}"`; }
        else if (act === 'snooze') { await sched({ title: 'Reminder: ' + (d.title || ''), body: d.bdy || '', categoryIdentifier: 'block', data: again }, new Date(Date.now() + SET.snooze * 60000)); fb = `Snoozed for ${SET.snooze} minutes`; }
      } else if (d.kind === 'prayer') {
        if (act === 'prayed') { await markKey(d.dk, 'p:' + d.id, true); fb = `${String(d.title || 'Prayer').replace(' time', '')} marked as prayed`; }
        else if (act === 'snooze') { await sched({ title: d.title || 'Prayer time', body: d.bdy || '', categoryIdentifier: 'prayer', data: again }, new Date(Date.now() + SET.snooze * 60000)); fb = `I will remind you again in ${SET.snooze} minutes`; }
      } else if (d.kind === 'task') {
        if (act === 'done') { await markKey(d.dk, d.key, true); fb = `Marked "${d.title}" as done`; }
        else if (act === 'snooze') { await sched({ title: 'Reminder: ' + (d.title || ''), body: d.bdy || '', categoryIdentifier: 'task', data: again }, new Date(Date.now() + SET.snooze * 60000)); fb = `Snoozed for ${SET.snooze} minutes`; }
      } else if (d.kind === 'rem') {
        if (act === 'done') { const rr = remRef.current.find((x) => x.id === d.id); if (rr && (!rr.rep || rr.rep === 'none')) saveReminders(remRef.current.map((x) => (x.id === d.id ? { ...x, done: true } : x))); fb = 'Reminder done'; }
        else if (act === 'snooze10' || act === 'snooze60') { const mn = act === 'snooze10' ? 10 : 60; await sched({ title: 'Reminder', body: d.bdy || d.title || '', categoryIdentifier: 'reminder', data: again }, new Date(Date.now() + mn * 60000)); fb = 'Snoozed for ' + (mn === 60 ? '1 hour' : '10 minutes'); }
      }
      if (fb) {
        const cold = Date.now() - fgSince.current < 4000 || AppState.currentState !== 'active';
        setQuick(fb);
        setTimeout(() => { setQuick(null); if (cold) BackHandler.exitApp(); }, 1700);
      }
    } catch (e) {}
  };
  useEffect(() => {
    setupNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => { if (respRef.current) respRef.current(r); });
    (async () => { try { const r = await Notifications.getLastNotificationResponseAsync(); if (r && respRef.current) respRef.current(r); } catch (e) {} })();
    const ap = AppState.addEventListener('change', (st) => { if (st === 'active') { fgSince.current = Date.now(); setTick((t) => t + 1); } });
    return () => { sub.remove(); ap.remove(); };
  }, []);
  useEffect(() => {
    if (!loaded) return undefined;
    const t = setTimeout(async () => {
      let co = null; try { co = JSON.parse((await AsyncStorage.getItem('coords')) || 'null'); } catch (e) {}
      await scheduleAll({ tasks, exams, settings, co, log: logRef.current, targets, reminders, loans });
    }, 3000);
    return () => clearTimeout(t);
  }, [loaded, tasks, exams, settings, log, tick, targets, profile, oneoffs, reminders, loans, offs]);
  const editMoney = (m) => saveMoney(money.map((x) => (x.id === m.id ? m : x)));
  const delMoney = (id) => saveMoney(money.filter((m) => m.id !== id));
  const addTask = (t) => saveTasks([...tasks, t]);
  const delTask = (id) => saveTasks(tasks.filter((t) => t.id !== id));
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { if (showSet) { setShowSet(false); return true; } if (tab !== 0) { setTab(0); return true; } return false; });
    return () => h.remove();
  }, [showSet, tab]);
  const s = mk(c);
  if (loaded && (!(profile && profile.done) || setup)) return <Setup c={c} settings={settings} initial={PROF} rerun={!!(profile && profile.done)} onFinish={finishSetup} onCancel={() => setSetup(false)} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: ins.top || StatusBar.currentHeight || 44 }}>
      <StatusBar barStyle={c === LIGHT ? 'dark-content' : 'light-content'} />
      {quick ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 50, backgroundColor: '#000c', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <FadeIn y={18} dur={260} style={{ backgroundColor: c.card, borderRadius: 22, padding: 26, alignItems: 'center', maxWidth: 320 }}>
            <Ionicons name="checkmark-circle" size={54} color={CYAN} />
            <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>{quick}</Text>
          </FadeIn>
        </View>
      ) : null}
      <FadeIn key={tab} style={{ flex: 1 }} y={0} dur={180}>
        {tab === 0 ? <Plan c={c} log={log} mark={mark} tasks={tasks} exams={exams} bump={() => setTick((t) => t + 1)} askAI={askAI} onSettings={() => setShowSet(true)} sched={schedApi} settings={settings} saveSet={saveSet} />
          : tab === 1 ? <GoalsHub c={c} targets={targets} saveTargets={saveTargets} askAI={askAI} tasks={tasks} log={log} mark={mark} addTask={addTask} editTask={editTask} saveTasks={saveTasks} delTask={delTask} exams={exams} saveExams={saveExams} examOn={EXAM.on} settings={settings} saveSet={saveSet} projects={projects} saveProjects={saveProjects} reminders={reminders} saveReminders={saveReminders} notes={notes} saveNotes={saveNotes} offs={offs} saveOffs={saveOffs} askDay={(d) => askAI({ text: `Help me with ${iso(d)}: what is planned, what is due, and how to make that day work.`, day: iso(d) })} />
          : tab === 2 ? <GrowHub c={c} tasks={tasks} log={log} sessions={focusS} addSession={addSession} disc={disc} saveDisc={saveDisc} sleep={sleep} saveSleep={saveSleep} train={train} saveTrain={saveTrain} settings={settings} />
          : tab === 3 ? <Money c={c} money={money} cfg={mcfg} saveCfg={saveCfg} addMoney={addMoney} editMoney={editMoney} delMoney={delMoney} sav={sav} saveSav={saveSav} sgoals={sgoals} saveSgoals={saveSgoals} loans={loans} saveLoans={saveLoans} mtags={mtags} saveMtags={saveMtags} />
          : tab === 4 ? <Stats c={c} log={log} tasks={tasks} money={money} mcfg={mcfg} exams={exams} targets={targets} focus={focusS} disc={disc} sav={sav} sgoals={sgoals} loans={loans} mtags={mtags} sleep={sleep} train={train} projects={projects} sleepGoal={settings.sleepGoal || 8} />
          : <Assistant c={c} settings={settings} tasks={tasks} money={money} mcfg={mcfg} log={log} applyActions={applyActions} undo={undo} hasUndo={!!snap} goMe={() => setShowSet(true)} kb={kb} kbY={kbd.y} exams={exams} targets={targets} pending={pendingAI} clearPending={() => setPendingAI(null)} sav={sav} sgoals={sgoals} loans={loans} mtags={mtags} offs={offs} reminders={reminders} sleep={sleep} train={train} projects={projects} sleepGoal={settings.sleepGoal || 8} />}
      </FadeIn>
      <View style={[s.nav, { paddingBottom: Math.max(12, ins.bottom + 4) }, kb > 0 && { display: 'none' }]}>
        {TABS.map((t, i) => (
          <Pressable key={t[0]} onPress={() => setTab(i)} style={[s.navBtn, tab === i && { borderTopColor: VIOLET }]}>
            <Ionicons name={tab === i ? NAVICON[i] : NAVICON[i] + '-outline'} size={21} color={tab === i ? VIOLET : c.mute} />
            <Text style={{ fontSize: 10.5, marginTop: 2, color: tab === i ? c.ink : c.mute, fontWeight: tab === i ? '700' : '400' }}>{t[0]}</Text>
          </Pressable>
        ))}
      </View>
      {!showSet && tab !== 5 && kb === 0 && !setup ? <AskFab c={c} tabName={TABS[tab][0]} bottom={84 + ins.bottom} onAsk={(q) => askAI({ text: q, ctx: TABS[tab][0] })} /> : null}
      {showSet ? (
        <FadeIn y={14} dur={240} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40, backgroundColor: c.bg, paddingTop: ins.top || StatusBar.currentHeight || 44 }}>
          <View style={{ paddingHorizontal: 12, paddingTop: 6 }}>
            <Pressable onPress={() => setShowSet(false)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', padding: 6 }}><Ionicons name="chevron-back" size={22} color={c.ink} /><Text style={{ color: c.ink, fontWeight: '600', marginLeft: 2 }}>Back</Text></Pressable>
          </View>
          <Settings c={c} set={settings} saveSet={saveSet} resetAll={resetAll} exportData={exportData} restoreData={restoreData} bump={() => setTick((t) => t + 1)} rerun={() => { setShowSet(false); setSetup(true); }} routine={PROF.routine || []} delRoutine={delRoutine} resetParts={resetParts} offs={offs} saveOffs={saveOffs} />
        </FadeIn>
      ) : null}
    </View>
  );
}

const mk = (c) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  h1: { fontSize: 26, fontWeight: '800', color: c.ink },
  mute: { color: c.mute, fontSize: 13 },
  btn: { borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, minWidth: 130, alignItems: 'center' },
  hero: { backgroundColor: VIOLET, borderRadius: 20, padding: 18, marginTop: 8 },
  heroTag: { color: '#ffffffb3', fontSize: 12, letterSpacing: 1.2 },
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  track: { height: 6, backgroundColor: '#ffffff40', borderRadius: 3, marginVertical: 10, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: '#fff' },
  heroSub: { color: '#fff' },
  heroPill: { backgroundColor: '#ffffff30', borderRadius: 12, padding: 10, marginTop: 10 },
  heroPillT: { color: '#fff', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: c.card, borderRadius: 16, padding: 10, marginTop: 12, borderWidth: 1, borderColor: c.line },
  chip: { flex: 1, marginHorizontal: 2, paddingVertical: 8, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.line },
  day: { flex: 1, marginHorizontal: 2, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  tick: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pray: { borderWidth: 1, borderColor: AMBER, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  block: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 14, borderWidth: 1, borderColor: c.line, borderLeftWidth: 5, padding: 12, marginBottom: 8 },
  time: { width: 82, fontSize: 12, fontWeight: '600', color: c.ink },
  nav: { flexDirection: 'row', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: 14 },
  navBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderTopWidth: 3, borderTopColor: 'transparent' },
});

export default function Root() {
  const [ok, err] = useFonts({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold, Sora_700Bold });
  if (!ok && !err) return <View style={{ flex: 1, backgroundColor: '#0B1020' }} />;
  return <SafeAreaProvider><AppInner /></SafeAreaProvider>;
}
