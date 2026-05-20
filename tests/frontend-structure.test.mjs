import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");

test("LLM configuration modal is available from the main form", () => {
  assert.match(html, /id="llmConfigBtn"/);
  assert.match(html, />配置大模型<\/button>/);
  assert.match(html, /id="llmConfigDialog"/);
  assert.match(html, /id="llmApiKey"/);
  assert.match(html, /id="llmBaseUrl"/);
  assert.match(html, /id="llmModel"/);
  assert.match(html, /id="testLlmConfigBtn"/);
});

test("result table uses the template columns", () => {
  assert.match(html, /<th>客户需求<\/th>/);
  assert.match(html, /<th>复用度<\/th>/);
  assert.match(html, /<th>CFP<\/th>/);
});

test("core app script loads before optional file parsing libraries", () => {
  assert.match(html, /src="\.\/app\.js\?v=[^"]+"/);
  assert.ok(html.indexOf('src="./app.js?v=') < html.indexOf("xlsx.full.min.js"));
  assert.ok(html.indexOf('src="./app.js?v=') < html.indexOf("mammoth.browser.min.js"));
});

test("AI generation request sends LLM configuration", () => {
  assert.match(script, /llmConfig:\s*settings\.llmConfig/);
  assert.match(script, /generationMode:\s*"ai"/);
  assert.match(script, /backendUrl:\s*DEFAULT_BACKEND_URL/);
  assert.match(script, /api\/export-template/);
  assert.match(script, /api\/test-llm/);
  assert.match(script, /normalizeRowsCfpByReuse/);
  assert.match(script, /buildTargetCfpMessage/);
  assert.match(script, /COSMIC_COLUMNS/);
});

test("API key is not persisted to localStorage", () => {
  assert.doesNotMatch(script, /localStorage\.setItem\([^)]*apiKey/i);
});

test("split completion shows a bottom-right toast reminder", () => {
  assert.match(script, /notifyCompletion\(\s*"拆分完成"/s);
  assert.match(script, /showSystemNotification/);
  assert.match(script, /playCompletionSound/);
  assert.match(script, /toast-container/);
  assert.match(styles, /\.toast-container\s*{[^}]*position:\s*fixed/s);
  assert.match(styles, /\.toast-container\s*{[^}]*right:\s*24px/s);
  assert.match(styles, /\.toast-container\s*{[^}]*bottom:\s*24px/s);
});

test("unused generation controls are hidden from the frontend", () => {
  assert.doesNotMatch(html, /id="templateType"/);
  assert.doesNotMatch(html, /id="generationMode"/);
  assert.doesNotMatch(html, /id="backendUrl"/);
  assert.doesNotMatch(html, /class="rules-box"/);
  assert.doesNotMatch(html, /id="analysisRatio"/);
  assert.doesNotMatch(html, /id="designRatio"/);
  assert.doesNotMatch(html, /id="testRatio"/);
  assert.doesNotMatch(html, /id="workUnit"/);
});
