const OPERATION_DEFINITIONS = [
  {
    code: "Q",
    label: "Q（查列表）",
    processVerb: "查看",
    movements: ["E", "R", "X"],
    subProcesses: ["录入查看{target}请求", "查询{target}数据", "展示{target}"],
  },
  {
    code: "R",
    label: "R（查详情）",
    processVerb: "查看",
    movements: ["E", "R", "X"],
    subProcesses: ["录入查看{target}请求", "查询{target}详情数据", "展示{target}详情"],
  },
  {
    code: "C",
    label: "C（新增）",
    processVerb: "保存",
    movements: ["E", "W"],
    subProcesses: ["录入{target}信息", "保存{target}信息"],
  },
  {
    code: "U",
    label: "U（修改）",
    processVerb: "调整",
    movements: ["E", "W"],
    subProcesses: ["录入{target}调整信息", "保存{target}调整结果"],
  },
  {
    code: "D",
    label: "D（删除）",
    processVerb: "取消",
    movements: ["E", "W"],
    subProcesses: ["录入{target}取消请求", "保存{target}取消结果"],
  },
  {
    code: "I",
    label: "I（导入数据）",
    processVerb: "导入",
    movements: ["E", "W"],
    subProcesses: ["录入{target}导入信息", "保存{target}导入结果"],
  },
  {
    code: "O",
    label: "O（导出数据列表）",
    processVerb: "导出",
    movements: ["E", "R", "X"],
    subProcesses: ["录入导出{target}请求", "查询{target}导出数据", "输出{target}导出结果"],
  },
  {
    code: "E",
    label: "E（下载模板）",
    processVerb: "获取",
    movements: ["E", "R", "X"],
    subProcesses: ["录入获取{target}模板请求", "查询{target}模板内容", "输出{target}模板内容"],
  },
];

const FORBIDDEN_WORDS = [
  "日志",
  "中间表",
  "临时表",
  "配置",
  "枚举值",
  "报文",
  "进程",
  "线程",
  "入参",
  "出参",
  "采集",
  "插入",
  "id",
  "用户",
  "表",
  "返回",
  "调用",
  "/",
  "页面",
  "解码",
  "映射",
  "格式转换",
  "解析",
  "验证",
  "测试",
  "校验",
  "处理",
  "清洗",
  "分析",
  "汇总",
  "抽取",
  "整理",
  "选择",
];

const LLM_CONFIG_STORAGE_KEY = "cosmicSplitter.llmConfig";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8090";
const TOAST_SUCCESS_AUTO_CLOSE_MS = 0;
const TOAST_ERROR_AUTO_CLOSE_MS = 12000;
const COSMIC_COLUMNS = [
  "客户需求",
  "一级模块",
  "二级模块",
  "三级模块",
  "功能用户",
  "触发事件",
  "功能过程",
  "子过程描述",
  "数据移动类型",
  "数据组",
  "数据属性",
  "复用度",
  "CFP",
];

let selectedFile = null;
let parsedModules = [];
let generatedRows = [];
let activeToastTimer = null;
let toastContainer = null;
let completionAudioContext = null;
let standardizedDocumentReady = false;
let llmSessionConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1/chat/completions",
  model: "gpt-4o-mini",
};

const elements = {
  targetCfp: document.getElementById("targetCfp"),
  projectName: document.getElementById("projectName"),
  llmConfigBtn: document.getElementById("llmConfigBtn"),
  llmConfigDialog: document.getElementById("llmConfigDialog"),
  closeLlmConfigBtn: document.getElementById("closeLlmConfigBtn"),
  llmConfigForm: document.getElementById("llmConfigForm"),
  testLlmConfigBtn: document.getElementById("testLlmConfigBtn"),
  llmApiKey: document.getElementById("llmApiKey"),
  llmBaseUrl: document.getElementById("llmBaseUrl"),
  llmModel: document.getElementById("llmModel"),
  rememberLlmConfig: document.getElementById("rememberLlmConfig"),
  llmConfigStatus: document.getElementById("llmConfigStatus"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  selectedFile: document.getElementById("selectedFile"),
  descriptionPanel: document.getElementById("descriptionPanel"),
  descriptionEditor: document.getElementById("descriptionEditor"),
  sourceEditor: document.getElementById("sourceEditor"),
  sourcePanelTitle: document.getElementById("sourcePanelTitle"),
  sourcePanelHint: document.getElementById("sourcePanelHint"),
  inputModeRadios: document.querySelectorAll('input[name="inputMode"]'),
  standardizeBtn: document.getElementById("standardizeBtn"),
  generateBtn: document.getElementById("generateBtn"),
  exportBtn: document.getElementById("exportBtn"),
  statusBox: document.getElementById("statusBox"),
  resultBody: document.getElementById("resultBody"),
};

bootstrap();

function bootstrap() {
  loadSavedLlmConfig();
  bindEvents();
  updateInputModeView();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("#llmConfigBtn")) {
      return;
    }

    event.preventDefault();
    openLlmConfigDialog();
  });

  elements.dropzone.addEventListener("click", () => elements.fileInput.click());
  elements.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });

  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    await loadFile(file);
  });

  ["dragenter", "dragover"].forEach((type) => {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("is-active");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    elements.dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("is-active");
    });
  });

  elements.dropzone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (!file) return;
    await loadFile(file);
  });

  elements.inputModeRadios.forEach((radio) => {
    radio.addEventListener("change", updateInputModeView);
  });
  elements.descriptionEditor.addEventListener("input", () => {
    standardizedDocumentReady = false;
  });
  elements.sourceEditor.addEventListener("input", () => {
    if (getInputMode() === "description" && elements.sourceEditor.value.trim()) {
      standardizedDocumentReady = true;
    }
  });
  elements.standardizeBtn.addEventListener("click", handleStandardizeOnly);
  elements.generateBtn.addEventListener("click", handleGenerate);
  elements.exportBtn.addEventListener("click", exportToExcel);
  elements.closeLlmConfigBtn.addEventListener("click", closeLlmConfigDialog);
  elements.testLlmConfigBtn.addEventListener("click", handleTestLlmConfig);
  elements.llmConfigForm.addEventListener("submit", handleSaveLlmConfig);
  elements.llmConfigDialog.querySelector("[data-close-modal]").addEventListener("click", closeLlmConfigDialog);
}

async function loadFile(file) {
  setInputMode("document");
  updateInputModeView();
  selectedFile = file;
  elements.selectedFile.textContent = `已选择：${file.name}`;
  setStatus(`正在解析 ${file.name} ...`);

  try {
    const text = await parseFileToText(file);
    elements.sourceEditor.value = text.trim();
    standardizedDocumentReady = false;
    setStatus(`文件解析完成，可直接点击“开始拆分”。`);
  } catch (error) {
    console.error(error);
    setStatus(`文件解析失败：${error.message}`, true);
  }
}

async function parseFileToText(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv")) {
    return file.text();
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    return rows.map((row) => row.join(",")).join("\n");
  }

  if (fileName.endsWith(".docx")) {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  throw new Error("当前仅支持 xlsx、xls、csv、txt、md、docx。");
}

async function handleGenerate() {
  try {
    prepareCompletionReminder();
    const settings = collectSettings();
    let generationSourceText = elements.sourceEditor.value.trim();
    if (getInputMode() === "description") {
      const descriptionText = elements.descriptionEditor.value.trim();
      if (!generationSourceText || !standardizedDocumentReady) {
        if (!descriptionText) {
          throw new Error("请先在“需求描述”中粘贴原始需求，或在右侧编辑标准需求文档。");
        }
        generationSourceText = await standardizeRequirement(descriptionText, settings);
        elements.sourceEditor.value = generationSourceText;
        standardizedDocumentReady = true;
        showToast("需求文档已整理", "请检查右侧标准需求文档；本次将基于该文档继续拆分。", "success");
      }
    } else if (!generationSourceText) {
      throw new Error("请输入需求文档或功能清单。");
    }

    setStatus("正在整理输入内容...");
    parsedModules = parseModules(generationSourceText);
    setStatus("正在请求大模型生成 COSMIC 拆分明细...");
    generatedRows = await requestAiRows(parsedModules, settings);
    generatedRows = normalizeRowsCfpByReuse(generatedRows);
    const totalCfp = getRowsCfpTotal(generatedRows);
    const targetMessage = buildTargetCfpMessage(totalCfp, settings.targetCfp);

    setStatus("正在整理拆分结果并生成预览表格...");
    renderResult(generatedRows);
    updateSummary(generatedRows);
    elements.exportBtn.disabled = false;
    setStatus(`已完成拆分，共生成 ${generatedRows.length} 行明细，CFP 总和 ${formatCfpValue(totalCfp)}。${targetMessage}`);
    notifyCompletion(
      "拆分完成",
      `已生成 ${generatedRows.length} 行明细，CFP 总和 ${formatCfpValue(totalCfp)}。${targetMessage}`,
      "success",
    );
  } catch (error) {
    console.error(error);
    generatedRows = [];
    renderResult([]);
    updateSummary([]);
    elements.exportBtn.disabled = true;
    setStatus(`拆分失败：${error.message}`, true);
    notifyCompletion("拆分失败", error.message, "error");
  }
}

async function handleStandardizeOnly() {
  const sourceText =
    getInputMode() === "description"
      ? elements.descriptionEditor.value.trim()
      : elements.sourceEditor.value.trim();
  if (!sourceText) {
    setStatus("请先输入需求描述，再整理为标准需求文档。", true);
    return;
  }

  const settings = collectSettings();
  elements.standardizeBtn.disabled = true;
  elements.generateBtn.disabled = true;

  try {
    const documentText = await standardizeRequirement(sourceText, settings);
    elements.sourceEditor.value = documentText;
    standardizedDocumentReady = true;
    setStatus("已整理为标准需求文档，请在右侧预览和编辑，确认后点击“开始拆分”。");
    showToast("整理完成", "标准需求文档已放入编辑区，可以继续调整或直接拆分。", "success");
  } catch (error) {
    console.error(error);
    setStatus(`需求文档整理失败：${error.message}`, true);
    showToast("需求文档整理失败", error.message, "error");
  } finally {
    elements.standardizeBtn.disabled = false;
    elements.generateBtn.disabled = false;
  }
}

async function standardizeRequirement(sourceText, settings) {
  setStatus("正在将需求描述整理为标准需求文档...");

  const response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/standardize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: settings.projectName,
      sourceText,
      llmConfig: settings.llmConfig,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "后端整理需求文档失败");
  }

  const content = String(payload.content || "").trim();
  if (!content) {
    throw new Error("大模型未返回可用的标准需求文档");
  }

  return content;
}

function getInputMode() {
  const selected = Array.from(elements.inputModeRadios).find((item) => item.checked);
  return selected?.value || "document";
}

function setInputMode(mode) {
  elements.inputModeRadios.forEach((item) => {
    item.checked = item.value === mode;
  });
  updateInputModeView();
}

function updateInputModeView() {
  const isDescriptionMode = getInputMode() === "description";
  elements.descriptionPanel.hidden = !isDescriptionMode;
  elements.dropzone.hidden = isDescriptionMode;
  elements.standardizeBtn.hidden = !isDescriptionMode;
  elements.sourcePanelTitle.textContent = isDescriptionMode ? "标准需求文档预览 / 编辑" : "提取内容";
  elements.sourcePanelHint.textContent = isDescriptionMode
    ? "整理后的标准需求文档会显示在这里，确认或修改后可直接开始拆分。"
    : "上传或粘贴后的需求内容会显示在这里。";

  if (isDescriptionMode) {
    setStatus("请在“需求描述”中粘贴原始需求，然后点击“整理需求文档”。");
    return;
  }

  setStatus("等待上传或粘贴需求文档。");
}

function notifyCompletion(title, message, type = "success") {
  showToast(title, type === "success" ? `${message}可以导出 Excel。` : message, type);
  showSystemNotification(title, message);
  playCompletionSound(type);
}

function collectSettings() {
  return {
    targetCfp: elements.targetCfp.value.trim() ? Number(elements.targetCfp.value) : "",
    templateType: "cosmic",
    generationMode: "ai",
    backendUrl: DEFAULT_BACKEND_URL,
    llmConfig: collectLlmConfig(),
    projectName: cleanCell(elements.projectName.value.trim() || "COSMIC拆分结果"),
  };
}

function parseModules(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const modules = [];
  let currentL1 = "";
  let currentL2 = "";
  let currentL3 = "";

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, ",");
    const level1Match = line.match(/^#{1,6}\s*一级模块[:：]\s*(.+)$/) || line.match(/^(?:[-*]\s*)?一级模块[:：]\s*(.+)$/);
    if (level1Match) {
      currentL1 = sanitizeModuleName(level1Match[1]);
      currentL2 = "";
      currentL3 = "";
      continue;
    }

    const level2Match = line.match(/^#{1,6}\s*二级模块[:：]\s*(.+)$/) || line.match(/^(?:[-*]\s*)?二级模块[:：]\s*(.+)$/);
    if (level2Match) {
      currentL2 = sanitizeModuleName(level2Match[1]);
      currentL3 = "";
      continue;
    }

    const level3Match = line.match(/^#{1,6}\s*三级模块[:：]\s*(.+)$/) || line.match(/^(?:[-*]\s*)?三级模块[:：]\s*(.+)$/);
    if (level3Match) {
      currentL3 = sanitizeModuleName(level3Match[1]);
      pushModule(currentL1, currentL2, currentL3);
      continue;
    }

    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line)) {
      continue;
    }

    if (line.startsWith("# ")) {
      currentL1 = sanitizeModuleName(line.replace(/^#\s*/, ""));
      continue;
    }
    if (line.startsWith("## ")) {
      currentL2 = sanitizeModuleName(line.replace(/^##\s*/, ""));
      continue;
    }
    if (line.startsWith("### ")) {
      currentL3 = sanitizeModuleName(line.replace(/^###\s*/, ""));
      pushModule(currentL1, currentL2, currentL3);
      continue;
    }

    if (/一级模块|二级模块|三级模块/.test(line)) {
      continue;
    }

    const parts = line
      .split(/[|,，]/)
      .map((item) => sanitizeModuleName(item))
      .filter(Boolean);

    if (parts.length >= 3) {
      currentL1 = parts[0];
      currentL2 = parts[1];
      currentL3 = parts[2];
      pushModule(currentL1, currentL2, currentL3);
    } else if (parts.length === 1 && currentL1 && currentL2) {
      currentL3 = parts[0];
      pushModule(currentL1, currentL2, currentL3);
    }
  }

  return dedupe(modules, (item) => `${item.level1}|${item.level2}|${item.level3}`);

  function pushModule(level1, level2, level3) {
    if (!level1 || !level2 || !level3) return;
    modules.push({ level1, level2, level3 });
  }
}

function buildCosmicRows(modules, settings) {
  const rows = [];

  for (const module of modules) {
    const operations = determineOperations(module.level3);
    const operationLabels = operations.map((item) => item.label).join("/");
    const userNeed = buildUserNeed(module.level3, operations);
    const triggerEvent = buildTriggerEvent(module.level3, operations);
    const functionProcess = buildFunctionProcess(module.level3, operations[0]);
    const dataGroup = buildDataGroup(module.level3);
    const dataAttributes = buildDataAttributes(module.level3);
    const rowCfp = estimateRowCfp(operations);

    for (const operation of operations) {
      operation.movements.forEach((movement, index) => {
        rows.push({
          一级模块: module.level1,
          二级模块: module.level2,
          三级模块: module.level3,
          用户功能需求: userNeed,
          可能的操作类型: operationLabels,
          触发事件: triggerEvent,
          功能过程: buildFunctionProcess(module.level3, operation),
          子过程描述: sanitizeText(fillTemplate(operation.subProcesses[index], module.level3)),
          数据移动类型: movement,
          数据组: dataGroup,
          数据属性: dataAttributes,
          估算CFP: roundNumber(rowCfp / operation.movements.length, 2),
        });
      });
    }
  }

  return rows;
}

async function requestAiRows(modules, settings) {
  const response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectName: settings.projectName,
      targetCfp: settings.targetCfp,
      templateType: settings.templateType,
      sourceText: elements.sourceEditor.value,
      modules,
      llmConfig: settings.llmConfig,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "后端生成失败");
  }

  const rows = parseAiContentToRows(payload.content || "");
  if (!rows.length) {
    throw new Error("大模型未返回可识别的表格内容");
  }

  return rows;
}

function parseAiContentToRows(content) {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const tableLines = lines.filter((line) => line.startsWith("|"));
  if (!tableLines.length) return [];

  const rows = [];
  let headers = [];

  tableLines.forEach((line) => {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (!headers.length) {
      headers = cells;
      return;
    }

    if (cells.every((cell) => /^-+$/.test(cell.replace(/:/g, "")))) {
      return;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || "";
    });
    rows.push(normalizeAiRow(row));
  });

  return rows.filter((row) => row.一级模块 && row.二级模块 && row.三级模块);
}

function normalizeAiRow(row) {
  const reuse = normalizeReuse(pickCell(row, ["复用度"]) || "新增");
  const cfp = normalizeCfp(pickCell(row, ["CFP", "估算CFP", "估算 CFP"]), reuse);

  return {
    客户需求: cleanCell(pickCell(row, ["客户需求", "用户功能需求"]) || collectSettings().projectName),
    一级模块: cleanCell(pickCell(row, ["一级模块"])),
    二级模块: cleanCell(pickCell(row, ["二级模块"])),
    三级模块: cleanCell(pickCell(row, ["三级模块"])),
    功能用户: cleanCell(pickCell(row, ["功能用户"]) || "发送者：用户 接受者：灵犀助手"),
    触发事件: cleanCell(pickCell(row, ["触发事件"])),
    功能过程: cleanCell(pickCell(row, ["功能过程"])),
    子过程描述: cleanCell(pickCell(row, ["子过程描述"])),
    数据移动类型: cleanCell(pickCell(row, ["数据移动类型"])).toUpperCase(),
    数据组: cleanCell(pickCell(row, ["数据组"])),
    数据属性: cleanCell(pickCell(row, ["数据属性"])),
    复用度: reuse,
    CFP: cfp,
  };
}

function pickCell(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function cleanCell(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeReuse(value) {
  const text = cleanCell(value);
  if (text.includes("复用")) return "复用";
  if (text.includes("利旧")) return "利旧";
  return "新增";
}

function normalizeCfp(value, reuse) {
  return reuseToCfp(reuse);
}

function reuseToCfp(reuse) {
  const normalized = normalizeReuse(reuse);
  if (normalized === "复用") return roundNumber(1 / 3, 2);
  if (normalized === "利旧") return 0;
  return 1;
}

function determineOperations(level3) {
  const text = level3 || "";
  const operations = [];

  if (/(导出|下载|清单|台账)/.test(text)) operations.push(findOperation("O"));
  if (/(导入|批量录入)/.test(text)) operations.push(findOperation("I"));
  if (/(新增|创建|维护|管理|编辑|调整|设置)/.test(text)) operations.push(findOperation("C"), findOperation("U"));
  if (/(详情|画像|档案|明细)/.test(text)) operations.push(findOperation("R"));
  operations.push(findOperation("Q"));

  return dedupe(operations.filter(Boolean), (item) => item.code);
}

function findOperation(code) {
  return OPERATION_DEFINITIONS.find((item) => item.code === code);
}

function buildUserNeed(level3, operations) {
  const action = operations.some((item) => item.code === "C" || item.code === "U") ? "维护" : "查看";
  return sanitizeText(`${action}${level3}`);
}

function buildTriggerEvent(level3, operations) {
  const action = operations.some((item) => item.code === "C" || item.code === "U") ? "需要维护" : "需要了解";
  return sanitizeText(`${action}${level3}信息`);
}

function buildFunctionProcess(level3, operation) {
  return sanitizeText(`${operation.processVerb}${normalizeTarget(level3)}信息`);
}

function buildDataGroup(level3) {
  return sanitizeText(`${normalizeTarget(level3)}信息`);
}

function buildDataAttributes(level3) {
  const target = normalizeTarget(level3);
  const keywords = splitKeywords(target);
  const attributes = [
    `${keywords[0]}名称`,
    `${keywords[1]}分类`,
    `${keywords[2]}状态`,
    `${keywords[0]}时间`,
  ];
  return dedupe(attributes, (item) => item).join("、");
}

function estimateRowCfp(operations) {
  const movementCount = operations.reduce((sum, operation) => sum + operation.movements.length, 0);
  return roundNumber(Math.max(1, movementCount / 3), 2);
}

function splitKeywords(text) {
  const compact = text.replace(/展示|查询|统计|图|画像|信息/g, "");
  const seed = compact.length >= 4 ? compact : `${text}对象`;
  return [
    seed.slice(0, 2) || "对象",
    seed.slice(2, 4) || "类型",
    seed.slice(4, 6) || "结果",
  ];
}

function fillTemplate(template, target) {
  return template.replaceAll("{target}", normalizeTarget(target));
}

function normalizeTarget(text) {
  return sanitizeText(text.replace(/展示/g, "").replace(/查询/g, "").trim() || "对象");
}

function sanitizeModuleName(text) {
  return cleanCell(text.replace(/^[-*]\s*/, "").trim());
}

function sanitizeText(text) {
  let result = String(text || "").trim();
  const replacements = [
    ["配置", "管理"],
    ["入参", "输入"],
    ["出参", "输出"],
    ["插入", "保存"],
    ["id", "标识"],
    ["用户", "使用方"],
    ["表", "信息"],
    ["返回", "输出"],
    ["页面", "界面"],
    ["解析", "识别"],
  ];

  replacements.forEach(([source, target]) => {
    result = result.replaceAll(source, target);
  });

  FORBIDDEN_WORDS.forEach((word) => {
    if (word === "页面") return;
    if (result.includes(word)) {
      result = result.replaceAll(word, "");
    }
  });

  return result.replace(/\s+/g, " ").replace(/，，+/g, "，").replace(/信息信息/g, "信息");
}

function renderResult(rows) {
  if (!rows.length) {
    elements.resultBody.innerHTML = `
      <tr>
        <td colspan="13" class="empty-state">暂无结果</td>
      </tr>
    `;
    return;
  }

  const html = rows
    .map(
      (row) => `
      <tr>
        ${COSMIC_COLUMNS.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}
      </tr>
    `,
    )
    .join("");

  elements.resultBody.innerHTML = html;
}

function updateSummary(rows) {
  return rows.length;
}

function normalizeRowsCfpByReuse(rows) {
  return rows.map((row) => ({
    ...row,
    复用度: normalizeReuse(row.复用度),
    CFP: reuseToCfp(row.复用度),
  }));
}

function getRowsCfpTotal(rows) {
  return roundNumber(
    rows.reduce((sum, row) => sum + Number(row.CFP || 0), 0),
    2,
  );
}

function formatCfpValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function buildTargetCfpMessage(totalCfp, targetCfp) {
  const target = Number(targetCfp);
  if (!Number.isFinite(target) || target <= 0) return "";

  const difference = roundNumber(target - totalCfp, 2);
  if (Math.abs(difference) <= 0.01) {
    return `已达到目标 ${formatCfpValue(target)}。`;
  }

  const direction = difference > 0 ? "低于" : "高于";
  return `${direction}目标 ${formatCfpValue(target)}，差额 ${formatCfpValue(Math.abs(difference))}；已按复用度固定 CFP，未做强制缩放。`;
}

async function exportToExcel() {
  if (!generatedRows.length) return;

  const settings = collectSettings();
  elements.exportBtn.disabled = true;
  setStatus("正在按模板生成 Excel...");

  try {
    const response = await fetch(`${settings.backendUrl.replace(/\/$/, "")}/api/export-template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectName: settings.projectName,
        rows: generatedRows,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        throw new Error(payload.error || "模板导出失败");
      }
      throw new Error(await response.text());
    }

    const blob = await response.blob();
    const fileName = `${settings.projectName}-COSMIC拆分结果.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`已按模板导出文件：${fileName}`);
  } catch (error) {
    console.error(error);
    setStatus(`导出失败：${error.message}`, true);
  } finally {
    elements.exportBtn.disabled = false;
  }
}

function setStatus(message, isError = false) {
  elements.statusBox.textContent = message;
  elements.statusBox.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function setLlmConfigStatus(message, isError = false) {
  elements.llmConfigStatus.textContent = message;
  elements.llmConfigStatus.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function showToast(title, message, type = "success") {
  const container = getToastContainer();
  container.textContent = "";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const content = document.createElement("div");
  content.className = "toast-content";

  const titleNode = document.createElement("p");
  titleNode.className = "toast-title";
  titleNode.textContent = title;

  const messageNode = document.createElement("p");
  messageNode.className = "toast-message";
  messageNode.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.className = "toast-close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "关闭提醒");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => dismissToast(toast));

  content.append(titleNode, messageNode);
  toast.append(content, closeButton);
  container.appendChild(toast);

  window.clearTimeout(activeToastTimer);
  const autoCloseMs =
    type === "success" ? TOAST_SUCCESS_AUTO_CLOSE_MS : TOAST_ERROR_AUTO_CLOSE_MS;
  if (autoCloseMs > 0) {
    activeToastTimer = window.setTimeout(() => dismissToast(toast), autoCloseMs);
  }
}

function prepareCompletionReminder() {
  ensureCompletionAudioContext();
  requestSystemNotificationPermission();
}

function ensureCompletionAudioContext() {
  if (!completionAudioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    completionAudioContext = new AudioCtor();
  }

  if (completionAudioContext.state === "suspended") {
    void completionAudioContext.resume();
  }
}

function requestSystemNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") {
    return;
  }

  void Notification.requestPermission().catch(() => {});
}

function showSystemNotification(title, message) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  try {
    new Notification(title, {
      body: message,
      tag: "cosmic-splitter-completion",
      silent: true,
    });
  } catch (error) {
    console.warn("Failed to show system notification", error);
  }
}

function playCompletionSound(type) {
  if (!completionAudioContext) {
    ensureCompletionAudioContext();
  }
  if (!completionAudioContext) {
    return;
  }

  const now = completionAudioContext.currentTime;
  const tones =
    type === "error"
      ? [165, 138]
      : [523.25, 659.25, 783.99];

  tones.forEach((frequency, index) => {
    const oscillator = completionAudioContext.createOscillator();
    const gain = completionAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = type === "error" ? 0.04 : 0.05;
    oscillator.connect(gain);
    gain.connect(completionAudioContext.destination);
    const startAt = now + index * 0.12;
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.12);
  });
}

function getToastContainer() {
  if (toastContainer) {
    return toastContainer;
  }

  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function dismissToast(toast) {
  if (!toast || !toast.parentElement) {
    return;
  }

  toast.classList.add("is-leaving");
  window.setTimeout(() => toast.remove(), 180);
}

function loadSavedLlmConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LLM_CONFIG_STORAGE_KEY) || "{}");
    llmSessionConfig = {
      ...llmSessionConfig,
      baseUrl: saved.baseUrl || llmSessionConfig.baseUrl,
      model: saved.model || llmSessionConfig.model,
    };
  } catch (error) {
    console.warn("Failed to load LLM config", error);
  }

  syncLlmConfigFields();
}

function syncLlmConfigFields() {
  elements.llmApiKey.value = llmSessionConfig.apiKey;
  elements.llmBaseUrl.value = llmSessionConfig.baseUrl;
  elements.llmModel.value = llmSessionConfig.model;
  setLlmConfigStatus(llmSessionConfig.apiKey ? "已保存" : "", false);
}

function openLlmConfigDialog() {
  syncLlmConfigFields();
  elements.llmConfigDialog.classList.add("is-fallback-open");

  if (elements.llmConfigDialog.open) {
    return;
  }

  try {
    if (typeof elements.llmConfigDialog.showModal === "function") {
      elements.llmConfigDialog.showModal();
      return;
    }
  } catch (error) {
    console.warn("Falling back to non-modal dialog opening", error);
  }

  elements.llmConfigDialog.setAttribute("open", "");
}

function closeLlmConfigDialog() {
  if (typeof elements.llmConfigDialog.close === "function") {
    elements.llmConfigDialog.close();
  }
  elements.llmConfigDialog.removeAttribute("open");
  elements.llmConfigDialog.classList.remove("is-fallback-open");
}

function handleSaveLlmConfig(event) {
  event.preventDefault();

  llmSessionConfig = readLlmConfigInputs();

  if (elements.rememberLlmConfig.checked) {
    localStorage.setItem(
      LLM_CONFIG_STORAGE_KEY,
      JSON.stringify({
        baseUrl: llmSessionConfig.baseUrl,
        model: llmSessionConfig.model,
      }),
    );
  } else {
    localStorage.removeItem(LLM_CONFIG_STORAGE_KEY);
  }

  syncLlmConfigFields();
  closeLlmConfigDialog();
  setStatus("大模型配置已更新。");
}

async function handleTestLlmConfig() {
  const config = readLlmConfigInputs();
  setLlmConfigStatus("正在测试连接...", false);
  elements.testLlmConfigBtn.disabled = true;

  try {
    const response = await fetch(`${DEFAULT_BACKEND_URL}/api/test-llm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ llmConfig: config }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "连接测试失败");
    }

    const preview = payload.preview ? `，返回：${payload.preview}` : "";
    const latency = payload.latencyMs ? `（${payload.latencyMs} ms）` : "";
    setLlmConfigStatus(`连接成功：${payload.model}${latency}`, false);
    showToast("大模型连接成功", `${payload.model}${preview}`, "success");
  } catch (error) {
    console.error(error);
    setLlmConfigStatus(`连接失败：${error.message}`, true);
    showToast("大模型连接失败", error.message, "error");
  } finally {
    elements.testLlmConfigBtn.disabled = false;
  }
}

function readLlmConfigInputs() {
  return {
    apiKey: elements.llmApiKey.value.trim(),
    baseUrl: elements.llmBaseUrl.value.trim() || "https://api.openai.com/v1/chat/completions",
    model: elements.llmModel.value.trim() || "gpt-4o-mini",
  };
}

function collectLlmConfig() {
  return {
    apiKey: llmSessionConfig.apiKey,
    baseUrl: llmSessionConfig.baseUrl,
    model: llmSessionConfig.model,
  };
}

function dedupe(list, getKey) {
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function roundNumber(value, digits = 2) {
  const base = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * base) / base;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
