# COSMIC 拆分助手

一个可直接打开的静态前端页面，用于：

- 填写目标 CFP 总和
- 上传功能清单或需求文档
- 生成 COSMIC 拆分预览
- 导出 Excel

## 启动方式

直接双击 `index.html` 即可打开。

如果希望本地通过 HTTP 方式访问，可在当前目录执行：

```powershell
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080/
```

## 后端启动方式

如果要接入大模型，请再启动后端：

```powershell
cd backend
python server.py
```

默认地址：

```text
http://127.0.0.1:8090
```

## 大模型配置

在 `backend` 目录中参考 `.env.example` 配置以下环境变量：

```text
COSMIC_LLM_API_KEY
COSMIC_LLM_BASE_URL
COSMIC_LLM_MODEL
```

说明：

- `COSMIC_LLM_BASE_URL` 默认兼容 OpenAI Chat Completions 形式接口
- 后续你提供 API Key 后，可以直接接入
- 如果是兼容 OpenAI 格式的平台，也只需要替换地址、模型名、Key

## 第一版支持

- `xlsx`
- `xls`
- `csv`
- `txt`
- `md`
- `docx`

## 输入格式建议

优先推荐使用三列结构：

```text
一级模块,二级模块,三级模块
触点场景,APP触点场景,APP触点高频客户画像展示
视频分析,视频结果管理,视频事件识别结果展示
```

也支持 Markdown 标题：

```md
# 一级模块
## 二级模块
### 三级模块
```

## 当前版本说明

- 当前为浏览器端 MVP
- 已支持规则化生成 COSMIC 拆分行
- 已支持 Excel 导出
- 已补充后端服务骨架，可切换为大模型生成
- 当前前端支持两种模式：规则引擎 / 大模型
- 大模型模式需要先启动 `backend/server.py` 并配置模型参数
