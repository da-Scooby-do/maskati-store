// Countries and their calling codes, for the WhatsApp number. Names come from the browser in her language (Intl.DisplayNames).
// Egypt first, then the Gulf and the Arab world, where most Maskati customers' family numbers are; everything else follows A–Z.
const FIRST = "EG:20 SA:966 AE:971 KW:965 QA:974 BH:973 OM:968 JO:962 LB:961 SD:249 LY:218 IQ:964 PS:970 SY:963 YE:967 MA:212 DZ:213 TN:216";
const REST =
  "AF:93 AL:355 AD:376 AO:244 AG:1 AR:54 AM:374 AU:61 AT:43 AZ:994 BS:1 BD:880 BB:1 BY:375 BE:32 BZ:501 BJ:229 BT:975 BO:591 BA:387 BW:267 " +
  "BR:55 BN:673 BG:359 BF:226 BI:257 KH:855 CM:237 CA:1 CV:238 CF:236 TD:235 CL:56 CN:86 CO:57 KM:269 CG:242 CD:243 CR:506 CI:225 HR:385 " +
  "CU:53 CY:357 CZ:420 DK:45 DJ:253 DM:1 DO:1 EC:593 SV:503 GQ:240 ER:291 EE:372 SZ:268 ET:251 FJ:679 FI:358 FR:33 GA:241 GM:220 GE:995 " +
  "DE:49 GH:233 GR:30 GD:1 GT:502 GN:224 GW:245 GY:592 HT:509 HN:504 HK:852 HU:36 IS:354 IN:91 ID:62 IR:98 IE:353 IT:39 JM:1 JP:81 KZ:7 " +
  "KE:254 KI:686 KG:996 LA:856 LV:371 LS:266 LR:231 LI:423 LT:370 LU:352 MO:853 MG:261 MW:265 MY:60 MV:960 ML:223 MT:356 MH:692 MR:222 " +
  "MU:230 MX:52 FM:691 MD:373 MC:377 MN:976 ME:382 MZ:258 MM:95 NA:264 NR:674 NP:977 NL:31 NZ:64 NI:505 NE:227 NG:234 KP:850 MK:389 NO:47 " +
  "PK:92 PW:680 PA:507 PG:675 PY:595 PE:51 PH:63 PL:48 PT:351 PR:1 RO:40 RU:7 RW:250 KN:1 LC:1 VC:1 WS:685 SM:378 ST:239 SN:221 RS:381 " +
  "SC:248 SL:232 SG:65 SK:421 SI:386 SB:677 SO:252 ZA:27 KR:82 SS:211 ES:34 LK:94 SR:597 SE:46 CH:41 TW:886 TJ:992 TZ:255 TH:66 TL:670 " +
  "TG:228 TO:676 TT:1 TR:90 TM:993 TV:688 UG:256 UA:380 GB:44 US:1 UY:598 UZ:998 VU:678 VE:58 VN:84 ZM:260 ZW:263";

export interface Country { iso: string; dial: string; name: string; other: string }

const parse = (s: string) => s.split(" ").map((p) => { const [iso, dial] = p.split(":"); return { iso, dial }; });
const first = parse(FIRST);
const rest = parse(REST);

const names = (lang: string) => {
  try { return new Intl.DisplayNames([lang], { type: "region" }); } catch { return null; }
};

/** Every country with its name in `lang` (and in the other language, so either can be searched). */
export function countries(lang: "ar" | "en"): Country[] {
  const here = names(lang), there = names(lang === "ar" ? "en" : "ar");
  const make = ({ iso, dial }: { iso: string; dial: string }) => ({ iso, dial, name: here?.of(iso) || iso, other: there?.of(iso) || iso });
  const sorted = rest.map(make).sort((a, b) => a.name.localeCompare(b.name, lang));
  return [...first.map(make), ...sorted];
}

/** The flag emoji for a two-letter country code. */
export const flagEmoji = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** Arabic-Indic digits to 0–9, everything else that isn't a digit dropped. */
export const onlyDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");

/** Egyptian mobile as she types or pastes it (010…, +20 10…, 0020…) → the 10 digits after +20. */
export function egyptNational(v: string) {
  let d = onlyDigits(v);
  if (d.startsWith("0020")) d = d.slice(4);
  else if (d.length > 10 && d.startsWith("20")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
}
export const isEgyptMobile = (national: string) => /^1[0125]\d{8}$/.test(national);

/** A stored number like "+971501234567" or "01012345678" → country and the rest of the number. */
export function splitInternational(stored: string | null | undefined): { iso: string; number: string } {
  const raw = String(stored || "").trim();
  if (!raw) return { iso: "EG", number: "" };
  const d = onlyDigits(raw);
  if (!raw.startsWith("+") && !raw.startsWith("00")) return { iso: "EG", number: egyptNational(d) };
  const intl = d.replace(/^00/, "");
  const all = [...first, ...rest].sort((a, b) => b.dial.length - a.dial.length);
  // shared codes (+1, +7) go to the most likely country
  const hit = intl.startsWith("1") ? { iso: "US", dial: "1" } : intl.startsWith("7") ? { iso: "RU", dial: "7" } : all.find((c) => intl.startsWith(c.dial));
  if (!hit) return { iso: "EG", number: intl };
  const number = intl.slice(hit.dial.length);
  return { iso: hit.iso, number: hit.iso === "EG" ? egyptNational(number) : number };
}

/** Country + number → "+<code><number>", dropping the trunk 0 people often type (050… in the UAE). */
export function joinInternational(iso: string, number: string) {
  const c = [...first, ...rest].find((x) => x.iso === iso) || first[0];
  const n = iso === "EG" ? egyptNational(number) : onlyDigits(number).replace(/^0+/, "");
  return { e164: `+${c.dial}${n}`, valid: iso === "EG" ? isEgyptMobile(n) : n.length >= 6 && (c.dial + n).length <= 15 && (c.dial + n).length >= 8 };
}

export const dialOf = (iso: string) => ([...first, ...rest].find((x) => x.iso === iso) || first[0]).dial;
