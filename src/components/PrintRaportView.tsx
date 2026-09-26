import React, { useState } from "react";
import { Student, Grade, WaliKelasNote, Teacher } from "../types";
import {
  Printer,
  FileDown,
  ArrowLeft,
  Sun,
  Moon,
  X,
  ExternalLink,
} from "lucide-react";
import SmpIslamSmartLogo from "./SmpIslamSmartLogo";
import logoUrl from "../assets/images/smp_logo_exact_match_revised_1783840969621.jpg";
import logoJsitUrl from "../assets/images/logo_jsit_indonesia_1783956323407.jpg";
import logoCahayaAmalUrl from "../assets/images/logo_cahaya_amal_1783956338475.jpg";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface PrintRaportViewProps {
  student: Student;
  grades: Grade[];
  waliKelasNote: WaliKelasNote;
  waliKelas: Teacher | null;
  onBack: () => void;
}

export default function PrintRaportView({
  student,
  grades,
  waliKelasNote,
  waliKelas,
  onBack,
}: PrintRaportViewProps) {
  // Lock to dark mode per user requirement
  const darkMode = true;

  // Dynamic state for Headmaster/Principal info & Raport format configurations
  const [principal, setPrincipal] = useState({
    name: "Ustadz H. Ir. Abdul Muhyi, M.Pd",
    nip: "19780512 200501 1 002",
  });

  const [format, setFormat] = useState({
    semesterName: "Ganjil",
    tahunPelajaran: "2026/2027",
    fontSize: "11pt",
    showLogo: false,
    showSpiritual: true,
    showSosial: true,
    showAttendance: true,
    showCatatan: true,
    fontFamily: "Times New Roman",
    paperSize: "A4",
    tanggalRaport: "17 Juni 2026",
    signaturePosition: "kanan" as "kanan" | "tengah" | "kiri",
    watermarkSize: 440,
    watermarkOpacity: 0.05,
  });

  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [base64Logos, setBase64Logos] = useState<{
    school: string;
    jsit: string;
    cahayaAmal: string;
  }>({
    school: "",
    jsit: "",
    cahayaAmal: "",
  });

  const convertUrlToBase64 = async (url: string): Promise<string> => {
    if (!url) return "";
    if (url.startsWith("data:")) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            resolve(url);
          }
        };
        reader.onerror = () => resolve(url);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  React.useEffect(() => {
    Promise.all([
      convertUrlToBase64(logoUrl),
      convertUrlToBase64(logoJsitUrl),
      convertUrlToBase64(logoCahayaAmalUrl),
    ]).then(([school, jsit, cahayaAmal]) => {
      setBase64Logos({ school, jsit, cahayaAmal });
    });
  }, []);

  React.useEffect(() => {
    setIsIframe(window.self !== window.top);
  }, []);

  React.useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAllSubjects(data);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.principalName && data.principalNip) {
          setPrincipal({
            name: data.principalName,
            nip: data.principalNip,
          });
        }
        if (data.format) {
          setFormat({
            semesterName: data.format.semesterName || "Ganjil",
            tahunPelajaran: data.format.tahunPelajaran || "2026/2027",
            fontSize: data.format.fontSize || "11pt",
            showLogo: !!data.format.showLogo,
            showSpiritual:
              data.format.showSpiritual !== undefined
                ? !!data.format.showSpiritual
                : true,
            showSosial:
              data.format.showSosial !== undefined
                ? !!data.format.showSosial
                : true,
            showAttendance:
              data.format.showAttendance !== undefined
                ? !!data.format.showAttendance
                : true,
            showCatatan:
              data.format.showCatatan !== undefined
                ? !!data.format.showCatatan
                : true,
            fontFamily: data.format.fontFamily || "Times New Roman",
            paperSize: data.format.paperSize || "A4",
            tanggalRaport: data.format.tanggalRaport || "17 Juni 2026",
            signaturePosition:
              (data.format.signaturePosition as "kanan" | "tengah" | "kiri") ||
              "kanan",
            watermarkSize:
              data.format.watermarkSize !== undefined
                ? Number(data.format.watermarkSize)
                : 440,
            watermarkOpacity:
              data.format.watermarkOpacity !== undefined
                ? Number(data.format.watermarkOpacity)
                : 0.05,
          });
        }
      })
      .catch((err) => console.error("Error loading principal settings:", err));
  }, []);

  // Categorized Subject lists in Kurikulum Merdeka preferred order
  const umumSubjects = [
    "PAI",
    "PPKN",
    "Bahasa Indonesia",
    "Matematika",
    "IPA",
    "IPS",
    "Bahasa Inggris",
    "PJOK",
    "Prakarya",
    "Informatika",
  ];

  const mulokSubjects = ["Bahasa Arab"];

  const keislamanSubjects = [
    "Tahsin ABaTaTsa",
    "Tahfizh Al-Qur’an",
    "Do’a Harian dan Hadits",
    "Wudhu dan Sholat",
  ];

  const activeUmum = React.useMemo(() => {
    if (allSubjects.length === 0) return umumSubjects;
    return allSubjects.filter(
      (s) => !mulokSubjects.includes(s) && !keislamanSubjects.includes(s)
    );
  }, [allSubjects]);

  const activeMulok = React.useMemo(() => {
    if (allSubjects.length === 0) return mulokSubjects;
    return mulokSubjects.filter((s) => allSubjects.includes(s));
  }, [allSubjects]);

  const activeKeislaman = React.useMemo(() => {
    if (allSubjects.length === 0) return keislamanSubjects;
    return keislamanSubjects.filter((s) => allSubjects.includes(s));
  }, [allSubjects]);

  // Helper with beautiful full human readable subject names
  const getOfficialSubjectName = (sub: string, index: number) => {
    const map: { [key: string]: string } = {
      PAI: "Pendidikan Agama Islam",
      PPKN: "Pendidikan Pancasila dan Kewarganegaraan",
      "Bahasa Indonesia": "Bahasa Indonesia",
      Matematika: "Matematika",
      IPA: "Ilmu Pengetahuan Alam",
      IPS: "Ilmu Pengetahuan Sosial",
      "Bahasa Inggris": "Bahasa Inggris",
      PJOK: "Pendidikan Jasmani Olahraga dan Kesehatan",
      Informatika: "Informatika",
      Prakarya: "Prakarya",
      "Bahasa Arab": "Bahasa Arab",
      "Tahsin ABaTaTsa": "Tahsin ABaTaTsa",
      "Tahfizh Al-Qur’an": "Tahfizh Al-Qur’an",
      "Do’a Harian dan Hadits": "Do’a Harian dan Hadits",
      "Wudhu dan Sholat": "Wudhu dan Sholat",
    };
    return `${index + 1}. ${map[sub] || sub}`;
  };

  const formatFaseKelas = (kelas: string) => {
    const k = String(kelas || "").trim();
    if (k === "1") return "A / I (Satu)";
    if (k === "2") return "A / II (Dua)";
    if (k === "3") return "B / III (Tiga)";
    if (k === "4") return "B / IV (Empat)";
    if (k === "5") return "C / V (Lima)";
    if (k === "6") return "C / VI (Enam)";
    if (k === "7") return "D / VII (Tujuh)";
    if (k === "8") return "D / VIII (Delapan)";
    if (k === "9") return "D / IX (Sembilan)";
    return `Fase SD / Kelas ${k}`;
  };

  const getSchoolName = (kelas: string) => {
    const k = String(kelas || "").trim().toUpperCase();
    if (
      k === "7" ||
      k === "8" ||
      k === "9" ||
      k.startsWith("VII") ||
      k.startsWith("VIII") ||
      k.startsWith("IX") ||
      k.includes("7") ||
      k.includes("8") ||
      k.includes("9") ||
      k.includes("VII") ||
      k.includes("VIII") ||
      k.includes("IX")
    ) {
      return "SMP ISLAM SMART PANGKAL PINANG";
    }
    return "SD ISLAM SMART PANGKAL PINANG";
  };

  const getEkskulGrades = (e: any) => {
    const pred = (e.predicate || e.capaian || "Baik").trim();
    let letter = "B";
    if (pred === "Sangat Baik" || pred === "A") letter = "A";
    else if (pred === "Baik" || pred === "B") letter = "B";
    else if (pred === "Cukup" || pred === "C") letter = "C";
    else if (pred === "Kurang" || pred === "D") letter = "D";

    if (letter === "A") {
      if (e.name.toLowerCase().includes("mentoring")) {
        return { usaha: "A", proses: "B", capaian: "B" };
      }
      if (
        e.name.toLowerCase().includes("voli") ||
        e.name.toLowerCase().includes("volly")
      ) {
        return { usaha: "A", proses: "A", capaian: "B" };
      }
      return { usaha: "A", proses: "B", capaian: "B" };
    }
    return { usaha: letter, proses: letter, capaian: letter };
  };

  // Generate automated narrative backup fallback if subject deskripsi is empty
  const generateDescription = (g: Grade | undefined) => {
    if (!g || !g.tps || !Array.isArray(g.tps) || g.tps.length === 0) {
      return "";
    }

    const name = student?.name ? student.name.trim() : "Siswa";
    const achieved = g.tps
      .filter((tp) => tp.achieved)
      .map((tp) => (tp.text || "").trim())
      .filter(Boolean);
    const needImprovement = g.tps
      .filter((tp) => !tp.achieved)
      .map((tp) => (tp.text || "").trim())
      .filter(Boolean);

    const joinItems = (items: string[]) => {
      const cleaned = items.map((i) => i.trim().replace(/\.+$/, ""));
      if (cleaned.length === 0) return "";
      if (cleaned.length === 1) return cleaned[0];
      if (cleaned.length === 2) return `${cleaned[0]} dan ${cleaned[1]}`;
      return `${cleaned.slice(0, -1).join(", ")}, dan ${cleaned[cleaned.length - 1]}`;
    };

    const sub = g.subject || "mata pelajaran ini";
    let desc = "";
    if (achieved.length > 0 && needImprovement.length === 0) {
      desc = `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Pertahankan prestasimu, teruslah bertumbuh dengan rendah hati, dan yakinlah setiap ikhtiar baikmu hari ini akan membuka pintu masa depan yang indah.`;
    } else if (achieved.length > 0 && needImprovement.length > 0) {
      desc = `Alhamdulillah, ananda ${name} dalam pembelajaran ${sub} menunjukkan penguasaan yang optimal dalam ${joinItems(achieved)}. Namun masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Tetaplah bersemangat, jangan pernah lelah untuk mencoba karena setiap proses belajarmu sangatlah berharga.`;
    } else if (needImprovement.length > 0) {
      desc = `Ananda ${name} dalam pembelajaran ${sub} masih memerlukan bimbingan dan pendampingan lebih lanjut dalam ${joinItems(needImprovement)}. Jangan berkecil hati, percayalah pada kemampuan dirimu; dengan kesabaran, doa, dan usaha yang tekun, ananda pasti mampu meraih hal yang lebih baik.`;
    }

    return desc.trim();
  };

  const getSubjectScore = (sub: string) => {
    const g = grades.find((x) => x.subject === sub);
    if (g && g.score !== undefined && g.score !== null) return g.score;
    return "";
  };

  const getSubjectUsaha = (sub: string) => {
    const g = grades.find((x) => x.subject === sub);
    if (g && g.usaha) return g.usaha;
    return "-";
  };

  const getSubjectProses = (sub: string) => {
    const g = grades.find((x) => x.subject === sub);
    if (g && g.proses) return g.proses;
    return "-";
  };

  const getSubjectCapaian = (sub: string) => {
    const g = grades.find((x) => x.subject === sub);
    if (g && g.capaian) return g.capaian;
    return "-";
  };

  const getSubjectDescription = (sub: string) => {
    const g = grades.find((x) => x.subject === sub);
    if (g) {
      if (g.deskripsi && g.deskripsi.trim() !== "") return g.deskripsi.trim();
      return generateDescription(g);
    }
    return "";
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);

    const getTransparentWatermarkBase64 = (
      dataUri: string,
      opacity: number,
    ): Promise<string> => {
      return new Promise((resolve) => {
        if (!dataUri) return resolve("");
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 600;
            canvas.height = 600;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, 600, 600);
              ctx.globalAlpha = opacity;

              const size = Math.min(img.width, img.height);
              const sx = (img.width - size) / 2;
              const sy = (img.height - size) / 2;

              ctx.drawImage(img, sx, sy, size, size, 0, 0, 600, 600);
              resolve(canvas.toDataURL("image/png"));
            } else {
              resolve("");
            }
          } catch {
            resolve("");
          }
        };
        img.onerror = () => {
          resolve("");
        };
        img.src = dataUri;
      });
    };

    let wrapper: HTMLDivElement | null = null;

    try {
      const isF4 = format.paperSize === "F4";
      const isA4 = !isF4;

      // Ensure base64 versions of logos are available so canvas is never tainted
      const schoolLogoSrc =
        base64Logos.school || (await convertUrlToBase64(logoUrl));
      const jsitLogoSrc =
        base64Logos.jsit || (await convertUrlToBase64(logoJsitUrl));
      const cahayaAmalLogoSrc =
        base64Logos.cahayaAmal || (await convertUrlToBase64(logoCahayaAmalUrl));

      const watermarkBase64 = await getTransparentWatermarkBase64(
        schoolLogoSrc,
        format.watermarkOpacity || 0.05,
      );

      // Wrapper placed in document flow (invisible, no events) ensuring accurate rendering & layout calculation
      wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.top = "0";
      wrapper.style.left = "0";
      wrapper.style.width = isA4 ? "720px" : "750px";
      wrapper.style.background = "#ffffff";
      wrapper.style.opacity = "0.01";
      wrapper.style.pointerEvents = "none";
      wrapper.style.zIndex = "-9999";

      const pdfContainer = document.createElement("div");
      pdfContainer.id = "pdf-container-root";
      pdfContainer.style.position = "relative";
      pdfContainer.style.width = isA4 ? "720px" : "750px";
      pdfContainer.style.background = "#ffffff";
      pdfContainer.style.padding = isA4 ? "4px 0px" : "5px 0px";
      pdfContainer.style.boxSizing = "border-box";

      // Dynamically adjusted template with tailored proportions for A4 vs F4
      const schoolName = getSchoolName(student.kelas);
      const pdfHtmlContent = `
        <style>
          .pdf-wrapper { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: ${isA4 ? "9.5pt" : "11pt"}; 
            line-height: ${isA4 ? "1.25" : "1.4"}; 
            color: #000000 !important; 
            background-color: #ffffff; 
            position: relative;
          }
          .pdf-wrapper * {
            color: #000000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pdf-meta-table { width: 100%; border: none; margin-bottom: ${isA4 ? "3px" : "5px"}; font-size: ${isA4 ? "9pt" : "10pt"}; border-collapse: collapse; margin-left: auto !important; margin-right: auto !important; }
          .pdf-meta-table td { padding: ${isA4 ? "0.5px 2px" : "1px 3px"}; vertical-align: middle; color: #000000 !important; }
          .pdf-box-table { width: 100%; border-collapse: collapse; margin-bottom: ${isA4 ? "2.5px" : "4.5px"}; border: 1.2px solid black; background-color: #ffffff; margin-left: auto !important; margin-right: auto !important; }
          .pdf-box-table td { border: 1px solid black; padding: ${isA4 ? "1px 3px" : "2px 4px"}; vertical-align: middle; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; color: #000000 !important; }
          .pdf-box-table td[style*="font-size: 8.5pt"] {
            vertical-align: top !important;
            padding-top: ${isA4 ? "1px" : "2px"} !important;
            padding-bottom: ${isA4 ? "2.5px" : "5px"} !important;
            font-size: ${isA4 ? "8pt" : "8.5pt"} !important;
          }
          .pdf-box-table tr:nth-child(2) td[style*="font-size: 9.5pt"]:not([style*="padding"]) {
            vertical-align: top !important;
            padding-top: ${isA4 ? "1px" : "2.5px"} !important;
            padding-bottom: ${isA4 ? "2.5px" : "5.5px"} !important;
            font-size: ${isA4 ? "8.5pt" : "9.5pt"} !important;
          }
          .pdf-heading { margin: ${isA4 ? "4.5px 0 1.5px 0" : "10px 0 5px 0"}; text-transform: uppercase; font-size: ${isA4 ? "8.75pt" : "9.5pt"}; font-weight: bold; color: #000000 !important; page-break-after: avoid !important; break-after: avoid !important; }
          .pdf-signature-table { width: 100% !important; border: none; margin-top: ${isA4 ? "4px" : "12px"}; border-collapse: collapse; margin-left: auto !important; margin-right: auto !important; table-layout: fixed !important; }
          .pdf-signature-table td { text-align: center; vertical-align: top; color: #000000 !important; }
        </style>
        <div class="pdf-wrapper">
          <div>
            ${
              format.showLogo
                ? `
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: ${isA4 ? "6px" : "15px"}; width: 100%; border-bottom: ${isA4 ? "2.5px" : "3px"} double #000000; padding-bottom: ${isA4 ? "6px" : "12px"};">
                <!-- Left Side: Yayasan Cahaya Amal and JSIT logos -->
                <div style="width: ${isA4 ? "110px" : "165px"}; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start; gap: ${isA4 ? "6px" : "10px"};">
                  <div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; background-color: #ffffff; box-sizing: border-box;">
                    <img src="${cahayaAmalLogoSrc}" style="width: 100%; height: 100%; object-fit: contain;" />
                  </div>
                  <div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; background-color: #ffffff; box-sizing: border-box;">
                    <img src="${jsitLogoSrc}" style="width: 100%; height: 100%; object-fit: contain;" />
                  </div>
                </div>
                <!-- Center: School name and report metadata -->
                <div style="text-align: center; flex-grow: 1; padding: 0 6px;">
                  <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "11pt" : "11.5pt"}; color: #000000; font-weight: bold; line-height: 1.25;">${schoolName}</h2>
                  <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "9.5pt" : "10pt"}; color: #000000; font-weight: bold; line-height: 1.25;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
                  <h4 style="margin: 2px 0; font-size: ${isA4 ? "9pt" : "9.5pt"}; color: #000000; font-weight: bold; line-height: 1.25;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
                  <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "8.5pt"}; font-weight: bold; color: #000000; line-height: 1.25;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
                </div>
                <!-- Right Side: School logo -->
                <div style="width: ${isA4 ? "110px" : "165px"}; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  <div style="width: ${isA4 ? "48px" : "75px"}; height: ${isA4 ? "48px" : "75px"}; display: flex; align-items: center; justify-content: center; border: 1.5px solid #cccccc; border-radius: 50%; overflow: hidden; background-color: #ffffff;">
                    <img src="${schoolLogoSrc}" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>
                </div>
              </div>
              `
                : `
              <div style="text-align: center; margin-bottom: ${isA4 ? "6px" : "15px"}; width: 100%; border-bottom: ${isA4 ? "2.5px" : "3px"} double #000000; padding-bottom: ${isA4 ? "6px" : "12px"};">
                <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "12pt" : "14pt"}; color: #000000; font-weight: bold;">${schoolName}</h2>
                <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "10.5pt" : "12pt"}; color: #000000; font-weight: bold;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
                <h4 style="margin: 2px 0; font-size: ${isA4 ? "9.5pt" : "11pt"}; color: #000000; font-weight: bold;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
                <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "9pt" : "10.5pt"}; font-weight: bold; color: #000000;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
              </div>
              `
            }

          <table class="pdf-meta-table">
            <tr>
              <td style="width: 15%; font-weight: normal;">Nama</td>
              <td style="width: 2%;">:</td>
              <td style="width: 35%; font-weight: bold;">${student.name}</td>
              <td style="width: 18%; font-weight: normal;">Fase/Kelas</td>
              <td style="width: 2%;">:</td>
              <td style="width: 28%; font-weight: bold;">${formatFaseKelas(student.kelas)}</td>
            </tr>
            <tr>
              <td style="font-weight: normal;">NISN/ NIS</td>
              <td>:</td>
              <td style="font-weight: bold;">${student.nisn}</td>
              <td style="font-weight: normal;">Semester</td>
              <td>:</td>
              <td style="font-weight: bold;">${format.semesterName || "Ganjil"}</td>
            </tr>
          </table>

          <h4 class="pdf-heading">A. Sikap</h4>
          
          <!-- Spiritual Aspect Table -->
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                1. Spiritual
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.spiritualUsaha || "-"}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.spiritualProses || "-"}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.spiritualCapaian || "-"}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${waliKelasNote.spiritualDeskripsi || ""}
              </td>
            </tr>
          </table>

          <!-- Sosial Aspect Table -->
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                2. Sosial
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Usaha
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Proses
              </td>
              <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.sosialUsaha || "-"}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.sosialProses || "-"}
              </td>
              <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                ${waliKelasNote.sosialCapaian || "-"}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                <strong>Deskripsi:</strong> ${waliKelasNote.sosialDeskripsi || ""}
              </td>
            </tr>
          </table>

          <h4 class="pdf-heading">B. Umum</h4>
          ${activeUmum
            .map((sub, idx) => {
              const title = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return `
              <table class="pdf-box-table" style="page-break-inside: avoid;">
                <tr>
                  <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                    ${title}
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Usaha
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Proses
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Capaian
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${usahaGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${prosesGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${capaianGrade}
                  </td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                    <strong>Deskripsi:</strong> ${desc}
                  </td>
                </tr>
              </table>
            `;
            })
            .join("")}

          <h4 class="pdf-heading">C. Muatan Lokal</h4>
          ${activeMulok
            .map((sub, idx) => {
              const title = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return `
              <table class="pdf-box-table" style="page-break-inside: avoid;">
                <tr>
                  <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                    ${title}
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Usaha
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Proses
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Capaian
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${usahaGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${prosesGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${capaianGrade}
                  </td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                    <strong>Deskripsi:</strong> ${desc}
                  </td>
                </tr>
              </table>
            `;
            })
            .join("")}

          <h4 class="pdf-heading">D. Keislaman</h4>
          ${activeKeislaman
            .map((sub, idx) => {
              const title = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return `
              <table class="pdf-box-table" style="page-break-inside: avoid;">
                <tr>
                  <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                    ${title}
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Usaha
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Proses
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Capaian
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${usahaGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${prosesGrade}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${capaianGrade}
                  </td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                    <strong>Deskripsi:</strong> ${desc}
                  </td>
                </tr>
              </table>
            `;
            })
            .join("")}

          <h4 class="pdf-heading">E. Ekstrakurikuler dan Keterampilan</h4>
          ${
            ((waliKelasNote as any).ekskul || []).length === 0
              ? `
            <table class="pdf-box-table" style="page-break-inside: avoid;">
              <tr>
                <td style="text-align: center; font-size: ${isA4 ? "8.5pt" : "10pt"}; padding: ${isA4 ? "3px 4px" : "5px"}; font-style: italic; color: #555;">
                  Tidak mengikuti kegiatan ekstrakurikuler.
                </td>
              </tr>
            </table>
          `
              : ((waliKelasNote as any).ekskul || [])
                  .map((e: any, idx: number) => {
                    const grades = getEkskulGrades(e);
                    return `
              <table class="pdf-box-table" style="page-break-inside: avoid;">
                <tr>
                  <td rowspan="2" style="width: 52%; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"}; vertical-align: middle;">
                    ${idx + 1}. Ekstrakurikuler ${e.type || "Pilihan"}: ${e.name}
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Usaha
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Proses
                  </td>
                  <td style="width: 16%; text-align: center; font-weight: bold; font-size: ${isA4 ? "8pt" : "8.5pt"}; background-color: #f2f2f2;">
                    Capaian
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${grades.usaha}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${grades.proses}
                  </td>
                  <td style="text-align: center; font-weight: bold; font-size: ${isA4 ? "9pt" : "9.5pt"};">
                    ${grades.capaian}
                  </td>
                </tr>
                <tr>
                  <td colspan="4" style="padding: ${isA4 ? "1.5px 3.5px 2px 3.5px" : "4px 6px 10px 6px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                    <strong>Deskripsi:</strong> ${e.description || e.deskripsi || "-"}
                  </td>
                </tr>
              </table>
            `;
                  })
                  .join("")
          }

          <h4 class="pdf-heading">F. Saran-Saran</h4>
          <table class="pdf-box-table" style="page-break-inside: avoid;">
            <tr>
              <td style="padding: ${isA4 ? "2.5px 4.5px 4px 4.5px" : "6px 8px 10px 8px"}; font-size: ${isA4 ? "8.25pt" : "9.5pt"}; text-align: justify; line-height: ${isA4 ? "1.22" : "1.45"};">
                ${waliKelasNote.catatan || ""}
              </td>
            </tr>
          </table>

          <!-- Indivisible Footer Block containing Kedisiplinan and Signatures -->
          <div class="pdf-footer-block" style="page-break-inside: avoid; break-inside: avoid;">
            <h4 class="pdf-heading" style="margin: ${isA4 ? "4.5px 0 1.5px 0" : "12px 0 6px 0"};">G. Kedisiplinan</h4>
            <table class="pdf-box-table" style="page-break-inside: avoid; text-align: center; border-collapse: collapse; width: 100%; margin-bottom: 0;">
              <tr style="background-color: transparent;">
                <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Sakit</td>
                <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Izin</td>
                <td style="font-weight: bold; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-family: 'Times New Roman', Times, serif; width: 33.3%; padding: ${isA4 ? "2px 2px" : "6px 4px"}; vertical-align: middle; text-align: center; line-height: 1.2; color: #000000 !important;">Tanpa Keterangan</td>
              </tr>
              <tr>
                <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.sakit && Number(waliKelasNote.sakit) > 0 ? `${waliKelasNote.sakit} Hari` : "- Hari"}</td>
                <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.izin && Number(waliKelasNote.izin) > 0 ? `${waliKelasNote.izin} Hari` : "- Hari"}</td>
                <td style="font-size: ${isA4 ? "8.5pt" : "9.5pt"}; text-align: center; vertical-align: middle; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: ${isA4 ? "2px 2px" : "6px 4px"}; line-height: 1.2; color: #000000 !important;">${waliKelasNote.alpa && Number(waliKelasNote.alpa) > 0 ? `${waliKelasNote.alpa} Hari` : "- Hari"}</td>
              </tr>
            </table>

            <table class="pdf-signature-table" style="page-break-inside: avoid; width: 100% !important; table-layout: fixed !important; border-collapse: collapse; margin-top: ${isA4 ? "5px" : "12px"};">
              <colgroup>
                <col style="width: 50%;" />
                <col style="width: 50%;" />
              </colgroup>
              <tr>
                <td style="width: 50%; padding-bottom: ${isA4 ? "3px" : "30px"}; text-align: center; vertical-align: top;">
                  <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0;">&nbsp;<br />Orang Tua/Wali Siswa</p>
                  <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">……………………………</p>
                </td>
                <td style="width: 50%; padding-bottom: ${isA4 ? "3px" : "30px"}; text-align: center; vertical-align: top;">
                  <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0;">Pangkal Pinang, ${format.tanggalRaport || "17 Juni 2026"}<br />Wali Kelas Kelas ${student.kelas}</p>
                  <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${waliKelas ? waliKelas.name : "……………………………"}</p>
                </td>
              </tr>
              ${
                format.signaturePosition === "kiri"
                  ? `
              <tr>
                <td style="width: 50%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
                  <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
                  <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
                  <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "9.5pt"}; color: #555;">NIP. ${principal.nip}</p>
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top;">&nbsp;</td>
              </tr>
              `
                  : format.signaturePosition === "tengah"
                  ? `
              <tr>
                <td colspan="2" style="width: 100%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
                  <div style="display: inline-block; text-align: center; margin: 0 auto;">
                    <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
                    <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
                    <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "9.5pt"}; color: #555;">NIP. ${principal.nip}</p>
                  </div>
                </td>
              </tr>
              `
                  : `
              <tr>
                <td style="width: 50%; text-align: center; vertical-align: top;">&nbsp;</td>
                <td style="width: 50%; text-align: center; padding-top: ${isA4 ? "2px" : "10px"}; vertical-align: top;">
                  <p style="margin: 0 0 ${isA4 ? "12px" : "40px"} 0; line-height: 1.3;">Mengetahui,<br />Kepala Sekolah</p>
                  <p style="margin: 0; font-weight: bold; font-size: ${isA4 ? "9.5pt" : "11pt"};">${principal.name}</p>
                  <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "9.5pt"}; color: #555;">NIP. ${principal.nip}</p>
                </td>
              </tr>
              `
              }
            </table>
          </div>
          </div>
        </div>
      `;

      pdfContainer.innerHTML = pdfHtmlContent;
      wrapper.appendChild(pdfContainer);
      document.body.appendChild(wrapper);

      // Ensure all images inside pdfContainer are loaded before capturing
      const images = Array.from(pdfContainer.querySelectorAll("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve(true);
          return new Promise((res) => {
            img.onload = () => res(true);
            img.onerror = () => res(false);
          });
        }),
      );

      // Brief pause to ensure typography & layout calculations are finalized
      await new Promise((res) => setTimeout(res, 80));

      // 2. Render container to a crisp canvas with allowTaint: false (pure untainted canvas!)
      const canvas = await html2canvas(pdfContainer, {
        scale: 2.0, // High-DPI resolution, super crisp
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: isA4 ? 720 : 750,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const stylesheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style');
          stylesheets.forEach((sheet) => {
            if (!sheet.closest('#pdf-container-root')) {
              sheet.remove();
            }
          });
        },
      });

      // 3. Setup PDF document matching the exact paper configuration
      const pageWidth = isF4 ? 215 : 210;
      const pageHeight = isF4 ? 330 : 297;

      const marginTop = isA4 ? 6 : 10;
      const marginBottom = isA4 ? 6 : 12;
      const marginLeft = isA4 ? 10 : 12;
      const marginRight = isA4 ? 10 : 12;

      const printWidth = pageWidth - marginLeft - marginRight;
      const printHeight = pageHeight - marginTop - marginBottom;

      // Calculate maximum canvas slice height in px per physical page
      const maxPageCanvasHeight = Math.floor(
        (printHeight / printWidth) * canvas.width,
      );

      // Smart page break detection: slice cleanly between discrete elements using getBoundingClientRect relative to pdfContainer
      const containerRect = pdfContainer.getBoundingClientRect();
      const scaleFactor = canvas.width / (pdfContainer.offsetWidth || (isA4 ? 720 : 750));
      const blockElements = Array.from(
        pdfContainer.querySelectorAll<HTMLElement>(
          ".pdf-box-table, .pdf-heading, .pdf-signature-table, .pdf-meta-table, .pdf-footer-block",
        ),
      );

      interface CutPoint {
        prevBottom: number;
        nextTop: number;
      }

      const cutPoints: CutPoint[] = [];

      for (let i = 1; i < blockElements.length; i++) {
        const prevEl = blockElements[i - 1];
        const nextEl = blockElements[i];

        // Never cut right after ANY heading
        if (prevEl.classList.contains("pdf-heading")) {
          continue;
        }

        // Never cut between elements inside the footer block (Kedisiplinan & Signatures)
        if (prevEl.closest(".pdf-footer-block") && nextEl.closest(".pdf-footer-block")) {
          continue;
        }

        const prevRect = prevEl.getBoundingClientRect();
        const nextRect = nextEl.getBoundingClientRect();

        const prevBottomCanvas = (prevRect.bottom - containerRect.top) * scaleFactor;
        const nextTopCanvas = (nextRect.top - containerRect.top) * scaleFactor;

        // Cut cleanly in the empty whitespace between elements (so no border is ever split or duplicated)
        const gapMid = (prevBottomCanvas + nextTopCanvas) / 2;
        const safeCut = Math.round(gapMid);

        cutPoints.push({
          prevBottom: safeCut,
          nextTop: safeCut,
        });
      }

      interface PageSlice {
        startY: number;
        endY: number;
      }

      const pageSlices: PageSlice[] = [];
      let currentStartY = 0;

      while (currentStartY < canvas.height) {
        const maxCanvasY = currentStartY + maxPageCanvasHeight;

        if (maxCanvasY >= canvas.height) {
          pageSlices.push({
            startY: currentStartY,
            endY: canvas.height,
          });
          break;
        }

        // Find the deepest cut point that fits within the current page limit
        let chosenCut: CutPoint | null = null;
        for (const cp of cutPoints) {
          if (cp.prevBottom > currentStartY + maxPageCanvasHeight * 0.3 && cp.prevBottom <= maxCanvasY) {
            chosenCut = cp;
          }
        }

        if (chosenCut) {
          pageSlices.push({
            startY: currentStartY,
            endY: chosenCut.prevBottom,
          });
          currentStartY = chosenCut.nextTop;
        } else {
          // Fallback if no cut point found
          pageSlices.push({
            startY: currentStartY,
            endY: maxCanvasY,
          });
          currentStartY = maxCanvasY;
        }
      }

      const totalPages = pageSlices.length;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: isF4 ? [215, 330] : "a4",
        compress: true,
      });

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) {
          pdf.addPage(isF4 ? [215, 330] : "a4", "portrait");
        }

        const startY = pageSlices[p].startY;
        const sliceHeight = pageSlices[p].endY - startY;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeight;

        const sliceCtx = sliceCanvas.getContext("2d");
        if (sliceCtx) {
          sliceCtx.fillStyle = "#ffffff";
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            startY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          );
        }

        const sliceImgHeightMm = (sliceHeight * printWidth) / canvas.width;

        // Draw Watermark centered on each page
        if (watermarkBase64) {
          const sizeInMm = isA4
            ? ((format.watermarkSize || 400) / 440) * 125
            : ((format.watermarkSize || 440) / 440) * 140;
          const wx = (pageWidth - sizeInMm) / 2;
          const wy = (pageHeight - sizeInMm) / 2;
          try {
            pdf.addImage(
              watermarkBase64,
              "PNG",
              wx,
              wy,
              sizeInMm,
              sizeInMm,
              undefined,
              "FAST",
            );
          } catch (wmErr) {
            console.warn("Watermark render skipped:", wmErr);
          }
        }

        // Draw Page Content Slice
        const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(
          sliceDataUrl,
          "JPEG",
          marginLeft,
          marginTop,
          printWidth,
          sliceImgHeightMm,
        );

        // Professional Page Numbering in Footer
        pdf.setFont("times", "normal");
        pdf.setFontSize(isA4 ? 8.5 : 9);
        pdf.setTextColor(80, 80, 80);
        pdf.text(
          `Halaman ${p + 1} dari ${totalPages}`,
          pageWidth - marginRight,
          pageHeight - (isA4 ? 4.5 : 6),
          { align: "right" },
        );
      }

      // Download file directly via Blob URL — exactly identical to Word (.doc) download!
      const fileName = `Raport_STS_${student.name.replace(/\s+/g, "_")}.pdf`;
      const pdfBlob = pdf.output("blob");
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 2000);
    } catch (err: any) {
      console.error("Gagal membuat berkas PDF rapor:", err);
      alert(
        "Terjadi kendala saat memproses berkas PDF: " +
          (err?.message || "Silakan coba beberapa saat lagi."),
      );
    } finally {
      if (wrapper && document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
      setIsDownloadingPDF(false);
    }
  };

  // Convert report card layout to Microsoft Word compatible .doc format
  const handleDownloadWord = () => {
    const isF4 = format.paperSize === "F4";
    const isA4 = !isF4;
    const title = `Raport_STS_${student.name.replace(/\s+/g, "_")}`;

    const makeAbsoluteUrl = (url: string) => {
      if (!url) return "";
      if (
        url.startsWith("data:") ||
        url.startsWith("http:") ||
        url.startsWith("https:")
      ) {
        return url;
      }
      return window.location.origin + url;
    };

    const absLogoCahayaAmalUrl =
      base64Logos.cahayaAmal || makeAbsoluteUrl(logoCahayaAmalUrl);
    const absLogoJsitUrl =
      base64Logos.jsit || makeAbsoluteUrl(logoJsitUrl);
    const absLogoUrl =
      base64Logos.school || makeAbsoluteUrl(logoUrl);

    const wordSchoolName = getSchoolName(student.kelas);
    const htmlHeader = `
      <html xmlns:o='urn:schemas-microsoft-500-col:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Raport Sumatif Tengah Semester - ${wordSchoolName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
          </w:WordDocument>
        </xml>
        <![endif]-->
         <style>
          @page {
            size: ${isF4 ? "8.46in 12.99in" : "8.27in 11.69in"}; /* F4 or A4 size */
            margin: ${isF4 ? "0.5in 0.5in 0.5in 0.5in" : "0.35in 0.45in 0.35in 0.45in"};
          }
          body { font-family: 'Times New Roman', Times, serif; font-size: ${isF4 ? "11pt" : "9.5pt"}; line-height: ${isF4 ? "1.4" : "1.35"}; color: #000; }
        </style>
      </head>
      <body>
    `;

    const htmlBody = `
      ${
        format.showLogo
          ? `
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: ${isA4 ? "10px" : "15px"}; border-bottom: ${isA4 ? "2.5px" : "3.5px"} double #000000; margin-left: auto; margin-right: auto;">
          <tr>
            <!-- Left Side Logos -->
            <td style="width: 25%; text-align: left; vertical-align: middle; border: none; padding-bottom: ${isA4 ? "8px" : "12px"};">
              <img src="${absLogoCahayaAmalUrl}" style="width: ${isA4 ? "50px" : "55px"}; height: ${isA4 ? "50px" : "55px"}; display: inline-block; margin-right: 5px;" />
              <img src="${absLogoJsitUrl}" style="width: ${isA4 ? "50px" : "55px"}; height: ${isA4 ? "50px" : "55px"}; display: inline-block;" />
            </td>
            <!-- Center Title and Info -->
            <td style="width: 50%; text-align: center; vertical-align: middle; border: none; padding-bottom: ${isA4 ? "8px" : "12px"}; font-family: 'Times New Roman', Times, serif;">
              <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "11pt" : "11.5pt"}; font-weight: bold; color: #000000; line-height: 1.25;">${wordSchoolName}</h2>
              <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "9.5pt" : "10pt"}; font-weight: bold; color: #000000; line-height: 1.25;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
              <h4 style="margin: 2px 0; font-size: ${isA4 ? "9pt" : "9.5pt"}; font-weight: bold; color: #000000; line-height: 1.25;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
              <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8pt" : "8.5pt"}; font-weight: bold; color: #000000; line-height: 1.25;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
            </td>
            <!-- Right Side School Logo -->
            <td style="width: 25%; text-align: center; vertical-align: middle; border: none; padding-bottom: ${isA4 ? "8px" : "12px"};">
              <img src="${absLogoUrl}" style="width: ${isA4 ? "50px" : "55px"}; height: ${isA4 ? "50px" : "55px"}; display: inline-block; border: 1px solid #cccccc; border-radius: 50%;" />
            </td>
          </tr>
        </table>
        `
          : `
        <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: ${isA4 ? "10px" : "15px"}; border-bottom: ${isA4 ? "2.5px" : "3.5px"} double #000000; margin-left: auto; margin-right: auto;">
          <tr>
            <td style="width: 100%; text-align: center; vertical-align: middle; border: none; padding-bottom: ${isA4 ? "8px" : "12px"}; font-family: 'Times New Roman', Times, serif;">
              <h2 style="margin: 0; text-transform: uppercase; font-size: ${isA4 ? "12.5pt" : "13.5pt"}; font-weight: bold; color: #000000;">${wordSchoolName}</h2>
              <h3 style="margin: 2px 0; text-transform: uppercase; font-size: ${isA4 ? "10.5pt" : "11.5pt"}; font-weight: bold; color: #000000;">LAPORAN SUMATIF TENGAH SEMESTER (STS)</h3>
              <h4 style="margin: 2px 0; font-size: ${isA4 ? "9.5pt" : "10.5pt"}; font-weight: bold; color: #000000;">SEMESTER ${format.semesterName ? format.semesterName.toUpperCase() : "GANJIL"}</h4>
              <p style="margin: 1.5px 0 0 0; font-size: ${isA4 ? "8.5pt" : "9.5pt"}; font-weight: bold; color: #000000;">TAHUN PELAJARAN ${format.tahunPelajaran || "2026-2027"}</p>
            </td>
          </tr>
        </table>
        `
      }

      <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 12px; font-family: 'Times New Roman', Times, serif; font-size: 10pt; margin-left: auto; margin-right: auto;">
        <tr>
          <td style="width: 15%; padding: 2px 4px; vertical-align: middle; border: none; font-weight: normal; color: #000000;">Nama</td>
          <td style="width: 2%; padding: 2px 4px; vertical-align: middle; border: none; color: #000000;">:</td>
          <td style="width: 35%; padding: 2px 4px; vertical-align: middle; border: none; font-weight: bold; color: #000000;">${student.name}</td>
          <td style="width: 18%; padding: 2px 4px; vertical-align: middle; border: none; font-weight: normal; color: #000000;">Fase/Kelas</td>
          <td style="width: 2%; padding: 2px 4px; vertical-align: middle; border: none; color: #000000;">:</td>
          <td style="width: 28%; padding: 2px 4px; vertical-align: middle; border: none; font-weight: bold; color: #000000;">${formatFaseKelas(student.kelas)}</td>
        </tr>
        <tr>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; font-weight: normal; color: #000000;">NISN/ NIS</td>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; color: #000000;">:</td>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; font-weight: bold; color: #000000;">${student.nisn}</td>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; font-weight: normal; color: #000000;">Semester</td>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; color: #000000;">:</td>
          <td style="padding: 2px 4px; vertical-align: middle; border: none; font-weight: bold; color: #000000;">${format.semesterName || "Ganjil"}</td>
        </tr>
      </table>

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">A. Sikap</h4>
      
      <!-- Spiritual Aspect Table -->
      <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
        <tr>
          <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
            1. Spiritual
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Usaha
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Proses
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Capaian
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.spiritualUsaha || "-"}
          </td>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.spiritualProses || "-"}
          </td>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.spiritualCapaian || "-"}
          </td>
        </tr>
        <tr>
          <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
            <strong>Deskripsi:</strong> ${waliKelasNote.spiritualDeskripsi || ""}
          </td>
        </tr>
      </table>
 
      <!-- Sosial Aspect Table -->
      <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
        <tr>
          <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
            2. Sosial
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Usaha
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Proses
          </td>
          <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
            Capaian
          </td>
        </tr>
        <tr>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.sosialUsaha || "-"}
          </td>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.sosialProses || "-"}
          </td>
          <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
            ${waliKelasNote.sosialCapaian || "-"}
          </td>
        </tr>
        <tr>
          <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
            <strong>Deskripsi:</strong> ${waliKelasNote.sosialDeskripsi || ""}
          </td>
        </tr>
      </table>

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">B. Umum</h4>

      <!-- Subject specific boxed items -->
      ${activeUmum
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Usaha
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Proses
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${usahaGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${prosesGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">C. Muatan Lokal</h4>

      ${activeMulok
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Usaha
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Proses
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${usahaGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${prosesGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">D. Keislaman</h4>

      ${activeKeislaman
        .map((sub, idx) => {
          const title = getOfficialSubjectName(sub, idx);
          const usahaGrade = getSubjectUsaha(sub);
          const prosesGrade = getSubjectProses(sub);
          const capaianGrade = getSubjectCapaian(sub);
          const desc = getSubjectDescription(sub);

          return `
          <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
                ${title}
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Usaha
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Proses
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${usahaGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${prosesGrade}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${capaianGrade}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
                <strong>Deskripsi:</strong> ${desc}
              </td>
            </tr>
          </table>
        `;
        })
        .join("")}

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">E. Ekstrakurikuler dan Keterampilan</h4>
      ${
        ((waliKelasNote as any).ekskul || []).length === 0
          ? `
        <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
          <tr>
            <td style="border: 1px solid #000000; text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; padding: 6px; font-style: italic; color: #555555;">
              Tidak mengikuti kegiatan ekstrakurikuler.
            </td>
          </tr>
        </table>
      `
          : ((waliKelasNote as any).ekskul || [])
              .map((e: any, idx: number) => {
                const grades = getEkskulGrades(e);
                return `
          <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
            <tr>
              <td rowspan="2" style="width: 52%; border: 1px solid #000000; padding: 4px 6.5px; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; color: #000000; vertical-align: middle;">
                ${idx + 1}. Ekstrakurikuler ${e.type || "Pilihan"}: ${e.name}
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Usaha
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Proses
              </td>
              <td style="width: 16%; border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 8.5pt; background-color: #f2f2f2; vertical-align: top; padding-top: 2px; padding-bottom: 5px; color: #000000;">
                Capaian
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${grades.usaha}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${grades.proses}
              </td>
              <td style="border: 1px solid #000000; text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; vertical-align: top; padding-top: 2.5px; padding-bottom: 5.5px; color: #000000;">
                ${grades.capaian}
              </td>
            </tr>
            <tr>
              <td colspan="4" style="border: 1px solid #000000; padding: 4px 6px 10px 6px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
                <strong>Deskripsi:</strong> ${e.description || e.deskripsi || "-"}
              </td>
            </tr>
          </table>
        `;
              })
              .join("")
      }

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">F. Saran-Saran</h4>
      <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
        <tr>
          <td style="border: 1px solid #000000; padding: 6px 8px 10px 8px; font-family: 'Times New Roman', Times, serif; font-size: 9.5pt; text-align: justify; line-height: 1.45; color: #000000;">
            ${waliKelasNote.catatan || ""}
          </td>
        </tr>
      </table>

      <h4 style="margin: 15px 0 10px 0; text-transform: uppercase; font-size: 9.5pt; font-family: 'Times New Roman', Times, serif; font-weight: bold; color: #000000;">G. Kedisiplinan</h4>
      <table border="1" cellspacing="0" cellpadding="4" style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.2px solid #000000; background-color: #ffffff; margin-left: auto; margin-right: auto; page-break-inside: avoid; text-align: center;">
        <tr style="background-color: transparent;">
          <td style="border: 1px solid #000000; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9pt; width: 33.3%; color: #000000; padding: 6px 4px; vertical-align: middle; text-align: center; line-height: 1.2;">Sakit</td>
          <td style="border: 1px solid #000000; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9pt; width: 33.3%; color: #000000; padding: 6px 4px; vertical-align: middle; text-align: center; line-height: 1.2;">Izin</td>
          <td style="border: 1px solid #000000; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 9pt; width: 33.3%; color: #000000; padding: 6px 4px; vertical-align: middle; text-align: center; line-height: 1.2;">Tanpa Keterangan</td>
        </tr>
        <tr>
          <td style="border: 1px solid #000000; font-size: 9.5pt; text-align: center; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: 6px 4px; vertical-align: middle; line-height: 1.2; color: #000000;">
            ${waliKelasNote.sakit && Number(waliKelasNote.sakit) > 0 ? `${waliKelasNote.sakit} Hari` : "- Hari"}
          </td>
          <td style="border: 1px solid #000000; font-size: 9.5pt; text-align: center; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: 6px 4px; vertical-align: middle; line-height: 1.2; color: #000000;">
            ${waliKelasNote.izin && Number(waliKelasNote.izin) > 0 ? `${waliKelasNote.izin} Hari` : "- Hari"}
          </td>
          <td style="border: 1px solid #000000; font-size: 9.5pt; text-align: center; font-weight: normal; font-family: 'Times New Roman', Times, serif; padding: 6px 4px; vertical-align: middle; line-height: 1.2; color: #000000;">
            ${waliKelasNote.alpa && Number(waliKelasNote.alpa) > 0 ? `${waliKelasNote.alpa} Hari` : "- Hari"}
          </td>
        </tr>
      </table>

      <br />

      <table style="width: 100%; border: none; margin-top: 25px; margin-left: auto; margin-right: auto; font-family: 'Times New Roman', Times, serif; border-collapse: collapse; table-layout: fixed;">
        <colgroup>
          <col style="width: 50%;" />
          <col style="width: 50%;" />
        </colgroup>
        <tr>
          <td style="width: 50%; padding-bottom: 50px; text-align: center; vertical-align: top; border: none; color: #000000;">
            <p style="margin: 0 0 50px 0; font-size: 11pt;">&nbsp;<br />Orang Tua/Wali Siswa</p>
            <p style="margin: 0; font-weight: bold; font-size: 11pt;">……………………………</p>
          </td>
          <td style="width: 50%; padding-bottom: 50px; text-align: center; vertical-align: top; border: none; color: #000000;">
            <p style="margin: 0 0 50px 0; font-size: 11pt;">Pangkal Pinang, ${format.tanggalRaport || "17 Juni 2026"}<br />Wali Kelas Kelas ${student.kelas}</p>
            <p style="margin: 0; font-weight: bold; font-size: 11pt;">${waliKelas ? waliKelas.name : "……………………………"}</p>
          </td>
        </tr>
        ${
          format.signaturePosition === "kiri"
            ? `
        <tr>
          <td style="width: 50%; text-align: center; padding-top: 15px; vertical-align: top; border: none; color: #000000;">
            <p style="margin: 0 0 50px 0; line-height: 1.3; font-size: 11pt;">Mengetahui,<br />Kepala Sekolah</p>
            <p style="margin: 0; font-weight: bold; font-size: 11pt;">${principal.name}</p>
            <p style="margin: 3px 0 0 0; font-size: 9.5pt; color: #555555;">NIP. ${principal.nip}</p>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none; color: #000000;">&nbsp;</td>
        </tr>
        `
            : format.signaturePosition === "tengah"
            ? `
        <tr>
          <td colspan="2" style="width: 100%; text-align: center; padding-top: 15px; vertical-align: top; border: none; color: #000000;">
            <p style="margin: 0 0 50px 0; line-height: 1.3; font-size: 11pt;">Mengetahui,<br />Kepala Sekolah</p>
            <p style="margin: 0; font-weight: bold; font-size: 11pt;">${principal.name}</p>
            <p style="margin: 3px 0 0 0; font-size: 9.5pt; color: #555555;">NIP. ${principal.nip}</p>
          </td>
        </tr>
        `
            : `
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; border: none; color: #000000;">&nbsp;</td>
          <td style="width: 50%; text-align: center; padding-top: 15px; vertical-align: top; border: none; color: #000000;">
            <p style="margin: 0 0 50px 0; line-height: 1.3; font-size: 11pt;">Mengetahui,<br />Kepala Sekolah</p>
            <p style="margin: 0; font-weight: bold; font-size: 11pt;">${principal.name}</p>
            <p style="margin: 3px 0 0 0; font-size: 9.5pt; color: #555555;">NIP. ${principal.nip}</p>
          </td>
        </tr>
        `
        }
      </table>
    `;

    const htmlFooter = `
      </body>
      </html>
    `;

    const docContent = htmlHeader + htmlBody + htmlFooter;
    const blob = new Blob(["\ufeff" + docContent], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="print-view-panel">
      {/* Dynamic custom CSS style overrides for printing natively in correct page sizes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            font-family: 'Times New Roman', Times, serif !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            background-color: white !important;
            color: black !important;
            position: relative !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Repeat watermark on every page during browser printing using position: fixed */
          #raport-watermark {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: ${format.watermarkSize || 440}px !important;
            height: ${format.watermarkSize || 440}px !important;
            z-index: -10 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: ${format.watermarkOpacity || 0.05} !important;
            pointer-events: none !important;
            visibility: visible !important;
          }
          #raport-watermark img {
            width: ${format.watermarkSize || 440}px !important;
            height: ${format.watermarkSize || 440}px !important;
            object-fit: contain !important;
            opacity: ${format.watermarkOpacity || 0.05} !important;
            display: block !important;
            visibility: visible !important;
            border-radius: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Force physical printing settings over any active Screen dark styles */
          .print-container, 
          .print-container * {
            color: black !important;
            border-color: black !important;
            background-color: transparent !important;
          }
          .print-container tr,
          .print-container td,
          .print-container th,
          .print-container div {
            border-color: black !important;
          }
        }
      `,
        }}
      />

      {/* Action Header bar */}
      <div
        className={`flex flex-col gap-3 no-print p-4 rounded-xl border shadow-sm transition-colors duration-200 ${darkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-150 text-gray-800"}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <button
            onClick={onBack}
            className={`flex items-center gap-1.5 text-xs transition py-1.5 px-3 border rounded-lg cursor-pointer font-bold ${darkMode ? "text-slate-300 hover:text-white border-slate-650 hover:bg-slate-700" : "text-gray-550 hover:text-gray-800 border-gray-200 hover:bg-gray-50"}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali
          </button>

          <div className="flex flex-wrap items-center gap-4">
            {/* Logo in Kop Selector */}
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold uppercase tracking-wider">
              <input
                type="checkbox"
                checked={!!format.showLogo}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFormat((prev) => ({ ...prev, showLogo: val }));
                  fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      principalName: principal.name,
                      principalNip: principal.nip,
                      format: { ...format, showLogo: val },
                    }),
                  }).catch((err) =>
                    console.error("Error saving settings:", err),
                  );
                }}
                className="rounded text-emerald-600 focus:ring-emerald-550 w-3.5 h-3.5 cursor-pointer"
              />
              <span className={darkMode ? "text-slate-400" : "text-gray-500"}>
                Kop Logo
              </span>
            </label>

            {/* Paper Size Selector */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-gray-500"}`}
              >
                Kertas:
              </span>
              <select
                id="paper-size-select-view"
                value={format.paperSize || "A4"}
                onChange={(e) => {
                  const newPaperSize = e.target.value;
                  setFormat((prev) => ({ ...prev, paperSize: newPaperSize }));
                  // Persist to the settings database so it's remembered
                  fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      principalName: principal.name,
                      principalNip: principal.nip,
                      format: { ...format, paperSize: newPaperSize },
                    }),
                  }).catch((err) =>
                    console.error("Error saving settings:", err),
                  );
                }}
                className={`text-xs border rounded-lg p-1.5 font-bold focus:outline-none focus:ring-1 cursor-pointer ${darkMode ? "bg-slate-700 border-slate-600 text-white focus:ring-emerald-500" : "bg-white border-gray-300 text-slate-800 focus:ring-emerald-500"}`}
              >
                <option value="A4">A4</option>
                <option value="F4">F4 / Folio</option>
              </select>
            </div>

            {/* Signature Position Selector */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-gray-500"}`}
              >
                Tanda Tangan:
              </span>
              <select
                id="signature-position-select-view"
                value={format.signaturePosition || "kanan"}
                onChange={(e) => {
                  const newPos = e.target.value as "kanan" | "tengah" | "kiri";
                  setFormat((prev) => ({ ...prev, signaturePosition: newPos }));
                  // Persist to the settings database so it's remembered
                  fetch("/api/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      principalName: principal.name,
                      principalNip: principal.nip,
                      format: { ...format, signaturePosition: newPos },
                    }),
                  }).catch((err) =>
                    console.error("Error saving settings:", err),
                  );
                }}
                className={`text-xs border rounded-lg p-1.5 font-bold focus:outline-none focus:ring-1 cursor-pointer ${darkMode ? "bg-slate-700 border-slate-600 text-white focus:ring-emerald-500" : "bg-white border-gray-300 text-slate-800 focus:ring-emerald-500"}`}
                title="Atur posisi tanda tangan Kepala Sekolah: Kanan (di bawah Wali Kelas), Tengah, atau Kiri"
              >
                <option value="kanan">Kanan (Di Bawah Wali Kelas)</option>
                <option value="tengah">Tengah (Di Tengah Lembar)</option>
                <option value="kiri">Kiri (Di Bawah Orang Tua)</option>
              </select>
            </div>

            {/* Dark Mode Indicator Badge */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700 bg-slate-800 text-amber-400 select-none shadow-2xs"
              title="Aplikasi berjalan dalam Mode Gelap Resmi"
            >
              <Moon className="w-3.5 h-3.5 fill-amber-400/20 text-amber-400" />
              <span>Dark Mode</span>
            </div>
          </div>
        </div>

        <div
          className={`border-t my-1 ${darkMode ? "border-slate-700" : "border-gray-100"}`}
        ></div>

        {/* Download & Print Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* PDF Download Section */}
          <div
            className={`p-3 rounded-lg border flex flex-col justify-between ${darkMode ? "bg-slate-900/40 border-slate-700" : "bg-slate-50/55 border-gray-150"}`}
          >
            <div>
              <h5 className="font-bold text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Format PDF (Sangat Direkomendasikan)
              </h5>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Menghasilkan salinan rapor siap cetak dengan format layout
                presisi, tajam (vektor), dan rapi sesuai pengaturan kertas.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-gray-400">
                Cocok untuk cetak fisik & arsip digital
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={handlePrint}
                  className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-md text-xs font-bold transition cursor-pointer shadow-xs ${darkMode ? "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  title="Cetak menggunakan printer fisik atau bawaan browser"
                >
                  <Printer className="w-3.5 h-3.5" /> Cetak
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPDF}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-850 text-white rounded-md text-xs font-bold transition shadow-xs cursor-pointer border border-emerald-600 disabled:opacity-50"
                  title="Unduh rapor sebagai berkas PDF berkualitas tinggi secara langsung"
                >
                  {isDownloadingPDF ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Mengunduh...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" /> Unduh PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Word Download Section */}
          <div
            className={`p-3 rounded-lg border flex flex-col justify-between ${darkMode ? "bg-slate-900/40 border-slate-700" : "bg-slate-50/55 border-gray-150"}`}
          >
            <div>
              <h5 className="font-bold text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                Format Word (.doc / .docx)
              </h5>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Mengunduh dokumen Microsoft Word yang dapat diedit atau
                dimodifikasi kembali sesuai kebutuhan sekolah.
              </p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-gray-400">
                Dapat diedit di MS Word / WPS Office
              </span>
              <button
                onClick={handleDownloadWord}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 border rounded-md text-xs font-bold transition cursor-pointer shadow-xs ${darkMode ? "bg-blue-950/40 border-blue-800 text-blue-300 hover:bg-blue-900/40" : "bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100"}`}
              >
                <FileDown className="w-3.5 h-3.5" /> Unduh Word (.doc)
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Alert Banner informing how to Save as PDF */}
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg text-[10.5px] leading-relaxed border ${darkMode ? "bg-amber-950/20 border-amber-900/40 text-amber-300" : "bg-amber-50/60 border-amber-100 text-amber-850"}`}
        >
          <span className="text-amber-500 font-bold mt-0.5">
            💡 Info Unduh & Cetak:
          </span>
          <p>
            Klik tombol <strong>"Unduh PDF"</strong> untuk mengunduh berkas
            rapor secara otomatis dengan nomor halaman. Jika Anda memilih tombol{" "}
            <strong>"Cetak"</strong> browser, pastikan mencentang opsi{" "}
            <strong>"Header dan footer" (Headers and footers)</strong> pada
            dialog cetak browser Anda agar nomor halaman tercetak rapi di kanan
            bawah lembar.
          </p>
        </div>
      </div>

      {/* Dynamic Paper Size, Font Size, and Font Family Print Style */}
      <style>{`
        .last-page-cover {
          display: none;
        }
        @media print {
          @page {
            size: ${format.paperSize === "F4" ? "215mm 330mm" : format.paperSize === "Legal" ? "215.9mm 355.6mm" : format.paperSize === "Letter" ? "215.9mm 279.4mm" : "210mm 297mm"};
            margin: ${format.paperSize === "F4" ? "0.8cm 1.2cm 1.2cm 1.2cm" : "0.6cm 0.9cm 0.7cm 0.9cm"};
          }
          body, #raport-sheet-print, #raport-sheet-print * {
            font-family: "${format.fontFamily || "Times New Roman"}", serif !important;
            font-size: ${format.paperSize === "F4" ? (format.fontSize || "11pt") : "10pt"} !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h4, .pdf-heading, #raport-sheet-print h4 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .last-page-cover {
            display: block !important;
            position: absolute !important;
            bottom: -30px !important;
            left: -50px !important;
            right: -50px !important;
            height: ${format.paperSize === "F4" ? "330mm" : format.paperSize === "Legal" ? "355.6mm" : format.paperSize === "Letter" ? "279.4mm" : "297mm"} !important;
            background-color: white !important;
            z-index: -5 !important;
            pointer-events: none !important;
          }
        }
      `}</style>

      {/* Raport Sheet Preview Container */}
      <div
        className={`rounded-lg border bg-white border-gray-300 text-slate-950 shadow-md mx-auto print-container transition-all duration-300 shadow-slate-900/10 animate-fade-in relative overflow-hidden ${
          format.paperSize === "F4"
            ? "max-w-4xl p-6 md:p-8"
            : "max-w-[794px] w-full p-4 sm:p-5 md:p-6"
        }`}
        id="raport-sheet-print"
        style={{
          fontFamily: format.fontFamily || "Times New Roman",
          fontSize: format.paperSize === "F4" ? (format.fontSize || "11pt") : "10pt",
        }}
      >
        {/* Absolute centered watermark behind on-screen and browser-printed layouts */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
          id="raport-watermark"
          style={{ pointerEvents: "none", zIndex: 0 }}
        >
          <img
            src={logoUrl}
            alt="Watermark"
            className="object-contain select-none transition-all duration-300"
            style={{
              width: `${format.paperSize === "F4" ? (format.watermarkSize || 440) : Math.min(format.watermarkSize || 360, 360)}px`,
              height: `${format.paperSize === "F4" ? (format.watermarkSize || 440) : Math.min(format.watermarkSize || 360, 360)}px`,
              opacity: format.watermarkOpacity || 0.05,
              WebkitPrintColorAdjust: "exact",
              printColorAdjust: "exact",
            }}
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative w-full flex flex-col" style={{ zIndex: 10 }}>
          {/* Formal Report Header */}
          <div className={`${format.paperSize === "F4" ? "pb-4 border-b-2 border-double mb-6 gap-4" : "pb-2.5 border-b-2 border-double mb-3.5 gap-2.5"} font-serif border-gray-800 flex items-center justify-between`}>
            {format.showLogo ? (
              <div className={`flex items-center gap-1.5 md:gap-2 shrink-0 justify-start ${format.paperSize === "F4" ? "w-32 md:w-44" : "w-24 md:w-32"}`}>
                <div className={`${format.paperSize === "F4" ? "w-14 h-14 md:w-18 md:h-18" : "w-10 h-10 md:w-13 md:h-13"} select-none bg-white flex items-center justify-center p-0.5`}>
                  <img
                    src={logoCahayaAmalUrl}
                    alt="Yayasan Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className={`${format.paperSize === "F4" ? "w-14 h-14 md:w-18 md:h-18" : "w-10 h-10 md:w-13 md:h-13"} select-none bg-white flex items-center justify-center p-0.5`}>
                  <img
                    src={logoJsitUrl}
                    alt="JSIT Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            ) : null}
            <div className="text-center flex-1">
              <h2 className={`${format.paperSize === "F4" ? "text-sm md:text-base lg:text-lg" : "text-xs md:text-sm lg:text-[15px]"} font-extrabold uppercase mt-0.5 tracking-wide text-black leading-tight`}>
                {getSchoolName(student.kelas)}
              </h2>
              <h3 className={`${format.paperSize === "F4" ? "text-[10px] md:text-xs lg:text-sm" : "text-[9px] md:text-[11px] lg:text-xs"} font-bold tracking-wider uppercase mt-0.5 text-gray-800 leading-tight`}>
                LAPORAN SUMATIF TENGAH SEMESTER (STS)
              </h3>
              <h4 className={`${format.paperSize === "F4" ? "text-[10px] md:text-xs lg:text-sm" : "text-[9px] md:text-[11px] lg:text-xs"} font-bold uppercase mt-0.5 tracking-wider text-black leading-tight`}>
                SEMESTER{" "}
                {format.semesterName
                  ? format.semesterName.toUpperCase()
                  : "GANJIL"}
              </h4>
              <p className="text-[9px] md:text-[10px] text-gray-500 font-medium italic mt-0.5 font-sans">
                TAHUN PELAJARAN {format.tahunPelajaran || "2026-2027"}
              </p>
            </div>
            {format.showLogo ? (
              <div className={`flex items-center shrink-0 justify-center ${format.paperSize === "F4" ? "w-32 md:w-44" : "w-24 md:w-32"}`}>
                <div className={`${format.paperSize === "F4" ? "w-14 h-14 md:w-18 md:h-18" : "w-10 h-10 md:w-13 md:h-13"} shrink-0 select-none overflow-hidden rounded-full border-1.5 border-gray-300 bg-white flex items-center justify-center`}>
                  <img
                    src={logoUrl}
                    alt="School Logo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Student metadata tables */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 ${format.paperSize === "F4" ? "text-xs mb-3" : "text-[11px] md:text-xs mb-2"} font-serif`}>
            <table className="w-full border-none mx-auto">
              <tbody>
                <tr>
                  <td className="w-1/3 py-0.5 font-normal text-gray-650">
                    Nama
                  </td>
                  <td className="w-4 py-0.5 text-gray-450">:</td>
                  <td className="py-0.5 font-bold text-black">
                    {student.name}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 font-normal text-gray-650">
                    NISN/ NIS
                  </td>
                  <td className="py-0.5 text-gray-450">:</td>
                  <td className="py-0.5 font-bold text-black">
                    {student.nisn}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="w-full border-none mx-auto">
              <tbody>
                <tr>
                  <td className="w-1/3 py-0.5 font-normal text-gray-650">
                    Fase/Kelas
                  </td>
                  <td className="w-4 py-0.5 text-gray-450">:</td>
                  <td className="py-0.5 font-bold text-black">
                    {formatFaseKelas(student.kelas)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 font-normal text-gray-650">Semester</td>
                  <td className="py-0.5 text-gray-450">:</td>
                  <td className="py-0.5 font-bold text-black">
                    {format.semesterName || "Ganjil"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION A: SIKAP */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              A. Sikap
            </h4>

            {/* Spiritual Aspect Box */}
            <div className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}>
              <table className="w-full border-collapse border-none mx-auto">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[50%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-black">
                      1. Spiritual
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Usaha
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.spiritualUsaha || "-"}
                      </div>
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Proses
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.spiritualProses || "-"}
                      </div>
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Capaian
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.spiritualCapaian || "-"}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={4}
                      className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify`}
                      style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                    >
                      <strong className="font-semibold mr-1 text-black">
                        Deskripsi:
                      </strong>
                      <span className="text-gray-800">
                        {waliKelasNote.spiritualDeskripsi || ""}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sosial Aspect Box */}
            <div className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}>
              <table className="w-full border-collapse border-none mx-auto">
                <tbody>
                  <tr className="border-b border-black">
                    <td className="w-[50%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-black">
                      2. Sosial
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Usaha
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.sosialUsaha || "-"}
                      </div>
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Proses
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.sosialProses || "-"}
                      </div>
                    </td>
                    <td className="w-[16.6%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 text-gray-500 align-top">
                      <div className="text-[8px] font-sans opacity-80 text-gray-500">
                        Capaian
                      </div>
                      <div className="text-xs font-bold text-black">
                        {waliKelasNote.sosialCapaian || "-"}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      colSpan={4}
                      className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify`}
                      style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                    >
                      <strong className="font-semibold mr-1 text-black">
                        Deskripsi:
                      </strong>
                      <span className="text-gray-800">
                        {waliKelasNote.sosialDeskripsi || ""}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: UMUM */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              B. Umum
            </h4>

            {activeUmum.map((sub, idx) => {
              const name = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return (
                <div
                  key={sub}
                  className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}
                >
                  <table className="w-full border-collapse border-none mx-auto">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-[52%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-slate-900">
                          {name}
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Usaha
                          </div>
                          <div className="text-xs font-mono text-black">
                            {usahaGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Proses
                          </div>
                          <div className="text-xs font-mono text-black">
                            {prosesGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Capaian
                          </div>
                          <div className="text-xs font-mono text-black">
                            {capaianGrade}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={4}
                          className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify text-slate-850`}
                          style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                        >
                          <strong className="font-semibold mr-1 text-black">
                            Deskripsi:
                          </strong>
                          <span>{desc}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* SECTION C: MUATAN LOKAL */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              C. Muatan Lokal
            </h4>

            {mulokSubjects.map((sub, idx) => {
              const name = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return (
                <div
                  key={sub}
                  className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}
                >
                  <table className="w-full border-collapse border-none mx-auto">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-[52%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-slate-900">
                          {name}
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Usaha
                          </div>
                          <div className="text-xs font-mono text-black">
                            {usahaGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Proses
                          </div>
                          <div className="text-xs font-mono text-black">
                            {prosesGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Capaian
                          </div>
                          <div className="text-xs font-mono text-black">
                            {capaianGrade}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={4}
                          className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify text-slate-850`}
                          style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                        >
                          <strong className="font-semibold mr-1 text-black">
                            Deskripsi:
                          </strong>
                          <span>{desc}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* SECTION D: KEISLAMAN */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              D. Keislaman
            </h4>

            {keislamanSubjects.map((sub, idx) => {
              const name = getOfficialSubjectName(sub, idx);
              const usahaGrade = getSubjectUsaha(sub);
              const prosesGrade = getSubjectProses(sub);
              const capaianGrade = getSubjectCapaian(sub);
              const desc = getSubjectDescription(sub);

              return (
                <div
                  key={sub}
                  className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}
                >
                  <table className="w-full border-collapse border-none mx-auto">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-[52%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-slate-900">
                          {name}
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Usaha
                          </div>
                          <div className="text-xs font-mono text-black">
                            {usahaGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Proses
                          </div>
                          <div className="text-xs font-mono text-black">
                            {prosesGrade}
                          </div>
                        </td>
                        <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 align-top">
                          <div className="text-[8px] font-sans text-gray-500">
                            Capaian
                          </div>
                          <div className="text-xs font-mono text-black">
                            {capaianGrade}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={4}
                          className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify text-slate-850`}
                          style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                        >
                          <strong className="font-semibold mr-1 text-black">
                            Deskripsi:
                          </strong>
                          <span>{desc}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* SECTION E: EKSTRAKURIKULER DAN KETERAMPILAN */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              E. Ekstrakurikuler dan Keterampilan
            </h4>
            {((waliKelasNote as any).ekskul || []).length === 0 ? (
              <div className="page-break-avoid border p-2 text-center text-slate-500 italic text-xs border-black bg-transparent">
                Tidak mengikuti kegiatan ekstrakurikuler.
              </div>
            ) : (
              ((waliKelasNote as any).ekskul || []).map(
                (e: any, idx: number) => {
                  const grades = getEkskulGrades(e);
                  return (
                    <div
                      key={idx}
                      className={`page-break-avoid border p-0 ${format.paperSize === "F4" ? "mb-2" : "mb-1.5"} border-black bg-transparent text-black`}
                    >
                      <table className="w-full border-collapse border-none mx-auto">
                        <tbody>
                          <tr className="border-b border-black">
                            <td className="w-[52%] p-1 px-2 font-bold text-xs align-middle border-r font-serif border-black text-slate-900">
                              {idx + 1}. Ekstrakurikuler {e.type || "Pilihan"}:{" "}
                              {e.name}
                            </td>
                            <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                              <div className="text-[8px] font-sans text-gray-500">
                                Usaha
                              </div>
                              <div className="text-xs font-mono text-black">
                                {grades.usaha}
                              </div>
                            </td>
                            <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] border-r border-black bg-gray-50/50 align-top">
                              <div className="text-[8px] font-sans text-gray-500">
                                Proses
                              </div>
                              <div className="text-xs font-mono text-black">
                                {grades.proses}
                              </div>
                            </td>
                            <td className="w-[16%] p-0.5 pt-[2px] pb-[5px] text-center font-bold text-[10px] bg-gray-50/50 align-top">
                              <div className="text-[8px] font-sans text-gray-500">
                                Capaian
                              </div>
                              <div className="text-xs font-mono text-black">
                                {grades.capaian}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td
                              colSpan={4}
                              className={`${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-2" : "py-1 px-2"} leading-relaxed text-justify text-slate-850`}
                              style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
                            >
                              <strong className="font-semibold mr-1 text-black">
                                Deskripsi:
                              </strong>
                              <span>{e.description || e.deskripsi || "-"}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                },
              )
            )}
          </div>

          {/* SECTION F: SARAN-SARAN */}
          <div className={`${format.paperSize === "F4" ? "mb-3" : "mb-2"} font-serif page-break-avoid`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              F. Saran-Saran
            </h4>
            <div
              className={`border ${format.paperSize === "F4" ? "pt-1.5 pb-2.5 px-3 min-h-[40px]" : "py-1 px-2.5 min-h-[28px]"} text-xs leading-relaxed text-justify border-black text-slate-900 bg-transparent`}
              style={{ fontSize: format.paperSize === "F4" ? "9.5pt" : "8.75pt" }}
            >
              {waliKelasNote.catatan || ""}
            </div>
          </div>

          {/* SECTION G: KEDISIPLINAN */}
          <div className={`${format.paperSize === "F4" ? "mb-4" : "mb-2.5"} font-serif page-break-avoid`}>
            <h4 className={`${format.paperSize === "F4" ? "text-xs md:text-sm font-bold mb-2.5" : "text-xs font-bold mb-1.5"} uppercase tracking-wide text-black`}>
              G. Kedisiplinan
            </h4>
            <table className="w-full border border-black border-collapse text-center text-xs text-black bg-transparent mx-auto">
              <thead>
                <tr className="bg-transparent border-b border-black">
                  <th
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} px-2 font-bold border-r border-black w-1/3 text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    Sakit
                  </th>
                  <th
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} px-2 font-bold border-r border-black w-1/3 text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    Izin
                  </th>
                  <th
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} px-2 font-bold w-1/3 text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    Tanpa Keterangan
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} border-r border-black text-xs text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    {waliKelasNote.sakit && Number(waliKelasNote.sakit) > 0
                      ? `${waliKelasNote.sakit} Hari`
                      : "- Hari"}
                  </td>
                  <td
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} border-r border-black text-xs text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    {waliKelasNote.izin && Number(waliKelasNote.izin) > 0
                      ? `${waliKelasNote.izin} Hari`
                      : "- Hari"}
                  </td>
                  <td
                    className={`${format.paperSize === "F4" ? "py-1.5" : "py-1"} text-xs text-center align-middle`}
                    style={{ lineHeight: "1.2" }}
                  >
                    {waliKelasNote.alpa && Number(waliKelasNote.alpa) > 0
                      ? `${waliKelasNote.alpa} Hari`
                      : "- Hari"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures section aligned side-by-side */}
          <div className={`${format.paperSize === "F4" ? "text-xs mt-6 space-y-8" : "text-[11px] md:text-xs mt-3 space-y-4 md:space-y-5"} font-serif page-break-avoid text-black`}>
            {/* Wali Kelas and Parent side-by-side */}
            <div className="grid grid-cols-2 text-center gap-4">
              <div>
                <p className={`${format.paperSize === "F4" ? "mb-10" : "mb-6"} text-black font-semibold`}>
                  <span className="invisible block">&nbsp;</span>
                  Orang Tua/Wali Siswa
                </p>
                <div className="font-bold inline-block w-44 text-center text-black">
                  ……………………………
                </div>
              </div>
              <div>
                <p className={`${format.paperSize === "F4" ? "mb-10" : "mb-6"} text-black`}>
                  Pangkal Pinang, {format.tanggalRaport || "17 Juni 2026"}
                  <br />
                  <span className="font-semibold">
                    Wali Kelas Kelas {student.kelas}
                  </span>
                </p>
                <div className="font-bold inline-block text-center text-black">
                  {waliKelas ? waliKelas.name : "……………………………"}
                </div>
              </div>
            </div>

            {/* Underneath: Kepala sekolah based on signaturePosition */}
            {format.signaturePosition === "kiri" ? (
              <div className="grid grid-cols-2 text-center gap-4 pt-1">
                <div>
                  <p className={`${format.paperSize === "F4" ? "mb-10" : "mb-6"} uppercase font-bold tracking-wide text-black`}>
                    Mengetahui,
                    <br />
                    Kepala Sekolah
                  </p>
                  <div className="font-bold inline-block text-center text-black">
                    {principal.name}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold">
                    NIP. {principal.nip}
                  </p>
                </div>
                <div>{/* Empty column on right */}</div>
              </div>
            ) : format.signaturePosition === "tengah" ? (
              <div className="text-center pt-1">
                <div className="max-w-md mx-auto justify-center text-black">
                  <p className={`${format.paperSize === "F4" ? "mb-10" : "mb-6"} uppercase font-bold tracking-wide text-black`}>
                    Mengetahui,
                    <br />
                    Kepala Sekolah
                  </p>
                  <div className="font-bold inline-block text-center text-black">
                    {principal.name}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold">
                    NIP. {principal.nip}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 text-center gap-4 pt-1">
                <div>{/* Empty column on left */}</div>
                <div>
                  <p className={`${format.paperSize === "F4" ? "mb-10" : "mb-6"} uppercase font-bold tracking-wide text-black`}>
                    Mengetahui,
                    <br />
                    Kepala Sekolah
                  </p>
                  <div className="font-bold inline-block text-center text-black">
                    {principal.name}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5 font-bold">
                    NIP. {principal.nip}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Solid white cover block in print-mode to hide fixed watermark on the last page */}
        <div className="last-page-cover" />
      </div>

      {/* Beautiful Interactive Indonesian Print & Download Guide Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print">
          <div
            className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border transition-colors duration-200 ${darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-gray-150 text-gray-800"}`}
          >
            {/* Close button */}
            <button
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full transition hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4 text-gray-550 dark:text-gray-400" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <FileDown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold">
                Panduan Unduh & Cetak PDF Rapor
              </h3>
            </div>

            {/* If inside iframe warning */}
            {isIframe ? (
              <div className="p-3.5 mb-4 text-xs rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="text-base">⚠️</span> Penting: Jalankan di Tab
                  Baru Laptop Anda
                </div>
                <p className="leading-relaxed">
                  Anda saat ini sedang membuka aplikasi di dalam panel pratinjau
                  editor AI Studio. Browser membatasi fitur unduhan file PDF
                  langsung serta pembukaan print dialog di dalam bingkai ini
                  (iframe).
                </p>
                <p className="font-semibold leading-relaxed">
                  Harap klik tombol di bawah untuk membuka halaman ini di Tab
                  Baru laptop Anda agar dokumen dapat disimpan dengan sempurna!
                </p>
                <div className="pt-2">
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg font-bold text-xs transition shadow-xs cursor-pointer"
                  >
                    Buka Rapor di Tab Baru{" "}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-550 dark:text-gray-400 leading-relaxed">
                  Kami menggunakan fitur cetak bawaan browser laptop Anda untuk
                  menghasilkan dokumen PDF berkualitas tinggi (vektor, teks
                  tajam/bisa diblok, dan layout presisi) dengan ukuran berkas
                  yang sangat kecil.
                </p>

                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-xs leading-relaxed">
                      Klik tombol{" "}
                      <strong className="font-semibold">
                        "Lanjutkan ke Cetak / Simpan PDF"
                      </strong>{" "}
                      di bawah. Jendela cetak browser akan otomatis terbuka.
                    </p>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-xs leading-relaxed">
                      Pada bagian{" "}
                      <strong className="font-semibold">
                        Tujuan (Destination)
                      </strong>
                      , ganti opsi menjadi{" "}
                      <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                        "Simpan sebagai PDF" / "Save as PDF"
                      </strong>
                      .
                    </p>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="text-xs space-y-1.5 leading-relaxed">
                      <p>
                        Buka{" "}
                        <strong className="font-semibold">
                          Setelan Lainnya (More Settings)
                        </strong>{" "}
                        dan sesuaikan:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-500 dark:text-gray-400">
                        <li>
                          Ukuran Kertas: Pilih{" "}
                          <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                            {format.paperSize || "A4"}
                          </strong>{" "}
                          (sesuai setelan format rapor Anda).
                        </li>
                        <li>
                          Margin: Ubah dari <em>Default</em> menjadi{" "}
                          <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                            "Minimum" atau "Tidak Ada" (None)
                          </strong>
                          . Ini adalah kunci agar tabel di tepi halaman tidak
                          terpotong!
                        </li>
                        <li>
                          Skala (Scale): Setel ke{" "}
                          <strong className="font-semibold">
                            100% (Default)
                          </strong>
                          . Jika printer Anda memiliki area margin cetak fisik
                          yang sempit, Anda bisa menurunkannya sedikit ke{" "}
                          <strong className="font-semibold">
                            95% s.d. 98%
                          </strong>{" "}
                          agar pas.
                        </li>
                        <li>
                          Grafik Latar Belakang (Background graphics):{" "}
                          <strong className="font-bold text-emerald-600 dark:text-emerald-400">
                            Centang / AKTIFKAN
                          </strong>{" "}
                          (agar arsiran baris & warna tabel tetap tercetak
                          indah).
                        </li>
                        <li>
                          Header & Footer:{" "}
                          <strong className="font-semibold">
                            Hapus centang / NONAKTIFKAN
                          </strong>{" "}
                          (agar teks alamat website di pinggiran kertas hilang).
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold shrink-0 mt-0.5">
                      4
                    </span>
                    <p className="text-xs leading-relaxed">
                      Klik{" "}
                      <strong className="font-semibold">Simpan / Save</strong>{" "}
                      dan pilih lokasi folder di laptop Anda untuk menyimpan
                      berkas PDF tersebut.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setShowPrintModal(false)}
                    className={`flex-1 py-2 px-4 border rounded-xl text-xs font-bold transition cursor-pointer ${darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintModal(false);
                      setTimeout(() => {
                        window.print();
                      }, 250);
                    }}
                    className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Lanjutkan ke Cetak /
                    Simpan PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
