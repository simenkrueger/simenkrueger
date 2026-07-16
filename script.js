// ============================================
// 羽生结弦资料库 - 按需加载
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
let seasonsIndex = null;        // 赛季索引（轻量）
let loadedData = {};            // 已加载的数据缓存 { 'zh-Hans-2025-2026': [...] }
let allEvents = [];            // 当前显示的所有事件

// ============================================
// DOM 缓存
// ============================================

const dom = {
    languageSelector: document.getElementById('languageSelector'),
    contentArea: document.getElementById('content-area'),
    resultCount: document.getElementById('result-count'),
    seasonFilterContainer: document.getElementById('seasonFilterContainer')
};

// ============================================
// 语言切换
// ============================================

dom.languageSelector.addEventListener('change', function() {
    currentLanguage = this.value;
    // 切换语言时，清空缓存，重新加载
    loadedData = {};
    allEvents = [];
    loadSeasonsIndex();
});

// ============================================
// 第一步：加载赛季索引（超轻量）
// ============================================

async function loadSeasonsIndex() {
    console.log('🔄 加载赛季索引...');
    
    try {
        const response = await fetch('data/seasons.json');
        if (!response.ok) throw new Error('无法加载赛季索引');
        seasonsIndex = await response.json();
        console.log('📋 索引加载成功:', seasonsIndex);
        
        // 更新赛季筛选器
        renderSeasonFilters();
        
        // 默认加载第一个赛季
        const firstSeason = seasonsIndex.seasons[0];
        if (firstSeason) {
            await loadSeasonData(firstSeason);
        }
        
    } catch (error) {
        console.error('❌ 加载索引失败:', error);
        dom.contentArea.innerHTML = `
            <div class="empty">
                <i class="fas fa-exclamation-triangle"></i> 
                加载失败: ${error.message}
                <br><small>请确保 data/seasons.json 存在</small>
            </div>
        `;
    }
}

// ============================================
// 第二步：渲染赛季筛选器
// ============================================

function renderSeasonFilters() {
    if (!dom.seasonFilterContainer) return;
    
    let html = `<span class="label"><i class="fas fa-calendar-alt"></i> 赛季</span>`;
    html += `<span class="filter-tag active" data-season="all">全部</span>`;
    
    seasonsIndex.seasons.forEach(season => {
        const count = seasonsIndex.seasonCounts[season] || 0;
        html += `<span class="filter-tag" data-season="${season}">${season} (${count})</span>`;
    });
    
    dom.seasonFilterContainer.innerHTML = html;
    
    // 重新绑定赛季筛选事件
    dom.seasonFilterContainer.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', async function() {
            dom.seasonFilterContainer.querySelectorAll('.filter-tag[data-season]')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const season = this.dataset.season;
            currentSeason = season;
            
            if (season === 'all') {
                // 加载所有赛季
                await loadAllSeasons();
            } else {
                // 加载单个赛季
                await loadSeasonData(season);
            }
        });
    });
}

// ============================================
// 第三步：加载单个赛季数据
// ============================================

async function loadSeasonData(season) {
    const cacheKey = `${currentLanguage}-${season}`;
    
    // 检查缓存
    if (loadedData[cacheKey]) {
        console.log(`📦 使用缓存: ${cacheKey}`);
        allEvents = loadedData[cacheKey];
        renderEvents();
        return;
    }
    
    console.log(`🔄 加载赛季数据: ${season} [${currentLanguage}]`);
    
    try {
        const url = `data/${currentLanguage}/${season}.json`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`⚠️ ${season} 数据不存在:`, url);
            loadedData[cacheKey] = [];
            allEvents = [];
            renderEvents();
            return;
        }
        
        const data = await response.json();
        const events = data.events || [];
        
        // 缓存数据
        loadedData[cacheKey] = events;
        allEvents = events;
        
        console.log(`✅ ${season} 加载完成，${events.length} 条数据`);
        renderEvents();
        
    } catch (error) {
        console.error(`❌ 加载 ${season} 失败:`, error);
        allEvents = [];
        renderEvents();
    }
}

// ============================================
// 第四步：加载所有赛季（全部）
// ============================================

async function loadAllSeasons() {
    console.log('🔄 加载所有赛季...');
    
    const allSeasons = seasonsIndex.seasons;
    const loadPromises = allSeasons.map(season => {
        const cacheKey = `${currentLanguage}-${season}`;
        if (loadedData[cacheKey]) {
            return Promise.resolve({ season, events: loadedData[cacheKey] });
        }
        
        return fetch(`data/${currentLanguage}/${season}.json`)
            .then(res => {
                if (!res.ok) return { season, events: [] };
                return res.json().then(data => ({ season, events: data.events || [] }));
            })
            .catch(() => ({ season, events: [] }));
    });
    
    try {
        const results = await Promise.all(loadPromises);
        
        // 合并所有数据
        allEvents = [];
        results.forEach(result => {
            const cacheKey = `${currentLanguage}-${result.season}`;
            loadedData[cacheKey] = result.events;
            allEvents = allEvents.concat(result.events);
        });
        
        console.log(`✅ 所有赛季加载完成，共 ${allEvents.length} 条数据`);
        renderEvents();
        
    } catch (error) {
        console.error('❌ 加载所有赛季失败:', error);
    }
}

// ============================================
// 第五步：渲染事件列表
// ============================================

function renderEvents() {
    // 过滤
    let filtered = allEvents;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(e => e.type === currentFilter);
    }

    if (dom.resultCount) {
        dom.resultCount.textContent = `${filtered.length} 项`;
    }

    if (filtered.length === 0) {
        dom.contentArea.innerHTML = `
            <div class="empty">
                <i class="fas fa-inbox"></i> 
                暂无数据
                <br><small>请添加数据文件</small>
            </div>
        `;
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
// PDF 渲染（懒加载）
// ============================================

async function openPDF(pdfFile, title) {
    // 动态加载 PDF.js（只在使用时加载）
    if (typeof pdfjsLib === 'undefined') {
        await loadPDFJS();
    }
    // ... 原有 PDF 渲染逻辑
}

async function loadPDFJS() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

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
    loadSeasonsIndex();
});

console.log('📄 script.js 已加载（按需加载版本）');
