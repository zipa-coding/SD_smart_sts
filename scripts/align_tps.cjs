const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../src/data/db.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

const studentsMap = {};
(db.students || []).forEach((s) => {
  studentsMap[s.id] = s;
});

// 1. Define canonical teacher-aligned Learning Objectives (TPs) per subject and grade
const tpTemplates = {
  "Do’a Harian dan Hadits": [
    // Kelas 1
    { id: "tp_doa_1_1", text: "Menghafal doa-doa harian dasar (sebelum makan, sesudah makan, sebelum tidur, bangun tidur, masuk & keluar kamar mandi) dengan lancar", kelas: "1" },
    { id: "tp_doa_1_2", text: "Menghafal hadits-hadits pilihan dasar tentang kebersihan, kasih sayang, dan senyum beserta artinya", kelas: "1" },
    { id: "tp_doa_1_3", text: "Membiasakan adab berdoa dan berzikir dengan tertib dan santun dalam keseharian", kelas: "1" },
    // Kelas 2
    { id: "tp_doa_2_1", text: "Menghafal doa harian (keluar/masuk rumah, berpakaian, bercermin, naik kendaraan) dengan benar dan tertib", kelas: "2" },
    { id: "tp_doa_2_2", text: "Menghafal hadits-hadits pilihan tentang adab makan, menuntut ilmu, dan keutamaan berbakti", kelas: "2" },
    { id: "tp_doa_2_3", text: "Mempraktikkan adab dan tata krama berdoa dengan khusyuk dalam aktivitas sehari-hari", kelas: "2" },
    // Kelas 3
    { id: "tp_doa_3_1", text: "Menghafal doa harian lanjutan (masuk masjid, keluar masjid, mendengar petir, turun hujan) dengan fasih", kelas: "3" },
    { id: "tp_doa_3_2", text: "Menghafal hadits-hadits pilihan tentang menjaga lisan, persaudaraan muslim, dan kejujuran beserta artinya", kelas: "3" },
    { id: "tp_doa_3_3", text: "Mengamalkan bacaan doa dan hadits dalam pembiasaan akhlak terpuji sehari-hari", kelas: "3" },
    // Kelas 4
    { id: "tp_doa_4_1", text: "Menghafal doa-doa setelah wudhu dan zikir sesudah sholat fardhu dengan tartil dan benar", kelas: "4" },
    { id: "tp_doa_4_2", text: "Menghafal hadits-hadits pilihan tentang silaturahmi, larangan marah, dan berbuat baik kepada tetangga", kelas: "4" },
    { id: "tp_doa_4_3", text: "Menunjukkan pemahaman makna hadits dan ketertiban adab berzikir dan berdoa", kelas: "4" },
    // Kelas 5
    { id: "tp_doa_5_1", text: "Menghafal doa safar, doa memohon keteguhan iman, dan doa keselamatan dunia akhirat dengan fasih", kelas: "5" },
    { id: "tp_doa_5_2", text: "Menghafal hadits pilihan tentang keutamaan sedekah, amanah, dan niat (Innamal a'maalu bin niyyaat)", kelas: "5" },
    { id: "tp_doa_5_3", text: "Mengintegrasikan nilai hadits dan adab berdoa dalam perilaku serta keteladanan pribadi", kelas: "5" },
    // Kelas 6
    { id: "tp_doa_6_1", text: "Menghafal doa husnul khatimah, doa kafaratul majlis, dan doa memohon perlindungan dari fitnah dengan lancar", kelas: "6" },
    { id: "tp_doa_6_2", text: "Menghafal hadits pilihan tentang istiqomah, menahan amarah, dan kemuliaan akhlak beserta pemahamannya", kelas: "6" },
    { id: "tp_doa_6_3", text: "Mengamalkan doa-doa dan hadits secara mandiri dan istiqomah dalam kehidupan sehari-hari", kelas: "6" }
  ],
  "Tahfizh Al-Qur’an": [
    // Kelas 1
    { id: "tp_tahfizh_1_1", text: "Menghafal surat-surat pendek Juz 30 (QS. An-Naas sampai QS. Al-Fiil) secara mutqin dan lancar", kelas: "1" },
    { id: "tp_tahfizh_1_2", text: "Menerapkan makharijul huruf dan tajwid dasar dengan tepat dalam hafalan", kelas: "1" },
    { id: "tp_tahfizh_1_3", text: "Menjaga kelancaran hafalan melalui pembiasaan muroja'ah rutin dan tartil", kelas: "1" },
    // Kelas 2
    { id: "tp_tahfizh_2_1", text: "Menghafal surat-surat Juz 30 (QS. Al-Humazah sampai QS. Asy-Syams) dengan lancar dan baik", kelas: "2" },
    { id: "tp_tahfizh_2_2", text: "Menerapkan kaidah tajwid (ghunnah, mad thabi'i, dan qalqalah) dalam hafalan secara benar", kelas: "2" },
    { id: "tp_tahfizh_2_3", text: "Muroja'ah hafalan secara istiqomah dan mandiri baik di sekolah maupun di rumah", kelas: "2" },
    // Kelas 3
    { id: "tp_tahfizh_3_1", text: "Menghafal surat-surat Juz 30 (QS. Al-Balad sampai QS. An-Naba) tuntas dengan baik", kelas: "3" },
    { id: "tp_tahfizh_3_2", text: "Menerapkan kaidah tajwid dan makharijul huruf yang teliti dan tartil saat melantunkan hafalan", kelas: "3" },
    { id: "tp_tahfizh_3_3", text: "Memperkuat kelancaran hafalan Juz 30 melalui muroja'ah berulang secara disiplin", kelas: "3" },
    // Kelas 4
    { id: "tp_tahfizh_4_1", text: "Menghafal surat-surat pilihan Juz 29 / lanjutan Juz 30 sesuai target pembelajaran dengan lancar", kelas: "4" },
    { id: "tp_tahfizh_4_2", text: "Memperhatikan kesempurnaan bacaan tajwid, panjang-pendek, dan kejelasan harakat", kelas: "4" },
    { id: "tp_tahfizh_4_3", text: "Memelihara hafalan dengan muroja'ah berkala agar tidak mudah lupa", kelas: "4" },
    // Kelas 5
    { id: "tp_tahfizh_5_1", text: "Menghafal surat-surat pilihan Juz 29 (QS. Al-Mulk sampai QS. Al-Mursalat) secara mutqin", kelas: "5" },
    { id: "tp_tahfizh_5_2", text: "Menerapkan hukum-hukum tajwid lanjutan (ikhfa, idgham, mad wajib/jaiz) dengan fasih", kelas: "5" },
    { id: "tp_tahfizh_5_3", text: "Meningkatkan kualitas sima'an dan muroja'ah mandiri secara konsisten", kelas: "5" },
    // Kelas 6
    { id: "tp_tahfizh_6_1", text: "Menuntaskan dan memperkokoh hafalan Juz 30 dan Juz 29 secara menyeluruh dan lancar", kelas: "6" },
    { id: "tp_tahfizh_6_2", text: "Membaca dan melantunkan hafalan dengan standar tajwid, fashahah, dan adab tilawah yang baik", kelas: "6" },
    { id: "tp_tahfizh_6_3", text: "Melakukan muroja'ah berulang secara disiplin untuk menjaga hafalan tetap mutqin", kelas: "6" }
  ],
  "Tahsin ABaTaTsa": [
    // Kelas 1
    { id: "tp_tahsin_1_1", text: "Mengenal dan melafalkan huruf hijaiyah tunggal dan bersambung dengan makhraj yang benar", kelas: "1" },
    { id: "tp_tahsin_1_2", text: "Membaca jilid ABaTaTsa sesuai tingkatan halaman dengan artikulasi yang jelas dan tepat", kelas: "1" },
    { id: "tp_tahsin_1_3", text: "Membiasakan membaca perlahan, teliti, dan mengikuti bimbingan talaqqi dengan tertib", kelas: "1" },
    // Kelas 2
    { id: "tp_tahsin_2_1", text: "Membaca jilid ABaTaTsa / tilawah dengan memperhatikan perbedaan makhraj dan sifat huruf", kelas: "2" },
    { id: "tp_tahsin_2_2", text: "Membedakan dan mempraktikkan bacaan panjang (mad) dan pendek dengan benar", kelas: "2" },
    { id: "tp_tahsin_2_3", text: "Membaca secara tartil dan bersemangat mengikuti proses pembelajaran tilawah", kelas: "2" },
    // Kelas 3
    { id: "tp_tahsin_3_1", text: "Membaca jilid lanjutan / Al-Qur'an dengan penerapan makharijul huruf yang fasih", kelas: "3" },
    { id: "tp_tahsin_3_2", text: "Menerapkan hukum tajwid (nun sukun, tanwin, mim sukun, dan ghunnah) secara cermat", kelas: "3" },
    { id: "tp_tahsin_3_3", text: "Menjaga ketelitian dan adab tilawah membaca Al-Qur'an secara tartil", kelas: "3" },
    // Kelas 4
    { id: "tp_tahsin_4_1", text: "Membaca ayat-ayat Al-Qur'an dengan pengucapan makhraj dan sifat huruf yang tepat dan lancar", kelas: "4" },
    { id: "tp_tahsin_4_2", text: "Menerapkan kaidah tajwid, hukum mad, dan tanda waqaf secara benar saat membaca", kelas: "4" },
    { id: "tp_tahsin_4_3", text: "Meningkatkan kelancaran dan ketenangan tilawah secara mandiri dan disiplin", kelas: "4" },
    // Kelas 5
    { id: "tp_tahsin_5_1", text: "Membaca Al-Qur'an dengan fashahah, tartil, dan kesesuaian hukum tajwid yang baik", kelas: "5" },
    { id: "tp_tahsin_5_2", text: "Mengidentifikasi dan mempraktikkan hukum tajwid lanjutan serta waqaf wal ibtida' dengan tepat", kelas: "5" },
    { id: "tp_tahsin_5_3", text: "Menerapkan adab membaca Al-Qur'an dengan khusyuk, tenang, dan istiqomah", kelas: "5" },
    // Kelas 6
    { id: "tp_tahsin_6_1", text: "Membaca Al-Qur'an secara fasih, lancar, dan sesuai standar kaidah makharijul huruf", kelas: "6" },
    { id: "tp_tahsin_6_2", text: "Menerapkan seluruh hukum tajwid secara terpadu dan cermat dalam setiap tilawah", kelas: "6" },
    { id: "tp_tahsin_6_3", text: "Menunjukkan kemandirian membaca Al-Qur'an dengan tartil, indah, dan penuh penghayatan", kelas: "6" }
  ],
  "Wudhu dan Sholat": [
    // Kelas 1
    { id: "tp_wudhu_1_1", text: "Menghafal niat, urutan, dan rukun wudhu serta mempraktikkannya secara tertib dan sempurna", kelas: "1" },
    { id: "tp_wudhu_1_2", text: "Mempraktikkan gerakan dan bacaan sholat fardhu sesuai tuntunan dengan benar", kelas: "1" },
    { id: "tp_wudhu_1_3", text: "Membiasakan tertib, tenang, dan beradab saat melaksanakan sholat dan doa bersama", kelas: "1" },
    // Kelas 2
    { id: "tp_wudhu_2_1", text: "Mempraktikkan tata cara wudhu secara mandiri dengan membasuh anggota wudhu secara sempurna", kelas: "2" },
    { id: "tp_wudhu_2_2", text: "Melafalkan bacaan sholat (takbir, ruku', i'tidal, sujud, tasyahhud) dan mempraktikkan gerakannya secara runtut", kelas: "2" },
    { id: "tp_wudhu_2_3", text: "Menunjukkan sikap khusyuk dan pembiasaan sholat berjamaah dengan tertib", kelas: "2" },
    // Kelas 3
    { id: "tp_wudhu_3_1", text: "Menyempurnakan rukun dan sunnah wudhu (termasuk membasuh sela-sela jari dan tertib)", kelas: "3" },
    { id: "tp_wudhu_3_2", text: "Mempraktikkan sholat fardhu lima waktu beserta bacaan dzikir sesudah sholat dengan benar", kelas: "3" },
    { id: "tp_wudhu_3_3", text: "Menunjukkan pemahaman terhadap pembatal wudhu dan sholat serta menjaga kesucian diri", kelas: "3" },
    // Kelas 4
    { id: "tp_wudhu_4_1", text: "Mempraktikkan wudhu secara sempurna dengan memperhatikan sunnah dan doa setelah wudhu", kelas: "4" },
    { id: "tp_wudhu_4_2", text: "Mempraktikkan sholat fardhu dan sholat sunnah rawatib dengan gerakan dan tuma'ninah yang benar", kelas: "4" },
    { id: "tp_wudhu_4_3", text: "Membiasakan zikir dan doa sesudah sholat dengan penuh kesungguhan dan adab islami", kelas: "4" },
    // Kelas 5
    { id: "tp_wudhu_5_1", text: "Menyempurnakan tata cara bersuci (wudhu & tayamum) sesuai sunnah dengan teliti", kelas: "5" },
    { id: "tp_wudhu_5_2", text: "Mempraktikkan sholat fardhu, sholat jamak qashar saat safar, dan sholat sunnah dhuha secara tepat", kelas: "5" },
    { id: "tp_wudhu_5_3", text: "Menjaga kekhusyukan sholat serta istiqomah dalam pembiasaan ibadah harian", kelas: "5" },
    // Kelas 6
    { id: "tp_wudhu_6_1", text: "Mempraktikkan tata cara wudhu dan bersuci secara sempurna, bersih, dan sesuai sunnah Rasulullah SAW", kelas: "6" },
    { id: "tp_wudhu_6_2", text: "Mempraktikkan sholat fardhu, sholat jenazah, dan sujud sahwi/syukur dengan bacaan dan gerakan yang fasih", kelas: "6" },
    { id: "tp_wudhu_6_3", text: "Menjadikan sholat sebagai kebutuhan dan pembiasaan diri yang kokoh dalam kehidupan sehari-hari", kelas: "6" }
  ],
  "Sirah": [
    { id: "tp_sirah_1_1", text: "Mengenal silsilah, kelahiran, dan masa kanak-kanak Nabi Muhammad SAW yang penuh kejujuran (Al-Amin)", kelas: "1" },
    { id: "tp_sirah_1_2", text: "Meneladani sikap santun, jujur, dan berbakti kepada orang tua sebagaimana keteladanan Rasulullah SAW", kelas: "1" },
    { id: "tp_sirah_2_1", text: "Memahami masa remaja dan masa berdagang Nabi Muhammad SAW bersama para sahabat", kelas: "2" },
    { id: "tp_sirah_2_2", text: "Meneladani sikap amanah, mandiri, dan kerja keras dalam kehidupan sehari-hari", kelas: "2" },
    { id: "tp_sirah_3_1", text: "Memahami peristiwa turunnya wahyu pertama di Gua Hira dan dakwah awal Rasulullah SAW di Makkah", kelas: "3" },
    { id: "tp_sirah_3_2", text: "Meneladani kesabaran, keimanan, dan kegigihan Rasulullah SAW serta para sahabat awal (Khulafaur Rasyidin)", kelas: "3" },
    { id: "tp_sirah_4_1", text: "Memahami peristiwa Isra' Mi'raj dan perintah sholat lima waktu serta keteladanan para sahabat utama", kelas: "4" },
    { id: "tp_sirah_4_2", text: "Mengambil hikmah dan meneladani keteguhan akidah dalam menghadapi tantangan hidup", kelas: "4" },
    { id: "tp_sirah_5_1", text: "Memahami peristiwa Hijrah ke Madinah dan persaudaraan kaum Muhajirin serta Anshar", kelas: "5" },
    { id: "tp_sirah_5_2", text: "Meneladani nilai-nilai persatuan, toleransi, dan gotong royong dalam kehidupan bermasyarakat", kelas: "5" },
    { id: "tp_sirah_6_1", text: "Memahami peristiwa Fathu Makkah (Pembebasan Kota Makkah), Haji Wada', dan wafatnya Rasulullah SAW", kelas: "6" },
    { id: "tp_sirah_6_2", text: "Meneladani akhlak pemaaf, kepemimpinan bijaksana, dan meneladani sunnah Rasulullah SAW secara kaffah", kelas: "6" }
  ],
  "Sirah Nabawiyah": [],
  "Siroh": [],
  "PAI": [
    { id: "tp_pai_1_1", text: "Mengenal Rukun Iman, Rukun Islam, dan melafalkan Asmaul Husna dasar dengan benar", kelas: "1" },
    { id: "tp_pai_1_2", text: "Mempraktikkan sikap beriman, berkata jujur, dan menghormati guru serta orang tua", kelas: "1" },
    { id: "tp_pai_2_1", text: "Memahami makna Asmaul Husna pilihan dan kisah keteladanan para Nabi", kelas: "2" },
    { id: "tp_pai_2_2", text: "Membiasakan perilaku terpuji, tolong-menolong, dan hidup bersih dalam keseharian", kelas: "2" },
    { id: "tp_pai_3_1", text: "Memahami hukum bersuci, tata cara puasa Ramadhan, dan zikir harian", kelas: "3" },
    { id: "tp_pai_3_2", text: "Meneladani sifat ikhlas, pemaaf, dan peduli terhadap sesama", kelas: "3" },
    { id: "tp_pai_4_1", text: "Memahami makna iman kepada Kitab-Kitab Allah dan tanda-tanda kebesaran-Nya", kelas: "4" },
    { id: "tp_pai_4_2", text: "Menerapkan sikap santun, menghargai perbedaan, dan menghindari perilaku tercela", kelas: "4" },
    { id: "tp_pai_5_1", text: "Memahami makna iman kepada Hari Akhir dan zakat, infak, serta sedekah", kelas: "5" },
    { id: "tp_pai_5_2", text: "Menerapkan perilaku amanah, adil, dan peduli sosial dalam bermasyarakat", kelas: "5" },
    { id: "tp_pai_6_1", text: "Memahami makna iman kepada Qada dan Qadar serta keteladanan para Rasul Ulul Azmi", kelas: "6" },
    { id: "tp_pai_6_2", text: "Menunjukkan sikap optimis, tawakal, dan akhlak mulia sebagai pribadi muslim sejati", kelas: "6" }
  ],
  "Bahasa Indonesia": [
    { id: "tp_bind_1_1", text: "Mampu menyimak dan menceritakan kembali informasi sederhana dengan lafal dan intonasi yang jelas", kelas: "1" },
    { id: "tp_bind_1_2", text: "Mampu membaca dan menulis kata serta kalimat sederhana dengan benar dan rapi", kelas: "1" },
    { id: "tp_bind_2_1", text: "Mampu membaca teks pendek dengan lancar serta memahami pesan dan informasi di dalamnya", kelas: "2" },
    { id: "tp_bind_2_2", text: "Mampu menulis karangan sederhana dengan memperhatikan penggunaan huruf kapital dan tanda titik", kelas: "2" },
    { id: "tp_bind_3_1", text: "Mampu menemukan gagasan pokok dan informasi penting dari teks narasi maupun deskripsi", kelas: "3" },
    { id: "tp_bind_3_2", text: "Mampu menyusun kalimat efektif dan paragraf sederhana secara runtut dan padu", kelas: "3" },
    { id: "tp_bind_4_1", text: "Mampu mengidentifikasi ide pokok, ide pendukung, dan informasi visual dalam teks informatif", kelas: "4" },
    { id: "tp_bind_4_2", text: "Mampu menulis teks deskripsi dan laporan hasil pengamatan dengan kosakata baku", kelas: "4" },
    { id: "tp_bind_5_1", text: "Mampu menganalisis unsur intrinsik cerita dan membedakan kalimat fakta serta opini", kelas: "5" },
    { id: "tp_bind_5_2", text: "Mampu menulis teks eksplanasi dan teks narasi ekspresif secara runtut dan sistematis", kelas: "5" },
    { id: "tp_bind_6_1", text: "Mampu mengidentifikasi tokoh, alur, sudut pandang, dan amanat dalam karya sastra dengan tepat", kelas: "6" },
    { id: "tp_bind_6_2", text: "Mampu menyusun teks pidato, surat resmi/pribadi, dan formulir dengan struktur bahasa yang baik dan benar", kelas: "6" }
  ],
  "Matematika": [
    { id: "tp_mtk_1_1", text: "Mampu membilang, membaca, menulis, dan membandingkan bilangan cacah sampai 20", kelas: "1" },
    { id: "tp_mtk_1_2", text: "Mampu melakukan operasi penjumlahan dan pengurangan sederhana serta mengenal bangun datar dasar", kelas: "1" },
    { id: "tp_mtk_2_1", text: "Mampu menentukan nilai tempat dan melakukan penjumlahan serta pengurangan bilangan cacah sampai 100", kelas: "2" },
    { id: "tp_mtk_2_2", text: "Mampu mengenal pecahan sederhana (1/2, 1/3, 1/4) dan pengukuran panjang serta waktu", kelas: "2" },
    { id: "tp_mtk_3_1", text: "Mampu melakukan operasi hitung perkalian dan pembagian bilangan cacah dengan tepat", kelas: "3" },
    { id: "tp_mtk_3_2", text: "Mampu menghitung keliling dan luas bangun datar sederhana serta membaca data tabel", kelas: "3" },
    { id: "tp_mtk_4_1", text: "Mampu menyelesaikan operasi pecahan biasa dan desimal serta faktor dan kelipatan bilangan (KPK & FPB)", kelas: "4" },
    { id: "tp_mtk_4_2", text: "Mampu menghitung luas, keliling, dan sudut bangun datar dalam pemecahan masalah kontekstual", kelas: "4" },
    { id: "tp_mtk_5_1", text: "Mampu melakukan operasi hitung penjumlahan, pengurangan, perkalian, dan pembagian pecahan serta desimal", kelas: "5" },
    { id: "tp_mtk_5_2", text: "Mampu menghitung perbandingan kecepatan, debit, serta volume bangun ruang (kubus dan balok)", kelas: "5" },
    { id: "tp_mtk_6_1", text: "Mampu memahami dan menghitung operasi bilangan bulat negatif, lingkaran, serta bangun ruang gabungan", kelas: "6" },
    { id: "tp_mtk_6_2", text: "Mampu menganalisis dan menyajikan data statistik (mean, median, modus, dan diagram data)", kelas: "6" }
  ],
  "PPKN": [
    { id: "tp_ppkn_1_1", text: "Mengenal simbol-simbol sila Pancasila dan mempraktikkan aturan tata tertib di rumah dan sekolah", kelas: "1" },
    { id: "tp_ppkn_2_1", text: "Memahami hubungan simbol dengan sila-sila Pancasila serta menjaga kebersamaan dalam keberagaman", kelas: "2" },
    { id: "tp_ppkn_3_1", text: "Memahami hak dan kewajiban sebagai anggota keluarga serta warga sekolah", kelas: "3" },
    { id: "tp_ppkn_4_1", text: "Menerapkan nilai-nilai Pancasila dalam kehidupan sehari-hari dan menghargai keragaman suku bangsa", kelas: "4" },
    { id: "tp_ppkn_5_1", text: "Memahami pentingnya persatuan, kesatuan, norma hukum, dan hak kewajiban warga negara", kelas: "5" },
    { id: "tp_ppkn_6_1", text: "Menganalisis penerapan nilai-nilai Pancasila dalam konteks kehidupan berbangsa dan bernegara", kelas: "6" }
  ],
  "IPAS": [
    { id: "tp_ipas_3_1", text: "Memahami bagian tubuh tumbuhan dan hewan serta siklus hidup makhluk hidup di lingkungan sekitar", kelas: "3" },
    { id: "tp_ipas_4_1", text: "Memahami wujud zat dan perubahannya, gaya, serta energi dan transformasinya dalam kehidupan sehari-hari", kelas: "4" },
    { id: "tp_ipas_5_1", text: "Menganalisis sistem organ pernapasan, pencernaan, dan peredaran darah manusia serta ekosistem lingkungan", kelas: "5" },
    { id: "tp_ipas_6_1", text: "Memahami tata surya, rotasi dan revolusi bumi, serta pelestarian sumber daya alam dan energi alternatif", kelas: "6" }
  ],
  "IPA": [],
  "IPS": [],
  "PJOK": [
    { id: "tp_pjok_1_1", text: "Mempraktikkan gerak dasar lokomotor, non-lokomotor, dan manipulatif dengan koordinasi yang baik", kelas: "1" },
    { id: "tp_pjok_2_1", text: "Mempraktikkan variasi gerak dasar kebugaran jasmani dan menjaga kesehatan tubuh", kelas: "2" },
    { id: "tp_pjok_3_1", text: "Mempraktikkan kombinasi gerak dasar dalam permainan sederhana serta senam lantai", kelas: "3" },
    { id: "tp_pjok_4_1", text: "Mempraktikkan variasi pola gerak dasar permainan bola besar/kecil dan aktivitas air", kelas: "4" },
    { id: "tp_pjok_5_1", text: "Mempraktikkan teknik dasar atletik, permainan beregu, dan pemeliharaan organ reproduksi", kelas: "5" },
    { id: "tp_pjok_6_1", text: "Mempraktikkan rangkaian gerak olahraga beregu, senam irama, dan pembiasaan gaya hidup sehat", kelas: "6" }
  ],
  "Seni Budaya": [
    { id: "tp_seni_1_1", text: "Mengenal unsur seni rupa (garis, bentuk, warna) dan mengekspresikan karya kreatif sederhana", kelas: "1" },
    { id: "tp_seni_2_1", text: "Mengenal pola irama lagu anak dan membuat karya seni rupa dua/tiga dimensi", kelas: "2" },
    { id: "tp_seni_3_1", text: "Membuat karya seni dekoratif dan menyanyikan lagu dengan dinamika yang sesuai", kelas: "3" },
    { id: "tp_seni_4_1", text: "Membuat karya kriya, seni rupa montase/kolase, dan mengenal gerak tari daerah", kelas: "4" },
    { id: "tp_seni_5_1", text: "Membuat karya seni rupa rupa murni dan terapan serta mengapresiasi musik nusantara", kelas: "5" },
    { id: "tp_seni_6_1", text: "Membuat karya seni patung, batik sederhana, dan menampilkan pementasan seni kreatif", kelas: "6" }
  ],
  "Prakarya": [],
  "Informatika": [],
  "TIK": [
    { id: "tp_tik_4_1", text: "Mengenal perangkat keras dan lunak komputer serta mengoperasikan aplikasi pengolah kata dasar", kelas: "4" },
    { id: "tp_tik_5_1", text: "Mengoperasikan aplikasi pengolah kata dan presentasi untuk menyajikan informasi sederhana", kelas: "5" },
    { id: "tp_tik_6_1", text: "Mengoperasikan perangkat komputer, internet sehat, dan aplikasi pengolah angka secara bertanggung jawab", kelas: "6" }
  ],
  "Life Skill": [
    { id: "tp_life_1_1", text: "Membiasakan kemandirian merapikan perlengkapan sekolah dan menjaga kebersihan diri", kelas: "1" },
    { id: "tp_life_2_1", text: "Mempraktikkan keterampilan dasar merawat barang pribadi dan bekerja sama dalam tugas rumah", kelas: "2" },
    { id: "tp_life_3_1", text: "Menerapkan keterampilan hidup mandiri, tata tertib, dan kepedulian terhadap lingkungan sekitar", kelas: "3" }
  ],
  "Life skill": [],
  "Bahasa Inggris": [
    { id: "tp_bing_1_1", text: "Mampu mengenal dan melafalkan kosakata dasar (greetings, numbers, colors, family) dalam bahasa Inggris", kelas: "1" },
    { id: "tp_bing_2_1", text: "Mampu merespons instruksi sederhana dan menyebutkan nama-nama benda di lingkungan sekitar", kelas: "2" },
    { id: "tp_bing_3_1", text: "Mampu mengekspresikan percakapan pendek tentang daily activities dan kesukaan (likes/dislikes)", kelas: "3" },
    { id: "tp_bing_4_1", text: "Mampu memahami teks bacaan pendek dan menulis kalimat sederhana tentang hobi dan lingkungan", kelas: "4" },
    { id: "tp_bing_5_1", text: "Mampu berkomunikasi secara lisan dan tertulis mengenai kegiatan sehari-hari (simple present tense)", kelas: "5" },
    { id: "tp_bing_6_1", text: "Mampu memahami dan menyusun teks deskriptif serta narasi pendek dengan tata bahasa yang baik", kelas: "6" }
  ],
  "Bahasa Arab": [
    { id: "tp_barab_1_1", text: "Mengenal dan melafalkan kosa kata dasar bahasa Arab (perkenalan, anggota tubuh, warna) dengan fasih", kelas: "1" },
    { id: "tp_barab_2_1", text: "Menyebutkan kosa kata peralatan sekolah, keluarga, dan lingkungan sekitar dalam bahasa Arab", kelas: "2" },
    { id: "tp_barab_3_1", text: "Mampu merespons sapaan dan menyusun frasa pendek bahasa Arab sederhana", kelas: "3" },
    { id: "tp_barab_4_1", text: "Membaca dan memahami teks dialog sederhana tentang kegiatan di sekolah dan di rumah", kelas: "4" },
    { id: "tp_barab_5_1", text: "Menyusun kalimat sederhana menggunakan dhomir (kata ganti) dan kata kerja dasar", kelas: "5" },
    { id: "tp_barab_6_1", text: "Membaca teks narasi pendek dan memahami tata bahasa Arab dasar secara tepat", kelas: "6" }
  ]
};

// Mirror alias keys
tpTemplates["Sirah Nabawiyah"] = tpTemplates["Sirah"];
tpTemplates["Siroh"] = tpTemplates["Sirah"];
tpTemplates["Life skill"] = tpTemplates["Life Skill"];

db.tujuan_pembelajaran_templates = tpTemplates;

// 2. Adjust TP achievements for every student grade based on the teacher description (deskripsi)
let adjustedGradesCount = 0;
let tpAssignedCount = 0;

(db.grades || []).forEach((grade) => {
  const student = studentsMap[grade.studentId];
  if (!student) return;

  const kelas = String(student.kelas || "1").trim();
  const subject = grade.subject || "PAI";
  const desc = (grade.deskripsi || "").toLowerCase();

  // Find matching templates for this subject & class
  let matchingTemplates = (tpTemplates[subject] || []).filter(
    (t) => String(t.kelas).trim() === kelas
  );

  if (matchingTemplates.length === 0) {
    // Try aliases
    if (subject.includes("Sirah") || subject.includes("Siroh")) {
      matchingTemplates = (tpTemplates["Sirah"] || []).filter(
        (t) => String(t.kelas).trim() === kelas
      );
    } else if (subject.toLowerCase().includes("life skill")) {
      matchingTemplates = (tpTemplates["Life Skill"] || []).filter(
        (t) => String(t.kelas).trim() === kelas
      );
    }
  }

  if (matchingTemplates.length === 0) return;

  // Build adjusted TP items based on teacher description and score
  const tpsForGrade = matchingTemplates.map((template, idx) => {
    let achieved = true; // default achieved (optimal)

    // Evaluate based on subject and specific keywords in teacher description
    if (subject === "Do’a Harian dan Hadits") {
      if (idx === 0) {
        // TP 1: Doa harian
        if (
          desc.includes("belum hafal doa") ||
          desc.includes("hafalan doa masih") ||
          desc.includes("perlu memperkuat hafalan") ||
          (desc.includes("namun") && desc.includes("muroja") && grade.capaian === "C")
        ) {
          achieved = false;
        }
      } else if (idx === 1) {
        // TP 2: Hadits
        if (
          desc.includes("belum hafal hadits") ||
          desc.includes("hadits masih") ||
          desc.includes("masih harus diperbaiki") ||
          desc.includes("perlu didampingi") ||
          (grade.capaian === "C" && grade.score < 78)
        ) {
          achieved = false;
        }
      } else if (idx === 2) {
        // TP 3: Adab & Ketertiban
        if (
          desc.includes("kurangi hal-hal yang tidak bermanfaat") ||
          desc.includes("fokus") ||
          desc.includes("belum tertib") ||
          desc.includes("adab") && desc.includes("perlu")
        ) {
          achieved = false;
        }
      }
    } else if (subject === "Tahfizh Al-Qur’an") {
      if (idx === 0) {
        // TP 1: Hafalan Surat / Target
        if (
          desc.includes("belum mencapai target") ||
          desc.includes("hafalan masih sedikit") ||
          (grade.score < 75 && grade.capaian === "C")
        ) {
          achieved = false;
        }
      } else if (idx === 1) {
        // TP 2: Tajwid & Makhraj
        if (
          desc.includes("tajwid") && (desc.includes("perlu") || desc.includes("diperbaiki") || desc.includes("belum")) ||
          desc.includes("makhroj") ||
          desc.includes("panjang pendek") ||
          desc.includes("fashahah")
        ) {
          achieved = false;
        }
      } else if (idx === 2) {
        // TP 3: Murojaah & Kelancaran
        if (
          desc.includes("muroja’ah berulang") ||
          desc.includes("murojaah") ||
          desc.includes("harus diperkuat") ||
          desc.includes("sering lupa") ||
          desc.includes("butuh bimbingan")
        ) {
          achieved = false;
        }
      }
    } else if (subject === "Tahsin ABaTaTsa") {
      if (idx === 0) {
        // TP 1: Makhraj & Sifat Huruf
        if (
          desc.includes("makhroj") ||
          desc.includes("sifat huruf") ||
          desc.includes("pelafalan") ||
          desc.includes("makharijul") ||
          desc.includes("mengenal huruf") && desc.includes("perlu")
        ) {
          achieved = false;
        }
      } else if (idx === 1) {
        // TP 2: Tajwid & Panjang Pendek
        if (
          desc.includes("tajwid") ||
          desc.includes("panjang pendek") ||
          desc.includes("mad") ||
          desc.includes("hukum tajwid") ||
          (desc.includes("harus di tingkatkan") && grade.capaian !== "A")
        ) {
          achieved = false;
        }
      } else if (idx === 2) {
        // TP 3: Tartil & Ketenangan
        if (
          desc.includes("perlahan") ||
          desc.includes("teliti") ||
          desc.includes("terburu-buru") ||
          desc.includes("fokus") ||
          desc.includes("pendampingan yang sabar")
        ) {
          achieved = false;
        }
      }
    } else if (subject === "Wudhu dan Sholat") {
      if (idx === 0) {
        // TP 1: Wudhu
        if (
          desc.includes("wudhu") && (desc.includes("belum") || desc.includes("tidak menyempurnakan") || desc.includes("harus diperbaiki") || desc.includes("sela jari") || desc.includes("mata kaki"))
        ) {
          achieved = false;
        }
      } else if (idx === 1) {
        // TP 2: Sholat
        if (
          desc.includes("sholat") && (desc.includes("ruku") || desc.includes("melengkung") || desc.includes("belum sempurna") || desc.includes("gerakan") || desc.includes("bacaan"))
        ) {
          achieved = false;
        }
      } else if (idx === 2) {
        // TP 3: Adab & Zikir
        if (
          desc.includes("zikir") && desc.includes("perlu") ||
          desc.includes("khusyuk") ||
          desc.includes("adab") && desc.includes("perlu diperbaiki") ||
          desc.includes("diawasi dan diingatkan")
        ) {
          achieved = false;
        }
      }
    } else {
      // General subjects
      if (grade.capaian === "C" || grade.score < 75) {
        if (idx === matchingTemplates.length - 1) achieved = false;
      }
    }

    return {
      id: template.id,
      text: template.text,
      achieved: achieved,
    };
  });

  grade.tps = tpsForGrade;
  adjustedGradesCount++;
  tpAssignedCount += tpsForGrade.length;
});

// Save updated db.json
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");

console.log(`Successfully aligned TP templates and student grades:`);
console.log(`- Total Subjects in TP Templates: ${Object.keys(db.tujuan_pembelajaran_templates).length}`);
console.log(`- Total Student Grades Adjusted: ${adjustedGradesCount}`);
console.log(`- Total TP Status Records Assigned: ${tpAssignedCount}`);
