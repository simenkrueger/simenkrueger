// ============================================================
// Simen Hegstad Krüger · 资料库
// 极致优化：预加载 + 纯内存操作
// ============================================================

// ---------- 全局状态 ----------
const state = {
    season: 'all',
    type: 'all',
    view: 'list',
    page: 1,
    pageSize: 15,
    seasons: [],
    allData: {}        // { '2025-2026': [...], '2024-2025': [...] }
};

// ---------- DOM 缓存 ----------
const dom = {
    content: document.getElementById('content-area'),
    count: document.getElementById('result-count'),
    seasonContainer: document.getElementById('season-tags-container'),
    tagContainer: document.getElementById('tag-container'),
    pagination: document.getElementById('pagination-container')
};

// ---------- 工具函数 ----------
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

// ---------- 1. 加载所有数据（预加载） ----------
async function loadAllData() {
    dom.content.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载数据中...</div>`;
    const startTime = performance.now();

    try {
        // 1. 加载索引
        const indexRes = await fetch('index.json');
        if (!indexRes.ok) throw new Error('index.json 不存在');
        const indexData = await indexRes.json();
        state.seasons = indexData.seasons || [];

        // 2. 预加载所有赛季 JSON（并行请求）
        const fetchPromises = state.seasons.map(async (season) => {
            try {
                const res = await fetch(`${season}.json`);
                if (res.ok) {
                    const data = await res.json();
                    return { season, events: data.events || [] };
                }
                return { season, events: [] };
            } catch {
                return { season, events: [] };
            }
        });

        const results = await Promise.all(fetchPromises);

        // 3. 存入内存
        results.forEach(({ season, events }) => {
            state.allData[season] = events;
        });

        // 4. 渲染
        renderSeasonTags();
        render();

        const elapsed = (performance.now() - startTime).toFixed(0);
        const totalEvents = Object.values(state.allData).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`✅ 预加载完成: ${state.seasons.length} 个赛季, ${totalEvents} 条数据, 耗时 ${elapsed}ms`);

    } catch (err) {
        dom.content.innerHTML = `<div class="empty">❌ 加载失败: ${err.message}</div>`;
        console.error(err);
    }
}

// ---------- 2. 渲染赛季按钮 ----------
function renderSeasonTags() {
    if (!dom.seasonContainer) return;
    let html = `<span class="filter-tag active" data-season="all">全部</span>`;
    state.seasons.forEach(s => {
        html += `<span class="filter-tag" data-season="${s}">${s}</span>`;
    });
    dom.seasonContainer.innerHTML = html;

    dom.seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', function() {
            dom.seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.season = this.dataset.season;
            state.page = 1;
            render();  // 纯内存操作，0 网络请求
        });
    });
}

// ---------- 3. 获取数据（纯内存） ----------
function getEvents() {
    let events = [];

    if (state.season === 'all') {
        state.seasons.forEach(s => {
            (state.allData[s] || []).forEach(e => {
                events.push({ ...e, _season: s });
            });
        });
    } else {
        (state.allData[state.season] || []).forEach(e => {
            events.push({ ...e, _season: state.season });
        });
    }

    // 类型筛选
    if (state.type !== 'all') {
        events = events.filter(e => e.type === state.type);
    }

    // 排序（最新在前）
    events.sort((a, b) => (a.date > b.date ? -1 : 1));
    return events;
}

// ---------- 4. 渲染 ----------
function render() {
    const startTime = performance.now();

    // 从内存获取数据（0 网络请求）
    const events = getEvents();
    const total = events.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const pageData = events.slice(start, start + state.pageSize);

    // 更新计数
    const seasonLabel = state.season === 'all' ? '全部赛季' : state.season;
    dom.count.textContent = `${total} 项 (${seasonLabel} · ${state.page}/${totalPages} 页)`;

    // 空状态
    if (total === 0) {
        dom.content.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        renderPagination(totalPages);
        return;
    }

    // 按赛季分组
    const groups = {};
    pageData.forEach(e => {
        const s = e._season || '未分类';
        if (!groups[s]) groups[s] = [];
        groups[s].push(e);
    });

    let html = '';
    for (const [season, items] of Object.entries(groups)) {
        html += `<div class="season-group">`;
        html += `<div class="season-title"><i class="fas fa-trophy"></i> ${season} <span class="count">${items.length} 项</span></div>`;
        html += state.view === 'list' ? renderList(items) : renderGrid(items);
        html += `</div>`;
    }

    dom.content.innerHTML = html;
    renderPagination(totalPages);

    const elapsed = (performance.now() - startTime).toFixed(0);
    if (pageData.length > 0) {
        console.log(`⚡ 渲染完成: ${pageData.length} 条数据, ${elapsed}ms`);
    }
}

// ---------- 5. 列表渲染 ----------
const EXCLUDED_TYPES = ['世界杯', '奥运会', '世锦赛', '全国锦标赛', '其他', '夏季比赛'];

function renderList(items) {
    let html = `<div class="event-list">`;
    items.forEach(e => {
        const tags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        html += `
            <div class="event-item">
                <div class="event-main">
                    <span class="event-date">${e.date || '日期待定'}</span>
                    <span class="event-type ${e.type || '其他'}">${e.type || '其他'}</span>
                    <span class="event-title">${e.title || '无标题'}</span>
                    ${e.result ? `<span class="event-result">${e.result}</span>` : ''}
                </div>
                ${e.location ? `<div class="event-location"><i class="fas fa-map-pin"></i> ${e.location}</div>` : ''}
                ${e.description ? `<div class="event-desc">${e.description}</div>` : ''}
                ${e.detail ? `<div class="event-detail">📋 ${e.detail}</div>` : ''}
                <div class="event-footer">
                    <span class="event-tags">${tags.map(t => `<span class="mini-tag">${t}</span>`).join('')}</span>
                    <div class="event-links">
                        ${e.photo ? `<a href="${e.photo}" target="_blank" class="link-btn photo" title="照片"><i class="fas fa-image"></i></a>` : ''}
                        ${e.video ? `<a href="${e.video}" target="_blank" class="link-btn video" title="视频"><i class="fas fa-video"></i></a>` : ''}
                        ${e.fisLink ? `<a href="${e.fisLink}" target="_blank" class="link-btn fis" title="FIS官网"><i class="fas fa-globe"></i></a>` : ''}
                        ${e.pdf ? `<a href="${e.pdf}" target="_blank" class="link-btn pdf" title="PDF报告"><i class="fas fa-file-pdf"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    return html + `</div>`;
}

// ---------- 6. 卡片渲染 ----------
function renderGrid(items) {
    let html = `<div class="event-grid">`;
    items.forEach(e => {
        const tags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        html += `
            <div class="event-card">
                <div class="card-header">
                    <span class="card-type ${e.type || '其他'}">${e.type || '其他'}</span>
                    <span class="card-date">${e.date || '日期待定'}</span>
                </div>
                <div class="card-title">${e.title || '无标题'}</div>
                ${e.result ? `<div class="card-result">🏅 ${e.result}</div>` : ''}
                ${e.location ? `<div class="card-location"><i class="fas fa-map-pin"></i> ${e.location}</div>` : ''}
                ${e.description ? `<div class="card-desc">${e.description}</div>` : ''}
                ${e.detail ? `<div class="card-detail">📋 ${e.detail}</div>` : ''}
                <div class="card-footer">
                    <span class="event-tags">${tags.map(t => `<span class="mini-tag">${t}</span>`).join('')}</span>
                    <div class="event-links">
                        ${e.photo ? `<a href="${e.photo}" target="_blank" class="link-btn photo" title="照片"><i class="fas fa-image"></i></a>` : ''}
                        ${e.video ? `<a href="${e.video}" target="_blank" class="link-btn video" title="视频"><i class="fas fa-video"></i></a>` : ''}
                        ${e.fisLink ? `<a href="${e.fisLink}" target="_blank" class="link-btn fis" title="FIS官网"><i class="fas fa-globe"></i></a>` : ''}
                        ${e.pdf ? `<a href="${e.pdf}" target="_blank" class="link-btn pdf" title="PDF报告"><i class="fas fa-file-pdf"></i></a>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    return html + `</div>`;
}

// ---------- 7. 分页 ----------
function renderPagination(totalPages) {
    if (!dom.pagination || totalPages <= 1) {
        dom.pagination.innerHTML = '';
        return;
    }

    const { page } = state;
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" data-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;

    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    if (start > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (start > 2) html += `<span class="page-ellipsis">…</span>`;
    }

    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `<button class="page-btn" data-page="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>`;
    html += `</div>`;

    dom.pagination.innerHTML = html;

    dom.pagination.querySelectorAll('.page-btn').forEach(el => {
        el.addEventListener('click', function() {
            const target = this.dataset.page;
            if (target === 'prev' && state.page > 1) state.page--;
            else if (target === 'next' && state.page < totalPages) state.page++;
            else if (!isNaN(target)) state.page = +target;
            render();
        });
    });
}

// ---------- 8. 绑定事件 ----------
// 类别筛选
document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
    el.addEventListener('click', function() {
        $$('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.type = this.dataset.filter;
        state.page = 1;
        render();
    });
});

// 视图切换
document.querySelectorAll('.view-btn').forEach(el => {
    el.addEventListener('click', function() {
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.view = this.dataset.view;
        render();
    });
});

// ---------- 9. 底部生涯统计 ----------
function calculateCareerDays() {
    function parseLocalDate(dateStr) {
        const parts = dateStr.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    const fisStart = parseLocalDate('2013-11-29');
    const wcStart = parseLocalDate('2014-11-28');
    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fisDays = Math.floor((today - fisStart) / (1000 * 60 * 60 * 24));
    const wcDays = Math.floor((today - wcStart) / (1000 * 60 * 60 * 24));

    const fisEl = document.getElementById('fis-days');
    const wcEl = document.getElementById('wc-days');
    if (fisEl) fisEl.innerHTML = `${fisDays.toLocaleString()} <span class="days-suffix">天</span>`;
    if (wcEl) wcEl.innerHTML = `${wcDays.toLocaleString()} <span class="days-suffix">天</span>`;

    const statsEl = document.getElementById('header-stats');
    if (statsEl) statsEl.textContent = `🏁 ${fisDays}天 · 🌍 ${wcDays}天`;

    const footerEl = document.getElementById('footer-stats');
    if (footerEl) footerEl.textContent = `FIS ${fisDays}天 · 世界杯 ${wcDays}天`;
}

// ---------- 10. 启动 ----------
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 启动（极致优化版）...');
    loadAllData();
    calculateCareerDays();
    setInterval(calculateCareerDays, 60000);
});
// ============================================================
// 生涯天数计算器（支持本地时区）
// ============================================================

function calculateCareerDays() {
    // 1. 使用本地时区解析日期（避免 UTC 偏移）
    function parseLocalDate(dateStr) {
        const parts = dateStr.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    
    const fisStart = parseLocalDate('2010-02-12';
    const wcStart = parseLocalDate('2013-03-16');
    const now = new Date();
    
    // 2. 重置时间为当天 00:00:00（精确到天）
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fisStartDay = new Date(fisStart.getFullYear(), fisStart.getMonth(), fisStart.getDate());
    const wcStartDay = new Date(wcStart.getFullYear(), wcStart.getMonth(), wcStart.getDate());
    
    // 3. 计算天数（+1 包含当天）
    const fisDays = Math.floor((today - fisStartDay) / (1000 * 60 * 60 * 24));
    const wcDays = Math.floor((today - wcStartDay) / (1000 * 60 * 60 * 24));
    
    // 4. 更新显示
    const fisEl = document.getElementById('fis-days');
    const wcEl = document.getElementById('wc-days');
    
    if (fisEl) {
        fisEl.innerHTML = `${fisDays.toLocaleString()} <span class="days-suffix">天</span>`;
    }
    if (wcEl) {
        wcEl.innerHTML = `${wcDays.toLocaleString()} <span class="days-suffix">天</span>`;
    }
}

// 每分钟刷新一次
document.addEventListener('DOMContentLoaded', calculateCareerDays);
setInterval(calculateCareerDays, 60000);
