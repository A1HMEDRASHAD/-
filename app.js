// ==========================================================================
// Safaqat Kitabiya ERP - Master Engine (app.js)
// 3-File Architecture | Hujariya UX + Persistent Auth + Smart Search + PWA
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================================================
// 1. إعدادات Firebase والحاكم الخفي (الإدارة العليا المطلقة)
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDtdAxJqFhc1nsViYRkMVw9FXzCKeYhT5I",
  authDomain: "safaqat-system.firebaseapp.com",
  projectId: "safaqat-system",
  storageBucket: "safaqat-system.firebasestorage.app",
  messagingSenderId: "847357037344",
  appId: "1:847357037344:web:fe71887332dfe8f35b2545",
  measurementId: "G-1KQB3XREKE"
};

const HIDDEN_SUPER_ADMINS = [
  "rawialshamal@gmail.com",
  "a1hmedrashad@gmail.com",
  "safaqatkitabiya@gmail.com"
];

function isSuperAdminEmail(email) {
  if (!email) return false;
  return HIDDEN_SUPER_ADMINS.includes(email.trim().toLowerCase());
}

const IMGBB_API_KEY = "8daac9827176202a80700d2e41aaebd8";

// تهيئة Firebase مع تفعيل حفظ الجلسة الدائم (لا يطلب تسجيل الدخول مرة أخرى)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => console.warn("Persistence note:", err));

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const db = getFirestore(app);

// ==========================================================================
// 2. استخراج الصور الأصلية من روابط ibb.co وتجهيز تطبيق الويب (PWA)
// ==========================================================================
const IBB_SQUARE_PAGE = "https://ibb.co/ymRzy6cb";
const IBB_WIDE_LOGO_PAGE = "https://ibb.co/39hSSp9t";

const FALLBACK_ICON_DATA =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="38" fill="#141c1b"/><rect x="8" y="8" width="184" height="184" rx="32" fill="none" stroke="#b88928" stroke-width="4"/><text x="100" y="122" text-anchor="middle" font-family="Tajawal, Arial" font-weight="800" font-size="68" fill="#facc15">ص</text></svg>`
  );

async function resolveDirectIbbImage(pageUrl, storageKey) {
  const cached = localStorage.getItem(storageKey);
  if (cached && cached.startsWith("http")) return cached;

  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(pageUrl)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();
    if (data && data.contents) {
      const match = data.contents.match(/https:\/\/i\.ibb\.co\/[^"'\s>]+/);
      if (match && match[0]) {
        localStorage.setItem(storageKey, match[0]);
        return match[0];
      }
    }
  } catch (e) {
    console.warn("Direct image resolution fallback:", e);
  }
  return null;
}

async function initBrandingAndDynamicPWA() {
  const directSquareIcon = (await resolveDirectIbbImage(IBB_SQUARE_PAGE, "safaqat_sq_icon_v2")) || FALLBACK_ICON_DATA;
  const directWideLogo = await resolveDirectIbbImage(IBB_WIDE_LOGO_PAGE, "safaqat_wide_logo_v2");

  document.querySelectorAll(".js-square-icon").forEach((img) => {
    img.src = directSquareIcon;
    img.onerror = () => {
      img.src = FALLBACK_ICON_DATA;
    };
  });

  document.querySelectorAll(".js-wide-logo").forEach((img) => {
    if (directWideLogo) {
      img.src = directWideLogo;
    } else {
      img.style.display = "none";
    }
  });

  const fav = document.getElementById("app-favicon");
  const touchIcon = document.getElementById("apple-touch-icon");
  if (fav) fav.href = directSquareIcon;
  if (touchIcon) touchIcon.href = directSquareIcon;

  // توليد ملف PWA Manifest مدمج بالأيقونة المربعة الرسمية
  const manifestObj = {
    name: "نظام صفقات كتابية | الإدارة المالية والتعاقدات",
    short_name: "صفقات كتابية",
    description: "النظام الداخلي لإدارة العقود والمبيعات والتوثيق المالي لدار صفقات كتابية",
    start_url: window.location.href.split("?")[0],
    display: "standalone",
    background_color: "#141c1b",
    theme_color: "#141c1b",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: directSquareIcon, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: directSquareIcon, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  const blob = new Blob([JSON.stringify(manifestObj)], { type: "application/json" });
  const manifestUrl = URL.createObjectURL(blob);
  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement("link");
    manifestLink.rel = "manifest";
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = manifestUrl;

  // استعادة الوضع الليلي أو النهاري المحفوظ
  const savedTheme = localStorage.getItem("safaqat_theme") || "light";
  setAppTheme(savedTheme);
}

function setAppTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("safaqat_theme", theme);
  const icon = document.getElementById("theme-icon");
  if (icon) {
    icon.className = theme === "dark" ? "ri-sun-fill" : "ri-contrast-2-line";
    icon.style.color = theme === "dark" ? "#facc15" : "";
  }
}

document.getElementById("btn-theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  setAppTheme(next);
  renderSalesChart();
});

initBrandingAndDynamicPWA();

// ==========================================================================
// 3. الحالة المركزية ومصفوفة الصلاحيات الـ 8 (Central State)
// ==========================================================================
const FULL_PERMISSIONS = {
  sell: true,
  addBook: true,
  deleteBook: true,
  authors: true,
  payouts: true,
  expenses: true,
  financeView: true,
  reports: true
};

const state = {
  currentUser: null,
  userEmail: "",
  userRole: null, // 'super_admin' | 'employee' | 'author'
  permissions: { ...FULL_PERMISSIONS },
  userProfile: {
    displayName: "",
    avatarUrl: FALLBACK_ICON_DATA
  },
  currentAuthorProfile: null,
  selectedAuthorDetailId: null,
  inspectingStaffEmail: null,
  activeBookFilter: "all",
  returnViewBeforePdf: "view-contracts",

  authors: [],
  books: [],
  sales: [],
  expenses: [],
  payouts: [],
  staff: [],
  notifications: [],
  activityLogs: [],

  chartInstance: null,
  currentChartType: "bar",
  confirmActionCallback: null,
  deferredPwaPrompt: null,
  unsubscribers: []
};

// ==========================================================================
// 4. القائمة الجانبية (☰) والشريط السفلي العائم والتنقل بين الصفحات
// ==========================================================================
const sideDrawer = document.getElementById("side-drawer");
const drawerBackdrop = document.getElementById("drawer-backdrop");
const quickAddSheet = document.getElementById("quick-add-sheet");

function openSideDrawer() {
  sideDrawer.classList.add("open");
  drawerBackdrop.classList.add("open");
}

function closeSideDrawer() {
  sideDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("open");
}

document.getElementById("btn-open-drawer").addEventListener("click", openSideDrawer);
document.getElementById("btn-close-drawer").addEventListener("click", closeSideDrawer);
drawerBackdrop.addEventListener("click", closeSideDrawer);

function navigateToView(viewId) {
  closeSideDrawer();
  quickAddSheet.classList.remove("show");

  document.querySelectorAll(".app-view").forEach((sec) => {
    sec.style.display = "none";
  });

  const target = document.getElementById(viewId);
  if (target) target.style.display = "block";

  // مزامنة التحديد في القائمة الجانبية
  document.querySelectorAll("#drawer-nav-list .drawer-link").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-nav") === viewId);
  });

  // مزامنة التحديد في الشريط السفلي العائم
  document.querySelectorAll(".floating-dock .dock-item").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-dock") === viewId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// أزرار القائمة الجانبية
document.querySelectorAll("#drawer-nav-list .drawer-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    const viewId = btn.getAttribute("data-nav");
    if (viewId === "view-profile") resetAuditLogToCurrentUser();
    navigateToView(viewId);
  });
});

// أزرار الشريط السفلي العائم
document.querySelectorAll(".floating-dock .dock-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const viewId = btn.getAttribute("data-dock");
    if (viewId === "view-profile") resetAuditLogToCurrentUser();
    navigateToView(viewId);
  });
});

// زر الإضافة السريعة (+) في منتصف الشريط السفلي
document.getElementById("btn-dock-quick-add").addEventListener("click", () => {
  quickAddSheet.classList.toggle("show");
});

document.getElementById("btn-close-quick-add").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
});

quickAddSheet.addEventListener("click", (e) => {
  if (e.target === quickAddSheet) quickAddSheet.classList.remove("show");
});

document.getElementById("qadd-contract").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
  openBookFormPage(null, null);
});

document.getElementById("qadd-author").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
  openAuthorFormPage(null);
});

document.getElementById("qadd-payout").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
  openPayoutFormPage(null);
});

document.getElementById("qadd-expense").addEventListener("click", () => {
  quickAddSheet.classList.remove("show");
  openExpenseFormPage();
});

// اختصارات الهيدر والرئيسية
document.getElementById("brand-home-trigger").addEventListener("click", () => {
  if (state.userRole === "author") {
    navigateToView("view-author-portal");
  } else {
    navigateToView("view-dashboard");
  }
});

document.getElementById("btn-header-guide").addEventListener("click", () => navigateToView("view-guide"));
document.getElementById("btn-header-notif").addEventListener("click", () => navigateToView("view-notifications"));
document.getElementById("btn-hero-open-books").addEventListener("click", () => navigateToView("view-contracts"));
document.getElementById("btn-dash-see-all-books").addEventListener("click", () => navigateToView("view-contracts"));
document.getElementById("btn-go-books-filter").addEventListener("click", () => navigateToView("view-contracts"));

document.querySelectorAll(".js-back-view").forEach((btn) => {
  btn.addEventListener("click", () => {
    navigateToView(btn.getAttribute("data-target") || "view-dashboard");
  });
});

// ==========================================================================
// 5. نظام الحفظ المؤقت التلقائي في المتصفح (Auto-Save Drafts)
// ==========================================================================
const DRAFT_PREFIX = "safaqat_v3_draft_";
const DRAFT_ACTIVE_VIEW = "safaqat_v3_active_view";

function setupDraftAutoSave() {
  document.querySelectorAll("[data-draft]").forEach((input) => {
    const key = input.getAttribute("data-draft");
    const saved = localStorage.getItem(DRAFT_PREFIX + key);
    if (saved !== null && input.value === "") {
      input.value = saved;
    }

    input.addEventListener("input", () => {
      localStorage.setItem(DRAFT_PREFIX + key, input.value);
      const sec = input.closest(".app-view");
      if (sec && sec.id) {
        localStorage.setItem(DRAFT_ACTIVE_VIEW, sec.id);
      }
    });
  });

  document.querySelectorAll(".js-clear-draft").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prefix = btn.getAttribute("data-prefix");
      clearDraftByPrefix(prefix);
      const form = btn.closest("form");
      if (form) form.reset();
      showToast("تم مسح المسودة المؤقتة بنجاح");
    });
  });
}

function clearDraftByPrefix(prefix) {
  Object.keys(localStorage).forEach((k) => {
    if (k.startsWith(DRAFT_PREFIX + prefix)) {
      localStorage.removeItem(k);
    }
  });
  localStorage.removeItem(DRAFT_ACTIVE_VIEW);
  document.getElementById("draft-banner").style.display = "none";
}

function restoreDraftInputs(prefix) {
  document.querySelectorAll(`[data-draft^="${prefix}"]`).forEach((input) => {
    const key = input.getAttribute("data-draft");
    const val = localStorage.getItem(DRAFT_PREFIX + key);
    if (val !== null) input.value = val;
  });
}

function checkActiveDraftBanner() {
  const draftView = localStorage.getItem(DRAFT_ACTIVE_VIEW);
  const banner = document.getElementById("draft-banner");
  if (!draftView || state.userRole === "author") {
    banner.style.display = "none";
    return;
  }

  const hasText = Object.keys(localStorage).some(
    (k) => k.startsWith(DRAFT_PREFIX) && (localStorage.getItem(k) || "").trim() !== ""
  );

  if (!hasText) {
    localStorage.removeItem(DRAFT_ACTIVE_VIEW);
    banner.style.display = "none";
    return;
  }

  const titles = {
    "view-form-book": "توثيق عقد كتاب",
    "view-form-author": "إضافة ملف كاتب",
    "view-form-payout": "تسجيل دفعة لمؤلف",
    "view-form-expense": "تسجيل مصروف",
    "view-form-staff": "إضافة موظف",
    "view-form-notif": "إرسال تنبيه"
  };

  document.getElementById("draft-banner-text").textContent =
    `لديك مسودة محفوظة تلقائياً في (${titles[draftView] || "نموذج إدخال"}) لم يتم حفظها بعد!`;
  banner.style.display = "flex";

  document.getElementById("btn-restore-draft").onclick = () => {
    banner.style.display = "none";
    if (draftView === "view-form-book") populateAuthorDropdowns("");
    if (draftView === "view-form-payout") populatePayoutAuthorsDropdown();
    navigateToView(draftView);
  };

  document.getElementById("btn-discard-draft").onclick = () => {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
    });
    localStorage.removeItem(DRAFT_ACTIVE_VIEW);
    banner.style.display = "none";
    showToast("تم تجاهل المسودة المؤقتة");
  };
}

setupDraftAutoSave();

// ==========================================================================
// 6. دوال مساعدة (العملة ج.م، الترحيب المصري، ضغط الصور، جوجل درايف)
// ==========================================================================
function formatEGP(num) {
  const val = Number(num || 0);
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " ج.م";
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getSiteUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function showToast(text, icon = "ri-checkbox-circle-fill") {
  const area = document.getElementById("toast-area");
  if (!area) return;
  const item = document.createElement("div");
  item.className = "toast-item";
  item.innerHTML = `<i class="${icon}" style="color: #facc15; font-size: 18px;"></i><span>${text}</span>`;
  area.appendChild(item);
  setTimeout(() => {
    item.style.opacity = "0";
    setTimeout(() => item.remove(), 240);
  }, 3200);
}

function openConfirmModal(title, msg, onConfirm) {
  document.getElementById("confirm-title-text").textContent = title;
  document.getElementById("confirm-msg-text").textContent = msg;
  state.confirmActionCallback = onConfirm;
  document.getElementById("modal-confirm").classList.add("show");
}

document.getElementById("btn-confirm-exec").addEventListener("click", async () => {
  document.getElementById("modal-confirm").classList.remove("show");
  if (typeof state.confirmActionCallback === "function") {
    await state.confirmActionCallback();
    state.confirmActionCallback = null;
  }
});

async function compressAndUploadToImgBB(file, maxWidth = 900, quality = 0.78) {
  if (!file) return null;
  const base64Str = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

  const form = new FormData();
  form.append("key", IMGBB_API_KEY);
  form.append("image", base64Str);

  const response = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  const resJson = await response.json();
  if (resJson && resJson.success && resJson.data && resJson.data.url) {
    return resJson.data.url;
  }
  throw new Error("فشل رفع الصورة");
}

function parseDrivePdfLink(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return null;
  const url = rawUrl.trim();
  const match = url.match(/[-\w]{25,}/);
  if (match && match[0]) {
    const id = match[0];
    return {
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`
    };
  }
  return { previewUrl: url, downloadUrl: url };
}

function getContractStatus(startDate, months) {
  if (!startDate || !months) {
    return { endDateStr: "غير محدد", daysLeft: 999, label: "عقد ساري", pillClass: "green", isExpiring: false };
  }
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months));
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const endDateStr = end.toISOString().split("T")[0];

  if (daysLeft < 0) {
    return { endDateStr, daysLeft, label: `منتهي منذ ${Math.abs(daysLeft)} يوم`, pillClass: "red", isExpiring: true };
  } else if (daysLeft <= 35) {
    return { endDateStr, daysLeft, label: `باقي ${daysLeft} يوم`, pillClass: "amber", isExpiring: true };
  }
  return { endDateStr, daysLeft, label: `عقد ساري (${daysLeft} يوم)`, pillClass: "green", isExpiring: false };
}

function refreshEgyptianGreeting() {
  const h = new Date().getHours();
  const name = state.userProfile.displayName || "يا صديقي";
  let headline = "";
  let subline = "";

  if (h >= 4 && h < 12) {
    headline = `يا صباح الفل والياسمين يا أ. ${name}! ☀️`;
    subline = "نهارك نادي ومليان بركة ورزق.. شغل موفق النهاردة بإذن الله";
  } else if (h >= 12 && h < 17) {
    headline = `يا مساء النشاط والجمال يا أ. ${name}! ✨`;
    subline = "تسلم إيدك على مجهودك الجميل.. ربنا يبارك في شغلك";
  } else {
    headline = `يا مساء الفل والروقان يا أ. ${name}! 🌙`;
    subline = "يعطيك العافية على تعبك النهاردة.. بالتوفيق دايماً في صفقات كتابية";
  }

  document.getElementById("greeting-headline").textContent = headline;
  document.getElementById("greeting-subline").textContent = subline;
}

function sortByNewest(arr) {
  return [...arr].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

async function recordAuditLog(actionTitle, detailsText) {
  if (!state.userEmail) return;
  try {
    await addDoc(collection(db, "activity_logs"), {
      actorEmail: state.userEmail,
      actorName: state.userProfile.displayName || state.userEmail,
      actorRole: state.userRole,
      actionTitle,
      detailsText,
      dateString: getTodayStr(),
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Audit log note:", e);
  }
}

function clearRealtimeListeners() {
  state.unsubscribers.forEach((u) => typeof u === "function" && u());
  state.unsubscribers = [];
}

// ==========================================================================
// 7. المصادقة وحفظ الجلسة وتسجيل الخروج من الملف الشخصي (Auth & Logout)
// ==========================================================================
document.getElementById("btn-google-login").addEventListener("click", async () => {
  document.getElementById("auth-error-box").style.display = "none";
  try {
    await setPersistence(auth, browserLocalPersistence);
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    console.error("Login Error:", err);
    const box = document.getElementById("auth-error-box");
    document.getElementById("auth-error-text").textContent =
      "تعذر فتح نافذة الدخول. تأكد من تفعيل Google في Firebase وإضافة الدومين.";
    box.style.display = "block";
  }
});

// تسجيل الخروج حصرياً من صفحة الملف الشخصي أو بوابة المؤلف
document.getElementById("btn-profile-logout").addEventListener("click", () => {
  document.getElementById("modal-logout").classList.add("show");
});

document.getElementById("btn-portal-logout").addEventListener("click", () => {
  document.getElementById("modal-logout").classList.add("show");
});

document.getElementById("btn-confirm-logout-now").addEventListener("click", async () => {
  document.getElementById("modal-logout").classList.remove("show");
  clearRealtimeListeners();
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  clearRealtimeListeners();
  const authScreen = document.getElementById("auth-screen");
  const appScreen = document.getElementById("app-screen");
  const errBox = document.getElementById("auth-error-box");
  const errText = document.getElementById("auth-error-text");

  if (!user || !user.email) {
    state.currentUser = null;
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
    return;
  }

  const email = user.email.trim().toLowerCase();
  state.currentUser = user;
  state.userEmail = email;

  try {
    const profSnap = await getDoc(doc(db, "user_profiles", email));
    if (profSnap.exists()) {
      const d = profSnap.data();
      state.userProfile.displayName = d.displayName || user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = d.avatarUrl || user.photoURL || FALLBACK_ICON_DATA;
    } else {
      state.userProfile.displayName = user.displayName || email.split("@")[0];
      state.userProfile.avatarUrl = user.photoURL || FALLBACK_ICON_DATA;
    }

    // 1. فحص الحاكم الخفي (الإدارة العليا)
    if (isSuperAdminEmail(email)) {
      state.userRole = "super_admin";
      state.permissions = { ...FULL_PERMISSIONS };
      bootApplicationUI();
      return;
    }

    // 2. فحص الموظف والصلاحيات الـ 8
    const staffSnap = await getDocs(query(collection(db, "staff"), where("email", "==", email)));
    if (!staffSnap.empty) {
      const sData = staffSnap.docs[0].data();
      if (sData.restricted) {
        await signOut(auth);
        errText.textContent = "تم تقييد وتجميد حسابك مؤقتاً من قِبل الإدارة.";
        errBox.style.display = "block";
        authScreen.style.display = "flex";
        appScreen.style.display = "none";
        return;
      }

      state.userRole = "employee";
      const p = sData.permissions || {};
      state.permissions = {
        sell: p.sell !== undefined ? !!p.sell : true,
        addBook: p.addBook !== undefined ? !!p.addBook : true,
        deleteBook: !!p.deleteBook,
        authors: p.authors !== undefined ? !!p.authors : true,
        payouts: !!p.payouts,
        expenses: !!p.expenses,
        financeView: !!p.financeView,
        reports: p.reports !== undefined ? !!p.reports : true
      };

      if (!profSnap.exists() && sData.name) {
        state.userProfile.displayName = sData.name;
      }
      bootApplicationUI();
      return;
    }

    // 3. فحص المؤلف
    const authorSnap = await getDocs(query(collection(db, "authors"), where("email", "==", email)));
    if (!authorSnap.empty) {
      const aDoc = authorSnap.docs[0];
      state.userRole = "author";
      state.currentAuthorProfile = { id: aDoc.id, ...aDoc.data() };
      state.userProfile.displayName = state.currentAuthorProfile.name || state.userProfile.displayName;
      if (state.currentAuthorProfile.avatarUrl) {
        state.userProfile.avatarUrl = state.currentAuthorProfile.avatarUrl;
      }
      bootApplicationUI();
      return;
    }

    // 4. غير مصرح له
    await signOut(auth);
    errText.textContent = `البريد (${email}) غير معتمد في النظام. الدخول للحسابات المضافة من الإدارة فقط.`;
    errBox.style.display = "block";
    authScreen.style.display = "flex";
    appScreen.style.display = "none";
  } catch (err) {
    console.error("Auth check error:", err);
    errText.textContent = "حدث خطأ في الاتصال بقاعدة البيانات. تأكد من نشر قواعد الأمان (Firestore Rules).";
    errBox.style.display = "block";
  }
});

// ==========================================================================
// 8. تهيئة واجهة النظام حسب الصلاحيات (Boot UI & Permissions)
// ==========================================================================
function bootApplicationUI() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";

  syncUserVisualProfile();
  refreshEgyptianGreeting();
  renderSmartGuide();

  const dlinkDash = document.getElementById("dlink-dashboard");
  const dlinkContracts = document.getElementById("dlink-contracts");
  const dlinkAuthors = document.getElementById("dlink-authors");
  const dlinkFinance = document.getElementById("dlink-finance");
  const dlinkStaff = document.getElementById("dlink-staff");
  const dlinkNotif = document.getElementById("dlink-notifications");
  const dockWrap = document.getElementById("floating-dock-container");

  if (state.userRole === "author") {
    dlinkDash.style.display = "none";
    dlinkContracts.style.display = "none";
    dlinkAuthors.style.display = "none";
    dlinkFinance.style.display = "none";
    dlinkStaff.style.display = "none";
    dlinkNotif.style.display = "none";
    dockWrap.style.display = "none";

    navigateToView("view-author-portal");
    startAuthorListeners(state.currentAuthorProfile.id);
    return;
  }

  const p = state.permissions;
  dockWrap.style.display = "flex";
  dlinkDash.style.display = "flex";
  dlinkContracts.style.display = "flex";
  dlinkAuthors.style.display = p.authors ? "flex" : "none";
  document.getElementById("dock-btn-authors").style.display = p.authors ? "flex" : "none";
  dlinkFinance.style.display = p.financeView || p.expenses ? "flex" : "none";
  dlinkStaff.style.display = state.userRole === "super_admin" ? "flex" : "none";
  dlinkNotif.style.display = "flex";

  // إظهار أو إخفاء الأزرار حسب الصلاحيات الـ 8
  document.getElementById("btn-top-add-contract").style.display = p.addBook ? "inline-flex" : "none";
  document.getElementById("qadd-contract").style.display = p.addBook ? "flex" : "none";
  document.getElementById("btn-author-new-contract").style.display = p.addBook ? "inline-flex" : "none";

  document.getElementById("btn-top-add-author").style.display = p.authors ? "inline-flex" : "none";
  document.getElementById("qadd-author").style.display = p.authors ? "flex" : "none";

  document.getElementById("btn-author-new-payout").style.display = p.payouts ? "inline-flex" : "none";
  document.getElementById("qadd-payout").style.display = p.payouts ? "flex" : "none";

  document.getElementById("btn-top-add-expense").style.display = p.expenses ? "inline-flex" : "none";
  document.getElementById("qadd-expense").style.display = p.expenses ? "flex" : "none";

  document.getElementById("btn-author-open-report").style.display = p.reports ? "inline-flex" : "none";
  document.getElementById("btn-notif-new").style.display = state.userRole === "super_admin" ? "inline-flex" : "none";
  document.getElementById("dashboard-metrics-grid").style.display = p.financeView ? "grid" : "none";

  checkActiveDraftBanner();
  navigateToView("view-dashboard");
  startAdminAndStaffListeners();
}

function syncUserVisualProfile() {
  const roleName =
    state.userRole === "super_admin"
      ? "إدارة النظام"
      : state.userRole === "employee"
      ? "فريق العمل"
      : "بوابة المؤلف";

  document.getElementById("header-role-subtitle").textContent = `${state.userProfile.displayName} • ${roleName}`;
  document.getElementById("drawer-user-name").textContent = state.userProfile.displayName;
  document.getElementById("drawer-user-role").textContent = roleName;

  document.getElementById("profile-card-name").textContent = state.userProfile.displayName;
  document.getElementById("profile-card-email").textContent = state.userEmail;
  document.getElementById("profile-card-role").textContent = roleName;
  document.getElementById("profile-name-input").value = state.userProfile.displayName;

  document.querySelectorAll(".js-user-avatar").forEach((img) => {
    img.src = state.userProfile.avatarUrl || FALLBACK_ICON_DATA;
    img.onerror = () => {
      img.src = FALLBACK_ICON_DATA;
    };
  });
}

// ==========================================================================
// 9. الاستماع اللحظي لقاعدة البيانات (Real-time Firestore Sync)
// ==========================================================================
function startAdminAndStaffListeners() {
  const unsubAuthors = onSnapshot(collection(db, "authors"), (snap) => {
    state.authors = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    populateAuthorDropdowns("");
    populatePayoutAuthorsDropdown();
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    updateFinancialSummary();
  });

  const unsubBooks = onSnapshot(collection(db, "books"), (snap) => {
    state.books = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    updateBookFilterCounts();
    renderDashboardBooksShowcase();
    renderContractsBooksGrid();
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    updateFinancialSummary();
    renderSalesChart();
  });

  const unsubSales = onSnapshot(collection(db, "sales"), (snap) => {
    state.sales = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    updateFinancialSummary();
  });

  const unsubExpenses = onSnapshot(collection(db, "expenses"), (snap) => {
    state.expenses = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    updateFinancialSummary();
  });

  const unsubPayouts = onSnapshot(collection(db, "payouts"), (snap) => {
    state.payouts = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderFinanceTimeline();
    renderAuthorsDirectory();
    if (state.selectedAuthorDetailId) renderAuthorDetailPage(state.selectedAuthorDetailId);
    updateFinancialSummary();
  });

  const unsubNotifs = onSnapshot(collection(db, "notifications"), (snap) => {
    state.notifications = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderNotificationsList();
  });

  const unsubLogs = onSnapshot(collection(db, "activity_logs"), (snap) => {
    state.activityLogs = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuditLogs();
    if (state.userRole === "super_admin") renderStaffCards();
  });

  if (state.userRole === "super_admin") {
    const unsubStaff = onSnapshot(collection(db, "staff"), (snap) => {
      state.staff = sortByNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      renderStaffCards();
      populateNotifTargetsDropdown();
    });
    state.unsubscribers.push(unsubStaff);
  }

  state.unsubscribers.push(
    unsubAuthors,
    unsubBooks,
    unsubSales,
    unsubExpenses,
    unsubPayouts,
    unsubNotifs,
    unsubLogs
  );
}

function startAuthorListeners(authorId) {
  const u1 = onSnapshot(doc(db, "authors", authorId), (s) => {
    if (s.exists()) {
      state.currentAuthorProfile = { id: s.id, ...s.data() };
      renderAuthorPortalView();
    }
  });

  const u2 = onSnapshot(query(collection(db, "books"), where("authorId", "==", authorId)), (s) => {
    state.books = sortByNewest(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortalView();
  });

  const u3 = onSnapshot(query(collection(db, "payouts"), where("authorId", "==", authorId)), (s) => {
    state.payouts = sortByNewest(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    renderAuthorPortalView();
  });

  state.unsubscribers.push(u1, u2, u3);
}

// ==========================================================================
// 10. محرك البحث الذكي الشامل (Instant Smart Search Engine)
// ==========================================================================
const globalSearchInput = document.getElementById("global-smart-search");
const quickResultsBox = document.getElementById("Quick-search-results-box");
const quickResultsContent = document.getElementById("global-search-results-content");

globalSearchInput.addEventListener("input", () => {
  const q = globalSearchInput.value.trim().toLowerCase();
  if (!q) {
    quickResultsBox.style.display = "none";
    return;
  }

  const matchedBooks = state.books.filter(
    (b) =>
      (b.title || "").toLowerCase().includes(q) ||
      (b.authorName || "").toLowerCase().includes(q) ||
      (b.category || "").toLowerCase().includes(q) ||
      (b.isbn || "").toLowerCase().includes(q)
  );

  const matchedAuthors = state.authors.filter(
    (a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q)
  );

  quickResultsBox.style.display = "block";

  if (!matchedBooks.length && !matchedAuthors.length) {
    quickResultsContent.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 14px;">لا توجد نتائج مطابقة لـ "${globalSearchInput.value}"</p>`;
    return;
  }

  const authorsHtml = matchedAuthors.length
    ? `<div style="margin-bottom: 14px;">
         <div style="font-size: 12px; font-weight: 800; color: var(--brand-gold); margin-bottom: 8px;">المؤلفون المطابقون (${matchedAuthors.length}):</div>
         ${matchedAuthors
           .slice(0, 4)
           .map(
             (a) => `
           <div class="row-item" style="cursor: pointer; padding: 10px 14px;" data-action="open-author" data-id="${a.id}">
             <div style="display: flex; align-items: center; gap: 10px;">
               <i class="ri-quill-pen-fill" style="color: var(--brand-gold); font-size: 18px;"></i>
               <div>
                 <strong style="font-size: 14px;">${a.name}</strong>
                 <span style="display: block; font-size: 11.5px; color: var(--text-secondary);" dir="ltr">${a.email}</span>
               </div>
             </div>
             <span class="badge gold">فتح ملف الكاتب وكتبه</span>
           </div>`
           )
           .join("")}
       </div>`
    : "";

  const booksHtml = matchedBooks.length
    ? `<div>
         <div style="font-size: 12px; font-weight: 800; color: var(--brand-crimson); margin-bottom: 8px;">الكتب والعقود المطابقة (${matchedBooks.length}):</div>
         <div class="books-showcase-grid">
           ${matchedBooks.slice(0, 4).map(buildVerticalBookCardHTML).join("")}
         </div>
       </div>`
    : "";

  quickResultsContent.innerHTML = authorsHtml + booksHtml;
});

document.getElementById("btn-clear-global-search").addEventListener("click", () => {
  globalSearchInput.value = "";
  quickResultsBox.style.display = "none";
});

// ==========================================================================
// 11. بناء بطاقات الكتب العمودية الفخمة والفلاتر (Hujariya Vertical Book Cards)
// ==========================================================================
function buildVerticalBookCardHTML(b) {
  const sold = Number(b.copiesSold || 0);
  const price = Number(b.price || 0);
  const rate = Number(b.royaltyRate || 0);
  const authorCut = sold * price * (rate / 100);
  const contract = getContractStatus(b.contractDate, b.contractMonths);
  const p = state.permissions;

  const coverContent = b.coverUrl
    ? `<img src="${b.coverUrl}" alt="${b.title}" loading="lazy" />`
    : `<div class="book-Fallback-cover">
         <i class="ri-book-open-fill"></i>
         <h4>${b.title}</h4>
         <span>${b.authorName || ""}</span>
       </div>`;

  return `
    <div class="book-v-card">
      <div class="book-cover-box" data-action="${p.sell ? "sell-book" : "open-author"}" data-id="${p.sell ? b.id : b.authorId}">
        <div class="cover-top-badges">
          <span class="contract-mini-pill ${contract.pillClass}">${contract.label}</span>
          <button type="button" class="btn-fav-overlay ${b.isFavorite ? "active" : ""}" data-action="toggle-fav" data-id="${b.id}" title="تمييز في المفضلة">
            <i class="${b.isFavorite ? "ri-star-fill" : "ri-star-line"}"></i>
          </button>
        </div>
        ${coverContent}
      </div>

      <div class="book-v-body">
        <div>
          <div class="book-v-title" title="${b.title}">${b.title}</div>
          <div class="book-v-author" data-action="open-author" data-id="${b.authorId}" title="اضغط لفتح ملف الكاتب">
            <i class="ri-quill-pen-line"></i> ${b.authorName || "غير محدد"}
          </div>
        </div>

        <div class="book-v-stats">
          <div>
            <span>سعر النسخة</span>
            <strong>${formatEGP(price)}</strong>
          </div>
          <div>
            <span>المباع</span>
            <strong style="color: var(--brand-crimson);">${sold} نسخة</strong>
          </div>
          <div>
            <span>ربح المؤلف (${rate}%)</span>
            <strong style="color: var(--success);">${formatEGP(authorCut)}</strong>
          </div>
          <div>
            <span>المخزون</span>
            <strong>${b.stock !== undefined && b.stock !== "" ? b.stock : "مفتوح"}</strong>
          </div>
        </div>

        <div class="book-v-actions">
          ${
            p.sell
              ? `<button type="button" class="btn-sell-card" data-action="sell-book" data-id="${b.id}">
                   <i class="ri-add-circle-fill"></i>
                   <span>بيع نسخة</span>
                 </button>`
              : ""
          }
          ${
            b.drivePdfUrl
              ? `<button type="button" class="circle-action-btn" style="width: 34px; height: 34px; font-size: 16px; color: var(--brand-crimson);" data-action="view-pdf" data-id="${b.id}" title="عرض وتحميل العقد PDF">
                   <i class="ri-file-pdf-2-fill"></i>
                 </button>`
              : ""
          }
          ${
            p.addBook
              ? `<button type="button" class="circle-action-btn" style="width: 34px; height: 34px; font-size: 16px;" data-action="edit-book" data-id="${b.id}" title="تعديل العقد والكتاب">
                   <i class="ri-edit-box-line"></i>
                 </button>`
              : ""
          }
          ${
            p.deleteBook
              ? `<button type="button" class="circle-action-btn" style="width: 34px; height: 34px; font-size: 16px; color: var(--danger);" data-action="delete-book" data-id="${b.id}" title="حذف الكتاب">
                   <i class="ri-delete-bin-6-line"></i>
                 </button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function updateBookFilterCounts() {
  const allCount = state.books.length;
  const favCount = state.books.filter((b) => b.isFavorite).length;
  const activeCount = state.books.filter((b) => !getContractStatus(b.contractDate, b.contractMonths).isExpiring).length;
  const expCount = state.books.filter((b) => getContractStatus(b.contractDate, b.contractMonths).isExpiring).length;

  document.getElementById("count-books-all").textContent = allCount;
  document.getElementById("count-books-fav").textContent = favCount;
  document.getElementById("count-books-active").textContent = activeCount;
  document.getElementById("count-books-expiring").textContent = expCount;
}

document.querySelectorAll("[data-book-filter]").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("[data-book-filter]").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    state.activeBookFilter = pill.getAttribute("data-book-filter");
    renderContractsBooksGrid();
  });
});

function renderDashboardBooksShowcase() {
  const box = document.getElementById("dashboard-books-showcase");
  if (!box) return;
  const favs = state.books.filter((b) => b.isFavorite);
  const list = favs.length ? favs.slice(0, 6) : state.books.slice(0, 6);

  if (!list.length) {
    box.innerHTML = `<div class="page-card" style="grid-column: 1/-1; padding: 28px; text-align: center; color: var(--text-muted);">لا توجد عقود كتب مسجلة بعد. اضغط زر (+) في الشريط السفلي لإضافة أول كاتب وعقد كتاب.</div>`;
    return;
  }
  box.innerHTML = list.map(buildVerticalBookCardHTML).join("");
}

function renderContractsBooksGrid() {
  const box = document.getElementById("contracts-books-grid");
  if (!box) return;
  const q = (document.getElementById("books-search-input").value || "").trim().toLowerCase();

  let list = [...state.books].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  if (state.activeBookFilter === "fav") {
    list = list.filter((b) => b.isFavorite);
  } else if (state.activeBookFilter === "active") {
    list = list.filter((b) => !getContractStatus(b.contractDate, b.contractMonths).isExpiring);
  } else if (state.activeBookFilter === "expiring") {
    list = list.filter((b) => getContractStatus(b.contractDate, b.contractMonths).isExpiring);
  }

  if (q) {
    list = list.filter(
      (b) =>
        (b.title || "").toLowerCase().includes(q) ||
        (b.authorName || "").toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q) ||
        (b.isbn || "").toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    box.innerHTML = `<div class="page-card" style="grid-column: 1/-1; padding: 34px; text-align: center; color: var(--text-muted);">لا توجد كتب مطابقة للفلتر أو البحث الحالي.</div>`;
    return;
  }
  box.innerHTML = list.map(buildVerticalBookCardHTML).join("");
}

document.getElementById("books-search-input").addEventListener("input", renderContractsBooksGrid);

// ==========================================================================
// 12. الإحصائيات المالية والرسوم البيانية التفاعلية (Financials & Chart.js)
// ==========================================================================
function updateFinancialSummary() {
  let totalRev = 0;
  let totalCopies = 0;
  let totalAuthorsEarned = 0;

  state.books.forEach((b) => {
    const c = Number(b.copiesSold || 0);
    const pr = Number(b.price || 0);
    const rate = Number(b.royaltyRate || 0);
    const rev = c * pr;
    totalCopies += c;
    totalRev += rev;
    totalAuthorsEarned += rev * (rate / 100);
  });

  const totalPaid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const unpaid = Math.max(0, totalAuthorsEarned - totalPaid);
  const totalExp = state.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRev - totalAuthorsEarned - totalExp;

  document.getElementById("stat-total-rev").textContent = formatEGP(totalRev);
  document.getElementById("stat-total-copies").textContent = `${totalCopies} نسخة مباعة`;
  document.getElementById("stat-net-profit").textContent = formatEGP(netProfit);
  document.getElementById("stat-authors-unpaid").textContent = formatEGP(unpaid);
  document.getElementById("stat-authors-paid").textContent = `سُدد: ${formatEGP(totalPaid)}`;
  document.getElementById("stat-total-exp").textContent = formatEGP(totalExp);
}

function renderSalesChart() {
  const canvas = document.getElementById("salesChartCanvas");
  if (!canvas || typeof Chart === "undefined") return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const labelColor = isDark ? "#e2e8f0" : "#141918";

  const top = [...state.books]
    .sort((a, b) => Number(b.copiesSold || 0) - Number(a.copiesSold || 0))
    .slice(0, 6);

  const labels = top.length ? top.map((b) => b.title) : ["لا توجد مبيعات بعد"];
  const revData = top.length ? top.map((b) => Number(b.copiesSold || 0) * Number(b.price || 0)) : [0];
  const copiesData = top.length ? top.map((b) => Number(b.copiesSold || 0)) : [0];

  if (state.chartInstance) state.chartInstance.destroy();

  const palette = ["#b91c1c", "#b88928", "#0d9488", "#141c1b", "#2563eb", "#7c3aed"];

  const datasets =
    state.currentChartType === "doughnut"
      ? [{ label: "إجمالي المبيعات (ج.م)", data: revData, backgroundColor: palette, borderWidth: 2 }]
      : [
          {
            label: "الإيرادات (ج.م)",
            data: revData,
            backgroundColor: "rgba(185, 28, 28, 0.82)",
            borderColor: "#b91c1c",
            borderWidth: 2,
            borderRadius: 6,
            tension: 0.35
          },
          {
            label: "النسخ المباعة",
            data: copiesData,
            backgroundColor: "rgba(184, 137, 40, 0.85)",
            borderColor: "#b88928",
            borderWidth: 2,
            borderRadius: 6,
            tension: 0.35
          }
        ];

  state.chartInstance = new Chart(canvas, {
    type: state.currentChartType,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: labelColor, font: { family: "Tajawal", weight: "bold", size: 12 } } }
      },
      scales:
        state.currentChartType === "doughnut"
          ? {}
          : {
              x: { ticks: { color: labelColor, font: { family: "Tajawal" } } },
              y: { ticks: { color: labelColor, font: { family: "Tajawal" } } }
            }
    }
  });
}

document.querySelectorAll(".js-chart-type").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".js-chart-type").forEach((b) => {
      b.className = "btn btn-outline js-chart-type";
    });
    btn.className = "btn btn-dark js-chart-type";
    state.currentChartType = btn.getAttribute("data-type");
    renderSalesChart();
  });
});

// ==========================================================================
// 13. دليل الكُتّاب والملف الشخصي المستقل لكل كاتب (Author Profile & Books)
// ==========================================================================
function renderAuthorsDirectory() {
  const box = document.getElementById("authors-directory-grid");
  if (!box) return;
  const q = (document.getElementById("authors-search-input").value || "").trim().toLowerCase();

  const filtered = state.authors.filter(
    (a) =>
      (a.name || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phone || "").toLowerCase().includes(q)
  );

  if (!filtered.length) {
    box.innerHTML = `<div class="page-card" style="grid-column: 1/-1; padding: 34px; text-align: center; color: var(--text-muted);">لا يوجد مؤلفون مسجلون حالياً. اضغط "إضافة كاتب" للبدء.</div>`;
    return;
  }

  box.innerHTML = filtered
    .map((a) => {
      const aBooks = state.books.filter((b) => b.authorId === a.id);
      const copies = aBooks.reduce((s, b) => s + Number(b.copiesSold || 0), 0);
      const earned = aBooks.reduce(
        (s, b) => s + Number(b.copiesSold || 0) * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100),
        0
      );
      const paid = state.payouts
        .filter((p) => p.authorId === a.id)
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const balance = Math.max(0, earned - paid);

      const avatar = a.avatarUrl
        ? `<img src="${a.avatarUrl}" class="author-avatar" alt="${a.name}" />`
        : `<div class="author-avatar">${(a.name || "ك")[0]}</div>`;

      return `
        <div class="author-card">
          <div class="author-card-head" data-action="open-author" data-id="${a.id}">
            ${avatar}
            <div style="flex: 1; min-width: 0;">
              <span class="badge gold">${aBooks.length} مؤلفات مرتبطة</span>
              <h4 style="font-size: 16px; font-weight: 800; margin-top: 4px;">${a.name}</h4>
              <p style="font-size: 12px; color: var(--text-secondary);" dir="ltr">${a.email}</p>
            </div>
          </div>

          <div class="book-v-stats">
            <div><span>إجمالي المبيعات</span><strong>${copies} نسخة</strong></div>
            <div><span>الرصيد المستحق</span><strong style="color: var(--brand-crimson);">${formatEGP(balance)}</strong></div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-dark" style="flex: 1; padding: 8px 12px; font-size: 12.5px;" data-action="open-author" data-id="${a.id}">
              <i class="ri-folder-user-line"></i><span>ملف الكاتب وكتبه</span>
            </button>
            <button type="button" class="circle-action-btn" data-action="edit-author" data-id="${a.id}" title="تعديل بيانات الكاتب">
              <i class="ri-edit-box-line"></i>
            </button>
            <button type="button" class="circle-action-btn" style="color: var(--danger);" data-action="delete-author" data-id="${a.id}" title="حذف الكاتب">
              <i class="ri-delete-bin-6-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("authors-search-input").addEventListener("input", renderAuthorsDirectory);

function renderAuthorDetailPage(authorId) {
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;

  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let copies = 0;
  let earned = 0;
  aBooks.forEach((b) => {
    const c = Number(b.copiesSold || 0);
    copies += c;
    earned += c * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100);
  });

  const paid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  const avatar = a.avatarUrl
    ? `<img src="${a.avatarUrl}" class="author-avatar" />`
    : `<div class="author-avatar">${(a.name || "ك")[0]}</div>`;

  document.getElementById("author-profile-banner").innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      ${avatar}
      <div>
        <h3 style="font-size: 18px; font-weight: 800;">أ. ${a.name}</h3>
        <p style="font-size: 12.5px; color: var(--text-secondary);" dir="ltr">${a.email} ${a.phone ? "• " + a.phone : ""}</p>
        ${a.bio ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">${a.bio}</p>` : ""}
      </div>
    </div>
    <span class="badge green">حساب المؤلف نشط</span>
  `;

  document.getElementById("author-det-earned").textContent = formatEGP(earned);
  document.getElementById("author-det-copies").textContent = `${copies} نسخة مباعة`;
  document.getElementById("author-det-paid").textContent = formatEGP(paid);
  document.getElementById("author-det-balance").textContent = formatEGP(balance);

  const booksGrid = document.getElementById("author-det-books-grid");
  booksGrid.innerHTML = aBooks.length
    ? aBooks.map(buildVerticalBookCardHTML).join("")
    : `<div class="page-card" style="grid-column: 1/-1; padding: 26px; text-align: center; color: var(--text-muted);">لا توجد كتب مرتبطة بهذا المؤلف حتى الآن. اضغط "إضافة عقد كتاب للمؤلف".</div>`;

  const payoutsBox = document.getElementById("author-det-payouts-list");
  payoutsBox.innerHTML = aPayouts.length
    ? aPayouts
        .map(
          (p) => `
        <div class="row-item">
          <div>
            <h4 style="font-size: 14.5px; font-weight: 800; color: var(--success);">دفعة مسددة: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${p.method} • التاريخ: ${p.dateString} ${p.notes ? "• " + p.notes : ""}</p>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${
              p.receiptUrl
                ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;"><i class="ri-image-line"></i><span>عرض الإيصال</span></a>`
                : `<span class="badge amber">بدون إيصال</span>`
            }
            ${
              state.permissions.payouts
                ? `<button type="button" class="circle-action-btn" style="color: var(--danger);" data-action="delete-payout" data-id="${p.id}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>
        </div>`
        )
        .join("")
    : `<div class="page-card" style="padding: 20px; text-align: center; color: var(--text-muted);">لا توجد دفعات مسجلة لهذا المؤلف بعد.</div>`;
}

document.getElementById("btn-back-authors-list").addEventListener("click", () => {
  state.selectedAuthorDetailId = null;
  navigateToView("view-authors");
});

// ==========================================================================
// 14. معالج الأحداث الموحد (بيع نسخة، مفضلة، عارض PDF، تعديل وحذف)
// ==========================================================================
document.addEventListener("click", async (e) => {
  const closeM = e.target.closest("[data-close-modal]");
  if (closeM) {
    document.getElementById(closeM.getAttribute("data-close-modal")).classList.remove("show");
    return;
  }

  const actEl = e.target.closest("[data-action]");
  if (!actEl) return;
  e.stopPropagation();

  const action = actEl.getAttribute("data-action");
  const id = actEl.getAttribute("data-id");

  if (action === "sell-book") {
    openSellModal(id);
  } else if (action === "toggle-fav") {
    const b = state.books.find((x) => x.id === id);
    if (b) {
      await updateDoc(doc(db, "books", id), { isFavorite: !b.isFavorite });
      showToast(!b.isFavorite ? "تمت إضافة الكتاب للمفضلة ⭐️" : "تمت إزالة الكتاب من المفضلة");
    }
  } else if (action === "view-pdf") {
    openPdfViewerPage(id);
  } else if (action === "edit-book") {
    openBookFormPage(id, null);
  } else if (action === "delete-book") {
    const b = state.books.find((x) => x.id === id);
    if (!b) return;
    openConfirmModal("حذف عقد الكتاب", `هل أنت متأكد من حذف عقد وبيانات كتاب "${b.title}" نهائياً؟`, async () => {
      await deleteDoc(doc(db, "books", id));
      await recordAuditLog("حذف كتاب", `حذف عقد كتاب: ${b.title}`);
      showToast("تم حذف الكتاب");
    });
  } else if (action === "open-author") {
    if (!id) return;
    quickResultsBox.style.display = "none";
    state.selectedAuthorDetailId = id;
    renderAuthorDetailPage(id);
    navigateToView("view-author-detail");
  } else if (action === "edit-author") {
    openAuthorFormPage(id);
  } else if (action === "delete-author") {
    const a = state.authors.find((x) => x.id === id);
    if (!a) return;
    openConfirmModal("حذف ملف الكاتب", `هل أنت متأكد من حذف ملف الكاتب "${a.name}"؟`, async () => {
      await deleteDoc(doc(db, "authors", id));
      await recordAuditLog("حذف كاتب", `حذف ملف الكاتب: ${a.name}`);
      showToast("تم حذف ملف الكاتب");
    });
  } else if (action === "delete-payout") {
    openConfirmModal("حذف دفعة مالية", "هل تريد حذف سجل هذه الدفعة المالية؟", async () => {
      await deleteDoc(doc(db, "payouts", id));
      showToast("تم حذف الدفعة");
    });
  } else if (action === "delete-sale") {
    const bookId = actEl.getAttribute("data-book-id");
    const qty = Number(actEl.getAttribute("data-qty") || 1);
    openConfirmModal("إلغاء عملية بيع", `سيتم إلغاء بيع (${qty}) نسخة وإرجاعها للمخزون. هل أنت متأكد؟`, async () => {
      await deleteDoc(doc(db, "sales", id));
      if (bookId) await updateDoc(doc(db, "books", bookId), { copiesSold: increment(-qty) });
      await recordAuditLog("إلغاء بيعة", `إلغاء بيع (${qty} نسخة)`);
      showToast("تم إلغاء عملية البيع");
    });
  } else if (action === "delete-expense") {
    openConfirmModal("حذف مصروف", "هل أنت متأكد من حذف هذا المصروف التشغيلي؟", async () => {
      await deleteDoc(doc(db, "expenses", id));
      showToast("تم حذف المصروف");
    });
  } else if (action === "edit-staff") {
    openStaffFormPage(id);
  } else if (action === "inspect-staff") {
    state.inspectingStaffEmail = actEl.getAttribute("data-email");
    const name = actEl.getAttribute("data-name");
    document.getElementById("audit-log-title").innerHTML = `<i class="ri-eye-fill" style="color: var(--brand-crimson);"></i> <span>مراقبة سجل نشاط الموظف: ${name}</span>`;
    document.getElementById("btn-back-my-logs").style.display = "inline-flex";
    renderAuditLogs();
    navigateToView("view-profile");
  } else if (action === "delete-staff") {
    openConfirmModal("حذف موظف", "هل أنت متأكد من سحب الصلاحية وحذف هذا الموظف؟", async () => {
      await deleteDoc(doc(db, "staff", id));
      showToast("تم حذف الموظف");
    });
  }
});

// --- أ) نافذة تأكيد البيع ---
function openSellModal(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;
  document.getElementById("sell-confirm-book-id").value = b.id;
  document.getElementById("sell-confirm-book-title").textContent = `${b.title} (${formatEGP(b.price)})`;
  const qtyInput = document.getElementById("sell-confirm-qty");
  qtyInput.value = 1;
  document.getElementById("sell-confirm-total").textContent = formatEGP(b.price);

  qtyInput.oninput = () => {
    const q = Math.max(1, Number(qtyInput.value || 1));
    document.getElementById("sell-confirm-total").textContent = formatEGP(q * Number(b.price || 0));
  };
  document.getElementById("modal-sell").classList.add("show");
}

document.getElementById("form-sell-confirm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bookId = document.getElementById("sell-confirm-book-id").value;
  const qty = Math.max(1, Number(document.getElementById("sell-confirm-qty").value || 1));
  const channel = document.getElementById("sell-confirm-channel").value;
  const b = state.books.find((x) => x.id === bookId);
  if (!b) return;

  const totalAmount = Number(b.price || 0) * qty;
  const authorCut = Number((totalAmount * (Number(b.royaltyRate || 0) / 100)).toFixed(2));
  const houseCut = Number((totalAmount - authorCut).toFixed(2));

  document.getElementById("modal-sell").classList.remove("show");

  try {
    const upd = { copiesSold: increment(qty) };
    if (b.stock !== undefined && b.stock !== null && b.stock !== "") {
      upd.stock = Math.max(0, Number(b.stock) - qty);
    }
    await updateDoc(doc(db, "books", bookId), upd);

    await addDoc(collection(db, "sales"), {
      bookId: b.id,
      bookTitle: b.title,
      authorId: b.authorId,
      authorName: b.authorName,
      qty,
      unitPrice: Number(b.price || 0),
      totalAmount,
      channel,
      authorCut,
      houseCut,
      soldBy: state.userEmail,
      soldByName: state.userProfile.displayName,
      dateString: getTodayStr(),
      createdAt: serverTimestamp()
    });

    await recordAuditLog("توثيق بيع", `بيع (${qty} نسخة) من "${b.title}" عبر (${channel}) بقيمة ${formatEGP(totalAmount)}`);
    showToast(`تم توثيق بيع (${qty}) نسخة من "${b.title}"!`);
  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء تسجيل البيع", "ri-error-warning-fill");
  }
});

// ==========================================================================
// 15. صفحات الإدخال الكاملة (الكاتب، عقد الكتاب، الدفعات، المصاريف، الموظفين)
// ==========================================================================

// --- 1. صفحة الكاتب ---
document.getElementById("btn-top-add-author").addEventListener("click", () => openAuthorFormPage(null));

function openAuthorFormPage(editId = null) {
  const form = document.getElementById("form-author");
  form.reset();
  if (editId) {
    const a = state.authors.find((x) => x.id === editId);
    if (!a) return;
    document.getElementById("author-id-field").value = a.id;
    document.getElementById("author-name-field").value = a.name || "";
    document.getElementById("author-email-field").value = a.email || "";
    document.getElementById("author-phone-field").value = a.phone || "";
    document.getElementById("author-bio-field").value = a.bio || "";
    document.getElementById("author-welcome-wrap").style.display = "none";
    document.getElementById("form-author-title").textContent = `تعديل ملف الكاتب: ${a.name}`;
  } else {
    document.getElementById("author-id-field").value = "";
    document.getElementById("author-welcome-wrap").style.display = "flex";
    document.getElementById("form-author-title").textContent = "إنشاء ملف شخصي لكاتب جديد";
    restoreDraftInputs("author_");
  }
  navigateToView("view-form-author");
}

document.getElementById("form-author").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-author");
  btn.disabled = true;

  const id = document.getElementById("author-id-field").value;
  const photoFile = document.getElementById("author-photo-file").files[0];
  const sendWelcome = document.getElementById("author-welcome-check").checked;

  const payload = {
    name: document.getElementById("author-name-field").value.trim(),
    email: document.getElementById("author-email-field").value.trim().toLowerCase(),
    phone: document.getElementById("author-phone-field").value.trim(),
    bio: document.getElementById("author-bio-field").value.trim()
  };

  try {
    if (photoFile) {
      showToast("جاري ضغط ورفع صورة المؤلف...", "ri-upload-cloud-2-line");
      payload.avatarUrl = await compressAndUploadToImgBB(photoFile);
    }

    if (id) {
      await updateDoc(doc(db, "authors", id), payload);
      await recordAuditLog("تعديل كاتب", `تحديث ملف الكاتب: ${payload.name}`);
      clearDraftByPrefix("author_");
      showToast("تم تحديث ملف الكاتب");
      navigateToView("view-authors");
    } else {
      payload.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, "authors"), payload);
      await recordAuditLog("إضافة كاتب", `إنشاء ملف الكاتب: ${payload.name}`);
      clearDraftByPrefix("author_");
      showToast("تم إنشاء ملف الكاتب بنجاح!");
      if (sendWelcome) {
        openReportPage(docRef.id, "welcome");
      } else {
        state.selectedAuthorDetailId = docRef.id;
        navigateToView("view-author-detail");
      }
    }
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ بيانات الكاتب", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- 2. صفحة عقد الكتاب ---
function populateAuthorDropdowns(filterText = "") {
  const sel = document.getElementById("book-author-select");
  if (!sel) return;
  const current = sel.value;
  const q = filterText.trim().toLowerCase();
  const list = state.authors.filter(
    (a) => (a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q)
  );
  sel.innerHTML =
    `<option value="">-- اختر المؤلف صاحب العقد --</option>` +
    list.map((a) => `<option value="${a.id}">${a.name} (${a.email})</option>`).join("");
  if (current && list.some((a) => a.id === current)) sel.value = current;
}

document.getElementById("book-author-filter").addEventListener("input", (e) => {
  populateAuthorDropdowns(e.target.value);
});

document.getElementById("btn-top-add-contract").addEventListener("click", () => openBookFormPage(null, null));
document.getElementById("btn-author-new-contract").addEventListener("click", () =>
  openBookFormPage(null, state.selectedAuthorDetailId)
);

function openBookFormPage(editBookId = null, preAuthorId = null) {
  if (!state.authors.length) {
    showToast("يرجى إضافة ملف كاتب أولاً قبل توثيق عقد كتاب!", "ri-information-fill");
    openAuthorFormPage(null);
    return;
  }
  const form = document.getElementById("form-book");
  form.reset();
  populateAuthorDropdowns("");

  if (editBookId) {
    const b = state.books.find((x) => x.id === editBookId);
    if (!b) return;
    document.getElementById("book-id-field").value = b.id;
    document.getElementById("book-title-field").value = b.title || "";
    document.getElementById("book-author-select").value = b.authorId || "";
    document.getElementById("book-price-field").value = b.price || "";
    document.getElementById("book-royalty-field").value = b.royaltyRate ?? 20;
    document.getElementById("book-months-field").value = b.contractMonths || 24;
    document.getElementById("book-date-field").value = b.contractDate || getTodayStr();
    document.getElementById("book-fav-check").checked = !!b.isFavorite;
    document.getElementById("book-drive-field").value = b.drivePdfUrl || "";
    document.getElementById("book-isbn-field").value = b.isbn || "";
    document.getElementById("book-cat-field").value = b.category || "";
    document.getElementById("book-edition-field").value = b.edition || "";
    document.getElementById("book-pages-field").value = b.pages || "";
    document.getElementById("book-stock-field").value = b.stock ?? "";
    document.getElementById("book-notes-field").value = b.notes || "";
    document.getElementById("form-book-title").textContent = `تعديل عقد وبيانات كتاب: ${b.title}`;
  } else {
    document.getElementById("book-id-field").value = "";
    document.getElementById("book-date-field").value = getTodayStr();
    restoreDraftInputs("book_");
    if (preAuthorId) document.getElementById("book-author-select").value = preAuthorId;
    document.getElementById("form-book-title").textContent = "توثيق عقد كتاب جديد";
  }
  navigateToView("view-form-book");
}

document.getElementById("form-book").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-book");
  btn.disabled = true;

  const id = document.getElementById("book-id-field").value;
  const authorId = document.getElementById("book-author-select").value;
  const authorObj = state.authors.find((a) => a.id === authorId);
  const coverFile = document.getElementById("book-cover-file").files[0];
  const stockRaw = document.getElementById("book-stock-field").value;

  const payload = {
    title: document.getElementById("book-title-field").value.trim(),
    authorId,
    authorName: authorObj ? authorObj.name : "غير محدد",
    price: Number(document.getElementById("book-price-field").value),
    royaltyRate: Number(document.getElementById("book-royalty-field").value),
    contractMonths: Number(document.getElementById("book-months-field").value),
    contractDate: document.getElementById("book-date-field").value,
    isFavorite: document.getElementById("book-fav-check").checked,
    drivePdfUrl: document.getElementById("book-drive-field").value.trim(),
    isbn: document.getElementById("book-isbn-field").value.trim(),
    category: document.getElementById("book-cat-field").value.trim(),
    edition: document.getElementById("book-edition-field").value.trim(),
    pages: document.getElementById("book-pages-field").value.trim(),
    stock: stockRaw !== "" ? Number(stockRaw) : "",
    notes: document.getElementById("book-notes-field").value.trim()
  };

  try {
    if (coverFile) {
      showToast("جاري ضغط ورفع غلاف الكتاب...", "ri-upload-cloud-2-line");
      payload.coverUrl = await compressAndUploadToImgBB(coverFile);
    }

    if (id) {
      await updateDoc(doc(db, "books", id), payload);
      await recordAuditLog("تعديل عقد كتاب", `تحديث عقد كتاب: ${payload.title}`);
      clearDraftByPrefix("book_");
      showToast("تم تحديث الكتاب والعقد");
    } else {
      payload.copiesSold = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "books"), payload);
      await recordAuditLog("إضافة عقد كتاب", `توثيق عقد كتاب "${payload.title}" للمؤلف ${payload.authorName}`);
      clearDraftByPrefix("book_");
      showToast("تم توثيق عقد الكتاب بنجاح!");
    }

    if (state.selectedAuthorDetailId === authorId) {
      navigateToView("view-author-detail");
    } else {
      navigateToView("view-contracts");
    }
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ الكتاب", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- 3. عارض عقود الـ PDF المدمج ---
function openPdfViewerPage(bookId) {
  const b = state.books.find((x) => x.id === bookId);
  if (!b || !b.drivePdfUrl) return;
  const parsed = parseDrivePdfLink(b.drivePdfUrl);
  document.getElementById("pdf-viewer-heading").innerHTML = `<i class="ri-file-pdf-2-fill" style="color: var(--danger);"></i> وثيقة عقد كتاب: ${b.title}`;
  document.getElementById("pdf-iframe").src = parsed.previewUrl;
  document.getElementById("btn-pdf-download").href = parsed.downloadUrl;
  state.returnViewBeforePdf = state.userRole === "author" ? "view-author-portal" : "view-contracts";
  navigateToView("view-pdf-viewer");
}

document.getElementById("btn-close-pdf-view").addEventListener("click", () => {
  document.getElementById("pdf-iframe").src = "";
  navigateToView(state.returnViewBeforePdf);
});

// --- 4. صفحة الدفعات والإيصالات ---
function populatePayoutAuthorsDropdown() {
  const sel = document.getElementById("payout-author-select");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">-- اختر المؤلف المستفيد --</option>` +
    state.authors.map((a) => `<option value="${a.id}">${a.name} (${a.email})</option>`).join("");
  if (cur) sel.value = cur;
}

document.getElementById("btn-author-new-payout").addEventListener("click", () => {
  openPayoutFormPage(state.selectedAuthorDetailId);
});

function openPayoutFormPage(preAuthorId = null) {
  if (!state.authors.length) {
    showToast("أضف ملف كاتب أولاً!", "ri-information-fill");
    return;
  }
  document.getElementById("form-payout").reset();
  populatePayoutAuthorsDropdown();
  restoreDraftInputs("payout_");
  if (preAuthorId) document.getElementById("payout-author-select").value = preAuthorId;
  navigateToView("view-form-payout");
}

document.getElementById("form-payout").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-submit-payout");
  btn.disabled = true;

  const authorId = document.getElementById("payout-author-select").value;
  const author = state.authors.find((a) => a.id === authorId);
  const amount = Number(document.getElementById("payout-amount-field").value);
  const method = document.getElementById("payout-method-field").value;
  const notes = document.getElementById("payout-notes-field").value.trim();
  const receiptFile = document.getElementById("payout-receipt-file").files[0];

  try {
    let receiptUrl = "";
    if (receiptFile) {
      showToast("جاري ضغط ورفع صورة الإيصال...", "ri-upload-cloud-2-line");
      receiptUrl = await compressAndUploadToImgBB(receiptFile, 1000, 0.82);
    }

    await addDoc(collection(db, "payouts"), {
      authorId,
      authorName: author ? author.name : "مؤلف",
      amount,
      method,
      notes,
      receiptUrl,
      paidBy: state.userEmail,
      dateString: getTodayStr(),
      createdAt: serverTimestamp()
    });

    await recordAuditLog("تسديد دفعة لمؤلف", `تحويل ${formatEGP(amount)} للمؤلف (${author ? author.name : ""}) عبر ${method}`);
    clearDraftByPrefix("payout_");
    showToast("تم توثيق الدفعة والإيصال بنجاح!");
    state.selectedAuthorDetailId = authorId;
    renderAuthorDetailPage(authorId);
    navigateToView("view-author-detail");
  } catch (err) {
    console.error(err);
    showToast("تعذر حفظ الدفعة", "ri-error-warning-fill");
  } finally {
    btn.disabled = false;
  }
});

// --- 5. صفحة المصاريف والسجل المالي ---
document.getElementById("btn-top-add-expense").addEventListener("click", openExpenseFormPage);

function openExpenseFormPage() {
  document.getElementById("form-expense").reset();
  restoreDraftInputs("exp_");
  navigateToView("view-form-expense");
}

document.getElementById("form-expense").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("expense-title-field").value.trim();
  const amount = Number(document.getElementById("expense-amount-field").value);
  const category = document.getElementById("expense-cat-field").value;

  try {
    await addDoc(collection(db, "expenses"), {
      title,
      amount,
      category,
      addedBy: state.userProfile.displayName || state.userEmail,
      dateString: getTodayStr(),
      createdAt: serverTimestamp()
    });
    await recordAuditLog("تسجيل مصروف", `مصروف (${title}) بقيمة ${formatEGP(amount)}`);
    clearDraftByPrefix("exp_");
    showToast("تم توثيق المصروف التشغيلي");
    navigateToView("view-finance");
  } catch (err) {
    console.error(err);
  }
});

function renderFinanceTimeline() {
  const box = document.getElementById("finance-timeline-list");
  if (!box) return;
  const combined = sortByNewest([
    ...state.sales.map((s) => ({ ...s, kind: "sale" })),
    ...state.expenses.map((x) => ({ ...x, kind: "expense" })),
    ...state.payouts.map((p) => ({ ...p, kind: "payout" }))
  ]);

  if (!combined.length) {
    box.innerHTML = `<div class="page-card" style="padding: 30px; text-align: center; color: var(--text-muted);">لا توجد حركات مالية موثقة بعد.</div>`;
    return;
  }

  box.innerHTML = combined
    .slice(0, 80)
    .map((item) => {
      if (item.kind === "sale") {
        const qty = Number(item.qty || 1);
        const tot = Number(item.totalAmount || item.price || 0);
        return `
          <div class="row-item">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">بيع (${qty} نسخة): ${item.bookTitle} <span class="badge green">+${formatEGP(tot)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">المؤلف: ${item.authorName} • القناة: ${item.channel || "مباشر"} • بواسطة: ${item.soldByName || item.soldBy} • ${item.dateString}</p>
            </div>
            ${
              state.userRole === "super_admin"
                ? `<button type="button" class="circle-action-btn" style="color: var(--danger);" data-action="delete-sale" data-id="${item.id}" data-book-id="${item.bookId}" data-qty="${qty}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>`;
      } else if (item.kind === "payout") {
        return `
          <div class="row-item">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">حوالة مسددة للمؤلف: ${item.authorName} <span class="badge gold">-${formatEGP(item.amount)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${item.method} • ${item.dateString} ${item.receiptUrl ? `• <a href="${item.receiptUrl}" target="_blank" style="color: var(--brand-crimson); font-weight: 800;">عرض الإيصال</a>` : ""}</p>
            </div>
          </div>`;
      } else {
        return `
          <div class="row-item">
            <div>
              <h4 style="font-size: 14.5px; font-weight: 800;">مصروف تشغيلي: ${item.title} <span class="badge red">-${formatEGP(item.amount)}</span></h4>
              <p style="font-size: 12px; color: var(--text-secondary);">${item.category} • بواسطة: ${item.addedBy} • ${item.dateString}</p>
            </div>
            ${
              state.permissions.expenses
                ? `<button type="button" class="circle-action-btn" style="color: var(--danger);" data-action="delete-expense" data-id="${item.id}"><i class="ri-delete-bin-line"></i></button>`
                : ""
            }
          </div>`;
      }
    })
    .join("");
}

// ==========================================================================
// 16. إدارة الموظفين ومصفوفة الصلاحيات الـ 8 المرنة (Staff Management)
// ==========================================================================
document.getElementById("btn-top-add-staff").addEventListener("click", () => openStaffFormPage(null));

document.getElementById("btn-staff-all-perms").addEventListener("click", () => {
  ["perm-sell", "perm-add-book", "perm-delete-book", "perm-authors", "perm-payouts", "perm-expenses", "perm-finance-view", "perm-reports"].forEach((id) => {
    document.getElementById(id).checked = true;
  });
});

document.getElementById("btn-staff-sell-only").addEventListener("click", () => {
  ["perm-add-book", "perm-delete-book", "perm-authors", "perm-payouts", "perm-expenses", "perm-finance-view", "perm-reports"].forEach((id) => {
    document.getElementById(id).checked = false;
  });
  document.getElementById("perm-sell").checked = true;
});

function openStaffFormPage(editId = null) {
  const form = document.getElementById("form-staff");
  form.reset();
  if (editId) {
    const s = state.staff.find((x) => x.id === editId);
    if (!s) return;
    document.getElementById("staff-id-field").value = s.id;
    document.getElementById("staff-name-field").value = s.name || "";
    document.getElementById("staff-email-field").value = s.email || "";
    document.getElementById("staff-job-field").value = s.jobTitle || "";

    const p = s.permissions || FULL_PERMISSIONS;
    document.getElementById("perm-sell").checked = !!p.sell;
    document.getElementById("perm-add-book").checked = p.addBook !== undefined ? !!p.addBook : true;
    document.getElementById("perm-delete-book").checked = !!p.deleteBook;
    document.getElementById("perm-authors").checked = p.authors !== undefined ? !!p.authors : true;
    document.getElementById("perm-payouts").checked = !!p.payouts;
    document.getElementById("perm-expenses").checked = !!p.expenses;
    document.getElementById("perm-finance-view").checked = !!p.financeView;
    document.getElementById("perm-reports").checked = p.reports !== undefined ? !!p.reports : true;
    document.getElementById("staff-restricted-check").checked = !!s.restricted;

    document.getElementById("form-staff-title").textContent = `تعديل صلاحيات الموظف: ${s.name}`;
  } else {
    document.getElementById("staff-id-field").value = "";
    document.getElementById("form-staff-title").textContent = "إضافة موظف وتخصيص صلاحياته";
    restoreDraftInputs("staff_");
  }
  navigateToView("view-form-staff");
}

document.getElementById("form-staff").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("staff-id-field").value;
  const email = document.getElementById("staff-email-field").value.trim().toLowerCase();

  if (isSuperAdminEmail(email)) {
    showToast("هذا البريد يتمتع بصلاحية عليا تلقائياً ولا يضاف كموظف", "ri-shield-star-line");
    return;
  }

  const permissions = {
    sell: document.getElementById("perm-sell").checked,
    addBook: document.getElementById("perm-add-book").checked,
    deleteBook: document.getElementById("perm-delete-book").checked,
    authors: document.getElementById("perm-authors").checked,
    payouts: document.getElementById("perm-payouts").checked,
    expenses: document.getElementById("perm-expenses").checked,
    financeView: document.getElementById("perm-finance-view").checked,
    reports: document.getElementById("perm-reports").checked
  };

  const payload = {
    name: document.getElementById("staff-name-field").value.trim(),
    email,
    jobTitle: document.getElementById("staff-job-field").value.trim(),
    permissions,
    restricted: document.getElementById("staff-restricted-check").checked
  };

  try {
    if (id) {
      await updateDoc(doc(db, "staff", id), payload);
      showToast("تم تحديث صلاحيات الموظف");
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "staff"), payload);
      showToast("تم اعتماد الموظف وصلاحياته بنجاح!");
    }
    clearDraftByPrefix("staff_");
    navigateToView("view-staff");
  } catch (err) {
    console.error(err);
  }
});

function renderStaffCards() {
  const box = document.getElementById("staff-cards-grid");
  if (!box) return;
  const list = state.staff.filter((s) => !isSuperAdminEmail(s.email));

  if (!list.length) {
    box.innerHTML = `<div class="page-card" style="grid-column: 1/-1; padding: 34px; text-align: center; color: var(--text-muted);">لا يوجد موظفون مضافون حالياً. اضغط "إضافة موظف وتخصيص صلاحياته".</div>`;
    return;
  }

  box.innerHTML = list
    .map((s) => {
      const logsCount = state.activityLogs.filter((l) => l.actorEmail === s.email).length;
      const p = s.permissions || {};
      const activeCount = Object.values(p).filter(Boolean).length;

      return `
        <div class="author-card">
          <div class="author-card-head">
            <div class="author-avatar"><i class="ri-user-settings-fill"></i></div>
            <div>
              ${s.restricted ? `<span class="badge red">مقيّد / مجمد</span>` : `<span class="badge green">نشط (${activeCount}/8 صلاحيات)</span>`}
              <h4 style="font-size: 16px; font-weight: 800; margin-top: 4px;">${s.name}</h4>
              <p style="font-size: 12px; color: var(--text-secondary);" dir="ltr">${s.email}</p>
            </div>
          </div>

          <div class="book-v-stats">
            <div><span>العمليات الموثقة</span><strong style="color: var(--brand-crimson);">${logsCount} عملية</strong></div>
            <div><span>المسمى</span><strong>${s.jobTitle || "موظف"}</strong></div>
          </div>

          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn btn-outline" style="flex: 1; padding: 8px 10px; font-size: 12.5px;" data-action="inspect-staff" data-email="${s.email}" data-name="${s.name}">
              <i class="ri-eye-line"></i><span>سجل نشاطه</span>
            </button>
            <button type="button" class="circle-action-btn" data-action="edit-staff" data-id="${s.id}" title="تعديل الصلاحيات">
              <i class="ri-equalizer-line"></i>
            </button>
            <button type="button" class="circle-action-btn" style="color: var(--danger);" data-action="delete-staff" data-id="${s.id}" title="حذف الموظف">
              <i class="ri-delete-bin-line"></i>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ==========================================================================
// 17. التنبيهات، الملف الشخصي، التقارير، بوابة المؤلف، وتثبيت التطبيق المباشر
// ==========================================================================
function populateNotifTargetsDropdown() {
  const sel = document.getElementById("notif-target-select");
  if (!sel) return;
  sel.innerHTML =
    `<option value="all">جميع الموظفين وفريق العمل</option>` +
    state.staff
      .filter((s) => !isSuperAdminEmail(s.email))
      .map((s) => `<option value="${s.email}">${s.name} (${s.email})</option>`)
      .join("");
}

document.getElementById("btn-staff-send-notif").addEventListener("click", () => navigateToView("view-form-notif"));
document.getElementById("btn-notif-new").addEventListener("click", () => navigateToView("view-form-notif"));

document.getElementById("form-notif").addEventListener("submit", async (e) => {
  e.preventDefault();
  await addDoc(collection(db, "notifications"), {
    target: document.getElementById("notif-target-select").value,
    priority: document.getElementById("notif-priority-select").value,
    title: document.getElementById("notif-title-field").value.trim(),
    body: document.getElementById("notif-body-field").value.trim(),
    senderName: state.userProfile.displayName || "الإدارة",
    dateString: getTodayStr(),
    createdAt: serverTimestamp()
  });
  clearDraftByPrefix("notif_");
  showToast("تم إرسال التنبيه الإداري!");
  navigateToView("view-notifications");
});

function renderNotificationsList() {
  const box = document.getElementById("notifications-stack-list");
  if (!box) return;
  const mine = state.notifications.filter(
    (n) => state.userRole === "super_admin" || n.target === "all" || n.target === state.userEmail
  );

  const badge = document.getElementById("drawer-notif-badge");
  const dot = document.getElementById("header-notif-dot");
  if (mine.length) {
    badge.textContent = mine.length;
    badge.style.display = "inline-block";
    dot.style.display = "block";
  } else {
    badge.style.display = "none";
    dot.style.display = "none";
  }

  box.innerHTML = mine.length
    ? mine
        .map(
          (n) => `
        <div class="row-item" style="border-right: 4px solid ${n.priority === "urgent" ? "var(--danger)" : "var(--brand-gold)"};">
          <div>
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
              <span class="badge ${n.priority === "urgent" ? "red" : "gold"}">${n.priority === "urgent" ? "تنبيه عاجل" : "توجيه إداري"}</span>
              <span style="font-size: 11.5px; color: var(--text-muted);">${n.dateString} • إلى: ${n.target === "all" ? "الجميع" : n.target}</span>
            </div>
            <h4 style="font-size: 15px; font-weight: 800;">${n.title}</h4>
            <p style="font-size: 13px; color: var(--text-secondary);">${n.body}</p>
          </div>
        </div>`
        )
        .join("")
    : `<div class="page-card" style="padding: 30px; text-align: center; color: var(--text-muted);">لا توجد تنبيهات إدارية حالياً.</div>`;
}

// تحديث الملف الشخصي
document.getElementById("form-profile-update").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  btn.disabled = true;

  const newName = document.getElementById("profile-name-input").value.trim();
  const file = document.getElementById("profile-avatar-file").files[0];

  try {
    let avatarUrl = state.userProfile.avatarUrl;
    if (file) {
      showToast("جاري ضغط ورفع صورتك...", "ri-upload-cloud-2-line");
      avatarUrl = await compressAndUploadToImgBB(file, 500, 0.82);
    }
    await setDoc(
      doc(db, "user_profiles", state.userEmail),
      { displayName: newName, avatarUrl, updatedAt: serverTimestamp() },
      { merge: true }
    );
    state.userProfile.displayName = newName;
    state.userProfile.avatarUrl = avatarUrl;
    syncUserVisualProfile();
    refreshEgyptianGreeting();
    showToast("تم حفظ تعديلات ملفك الشخصي!");
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
});

function resetAuditLogToCurrentUser() {
  state.inspectingStaffEmail = null;
  document.getElementById("audit-log-title").innerHTML = `<i class="ri-history-line" style="color: var(--brand-gold);"></i> <span>سجل نشاطي والعمليات الموثقة في النظام</span>`;
  document.getElementById("btn-back-my-logs").style.display = "none";
  renderAuditLogs();
}

document.getElementById("btn-back-my-logs").addEventListener("click", resetAuditLogToCurrentUser);

function renderAuditLogs() {
  const box = document.getElementById("audit-logs-list");
  if (!box) return;
  const target = state.inspectingStaffEmail || state.userEmail;
  const list = state.activityLogs.filter((l) => l.actorEmail === target);

  box.innerHTML = list.length
    ? list
        .slice(0, 60)
        .map(
          (l) => `
        <div class="row-item">
          <div>
            <h4 style="font-size: 14px; font-weight: 800;">${l.actionTitle}</h4>
            <p style="font-size: 12.5px; color: var(--text-secondary);">${l.detailsText}</p>
          </div>
          <span class="badge blue">${l.dateString}</span>
        </div>`
        )
        .join("")
    : `<div class="page-card" style="padding: 24px; text-align: center; color: var(--text-muted);">لا توجد عمليات مسجلة لهذا الحساب بعد.</div>`;
}

// التقارير والترحيب بالكاتب
document.getElementById("btn-author-open-report").addEventListener("click", () => {
  if (state.selectedAuthorDetailId) openReportPage(state.selectedAuthorDetailId, "full_sales");
});

document.getElementById("btn-author-copy-link").addEventListener("click", () => {
  const url = getSiteUrl();
  navigator.clipboard.writeText(url);
  showToast(`تم نسخ رابط النظام (${url})! أرسله للمؤلف ليسجل دخوله ببريده.`);
});

function openReportPage(authorId, type = "full_sales") {
  document.getElementById("report-author-id").value = authorId;
  document.getElementById("report-type-select").value = type;
  generateReportText();
  navigateToView("view-form-report");
}

document.getElementById("report-type-select").addEventListener("change", generateReportText);

function generateReportText() {
  const authorId = document.getElementById("report-author-id").value;
  const type = document.getElementById("report-type-select").value;
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;

  const siteUrl = getSiteUrl();
  const aBooks = state.books.filter((b) => b.authorId === authorId);
  const aPayouts = state.payouts.filter((p) => p.authorId === authorId);

  let copies = 0;
  let earned = 0;
  const lines = aBooks
    .map((b) => {
      const c = Number(b.copiesSold || 0);
      const roy = c * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100);
      copies += c;
      earned += roy;
      const st = getContractStatus(b.contractDate, b.contractMonths);
      return `• كتاب (${b.title}): المباع ${c} نسخة | نسبتك (${b.royaltyRate}%): ${formatEGP(roy)} | العقد: ${st.label}`;
    })
    .join("\n");

  const paid = aPayouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  let text = "";
  if (type === "welcome") {
    text = `أهلاً ومرحباً بك أ. ${a.name} في دار صفقات كتابية للنشر والتوزيع! 🌟\n\nيسعدنا إبلاغكم بتفعيل حسابكم الشخصي في "نظام صفقات" لمتابعة عقود مؤلفاتكم، المبيعات اللحظية، والحوالات المالية بكل شفافية.\n\n🔹 للدخول المباشر لبوابتكم الخاصة:\n${siteUrl}\n(سجل الدخول عبر حساب Google باستخدام بريدكم المعتمد: ${a.email}).\n\nمع خالص التحية والتقدير،\nإدارة صفقات كتابية`;
  } else if (type === "full_sales") {
    text = `تحية طيبة أ. ${a.name}،\nإليكم التقرير المالي المحدث لمؤلفاتكم لدى دار صفقات كتابية حتى (${getTodayStr()}):\n\n${lines || "• لا توجد كتب مسجلة بعد."}\n\n📊 الملخص المالي:\n- إجمالي النسخ المباعة: ${copies} نسخة\n- إجمالي الأرباح المحققة: ${formatEGP(earned)}\n- إجمالي الحوالات المسددة لكم: ${formatEGP(paid)}\n- صافي الرصيد المتبقي المستحق لكم: ${formatEGP(balance)}\n\nبوابتكم المباشرة:\n${siteUrl}\n\nإدارة صفقات كتابية`;
  } else {
    text = `إشعار عقود النشر | أ. ${a.name} المحترم،\nفيما يلي بيان حالة عقود مؤلفاتكم المسجلة في دار صفقات كتابية:\n\n${lines || "-"}\n\nلاستعراض وتحميل نسخ العقود (PDF):\n${siteUrl}\n\nإدارة صفقات كتابية`;
  }

  document.getElementById("report-text-area").value = text;
}

document.getElementById("btn-copy-report").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("report-text-area").value);
  showToast("تم نسخ نص الرسالة!");
});

document.getElementById("btn-mailto-report").addEventListener("click", () => {
  const authorId = document.getElementById("report-author-id").value;
  const a = state.authors.find((x) => x.id === authorId);
  if (!a) return;
  const subject = `دار صفقات كتابية | إشعار رسمي - أ. ${a.name}`;
  const body = document.getElementById("report-text-area").value;
  window.location.href = `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});

// بوابة المؤلف الخاصة
function renderAuthorPortalView() {
  const prof = state.currentAuthorProfile;
  if (!prof) return;

  document.getElementById("portal-author-name").textContent = `أهلاً بك، أ. ${prof.name}`;
  if (prof.avatarUrl) document.getElementById("portal-author-avatar").src = prof.avatarUrl;

  let copies = 0;
  let earned = 0;
  state.books.forEach((b) => {
    const c = Number(b.copiesSold || 0);
    copies += c;
    earned += c * Number(b.price || 0) * (Number(b.royaltyRate || 0) / 100);
  });

  const paid = state.payouts.reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, earned - paid);

  document.getElementById("portal-stat-copies").textContent = `${copies} نسخة`;
  document.getElementById("portal-stat-earned").textContent = formatEGP(earned);
  document.getElementById("portal-stat-paid").textContent = `سُدد: ${formatEGP(paid)}`;
  document.getElementById("portal-stat-balance").textContent = formatEGP(balance);

  const bGrid = document.getElementById("portal-books-showcase");
  bGrid.innerHTML = state.books.length
    ? state.books
        .map((b) => {
          const sold = Number(b.copiesSold || 0);
          const price = Number(b.price || 0);
          const rate = Number(b.royaltyRate || 0);
          const roy = sold * price * (rate / 100);
          const st = getContractStatus(b.contractDate, b.contractMonths);
          const cover = b.coverUrl
            ? `<img src="${b.coverUrl}" alt="${b.title}" />`
            : `<div class="book-Fallback-cover"><i class="ri-book-open-fill"></i><h4>${b.title}</h4></div>`;

          return `
            <div class="book-v-card">
              <div class="book-cover-box">
                <div class="cover-top-badges">
                  <span class="contract-mini-pill ${st.pillClass}">${st.label}</span>
                </div>
                ${cover}
              </div>
              <div class="book-v-body">
                <div class="book-v-title">${b.title}</div>
                <div class="book-v-stats">
                  <div><span>سعر الكتاب</span><strong>${formatEGP(price)}</strong></div>
                  <div><span>نسبتك</span><strong>${rate}%</strong></div>
                  <div><span>المباع</span><strong style="color: var(--brand-crimson);">${sold} نسخة</strong></div>
                  <div><span>أرباحك</span><strong style="color: var(--success);">${formatEGP(roy)}</strong></div>
                </div>
                ${
                  b.drivePdfUrl
                    ? `<button type="button" class="btn-sell-card" data-action="view-pdf" data-id="${b.id}">
                         <i class="ri-file-pdf-2-fill"></i><span>عرض وتحميل العقد</span>
                       </button>`
                    : ""
                }
              </div>
            </div>`;
        })
        .join("")
    : `<div class="page-card" style="grid-column: 1/-1; padding: 24px; text-align: center;">لا توجد عقود كتب مسجلة حالياً.</div>`;

  const pList = document.getElementById("portal-payouts-list");
  pList.innerHTML = state.payouts.length
    ? state.payouts
        .map(
          (p) => `
        <div class="row-item">
          <div>
            <h4 style="font-size: 14.5px; font-weight: 800; color: var(--success);">دفعة محولة لك: ${formatEGP(p.amount)}</h4>
            <p style="font-size: 12px; color: var(--text-secondary);">الطريقة: ${p.method} • التاريخ: ${p.dateString}</p>
          </div>
          ${p.receiptUrl ? `<a href="${p.receiptUrl}" target="_blank" class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;"><i class="ri-image-line"></i><span>عرض الإيصال</span></a>` : ""}
        </div>`
        )
        .join("")
    : `<div class="page-card" style="padding: 20px; text-align: center; color: var(--text-muted);">لا توجد دفعات محولة مسجلة حتى الآن.</div>`;
}

document.getElementById("portal-author-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !state.currentAuthorProfile) return;
  try {
    showToast("جاري ضغط وتحديث صورتك الشخصية...", "ri-upload-cloud-2-line");
    const url = await compressAndUploadToImgBB(file, 500, 0.82);
    await updateDoc(doc(db, "authors", state.currentAuthorProfile.id), { avatarUrl: url });
    document.getElementById("portal-author-avatar").src = url;
    showToast("تم تحديث صورتك الشخصية بنجاح!");
  } catch (err) {
    console.error(err);
  }
});

// لوحة التعليمات الذكية حسب الصلاحية
function renderSmartGuide() {
  const box = document.getElementById("smart-guide-box");
  if (!box) return;
  const p = state.permissions;
  const row = (ok, txt) => `<div class="perm-box"><span>${ok ? "✅" : "❌"}</span><span>${txt}</span></div>`;

  box.innerHTML = `
    <div class="page-card">
      <div class="page-card-header">
        <h3 style="font-size: 16px; font-weight: 800;"><i class="ri-compass-3-fill" style="color: var(--brand-gold);"></i> لوحة التعليمات والصلاحيات الممنوحة لحسابك</h3>
      </div>
      <div class="page-card-body">
        <div class="perm-checks-grid" style="margin-bottom: 16px;">
          ${row(p.sell, "تسجيل مبيعات الكتب")}
          ${row(p.addBook, "إضافة وتعديل عقود الكتب")}
          ${row(p.deleteBook, "حذف عقود الكتب")}
          ${row(p.authors, "إدارة ملفات الكُتّاب")}
          ${row(p.payouts, "تسديد دفعات وإيصالات الكُتّاب")}
          ${row(p.expenses, "تسجيل المصاريف التشغيلية")}
          ${row(p.financeView, "الاطلاع على أرباح الدار والمالية")}
          ${row(p.reports, "إرسال التقارير للكُتّاب")}
        </div>
        <div class="form-block" style="margin-bottom: 0;">
          <div class="form-block-title"><i class="ri-flashlight-fill"></i> اختصارات العمل السريع</div>
          <p style="font-size: 13.5px; line-height: 1.8;">
            • استخدم <strong>شريط البحث الذكي</strong> في أعلى الصفحة الرئيسية للوصول الفوري لأي كتاب أو مؤلف بلمحة بصر.<br/>
            • اضغط على <strong>اسم المؤلف</strong> تحت أي كتاب لفتح ملفه الشخصي الكامل وكتبه وحوالاته.<br/>
            • استخدم زر <strong>(+)</strong> في وسط الشريط السفلي العائم لإضافة عقد كتاب أو مؤلف أو دفعة مالية من أي مكان في النظام.
          </p>
        </div>
      </div>
    </div>
  `;
}

// تثبيت التطبيق المباشر بضغطة زر من آخر عنصر في القائمة الجانبية (بدون شاشات تعليمات)
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.deferredPwaPrompt = e;
});

document.getElementById("btn-drawer-install-pwa").addEventListener("click", async () => {
  closeSideDrawer();
  if (state.deferredPwaPrompt) {
    state.deferredPwaPrompt.prompt();
    await state.deferredPwaPrompt.userChoice;
    state.deferredPwaPrompt = null;
  } else {
    showToast("التطبيق مثبت لديك بالفعل أو يمكنك إضافته للشاشة الرئيسية مباشرة من متصفحك", "ri-install-line");
  }
});
