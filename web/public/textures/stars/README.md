# NASA 星空纹理资源

这个目录存储真实的 NASA/ESO 天文照片，用于星空背景渲染。

## 📥 如何下载资源

由于图片文件较大，需要手动下载到 `web/public/textures/stars/` 目录：

### 1. 银河系全景图（推荐）

**来源：** ESO - 欧洲南方天文台  
**链接：** https://www.eso.org/public/archives/images/large/eso1925a.jpg  
**大小：** ~10MB  
**分辨率：** 7680 x 4320

```bash
cd web/public/textures/stars/
curl -L -o milkyway.jpg "https://cdn.eso.org/images/screen/eso1925a.jpg"
```

或者手动下载：
1. 访问 https://www.eso.org/public/images/eso1925a/
2. 点击 "Download" → "Very Large (JPG)"
3. 保存为 `milkyway.jpg`

### 2. NASA 恒星地图（可选）

**来源：** NASA 公开资源  
**链接：** https://svs.gsfc.nasa.gov/vis/a010000/a010800/a010898/  
**大小：** ~5MB

```bash
curl -L -o stars_map.png "https://svs.gsfc.nasa.gov/vis/a010000/a010800/a010898/stars_4096.png"
```

## 🎨 备用方案

如果无法下载，系统会自动使用**程序生成的银河背景**（Shader 实现），效果也很棒！

## 📄 许可证

- ESO 图片：CC BY 4.0 (https://www.eso.org/public/copyright/)
- NASA 图片：Public Domain (https://www.nasa.gov/multimedia/guidelines/index.html)

## 📁 文件结构

```
textures/stars/
├── milkyway.jpg      # ESO 银河系全景图（可选，~10MB）
├── stars_map.png     # NASA 恒星地图（可选，~5MB）
└── README.md         # 本文件
```

## 🔧 代码使用

在 `StarScene.tsx` 中：

```tsx
<NasaMilkyWayBackground />  // 使用 NASA 真实图片
// 或
<ProceduralMilkyWay />      // 使用程序生成（备用）
```

---

**注意：** 为了保持 Git 仓库轻量，大图片文件应该添加到 `.gitignore`，或者使用 Git LFS。
