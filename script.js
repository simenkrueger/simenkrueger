// ============================================
// 羽生结弦资料库 - 多语言（从根目录读取 JSON）
// ============================================

// ============================================
// 配置
// ============================================

const CONFIG = {
    defaultLanguage: 'zh-Hans'
};

// 状态
let currentLanguage = CONFIG.defaultLanguage;
let currentSeason = 'all';
let currentFilter = 'all';
let currentView = 'list';
let allData = {};
let indexData = null;

// PDF.js 设置（如果用了 PDF）
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfDoc = null;
let pdfCurrentPage = 1;
let pdfScale = 1.2;

// ============================================
// DOM 元素缓存
// ============================================

const dom = {
    languageSelector: document.getElementById('languageSelector'),
    contentArea: document.getElementById('content-area'),
    resultCount: document.getElementById('result-count'),
    pdfModal: document.getElementById('pdfModal'),
    pdfContainer: document.getElementById('pdfContainer'),
    pdfTitle: document.getElementById('pdfTitle'),
    pdfPageInfo: document.getElementById('pdfPageInfo'),
    pdfPrevPage: document.getElementById('pdfPrevPage'),
    pdfNextPage: document.getElementById('pdfNextPage'),
    pdfZoomIn: document.getElementById('pdfZoomIn'),
    pdfZoomOut: document.getElementById('pdfZoomOut')
};

// ============================================
// 语言切换
// ============================================

dom.languageSelector.addEventListener('change', function() {
    currentLanguage = this.value;
    loadAllData();
});

// ============================================
// 加载数据（从根目录）
// ============================================

async function loadAllData() {
    console.log(`🔄 加载数据 [${currentLanguage}]...`);
    
    try {
        // 1. 加载索引（从根目录）
        const indexRes = await fetch('index.json');
        if (!indexRes.ok) {
            throw new Error(`index.json 不存在 (HTTP ${indexRes.status})`);
        }
        indexData = await indexRes.json();
        console.log('📋 索引加载成功:', indexData);
        
        // 2. 加载当前语言的数据（从根目录）
        const langFile = `${currentLanguage}.json`;
        const langRes = await fetch(langFile);
        if (!langRes.ok) {
            throw new Error(`${langFile} 不存在 (HTTP ${langRes.status})`);
        }
        const langData = await langRes.json();
        console.log(`✅ ${currentLanguage} 数据加载成功:`, langData);
        
        // 3. 转换数据格式
        // 假设 langData 结构: { "2025-2026": [...], "2024-2025": [...] }
        allData = {};
        for (const [season, events] of Object.entries(langData)) {
            allData[season] = events;
        }
        
        // 如果没有赛季数据，显示提示
        if (Object.keys(allData).length === 0) {
            dom.contentArea.innerHTML = `
                <div class="empty">
                    <i class="fas fa-inbox"></i> 
                    暂无数据
                    <br><small>请在 ${langFile} 中添加数据</small>
                </div>
            `;
            return;
        }
        
        renderEvents();
        
    } catch (error) {
        console.error('❌ 加载失败:', error);
        dom.contentArea.innerHTML = `
            <div class="empty">
                <i class="fas fa-exclamation-triangle"></i> 
                加载失败: ${error.message}
                <br><br>
                <div style="font-size:0.85rem; text-align:left; max-width:500px; margin:0 auto; color:#6b839b;">
                    <b>请检查文件是否存在：</b><br>
                    ✅ index.json<br>
                    ✅ ${currentLanguage}.json<br>
                    <br>
                    <b>文件结构示例：</b><br>
                    <pre style="background:#f5f7fa; padding:0.5rem; border-radius:8px; font-size:0.75rem;">
{
  "2025-2026": [
    { "title": "...", "date": "...", "type": "..." }
  ]
}
                    </pre>
                </div>
            </div>
        `;
    }
}

// ============================================
// 获取所有事件
// ============================================

function getAllEvents() {
    const all = [];
    for (const [season, events] of Object.entries(allData)) {
        events.forEach(e => {
            all.push({ ...e, season });
        });
    }
    return all;
}

// ============================================
// 渲染事件列表
// ============================================

function renderEvents() {
    let allEvents = getAllEvents();
    
    // 过滤
    let filtered = allEvents;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(e => e.type === currentFilter);
    }
    if (currentSeason !== 'all') {
        filtered = filtered.filter(e => e.season === currentSeason);
    }

    if (!dom.contentArea) return;
    
    if (dom.resultCount) {
        dom.resultCount.textContent = `${filtered.length} 项`;
    }

    if (filtered.length === 0) {
        dom.contentArea.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        return;
    }

    // 按赛季分组
    const seasons = {};
    filtered.forEach(e => {
        const season = e.season || '未分类';
        if (!seasons[season]) seasons[season] = [];
        seasons[season].push(e);
    });

    let html = '';
    for (const [season, events] of Object.entries(seasons)) {
        html += `<div class="season-group">`;
        html += `<div class="season-title"><i class="fas fa-trophy"></i> ${season} <span class="count">${events.length} 项</span></div>`;

        if (currentView === 'list') {
            html += `<div class="event-list">`;
            events.forEach(e => {
                html += `
                    <div class="event-item">
                        <span class="event-date">${e.date || '日期待定'}</span>
                        <span class="event-type ${e.type || '其他'}">${e.type || '其他'}</span>
                        <span class="event-title">${e.title || '无标题'}</span>
                        ${e.result ? `<span class="event-result">${e.result}</span>` : ''}
                        <span class="event-media">
                            ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i></a>` : ''}
                            ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i></a>` : ''}
                            ${e.pdf ? `<button onclick="openPDF('${e.pdf}', '${e.title}')" class="pdf-btn"><i class="fas fa-file-pdf"></i></button>` : ''}
                        </span>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<div class="event-grid">`;
            events.forEach(e => {
                html += `
                    <div class="event-card">
                        <div class="date">${e.date || '日期待定'}</div>
                        <div class="title">${e.title || '无标题'}</div>
                        <span class="type ${e.type || '其他'}">${e.type || '其他'}</span>
                        ${e.result ? `<div class="result">${e.result}</div>` : ''}
                        <div class="media-links">
                            ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i> 照片</a>` : ''}
                            ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i> 视频</a>` : ''}
                            ${e.pdf ? `<button onclick="openPDF('${e.pdf}', '${e.title}')" class="pdf-btn"><i class="fas fa-file-pdf"></i> PDF</button>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
    }

    dom.contentArea.innerHTML = html;
}

// ============================================
// PDF 渲染
// ============================================

async function openPDF(pdfFile, title) {
    const modal = dom.pdfModal;
    const container = dom.pdfContainer;
    const titleEl = dom.pdfTitle;
    const pageInfo = dom.pdfPageInfo;
    
    const pdfPath = `pdfs/${pdfFile}`;
    
    modal.style.display = 'block';
    titleEl.textContent = title || 'PDF 预览';
    container.innerHTML = `<div class="loading-pdf"><i class="fas fa-spinner fa-spin"></i> 加载 PDF...</div>`;
    
    try {
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        pdfDoc = await loadingTask.promise;
        pdfCurrentPage = 1;
        pdfScale = 1.2;
        
        pageInfo.textContent = `1 / ${pdfDoc.numPages}`;
        dom.pdfPrevPage.disabled = true;
        dom.pdfNextPage.disabled = pdfDoc.numPages <= 1;
        
        await renderPDFPage(pdfCurrentPage);
        
        dom.pdfPrevPage.onclick = async () => {
            if (pdfCurrentPage > 1) {
                pdfCurrentPage--;
                await renderPDFPage(pdfCurrentPage);
            }
        };
        dom.pdfNextPage.onclick = async () => {
            if (pdfCurrentPage < pdfDoc.numPages) {
                pdfCurrentPage++;
                await renderPDFPage(pdfCurrentPage);
            }
        };
        
        dom.pdfZoomIn.onclick = () => {
            pdfScale = Math.min(pdfScale + 0.2, 3);
            renderPDFPage(pdfCurrentPage);
        };
        dom.pdfZoomOut.onclick = () => {
            pdfScale = Math.max(pdfScale - 0.2, 0.5);
            renderPDFPage(pdfCurrentPage);
        };
        
    } catch (error) {
        console.error('PDF 加载失败:', error);
        container.innerHTML = `
            <div class="pdf-error">
                <i class="fas fa-exclamation-triangle"></i> 
                加载 PDF 失败: ${error.message}
                <br><small>请确保 PDF 文件存在: ${pdfPath}</small>
            </div>
        `;
    }
}

async function renderPDFPage(pageNum) {
    const container = dom.pdfContainer;
    const pageInfo = dom.pdfPageInfo;
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: pdfScale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'pdf-canvas';
        
        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        container.innerHTML = '';
        container.appendChild(canvas);
        
        pageInfo.textContent = `${pageNum} / ${pdfDoc.numPages}`;
        dom.pdfPrevPage.disabled = pageNum <= 1;
        dom.pdfNextPage.disabled = pageNum >= pdfDoc.numPages;
        
    } catch (error) {
        console.error('渲染页面失败:', error);
    }
}

function closePDF() {
    dom.pdfModal.style.display = 'none';
    pdfDoc = null;
    dom.pdfContainer.innerHTML = '';
}

dom.pdfModal.addEventListener('click', function(e) {
    if (e.target === this) closePDF();
});

// ============================================
// 键盘快捷键
// ============================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closePDF();
    if (e.key === 'ArrowLeft' && pdfDoc && pdfCurrentPage > 1) {
        pdfCurrentPage--;
        renderPDFPage(pdfCurrentPage);
    }
    if (e.key === 'ArrowRight' && pdfDoc && pdfCurrentPage < pdfDoc.numPages) {
        pdfCurrentPage++;
        renderPDFPage(pdfCurrentPage);
    }
});

// ============================================
// 绑定筛选事件
// ============================================

document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
    el.addEventListener('click', function() {
        document.querySelectorAll('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentFilter = this.dataset.filter;
        renderEvents();
    });
});

document.querySelectorAll('.filter-tag[data-season]').forEach(el => {
    el.addEventListener('click', function() {
        document.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentSeason = this.dataset.season;
        renderEvents();
    });
});

document.querySelectorAll('.view-btn').forEach(el => {
    el.addEventListener('click', function() {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentView = this.dataset.view;
        renderEvents();
    });
});

// ============================================
// 启动
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM 加载完成');
    loadAllData();
});

console.log('📄 script.js 已加载（根目录版本）');
