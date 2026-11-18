// Arabic names for Bosta's area groups ("zones"). Bosta only sends zone names in English, and a
// customer looking for الهرم or فيصل types the group's name, not the small area inside it.
export const ZONES_AR: Record<string, string> = {
  // Giza
  "6 October": "6 أكتوبر", "Abu ElNumros": "أبو النمرس", "Awsim": "أوسيم", "Bolak ElDakrour": "بولاق الدكرور",
  "Cairo Alex Desert Road": "طريق مصر إسكندرية الصحراوي", "Cairo University - Gamaet AlKahira": "جامعة القاهرة",
  "Dokki": "الدقي", "ElAyat": "العياط", "ElBadrashein": "البدرشين", "ElBahr ElAazam": "البحر الأعظم",
  "ElHaram": "الهرم", "ElHawamdeyah": "الحوامدية", "ElManawat": "المناوات", "ElMunib": "المنيب",
  "ElOmraniya": "العمرانية", "ElSaf": "الصف", "ElSheikh Zayed": "الشيخ زايد", "ElWarraq": "الوراق",
  "Faisal": "فيصل", "Gezirat ElDahab": "جزيرة الدهب", "Giza Square - Midan ElGiza": "ميدان الجيزة",
  "Hadabet ElAhram": "هضبة الأهرام", "Imbaba": "إمبابة", "Manyal Shihah": "منيل شيحة", "Mit Qadous": "ميت قادوس",
  "Mit Shammas": "ميت شماس", "Nazlet ElAshtar": "نزلة الأشطر", "Saft ElLaban": "صفط اللبن", "Saqiyet Mekki": "ساقية مكي",
  "Scouts Club Egypt": "نادي الكشافة", "Tamwah": "طموه",
  // Cairo
  "15 May": "15 مايو", "Abdeen": "عابدين", "Agouza": "العجوزة", "AlAtaba - El Mosky": "العتبة - الموسكي", "Azhar": "الأزهر",
  "Bab ElSharia": "باب الشعرية", "Badr City": "مدينة بدر", "Boulak Abu ElEila": "بولاق أبو العلا", "Daher": "الظاهر",
  "Ein Shams": "عين شمس", "ElAzbakeya": "الأزبكية", "ElBasatin": "البساتين", "ElDarb ElAhmar": "الدرب الأحمر",
  "ElGamaliya": "الجمالية", "ElKhalifa": "الخليفة", "ElMaadi": "المعادي", "ElMarg": "المرج", "ElMatareya": "المطرية",
  "ElMokattam": "المقطم", "ElNozha": "النزهة", "ElRehab": "الرحاب", "Elsahel": "الساحل", "ElSalam": "السلام",
  "ElSayeda Zainab": "السيدة زينب", "ElSharabiya": "الشرابية", "ElShorouk": "الشروق", "ElTahrir": "التحرير",
  "ElTibbin": "التبين", "ElWaili": "الوايلي", "ElZamalek": "الزمالك", "ElZawya ElHamra": "الزاوية الحمراء",
  "ElZeytoun": "الزيتون", "Gesr ElSuez": "جسر السويس", "Hadaiq ElQobbah": "حدائق القبة", "Helwan": "حلوان",
  "Ismailia Desert Road": "طريق الإسماعيلية الصحراوي", "Madinaty": "مدينتي", "Masaken Sheraton": "مساكن شيراتون",
  "Masr ElGedida": "مصر الجديدة", "Masr ElQadimah": "مصر القديمة", "Minshat Nasir": "منشأة ناصر", "Nasr City": "مدينة نصر",
  "New Cairo": "القاهرة الجديدة", "New Capital": "العاصمة الإدارية", "Obour": "العبور", "Qasr ElNile": "قصر النيل",
  "Rod El Farag": "روض الفرج", "Rod ElFarag": "روض الفرج", "Shobra Masr": "شبرا مصر", "Shoubra": "شبرا", "Tura": "طرة",
  "Zahraa ElMaadi": "زهراء المعادي",
  // Alexandria
  "Abu Yousef": "أبو يوسف", "Alex Cairo Desert Road": "طريق إسكندرية القاهرة الصحراوي", "Bab Sharqi": "باب شرقي",
  "Borg ElArab": "برج العرب", "ElAmaria": "العامرية", "ElAttarin": "العطارين", "ElDayra ElGomrokeyah": "الدائرة الجمركية",
  "ElDekhela": "الدخيلة", "ElGomrok": "الجمرك", "ElIbrahimeyah": "الإبراهيمية", "ElLabban": "اللبان", "ElMansheya": "المنشية",
  "ElMontazah": "المنتزه", "Karmouz": "كرموز", "Kilo 21": "الكيلو 21", "King Maryout": "كينج مريوط", "Mina ElBasal": "مينا البصل",
  "Moharram Bek": "محرم بك", "Qesm ElRaml": "قسم الرمل", "Sidi Gaber": "سيدي جابر",
};

export const zoneName = (zone: string | null | undefined, lang: string) =>
  !zone ? "" : lang === "ar" ? ZONES_AR[zone] || zone : zone;
