# SmallTalk Village — AR Vocabulary Explorer

> ESL 教室 AR 词汇演示 Demo  
> 用 iPhone 摄像头扫描物品，实时显示英语单词标签、音标与例句

---

## 功能

- 打开摄像头，实时识别物品并叠加英语词汇卡片
- 显示单词、音标、例句，置信度进度环
- 支持自定义 Teachable Machine 模型 / 内置 COCO Demo 模式
- 记录已学词汇列表
- 完全网页端，iPhone Safari 免安装可用

---

## 快速开始

### 方式一：Demo 模式（无需训练，直接体验）

1. 部署到支持 HTTPS 的服务器（见下方部署章节）
2. iPhone Safari 打开链接
3. 点击 **Try Demo Mode (COCO)** 按钮
4. 将摄像头对准常见物品即可识别

> COCO-SSD 可识别约 80 种常见物品：person、cup、chair、laptop、cell phone、book、backpack 等

---

### 方式二：自定义模型（推荐，识别课堂指定物品）

#### 第一步：用 Teachable Machine 训练模型

1. 打开 https://teachablemachine.withgoogle.com
2. 点击 **Get Started → Image Project → Standard image model**
3. 为每个物品新建 Class，命名与 `app.js` 中 `VOCAB_DB` 键名一致：
   ```
   cup / desk / chair / book / pen / phone / laptop / bag / bottle / keyboard
   ```
4. 每个 Class 用摄像头拍摄 **30-50 张照片**（不同角度）
5. 点击 **Train Model**（约 1-3 分钟）
6. 点击 **Export Model → TensorFlow.js → Download my model**

#### 第二步：放置模型文件

将下载的 zip 解压，把以下三个文件放入 `model/` 文件夹：

```
SmallTalk/
├── model/
│   ├── model.json       ← 必须
│   ├── metadata.json    ← 必须
│   └── weights.bin      ← 必须
├── index.html
├── app.js
└── style.css
```

#### 第三步：部署并在 iPhone 上打开

> **必须 HTTPS**，否则 Safari 不允许访问摄像头

---

## 部署方法（推荐 Netlify，免费）

### Netlify 拖拽部署（最简单，2 分钟）

1. 打开 https://app.netlify.com
2. 注册/登录（GitHub 账号即可）
3. 将整个 `SmallTalk` 文件夹拖拽到页面上
4. 等待约 30 秒，Netlify 会给你一个 `https://xxx.netlify.app` 链接
5. iPhone Safari 打开该链接即可

### GitHub Pages 部署

```bash
cd SmallTalk
git init
git add .
git commit -m "SmallTalk AR demo"
gh repo create smalltalk-ar --public --push --source=.
# 然后在 GitHub 仓库 Settings → Pages → Branch: main 开启
```

访问 `https://你的用户名.github.io/smalltalk-ar`

---

## 自定义词汇

在 `app.js` 的 `VOCAB_DB` 对象中添加或修改词汇：

```javascript
const VOCAB_DB = {
  // 键名 = Teachable Machine 中的 Class 名称（全小写）
  cup: {
    phonetic: '/kʌp/',
    example: 'Could I have a cup of coffee?',
    color: '#FF6B6B',   // 标签颜色（十六进制）
  },
  // 添加更多...
};
```

---

## 技术栈

| 技术 | 用途 |
|------|------|
| TensorFlow.js 4.x | 浏览器内模型推理 |
| @teachablemachine/image | 加载 Teachable Machine 导出模型 |
| COCO-SSD (可选) | Demo 模式内置目标检测 |
| getUserMedia API | 调用 iPhone 后置摄像头 |
| Canvas API | AR 标签叠加渲染 |

---

## 常见问题

**Q: iPhone Safari 打开没有摄像头权限？**  
A: 必须通过 HTTPS 链接打开，localhost 不行。使用 Netlify 部署后再测试。

**Q: 识别准确率低？**  
A: 每个 Class 多拍几张（50张+），确保不同光线、角度、距离都有覆盖。

**Q: 想添加新单词？**  
A: 在 Teachable Machine 新增 Class 并重新训练，同时在 `VOCAB_DB` 中添加对应词条。
