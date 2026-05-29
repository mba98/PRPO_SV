/**
 * Arabic UI labels — central source for portal copy.
 * Technical codes (PR, PO, SAP, DocNum, etc.) stay in English where noted.
 */

export const nav = {
  dashboard: 'لوحة التحكم',
  purchaseRequests: 'طلبات الشراء',
  prsReadyForPo: 'طلبات جاهزة لأمر الشراء',
  purchaseOrders: 'أوامر الشراء',
  posReadyForApri: 'أوامر جاهزة لفاتورة A/P',
  apReserveInvoices: 'فواتير A/P الاحتياطية',
  settings: 'الإعدادات',
  users: 'المستخدمون',
  roles: 'الأدوار',
  approvalMatrix: 'مصفوفة الموافقات',
  emailGroups: 'مجموعات البريد',
  sapIntegration: 'تكامل SAP',
  systemLogs: 'سجلات النظام',
};

export const common = {
  appName: 'بوابة المشتريات',
  appTagline: 'سير عمل المشتريات',
  signIn: 'تسجيل الدخول',
  signOut: 'تسجيل الخروج',
  signedInAs: 'مسجّل الدخول:',
  loading: 'جاري التحميل…',
  save: 'حفظ',
  cancel: 'إلغاء',
  close: 'إغلاق',
  edit: 'تعديل',
  delete: 'حذف',
  add: 'إضافة',
  search: 'بحث',
  reset: 'إعادة تعيين',
  apply: 'تطبيق',
  applyFilters: 'تطبيق الفلاتر',
  exportExcel: 'تصدير Excel',
  previous: 'السابق',
  next: 'التالي',
  actions: 'إجراءات',
  status: 'الحالة',
  history: 'السجل',
  details: 'التفاصيل',
  attachments: 'المرفقات',
  comments: 'التعليقات',
  approvalHistory: 'سجل الموافقات',
  emails: 'البريد',
  noData: 'لا توجد بيانات',
  errorLoad: 'تعذّر تحميل البيانات',
  accessDenied: 'الوصول مرفوض',
  accessDeniedSettings: 'ليس لديك صلاحية لعرض هذه الصفحة.',
  returnDashboard: 'العودة إلى لوحة التحكم',
  themeColor: 'لون الواجهة',
  menu: 'القائمة',
  all: 'الكل',
  active: 'نشط',
  inactive: 'غير نشط',
  yes: 'نعم',
  no: 'لا',
  approveReject: 'موافقة / رفض',
  approve: 'موافقة',
  reject: 'رفض',
  submit: 'إرسال',
  retrySap: 'إعادة المحاولة في SAP',
  waitingFor: 'بانتظار',
  waitingForApproval: 'بانتظار الموافقة',
  create: 'إنشاء',
  deactivate: 'إيقاف',
  pageOf: 'صفحة',
  total: 'الإجمالي',
  fromDate: 'من تاريخ',
  toDate: 'إلى تاريخ',
  documentDate: 'تاريخ المستند',
  createdAt: 'تاريخ الإنشاء',
  vendor: 'المورّد',
  department: 'القسم',
  project: 'المشروع',
  warehouse: 'المستودع',
  lines: 'البنود',
  amount: 'المبلغ',
  healthy: 'سليم',
  failed: 'فشل',
};

export const login = {
  title: 'بوابة المشتريات',
  subtitle: 'سجّل الدخول بحسابك في البوابة',
  username: 'اسم المستخدم',
  password: 'كلمة المرور',
  signingIn: 'جاري تسجيل الدخول…',
  loginFailed: 'فشل تسجيل الدخول',
  invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة',
};

export const dashboard = {
  title: 'لوحة التحكم',
  description: 'نظرة عامة على الطلبات والموافقات وتكامل SAP',
  totalPrs: 'إجمالي طلبات الشراء',
  prsPending: 'طلبات بانتظار الموافقة',
  prsInSap: 'طلبات في SAP',
  totalPos: 'إجمالي أوامر الشراء',
  posPending: 'أوامر بانتظار الموافقة',
  posInSap: 'أوامر في SAP',
  apriCreated: 'فواتير A/P الاحتياطية',
  sapFailures: 'فشل تكامل SAP',
  emailFailures: 'فشل البريد',
  recentPrs: 'أحدث طلبات الشراء',
  recentPos: 'أحدث أوامر الشراء',
  recentApri: 'أحدث فواتير A/P',
  recentSapFailures: 'أحدث أخطاء SAP',
  viewList: 'عرض القائمة',
  runHealth: 'فحص الصحة',
};

export const filters = {
  searchPr: 'رقم PR، SAP، قسم، مشروع…',
  searchPo: 'رقم PO، SAP، مورّد، قسم…',
  searchApri: 'رقم APRI، SAP، مورّد…',
  allStatuses: 'جميع الحالات',
  portalPr: 'رقم الطلب',
  portalPo: 'رقم أمر الشراء',
  portalApri: 'رقم الفاتورة',
  sapPrDoc: 'رقم SAP PR',
  sapPoDoc: 'رقم SAP PO',
  relatedPr: 'طلب الشراء المرتبط',
  noResultsPr: 'لا توجد طلبات شراء مطابقة',
  noResultsPo: 'لا توجد أوامر شراء مطابقة',
  noResultsApri: 'لا توجد فواتير مطابقة',
};

export const detail = {
  lineItems: 'بنود المستند',
  item: 'الصنف',
  qty: 'الكمية',
  uom: 'وحدة القياس',
  unitPrice: 'سعر الوحدة',
  remarks: 'ملاحظات',
  sapFailed: 'فشل الإنشاء في SAP',
  sapRetryAdmin: 'إعادة المحاولة في SAP متاحة لمسؤولي النظام فقط.',
  requesterSapCode: 'كود مقدّم الطلب في SAP',
  requesterMissingSap: 'مقدّم الطلب بدون كود SAP.',
  notFound: 'المستند غير موجود',
  sapPrDocNum: 'SAP PR DocNum',
  sapPrDocEntry: 'SAP PR DocEntry',
  sapPoDocNum: 'SAP PO DocNum',
  sapPoDocEntry: 'SAP PO DocEntry',
};

export const approve = {
  prTitle: 'اعتماد طلب الشراء',
  poTitle: 'اعتماد أمر الشراء',
  comment: 'تعليق',
  optionalAttachments: 'مرفقات (اختياري)',
  cannotAct: 'لا يمكنك تنفيذ إجراء الموافقة على هذه الخطوة.',
};

export const pr = {
  title: 'طلبات الشراء',
  description: 'إنشاء ومتابعة واعتماد طلبات الشراء',
  createDesc: 'أدخل بيانات الرأس والبنود والمرفقات ثم أرسل للموافقة.',
  createTitle: 'طلب شراء جديد',
  newPr: 'طلب شراء جديد',
  prsReadyForPo: 'طلبات جاهزة لأمر الشراء',
  portalNumber: 'رقم الطلب',
  sapDocNum: 'رقم SAP',
  requester: 'مقدّم الطلب',
  requiredDate: 'التاريخ المطلوب',
  myPrs: 'طلباتي',
  pendingApproval: 'بانتظار موافقتي',
  postApproval: 'بعد الموافقة',
  failedSapTab: 'فشل SAP',
  rejectedTab: 'مرفوضة',
  inSapTab: 'في SAP',
  allTab: 'الكل',
  noPrs: 'لا توجد طلبات شراء',
  approvedForPoTitle: 'طلبات جاهزة لأمر الشراء',
  approvedForPoDesc: 'طلبات معتمدة في SAP ويمكن إنشاء أمر شراء لها',
};

export const po = {
  title: 'أوامر الشراء',
  description: 'مراجعة واعتماد أوامر الشراء. يُنشأ مستند SAP بعد موافقة المالية.',
  pendingTab: 'بانتظار موافقتي',
  approvedTab: 'معتمدة',
  rejectedTab: 'مرفوضة',
  inSapTab: 'في SAP',
  allTab: 'الكل',
  portalNumber: 'رقم أمر الشراء',
  relatedPr: 'طلب الشراء المرتبط',
  posReadyForApri: 'أوامر جاهزة لفاتورة A/P',
  readyForApriTitle: 'أوامر جاهزة لفاتورة A/P الاحتياطية',
  readyForApriDesc: 'أوامر شراء منشأة في SAP بدون فاتورة A/P احتياطية',
  createApri: 'إنشاء APRI',
  noPos: 'لا توجد أوامر شراء',
};

export const apri = {
  title: 'فواتير A/P الاحتياطية',
  description: 'فواتير احتياطية من أوامر الشراء في SAP',
  portalNumber: 'رقم الفاتورة',
  relatedPo: 'أمر الشراء المرتبط',
  noApri: 'لا توجد فواتير',
};

export const settings = {
  usersTitle: 'المستخدمون',
  usersDesc: 'إدارة حسابات المستخدمين والأدوار',
  rolesTitle: 'الأدوار',
  rolesDesc: 'صلاحيات الوصول للبوابة',
  matrixTitle: 'مصفوفة الموافقات',
  matrixDesc: 'خطوات الموافقة لطلبات الشراء وأوامر الشراء',
  emailTitle: 'مجموعات البريد',
  emailDesc: 'مستلمو الإشعارات لكل حدث',
  sapTitle: 'تكامل SAP',
  sapDesc: 'فحص الاتصال وصحة الخدمات',
  logsTitle: 'سجلات النظام',
  logsDesc: 'سجلات البريد وتكامل SAP',
  addUser: 'إضافة مستخدم',
  addRole: 'إضافة دور',
  addStep: 'إضافة خطوة',
  systemHealth: 'صحة النظام',
  sapConnectionTest: 'اختبار اتصال SAP',
  emailLogs: 'سجلات البريد',
  sapLogs: 'سجلات SAP',
};

/** Map English workflow status → Arabic display */
export const statusAr = {
  Draft: 'مسودة',
  Approved: 'تمت الموافقة',
  Rejected: 'مرفوض',
  'Creating in SAP': 'جاري الإنشاء في SAP',
  'Created in SAP': 'تم الإنشاء في SAP',
  'Failed to Create in SAP': 'فشل الإنشاء في SAP',
  'Ready for AP Reserve Invoice': 'جاهز لإنشاء A/P Reserve Invoice',
  Completed: 'مكتمل',
  'Pending Warehouse Approval': 'بانتظار موافقة المخزن',
  'Pending Project Manager Approval': 'بانتظار موافقة مدير المشروع',
  'Pending Finance Approval': 'بانتظار موافقة المالية',
  Sent: 'تم الإرسال',
  Failed: 'فشل',
  Success: 'نجاح',
  Healthy: 'سليم',
};

export function statusLabel(status) {
  if (!status) return '—';
  return statusAr[status] || status;
}

export function navLabel(item) {
  if (!item?.labelKey) return item?.label || '';
  return nav[item.labelKey] || item.label || item.labelKey;
}
