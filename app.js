const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// 確保 uploads 目錄存在
const uploadsDir = path.join(__dirname, "uploads");
const metaFile = path.join(__dirname, "images_meta.json");

if (!fsSync.existsSync(uploadsDir)) {
  fsSync.mkdirSync(uploadsDir, { recursive: true });
}

// 初始化 metadata 檔案
if (!fsSync.existsSync(metaFile)) {
  fsSync.writeFileSync(metaFile, JSON.stringify([], null, 2));
}

// 讀取和寫入 metadata 的函數
async function readMeta() {
  try {
    const data = await fs.readFile(metaFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function writeMeta(data) {
  await fs.writeFile(metaFile, JSON.stringify(data, null, 2));
}

// 生成正確的 HTTPS 網址
function getBaseUrl(req) {
  // 檢查 X-Forwarded-Proto header（常見於代理服務器）
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;

  // 如果是部署環境，強制使用 https
  if (
    req.get("host").includes("zeabur.app") ||
    req.get("host").includes("herokuapp.com") ||
    req.get("host").includes("vercel.app") ||
    process.env.NODE_ENV === "production"
  ) {
    return `https://${req.get("host")}`;
  }

  // 本地開發環境使用原始 protocol
  return `${protocol}://${req.get("host")}`;
}

// 設定 multer 儲存配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, uniqueId + ext);
  },
});

// 檔案過濾器
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("只允許上傳圖片檔案"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 限制
  },
  fileFilter: fileFilter,
});

// 啟用 CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// 信任代理服務器（重要：用於正確獲取 protocol）
app.set("trust proxy", true);

// 靜態檔案服務
app.use("/images", express.static(uploadsDir));

// 首頁 - 簡單的上傳介面
app.get("/", (req, res) => {
  res.send(`
      <!DOCTYPE html>
      <html>
      <head>
          <title>圖片託管服務</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
              * { box-sizing: border-box; }
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  max-width: 1200px; 
                  margin: 0 auto; 
                  padding: 20px; 
                  background: #f5f5f5;
              }
              .header { 
                  background: white; 
                  padding: 20px; 
                  border-radius: 8px; 
                  margin-bottom: 20px; 
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .nav { 
                  display: flex; 
                  gap: 10px; 
                  margin-bottom: 20px; 
              }
              .nav-btn { 
                  padding: 10px 20px; 
                  background: #007bff; 
                  color: white; 
                  border: none; 
                  border-radius: 4px; 
                  cursor: pointer; 
                  text-decoration: none;
                  display: inline-block;
              }
              .nav-btn:hover { background: #0056b3; }
              .nav-btn.active { background: #28a745; }
              .upload-area { 
                  border: 2px dashed #ccc; 
                  padding: 40px; 
                  text-align: center; 
                  margin: 20px 0; 
                  background: white;
                  border-radius: 8px;
              }
              .upload-area.dragover { border-color: #007bff; background-color: #f8f9fa; }
              input[type="file"] { margin: 10px 0; }
              button { 
                  background: #007bff; 
                  color: white; 
                  padding: 10px 20px; 
                  border: none; 
                  border-radius: 4px; 
                  cursor: pointer; 
              }
              button:hover { background: #0056b3; }
              .result { 
                  margin-top: 20px; 
                  padding: 15px; 
                  background: white; 
                  border-radius: 8px; 
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .url-input { 
                  width: 100%; 
                  padding: 8px; 
                  margin: 5px 0; 
                  border: 1px solid #ddd; 
                  border-radius: 4px; 
              }
              .content { 
                  background: white; 
                  padding: 20px; 
                  border-radius: 8px; 
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
          </style>
      </head>
      <body>
          <div class="header">
              <h1>圖片託管服務</h1>
              <div class="nav">
                  <a href="/" class="nav-btn active">上傳圖片</a>
                  <a href="/manage" class="nav-btn">管理圖片</a>
              </div>
          </div>

          <div class="content">
              <div class="upload-area" id="uploadArea">
                  <p>🖼️ 拖拉圖片到這裡或點擊選擇檔案</p>
                  <input type="file" id="fileInput" accept="image/*" multiple>
                  <br>
                  <button onclick="uploadFiles()">上傳圖片</button>
              </div>
              <div id="result"></div>
          </div>

          <script>
              const uploadArea = document.getElementById('uploadArea');
              const fileInput = document.getElementById('fileInput');
              const result = document.getElementById('result');

              // 拖拉功能
              uploadArea.addEventListener('dragover', (e) => {
                  e.preventDefault();
                  uploadArea.classList.add('dragover');
              });

              uploadArea.addEventListener('dragleave', () => {
                  uploadArea.classList.remove('dragover');
              });

              uploadArea.addEventListener('drop', (e) => {
                  e.preventDefault();
                  uploadArea.classList.remove('dragover');
                  fileInput.files = e.dataTransfer.files;
              });

              uploadArea.addEventListener('click', () => {
                  fileInput.click();
              });

              async function uploadFiles() {
                  const files = fileInput.files;
                  if (files.length === 0) {
                      alert('請選擇檔案');
                      return;
                  }

                  const formData = new FormData();
                  for (let file of files) {
                      formData.append('images', file);
                  }

                  try {
                      result.innerHTML = '<p>⏳ 上傳中...</p>';
                      
                      const response = await fetch('/upload', {
                          method: 'POST',
                          body: formData
                      });

                      const data = await response.json();
                      
                      if (response.ok) {
                          showResults(data.images);
                      } else {
                          alert('上傳失敗: ' + data.error);
                          result.innerHTML = '';
                      }
                  } catch (error) {
                      alert('上傳失敗: ' + error.message);
                      result.innerHTML = '';
                  }
              }

              function showResults(images) {
                  let html = '<h3>✅ 上傳成功！</h3>';
                  images.forEach(img => {
                      html += \`
                          <div class="result" style="margin: 15px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                              <p><strong>檔案名稱：</strong>\${img.originalName}</p>
                              <p><strong>圖片網址：</strong></p>
                              <input type="text" class="url-input" value="\${img.url}" readonly onclick="this.select()">
                              <div style="margin-top: 10px;">
                                  <img src="\${img.url}" style="max-width: 200px; border-radius: 4px;" alt="uploaded image">
                              </div>
                          </div>
                      \`;
                  });
                  result.innerHTML = html;
              }
          </script>
      </body>
      </html>
  `);
});

// 上傳 API - 使用修正的網址生成方式
app.post("/upload", upload.array("images", 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "沒有檔案被上傳" });
  }

  const baseUrl = getBaseUrl(req);

  readMeta()
    .then((images) => {
      const newImages = [];

      for (const file of req.files) {
        const imageData = {
          id: uuidv4(),
          filename: file.filename,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          url: `${baseUrl}/images/${file.filename}`,
          uploadTime: new Date().toISOString(),
        };

        images.push(imageData);
        newImages.push(imageData);
      }

      return writeMeta(images).then(() => {
        res.json({
          success: true,
          message: `成功上傳 ${req.files.length} 個檔案`,
          images: newImages,
        });
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// 錯誤處理
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "檔案太大，請上傳小於 10MB 的圖片" });
    }
  }
  res.status(500).json({ error: error.message });
});

// 健康檢查
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`圖片託管服務運行在 port ${PORT}`);
});
// 圖片管理頁面路由
app.get("/manage", (req, res) => {
  readMeta()
    .then((images) => {
      res.send(`
          <!DOCTYPE html>
          <html>
          <head>
              <title>圖片管理 - 圖片託管服務</title>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                  * { box-sizing: border-box; }
                  body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      max-width: 1200px; 
                      margin: 0 auto; 
                      padding: 20px; 
                      background: #f5f5f5;
                  }
                  .header { 
                      background: white; 
                      padding: 20px; 
                      border-radius: 8px; 
                      margin-bottom: 20px; 
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .nav { 
                      display: flex; 
                      gap: 10px; 
                      margin-bottom: 20px; 
                  }
                  .nav-btn { 
                      padding: 10px 20px; 
                      background: #007bff; 
                      color: white; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer; 
                      text-decoration: none;
                      display: inline-block;
                  }
                  .nav-btn:hover { background: #0056b3; }
                  .nav-btn.active { background: #28a745; }
                  .content { 
                      background: white; 
                      padding: 20px; 
                      border-radius: 8px; 
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .stats { 
                      display: flex; 
                      gap: 20px; 
                      margin-bottom: 30px; 
                      flex-wrap: wrap;
                  }
                  .stat-card { 
                      background: #f8f9fa; 
                      padding: 20px; 
                      border-radius: 8px; 
                      text-align: center; 
                      min-width: 150px;
                  }
                  .stat-number { 
                      font-size: 2em; 
                      font-weight: bold; 
                      color: #007bff; 
                  }
                  .filters { 
                      margin-bottom: 20px; 
                      display: flex; 
                      gap: 10px; 
                      align-items: center;
                      flex-wrap: wrap;
                  }
                  .search-input { 
                      padding: 8px 12px; 
                      border: 1px solid #ddd; 
                      border-radius: 4px; 
                      flex: 1;
                      min-width: 200px;
                  }
                  .sort-select { 
                      padding: 8px 12px; 
                      border: 1px solid #ddd; 
                      border-radius: 4px; 
                  }
                  .images-grid { 
                      display: grid; 
                      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                      gap: 20px; 
                  }
                  .image-card { 
                      border: 1px solid #ddd; 
                      border-radius: 8px; 
                      overflow: hidden; 
                      background: white;
                      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  }
                  .image-preview { 
                      width: 100%; 
                      height: 200px; 
                      object-fit: cover; 
                  }
                  .image-info { 
                      padding: 15px; 
                  }
                  .image-name { 
                      font-weight: bold; 
                      margin-bottom: 8px; 
                      word-break: break-all;
                  }
                  .image-meta { 
                      font-size: 0.9em; 
                      color: #666; 
                      margin-bottom: 5px; 
                  }
                  .image-url { 
                      font-size: 0.8em; 
                      background: #f8f9fa; 
                      padding: 5px; 
                      border-radius: 4px; 
                      word-break: break-all;
                      margin: 10px 0;
                  }
                  .image-actions { 
                      display: flex; 
                      gap: 10px; 
                      margin-top: 10px; 
                      flex-wrap: wrap;
                  }
                  .btn { 
                      padding: 6px 12px; 
                      border: none; 
                      border-radius: 4px; 
                      cursor: pointer; 
                      text-decoration: none;
                      display: inline-block;
                      font-size: 0.9em;
                  }
                  .btn-primary { background: #007bff; color: white; }
                  .btn-danger { background: #dc3545; color: white; }
                  .btn-success { background: #28a745; color: white; }
                  .btn:hover { opacity: 0.8; }
                  .empty-state { 
                      text-align: center; 
                      padding: 60px 20px; 
                      color: #666;
                      grid-column: 1 / -1;
                  }
                  .empty-state img { 
                      width: 100px; 
                      opacity: 0.3; 
                      margin-bottom: 20px; 
                  }
                  .bulk-actions {
                      margin-bottom: 20px;
                      display: flex;
                      gap: 10px;
                      align-items: center;
                      flex-wrap: wrap;
                  }
                  .checkbox {
                      margin-right: 8px;
                  }
                  .selected-count {
                      background: #007bff;
                      color: white;
                      padding: 5px 10px;
                      border-radius: 4px;
                      font-size: 0.9em;
                  }
                  @media (max-width: 768px) {
                      .images-grid { grid-template-columns: 1fr; }
                      .stats { justify-content: center; }
                      .filters { flex-direction: column; align-items: stretch; }
                      .image-actions { justify-content: center; }
                  }
              </style>
          </head>
          <body>
              <div class="header">
                  <h1>圖片管理</h1>
                  <div class="nav">
                      <a href="/" class="nav-btn">上傳圖片</a>
                      <a href="/manage" class="nav-btn active">管理圖片</a>
                  </div>
              </div>

              <div class="content">
                  <!-- 統計卡片 -->
                  <div class="stats">
                      <div class="stat-card">
                          <div class="stat-number" id="totalImages">${
                            images.length
                          }</div>
                          <div>總圖片數</div>
                      </div>
                      <div class="stat-card">
                          <div class="stat-number" id="totalSize">計算中...</div>
                          <div>總容量</div>
                      </div>
                      <div class="stat-card">
                          <div class="stat-number" id="todayUploads">計算中...</div>
                          <div>今日上傳</div>
                      </div>
                  </div>

                  <!-- 批量操作 -->
                  <div class="bulk-actions" id="bulkActions" style="display: none;">
                      <span class="selected-count" id="selectedCount">已選擇 0 張圖片</span>
                      <button class="btn btn-danger" onclick="deleteSelected()">🗑️ 刪除選中</button>
                      <button class="btn btn-primary" onclick="selectAll()">全選</button>
                      <button class="btn" onclick="clearSelection()">取消選擇</button>
                  </div>

                  <!-- 篩選和搜尋 -->
                  <div class="filters">
                      <input type="text" id="searchInput" class="search-input" placeholder="🔍 搜尋圖片名稱...">
                      <select id="sortSelect" class="sort-select">
                          <option value="newest">最新上傳</option>
                          <option value="oldest">最舊上傳</option>
                          <option value="name">檔名 A-Z</option>
                          <option value="size">檔案大小</option>
                      </select>
                      <button class="btn btn-danger" onclick="confirmDeleteAll()">🗑️ 清空全部</button>
                  </div>

                  <!-- 圖片網格 -->
                  <div class="images-grid" id="imagesGrid">
                      ${
                        images.length === 0
                          ? `
                          <div class="empty-state">
                              <div style="font-size: 4em;">📷</div>
                              <h3>還沒有圖片</h3>
                              <p>去 <a href="/">上傳頁面</a> 開始上傳你的第一張圖片吧！</p>
                          </div>
                      `
                          : ""
                      }
                  </div>
              </div>

              <script>
                  let allImages = ${JSON.stringify(images)};
                  let filteredImages = [...allImages];
                  let selectedImages = new Set();

                  // 計算統計資料
                  function calculateStats() {
                      const today = new Date().toDateString();
                      const todayUploads = allImages.filter(img => 
                          new Date(img.uploadTime).toDateString() === today
                      ).length;
                      
                      const totalSize = allImages.reduce((sum, img) => sum + (img.size || 0), 0);
                      
                      document.getElementById('todayUploads').textContent = todayUploads;
                      document.getElementById('totalSize').textContent = formatFileSize(totalSize);
                  }

                  // 格式化檔案大小
                  function formatFileSize(bytes) {
                      if (bytes === 0) return '0 B';
                      const k = 1024;
                      const sizes = ['B', 'KB', 'MB', 'GB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                  }

                  // 更新選擇狀態
                  function updateSelectionUI() {
                      const count = selectedImages.size;
                      const bulkActions = document.getElementById('bulkActions');
                      const selectedCount = document.getElementById('selectedCount');
                      
                      if (count > 0) {
                          bulkActions.style.display = 'flex';
                          selectedCount.textContent = \`已選擇 \${count} 張圖片\`;
                      } else {
                          bulkActions.style.display = 'none';
                      }
                  }

                  // 切換圖片選擇狀態
                  function toggleImageSelection(imageId) {
                      if (selectedImages.has(imageId)) {
                          selectedImages.delete(imageId);
                      } else {
                          selectedImages.add(imageId);
                      }
                      updateSelectionUI();
                      renderImages();
                  }

                  // 全選
                  function selectAll() {
                      filteredImages.forEach(img => selectedImages.add(img.id));
                      updateSelectionUI();
                      renderImages();
                  }

                  // 清除選擇
                  function clearSelection() {
                      selectedImages.clear();
                      updateSelectionUI();
                      renderImages();
                  }

                  // 渲染圖片
                  function renderImages() {
                      const grid = document.getElementById('imagesGrid');
                      
                      if (filteredImages.length === 0) {
                          grid.innerHTML = \`
                              <div class="empty-state">
                                  <div style="font-size: 4em;">🔍</div>
                                  <h3>沒有找到符合的圖片</h3>
                                  <p>試試其他搜尋關鍵字或調整篩選條件</p>
                              </div>
                          \`;
                          return;
                      }

                      grid.innerHTML = filteredImages.map(img => \`
                          <div class="image-card \${selectedImages.has(img.id) ? 'selected' : ''}" data-id="\${img.id}" 
                               style="\${selectedImages.has(img.id) ? 'border-color: #007bff; box-shadow: 0 0 0 2px rgba(0,123,255,0.25);' : ''}">
                              <div style="position: relative;">
                                  <input type="checkbox" class="checkbox" 
                                         style="position: absolute; top: 10px; left: 10px; z-index: 10;"
                                         \${selectedImages.has(img.id) ? 'checked' : ''} 
                                         onchange="toggleImageSelection('\${img.id}')">
                                  <img src="\${img.url}" alt="\${img.originalName}" class="image-preview" 
                                       onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWcluePh+eEoeazleS4reWFpTwvdGV4dD48L3N2Zz4='">
                              </div>
                              <div class="image-info">
                                  <div class="image-name">\${img.originalName}</div>
                                  <div class="image-meta">📅 \${new Date(img.uploadTime).toLocaleString('zh-TW')}</div>
                                  <div class="image-meta">📏 \${formatFileSize(img.size || 0)}</div>
                                  <div class="image-url">\${img.url}</div>
                                  <div class="image-actions">
                                      <button class="btn btn-primary" onclick="copyUrl('\${img.url}')">📋 複製網址</button>
                                      <a href="\${img.url}" target="_blank" class="btn btn-success">👀 查看原圖</a>
                                      <button class="btn btn-danger" onclick="deleteImage('\${img.id}', '\${img.originalName}')">🗑️ 刪除</button>
                                  </div>
                              </div>
                          </div>
                      \`).join('');
                  }

                  // 搜尋功能
                  document.getElementById('searchInput').addEventListener('input', function() {
                      const query = this.value.toLowerCase();
                      filteredImages = allImages.filter(img => 
                          img.originalName.toLowerCase().includes(query)
                      );
                      renderImages();
                  });

                  // 排序功能
                  document.getElementById('sortSelect').addEventListener('change', function() {
                      const sortBy = this.value;
                      
                      filteredImages.sort((a, b) => {
                          switch(sortBy) {
                              case 'newest':
                                  return new Date(b.uploadTime) - new Date(a.uploadTime);
                              case 'oldest':
                                  return new Date(a.uploadTime) - new Date(b.uploadTime);
                              case 'name':
                                  return a.originalName.localeCompare(b.originalName);
                              case 'size':
                                  return (b.size || 0) - (a.size || 0);
                              default:
                                  return 0;
                          }
                      });
                      
                      renderImages();
                  });

                  // 複製網址
                  function copyUrl(url) {
                      navigator.clipboard.writeText(url).then(() => {
                          alert('✅ 網址已複製到剪貼簿！');
                      }).catch(() => {
                          // 備用方案
                          const textArea = document.createElement('textarea');
                          textArea.value = url;
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);
                          alert('✅ 網址已複製到剪貼簿！');
                      });
                  }

                  // 刪除單張圖片
                  async function deleteImage(id, name) {
                      if (!confirm(\`確定要刪除「\${name}」嗎？\\n\\n⚠️ 此操作無法復原！\`)) {
                          return;
                      }

                      try {
                          const response = await fetch(\`/api/images/\${id}\`, {
                              method: 'DELETE'
                          });

                          const result = await response.json();
                          
                          if (response.ok) {
                              // 從陣列中移除
                              allImages = allImages.filter(img => img.id !== id);
                              filteredImages = filteredImages.filter(img => img.id !== id);
                              selectedImages.delete(id);
                              
                              // 更新統計和重新渲染
                              document.getElementById('totalImages').textContent = allImages.length;
                              calculateStats();
                              updateSelectionUI();
                              renderImages();
                              
                              alert('✅ 圖片已刪除！');
                          } else {
                              alert('❌ 刪除失敗：' + result.error);
                          }
                      } catch (error) {
                          alert('❌ 刪除失敗：' + error.message);
                      }
                  }

                  // 刪除選中的圖片
                  async function deleteSelected() {
                      if (selectedImages.size === 0) {
                          alert('請先選擇要刪除的圖片');
                          return;
                      }

                      if (!confirm(\`確定要刪除選中的 \${selectedImages.size} 張圖片嗎？\\n\\n⚠️ 此操作無法復原！\`)) {
                          return;
                      }

                      const deletePromises = Array.from(selectedImages).map(async (id) => {
                          try {
                              const response = await fetch(\`/api/images/\${id}\`, {
                                  method: 'DELETE'
                              });
                              return response.ok;
                          } catch (error) {
                              console.error('刪除失敗:', error);
                              return false;
                          }
                      });

                      try {
                          const results = await Promise.all(deletePromises);
                          const successCount = results.filter(Boolean).length;
                          
                          // 從陣列中移除已刪除的圖片
                          allImages = allImages.filter(img => !selectedImages.has(img.id));
                          filteredImages = filteredImages.filter(img => !selectedImages.has(img.id));
                          selectedImages.clear();
                          
                          // 更新統計和重新渲染
                          document.getElementById('totalImages').textContent = allImages.length;
                          calculateStats();
                          updateSelectionUI();
                          renderImages();
                          
                          alert(\`✅ 成功刪除 \${successCount} 張圖片！\`);
                      } catch (error) {
                          alert('❌ 批量刪除失敗：' + error.message);
                      }
                  }

                  // 清空全部圖片
                  async function confirmDeleteAll() {
                      if (allImages.length === 0) {
                          alert('沒有圖片可以刪除');
                          return;
                      }

                      if (!confirm(\`確定要刪除全部 \${allImages.length} 張圖片嗎？\\n\\n⚠️ 此操作無法復原！\`)) {
                          return;
                      }

                      if (!confirm('⚠️⚠️⚠️ 最後確認 ⚠️⚠️⚠️\\n\\n真的要清空全部圖片嗎？這個動作無法復原！')) {
                          return;
                      }

                      try {
                          const response = await fetch('/api/images/clear-all', {
                              method: 'DELETE'
                          });

                          const result = await response.json();
                          
                          if (response.ok) {
                              allImages = [];
                              filteredImages = [];
                              selectedImages.clear();
                              
                              // 更新統計和重新渲染
                              document.getElementById('totalImages').textContent = 0;
                              calculateStats();
                              updateSelectionUI();
                              renderImages();
                              
                              alert('✅ 已清空全部圖片！');
                          } else {
                              alert('❌ 清空失敗：' + result.error);
                          }
                      } catch (error) {
                          alert('❌ 清空失敗：' + error.message);
                      }
                  }

                  // 初始化
                  calculateStats();
                  renderImages();
              </script>
          </body>
          </html>
      `);
    })
    .catch((error) => {
      console.error("讀取圖片資料失敗:", error);
      res.status(500).send("讀取圖片資料失敗");
    });
});

// API: 獲取所有圖片資訊
app.get("/api/images", (req, res) => {
  readMeta()
    .then((images) => {
      res.json(images);
    })
    .catch((error) => {
      res.status(500).json({ error: "讀取圖片資料失敗" });
    });
});

// API: 刪除單張圖片
app.delete("/api/images/:id", (req, res) => {
  const { id } = req.params;

  readMeta()
    .then((images) => {
      const imageIndex = images.findIndex((img) => img.id === id);
      if (imageIndex === -1) {
        return res.status(404).json({ error: "圖片不存在" });
      }

      const image = images[imageIndex];

      // 刪除實際檔案
      fs.unlink(path.join(uploadsDir, image.filename))
        .then(() => {
          console.log("檔案已刪除:", image.filename);
        })
        .catch((fileError) => {
          console.log("檔案已不存在或刪除失敗:", fileError.message);
        });

      // 從 metadata 中移除
      images.splice(imageIndex, 1);

      return writeMeta(images).then(() => {
        res.json({ success: true, message: "圖片已刪除" });
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// API: 批量刪除圖片
app.delete("/api/images/batch", (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "請提供要刪除的圖片ID陣列" });
  }

  readMeta()
    .then((images) => {
      const imagesToDelete = images.filter((img) => ids.includes(img.id));
      const remainingImages = images.filter((img) => !ids.includes(img.id));

      if (imagesToDelete.length === 0) {
        return res.status(404).json({ error: "沒有找到要刪除的圖片" });
      }

      // 刪除實際檔案
      const deletePromises = imagesToDelete.map((image) =>
        fs
          .unlink(path.join(uploadsDir, image.filename))
          .then(() => {
            console.log("檔案已刪除:", image.filename);
          })
          .catch((fileError) => {
            console.log("檔案已不存在或刪除失敗:", fileError.message);
          })
      );

      // 等待所有檔案刪除完成，然後更新 metadata
      Promise.all(deletePromises)
        .then(() => {
          return writeMeta(remainingImages);
        })
        .then(() => {
          res.json({
            success: true,
            message: `已刪除 ${imagesToDelete.length} 張圖片`,
            deletedCount: imagesToDelete.length,
          });
        })
        .catch((error) => {
          res.status(500).json({ error: error.message });
        });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// API: 清空全部圖片
app.delete("/api/images/clear-all", (req, res) => {
  readMeta()
    .then((images) => {
      // 刪除所有檔案的 Promise 陣列
      const deletePromises = images.map((image) => {
        return fs
          .unlink(path.join(uploadsDir, image.filename))
          .catch((fileError) => {
            console.log("檔案刪除失敗:", image.filename, fileError.message);
          });
      });

      // 等待所有檔案刪除完成，然後清空 metadata
      Promise.all(deletePromises)
        .then(() => {
          return writeMeta([]);
        })
        .then(() => {
          res.json({
            success: true,
            message: `已刪除 ${images.length} 張圖片`,
          });
        })
        .catch((error) => {
          res.status(500).json({ error: error.message });
        });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// API: 更新圖片資訊（可選功能）
app.put("/api/images/:id", (req, res) => {
  const { id } = req.params;
  const { originalName } = req.body;

  if (!originalName) {
    return res.status(400).json({ error: "請提供新的檔案名稱" });
  }

  readMeta()
    .then((images) => {
      const imageIndex = images.findIndex((img) => img.id === id);
      if (imageIndex === -1) {
        return res.status(404).json({ error: "圖片不存在" });
      }

      // 更新圖片資訊
      images[imageIndex].originalName = originalName;
      images[imageIndex].updatedTime = new Date().toISOString();

      return writeMeta(images).then(() => {
        res.json({
          success: true,
          message: "圖片資訊已更新",
          image: images[imageIndex],
        });
      });
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});
