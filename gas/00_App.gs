/**
 * 00_App.gs — ค่าคงที่ของระบบจัดซื้อพัสดุและครุภัณฑ์ (ระบบใหม่ แยกจากระบบบัญชีรับ-จ่ายเดิม)
 * ไฟล์และโฟลเดอร์สร้างไว้แล้วในโฟลเดอร์ Drive "ระบบจัดซื้อพัสดุและครุภัณฑ์"
 */
var APP = {
  VERSION: '0.3.3 (เฟส 2.2a+)',
  DB_ID: '1Utkv36C3yXSUJhioou2xeHcceCozI-oq2cp7u3M0ItQ',
  TEACHER_VIEW_ID: '1bWMoPnrpvJnXQ-AU2LHGO8I_x5Y9RIwLL5toSY3ABEg',
  LEGACY_ID: '1X7E6_mhuA-B4r_-6OxSzo6m0cmDvfnoVowCr7sJqebs', // ระบบเดิม: อ่านอย่างเดียว ห้ามเขียน
  VARDICT_ID: '1Mw08ZiTkTHqgBX6pmYrgWFCEsSj_aXBiZatoiwtw4P8',
  FOLDERS: {
    root: '10zF-DMlizNGzzm9GTRQkbKaYqqgXc-EN',
    db: '10r_v58J9T8Ujn8PoZOmQti9hK_huOdEP',
    teacher: '15lxM1TWjSm9OhJPryNlHpwNF27F5LLLC',
    templates: '1VrfArzjGP5YZW2UG2Hs2C_4UH-RpVyiy',
    output: '1wAlIn_zelnOeR8JjcTs29ATWXrQzJdJ9',
    backup: '1nk1nGhsdecRt6SKJRdlRhdHKM2jSRXqR'
  },
  TZ: 'Asia/Bangkok',
  DOMAIN: 'hongson.ac.th',
  ROLES: ['admin', 'officer', 'head', 'finance', 'viewer'],
  STAFF_ROLES: ['admin', 'officer', 'head', 'finance'],
  BACKUP_KEEP: 8
};

/** โครงสร้างตาราง: เพิ่มคอลัมน์ใหม่ต่อท้ายได้เสมอ ห้ามลบหรือสลับลำดับ */
var SCHEMA = {
  Config: ['key', 'value', 'note'],
  Users: ['email', 'person_id', 'display_name', 'roles', 'active', 'note', 'updated_at', 'updated_by'],
  Roles: ['role_key', 'role_name', 'description'],
  Signers: ['sign_key', 'sign_label', 'person_id', 'title_override', 'start_date', 'end_date', 'active', 'note'],
  Personnel: ['person_id', 'prefix', 'first_name', 'last_name', 'full_name', 'staff_type', 'position', 'position_title', 'dept', 'status', 'email', 'note', 'source', 'updated_at'],
  Department: ['dept_id', 'dept_name', 'dept_type', 'active', 'note', 'added_by', 'added_at'],
  Category: ['cat_code', 'cat_name', 'type'],
  Item: ['item_code', 'cat_code', 'item_name', 'unit', 'note'],
  Vendor: ['vendor_id', 'vendor_name', 'branch', 'vendor_type', 'tax_id', 'address', 'subdistrict', 'district', 'province', 'postcode', 'phone', 'note', 'active', 'legacy_name'],
  Project: ['project_id', 'fiscal_year', 'project_name', 'dept', 'responsible_unit', 'owner_person_id', 'budget_amount', 'budget_type', 'budget_source', 'note', 'active', 'source'],
  Procurement: ['proc_id', 'fiscal_year', 'proc_no', 'status', 'method', 'subject', 'subject_short', 'reason', 'project_id', 'project_name', 'admin_group', 'responsible_unit', 'dept', 'requester_id', 'budget_type', 'budget_source', 'budget_year', 'budget_amount', 'ref_price', 'price_source', 'total_amount', 'vat_mode', 'vendor_id', 'delivery_days', 'price_validity_days', 'contract_sign_days', 'warranty_years', 'warranty_months', 'repair_days', 'penalty_rate', 'number_style', 'egp_project_no', 'egp_project_name', 'egp_contract_no', 'egp_inspect_no', 'tor_memo_no', 'tor_memo_date', 'tor_order_no', 'tor_order_date', 'request_date', 'result_date', 'inspect_order_no', 'inspect_order_date', 'announce_date', 'contract_notice_date', 'po_date', 'due_date', 'inspection_date', 'issue_date', 'issue_doc_no', 'receive_doc_no', 'folder_id', 'created_by', 'created_at', 'updated_by', 'updated_at', 'void_reason',
    'item_mode', 'po_line_desc', 'po_line_qty', 'po_line_unit', 'issue_quarter', 'rev'],
  ProcItem: ['proc_id', 'line_no', 'item_code', 'description', 'qty', 'unit', 'unit_price', 'std_price', 'amount', 'post_to_ledger', 'is_asset', 'note',
    'brand', 'model', 'buy_note'],
  ProcSpec: ['proc_id', 'section', 'line_no', 'text'],
  ProcCommittee: ['proc_id', 'kind', 'seq', 'person_id', 'role_label'],
  ProcQuote: ['proc_id', 'seq', 'vendor_id', 'offered_price', 'agreed_price'],
  ProcLog: ['log_id', 'proc_id', 'at', 'by_email', 'action', 'from_status', 'to_status', 'note'],
  DocOutput: ['out_id', 'proc_id', 'form_key', 'file_id', 'pdf_id', 'created_at', 'created_by', 'template_rev', 'number_style', 'note'],
  Counter: ['counter_key', 'fiscal_year', 'last_no', 'prefix', 'note'],
  FormTemplate: ['form_key', 'form_name', 'seq', 'template_doc_id', 'active', 'note', 'step', 'template_rev'],
  ImportLog: ['run_id', 'at', 'by_email', 'source', 'target', 'rows', 'note']
};

/**
 * วันที่: เก็บเป็นข้อความ "yyyy-MM-dd" เสมอ (ไม่ให้ชีตแปลงเป็นค่าวันที่ ซึ่งผูกกับเขตเวลาของชีต)
 * เวลาบันทึก: เก็บเป็นข้อความ "yyyy-MM-dd HH:mm:ss" เวลาไทย
 */
var DATE_COLUMNS = ['tor_memo_date', 'tor_order_date', 'request_date', 'result_date', 'inspect_order_date', 'announce_date',
  'contract_notice_date', 'po_date', 'due_date', 'inspection_date', 'issue_date', 'start_date', 'end_date'];
var DATETIME_COLUMNS = ['created_at', 'updated_at', 'at', 'added_at'];

/** คอลัมน์ที่ต้องเก็บเป็นข้อความเสมอ (กันเลขศูนย์นำหน้าหาย และกันชีตแปลงวันที่) */
var TEXT_COLUMNS = ['tax_id', 'phone', 'postcode', 'item_code', 'cat_code', 'value', 'egp_project_no', 'egp_contract_no', 'egp_inspect_no', 'proc_no', 'branch',
  'inspect_order_no', 'tor_order_no', 'tor_memo_no', 'issue_doc_no', 'receive_doc_no', 'po_line_qty', 'issue_quarter'].concat(DATE_COLUMNS, DATETIME_COLUMNS);

/** ค่า Config ที่ผู้ดูแลแก้ผ่านหน้าเว็บได้ */
var EDITABLE_CONFIG = ['number_style', 'fiscal_year_current', 'default_delivery_days', 'default_price_validity_days',
  'default_contract_sign_days', 'default_repair_days', 'default_penalty_rate', 'default_inspect_committee_size',
  'school_name', 'school_address', 'school_district_text', 'area_office', 'moe_code', 'phone_supply', 'fax_supply',
  'phone_office', 'supply_unit_name', 'budget_group_name', 'dev_mode'];
