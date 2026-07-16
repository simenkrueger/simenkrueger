// ============================================
// 羽生结弦资料库 - 分页 + 大数据支持
// ============================================

// ============================================
// 配置
// ============================================

const CONFIG = {
    defaultLanguage: 'zh-Hans',
    defaultSeason: 'all',
    pageSize: 15,                // 每页显示 15 条
    maxCacheSize: 5,             // 最多缓存 5 个赛季
    languages: ['zh-Hans', 'en', 'ja']
};

// ============================================
// 状态
// ============================================

let state = {
    language: CONFIG.defaultLanguage,
    season: CONFIG.defaultSeason,
    filter: 'all',
    view: 'list',
    page: 1,
    totalPages: 1
};

// 缓存
const cache = {
    index: null,                 // 索引数据
    seasons: new Map(),          // 赛季数据缓存 { 'zh-Hans-2025-2026': [...] }
    loadedSeasons: []            // 已加载的赛季列表（用于 LRU 淘汰）
};

// 当前显示的数据
let currentEvents = [];
let currentFiltered = [];

// ============================================
// DOM 缓存
// ============================================

const dom = {
    languageSelector: document.getElementById('languageSelector'),
    contentArea: document.getElementById('content-area'),
    resultCount: document.getElementById('result-count'),
    seasonFilterContainer: document.getElementById('seasonFilterContainer'),
    paginationContainer: document.getElementById('paginationContainer')
};

// ============================================
// 第一步：加载索引
// ============================================

async function loadIndex() {
    console.log('🔄 加载索引...');
    const startTime = performance.now();
    
    try {
        const response = await fetch('data/index.json');
        if (!response.ok) throw new Error('索引文件不存在');
        cache.index = await response.json();
        
        // 初始化语言选择器
        initLanguageSelector();
        // 渲染赛季筛选器
        renderSeasonFilters();
        // 加载默认赛季
        await loadSeasonData(state.season === 'all' ? cache.index.seasons[0] : state.season);
        
        const loadTime = (performance.now() - startTime).toFixed(0);
        console.log(`✅ 索引加载完成，耗时 ${loadTime}ms`);
        
    } catch (error) {
        console.error('❌ 加载索引失败:', error);
        dom.contentArea.innerHTML = `
            <div class="empty">
                <i class="fas fa-exclamation-triangle"></i> 
                加载失败: ${error.message}
                <br><small>请确保 data/index.json 存在</small>
            </div>
        `;
    }
}

// ============================================
// 第二步：加载赛季数据（带缓存）
// ============================================

async function loadSeasonData(season) {
    const cacheKey = `${state.language}-${season}`;
    
    // 检查缓存
    if (cache.seasons.has(cacheKey)) {
        console.log(`📦 使用缓存: ${cacheKey}`);
        currentEvents = cache.seasons.get(cacheKey);
        updatePagination();
        renderEvents();
        return;
    }
    
    console.log(`🔄 加载赛季数据: ${season} [${state.language}]`);
    
    try {
        const url = `data/${state.language}/${season}.json`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`⚠️ ${season} 数据不存在`);
            currentEvents = [];
            updatePagination();
            renderEvents();
            return;
        }
        
        const data = await response.json();
        const events = data.events || [];
        
        // 缓存数据（LRU 淘汰）
        addToCache(cacheKey, events);
        
        currentEvents = events;
        console.log(`✅ ${season} 加载完成，${events.length} 条数据`);
        
        updatePagination();
        renderEvents();
        
    } catch (error) {
        console.error(`❌ 加载 ${season} 失败:`, error);
        currentEvents = [];
        renderEvents();
    }
}

// ============================================
// 第三步：缓存管理（LRU 淘汰）
// ============================================

function addToCache(key, data) {
    // 如果缓存已满，删除最旧的
    if (cache.seasons.size >= CONFIG.maxCacheSize) {
        const oldestKey = cache.loadedSeasons.shift();
        cache.seasons.delete(oldestKey);
        console.log(`🗑️ 淘汰缓存: ${oldestKey}`);
    }
    
    cache.seasons.set(key, data);
    cache.loadedSeasons.push(key);
}

// ============================================
// 第四步：分页逻辑
// ============================================

function updatePagination() {
    const total = currentEvents.length;
    state.totalPages = Math.max(1, Math.ceil(total / CONFIG.pageSize));
    
    // 如果当前页超出总页数，重置到第一页
    if (state.page > state.totalPages) {
        state.page = 1;
    }
    
    // 更新分页显示
    renderPagination();
}

function getCurrentPageData() {
    const start = (state.page - 1) * CONFIG.pageSize;
    const end = Math.min(start + CONFIG.pageSize, currentFiltered.length);
    return currentFiltered.slice(start, end);
}

// ============================================
// 第五步：渲染分页控件
// ============================================

function renderPagination() {
    if (!dom.paginationContainer) return;
    
    const { page, totalPages } = state;
    
    if (totalPages <= 1) {
        dom.paginationContainer.innerHTML = '';
        return;
    }
    
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" data-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;
    
    // 显示页码（最多 7 个）
    const maxVisible = 7;
    let startPage = Math.max(1, page - 3);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    html += `<button class="page-btn" data-page="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>`;
    html += `</div>`;
    
    dom.paginationContainer.innerHTML = html;
    
    // 绑定分页事件
    dom.paginationContainer.querySelectorAll('.page-btn').forEach(el => {
        el.addEventListener('click', function() {
            const target = this.dataset.page;
            if (target === 'prev' && state.page > 1) {
                state.page--;
            } else if (target === 'next' && state.page < state.totalPages) {
                state.page++;
            } else if (!isNaN(target)) {
                state.page = parseInt(target);
            }
            renderEvents();
        });
    });
}

// ============================================
// 第六步：渲染事件列表（分页）
// ============================================

function renderEvents() {
    const startTime = performance.now();
    
    // 1. 过滤
    let filtered = currentEvents;
    if (state.filter !== 'all') {
        filtered = filtered.filter(e => e.type === state.filter);
    }
    currentFiltered = filtered;
    
    // 2. 更新总数显示
    if (dom.resultCount) {
        dom.resultCount.textContent = `${filtered.length} 项 (第 ${state.page}/${state.totalPages} 页)`;
    }
    
    // 3. 分页
    const pageData = getCurrentPageData();
    
    if (pageData.length === 0) {
        dom.contentArea.innerHTML = `
            <div class="empty">
                <i class="fas fa-inbox"></i> 
                暂无数据
                <br><small>当前赛季没有数据</small>
            </div>
        `;
        renderPagination();
        return;
    }
    
    // 4. 按赛季分组（如果显示全部赛季）
    const seasons = {};
    pageData.forEach(e => {
        const season = e.season || '未分类';
        if (!seasons[season]) seasons[season] = [];
        seasons[season].push(e);
    });
    
    // 5. 生成 HTML
    let html = '';
    for (const [season, events] of Object.entries(seasons)) {
        html += `<div class="season-group">`;
        html += `<div class="season-title"><i class="fas fa-trophy"></i> ${season} <span class="count">${events.length} 项</span></div>`;

        if (state.view === 'list') {
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
    
    // 更新分页
    renderPagination();
    
    const renderTime = (performance.now() - startTime).toFixed(0);
    console.log(`⚡ 渲染完成，${pageData.length} 条数据，耗时 ${renderTime}ms`);
}

// ============================================
// 第七步：UI 控件绑定
// ============================================

// 语言选择器
function initLanguageSelector() {
    if (!dom.languageSelector) return;
    
    const languages = cache.index.languages || CONFIG.languages;
    dom.languageSelector.innerHTML = languages.map(lang => 
        `<option value="${lang}" ${lang === state.language ? 'selected' : ''}>${lang}</option>`
    ).join('');
    
    dom.languageSelector.addEventListener('change', function() {
        state.language = this.value;
        // 切换语言时清空缓存（不同语言的数据不同）
        cache.seasons.clear();
        cache.loadedSeasons = [];
        loadSeasonData(state.season === 'all' ? cache.index.seasons[0] : state.season);
    });
}

// 赛季筛选器
function renderSeasonFilters() {
    if (!dom.seasonFilterContainer) return;
    
    const seasons = cache.index.seasons || [];
    let html = `<span class="label"><i class="fas fa-calendar-alt"></i> 赛季</span>`;
    html += `<span class="filter-tag ${state.season === 'all' ? 'active' : ''}" data-season="all">全部</span>`;
    
    seasons.forEach(season => {
        const count = cache.index.seasonCounts?.[season] || 0;
        html += `<span class="filter-tag ${state.season === season ? 'active' : ''}" data-season="${season}">${season} (${count})</span>`;
    });
    
    dom.seasonFilterContainer.innerHTML = html;
    
    // 绑定事件
    dom.seasonFilterContainer.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', async function() {
            dom.seasonFilterContainer.querySelectorAll('.filter-tag[data-season]')
                .forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            state.season = this.dataset.season;
            state.page = 1;
            
            if (state.season === 'all') {
                // 加载所有赛季（逐个加载）
                await loadAllSeasons();
            } else {
                await loadSeasonData(state.season);
            }
        });
    });
}

// 加载所有赛季
async function loadAllSeasons() {
    console.log('🔄 加载所有赛季...');
    const allSeasons = cache.index.seasons || [];
    const allEvents = [];
    
    for (const season of allSeasons) {
        const cacheKey = `${state.language}-${season}`;
        if (cache.seasons.has(cacheKey)) {
            allEvents.push(...cache.seasons.get(cacheKey));
        } else {
            try {
                const url = `data/${state.language}/${season}.json`;
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    const events = data.events || [];
                    addToCache(cacheKey, events);
                    allEvents.push(...events);
                }
            } catch (e) {
                console.warn(`⚠️ 加载 ${season} 失败`);
            }
        }
    }
    
    currentEvents = allEvents;
    updatePagination();
    renderEvents();
    console.log(`✅ 所有赛季加载完成，共 ${allEvents.length} 条数据`);
}

// 类型筛选
document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
    el.addEventListener('click', function() {
        document.querySelectorAll('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.filter = this.dataset.filter;
        state.page = 1;
        renderEvents();
    });
});

// 视图切换
document.querySelectorAll('.view-btn').forEach(el => {
    el.addEventListener('click', function() {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.view = this.dataset.view;
        renderEvents();
    });
});

// ============================================
// PDF 渲染（懒加载）
// ============================================

let pdfjsLoaded = false;

async function openPDF(pdfFile, title) {
    if (!pdfjsLoaded) {
        await loadPDFJS();
    }
    // PDF 渲染逻辑（省略）
}

async function loadPDFJS() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            pdfjsLoaded = true;
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// 启动
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM 加载完成');
    loadIndex();
});

console.log('📄 script.js 已加载（分页版）');
