// ============================================================
// 羽生结弦资料库 - 按赛季拆分JSON + 分页 + 修复"全部"按钮
// ============================================================

// ---------- 状态 ----------
let state = {
    currentSeason: 'all',        // 'all' 表示全部
    currentType: 'all',
    currentView: 'list',
    allData: {},                 // { '2025-2026': [...], '2024-2025': [...] }
    allSeasons: [],
    page: 1,
    pageSize: 15
};

// ---------- DOM 引用 ----------
const $ = (id) => document.getElementById(id);
const contentArea = $('content-area');
const resultCount = $('result-count');
const seasonContainer = $('season-tags-container');
const paginationContainer = $('pagination-container');

// ---------- 1. 加载赛季列表 ----------
async function loadSeasonList() {
    try {
        const res = await fetch('data/index.json');
        if (!res.ok) throw new Error('index.json 不存在');
        const data = await res.json();
        state.allSeasons = data.seasons || [];
        renderSeasonTags();
        // 默认加载全部
        await loadAllSeasons();
    } catch (err) {
        contentArea.innerHTML = `<div class="empty">❌ 加载失败: ${err.message}</div>`;
    }
}

// ---------- 2. 渲染赛季按钮 ----------
function renderSeasonTags() {
    if (!seasonContainer) return;
    let html = '';
    // "全部"按钮
    const allActive = state.currentSeason === 'all' ? 'active' : '';
    html += `<span class="filter-tag ${allActive}" data-season="all">全部</span>`;
    // 赛季按钮
    state.allSeasons.forEach(season => {
        const active = state.currentSeason === season ? 'active' : '';
        html += `<span class="filter-tag ${active}" data-season="${season}">${season}</span>`;
    });
    seasonContainer.innerHTML = html;

    seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', function () {
            // 移除所有赛季按钮的 active 状态
            seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const season = this.dataset.season;
            state.currentSeason = season;
            state.page = 1;

            if (season === 'all') {
                loadAllSeasons();
            } else {
                loadSeasonData(season);
            }
        });
    });
}

// ---------- 3. 加载单个赛季数据 ----------
async function loadSeasonData(season) {
    contentArea.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载 ${season} 数据...</div>`;

    try {
        const url = `data/${season}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${season}.json 不存在`);
        const data = await res.json();
        state.allData[season] = data.events || [];
        state.page = 1;
        renderEvents();
    } catch (err) {
        contentArea.innerHTML = `<div class="empty">❌ 加载 ${season} 失败: ${err.message}</div>`;
    }
}

// ---------- 4. 加载所有赛季数据 ----------
async function loadAllSeasons() {
    contentArea.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载全部数据...</div>`;

    try {
        // 清空旧数据
        state.allData = {};
        let total = 0;

        // 逐个加载所有赛季
        for (const season of state.allSeasons) {
            try {
                const url = `data/${season}.json`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    state.allData[season] = data.events || [];
                    total += state.allData[season].length;
                }
            } catch (e) {
                console.warn(`⚠️ 加载 ${season} 失败:`, e);
                state.allData[season] = [];
            }
        }

        state.page = 1;
        renderEvents();
        console.log(`✅ 全部加载完成，共 ${total} 条数据`);
    } catch (err) {
        contentArea.innerHTML = `<div class="empty">❌ 加载全部失败: ${err.message}</div>`;
    }
}

// ---------- 5. 获取当前显示的数据 ----------
function getCurrentEvents() {
    let events = [];

    if (state.currentSeason === 'all') {
        // 全部赛季：合并所有数据
        for (const season of state.allSeasons) {
            const seasonEvents = state.allData[season] || [];
            // 给每条数据打上赛季标签
            seasonEvents.forEach(e => {
                events.push({ ...e, _season: season });
            });
        }
    } else {
        // 单个赛季
        events = state.allData[state.currentSeason] || [];
        events = events.map(e => ({ ...e, _season: state.currentSeason }));
    }

    // 按类型筛选
    if (state.currentType !== 'all') {
        events = events.filter(e => e.type === state.currentType);
    }

    // 按日期排序（最新在前）
    events.sort((a, b) => (a.date > b.date ? -1 : 1));

    return events;
}

// ---------- 6. 渲染事件列表（分页） ----------
function renderEvents() {
    const events = getCurrentEvents();
    const total = events.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageData = events.slice(start, end);

    // 更新计数
    if (resultCount) {
        const seasonLabel = state.currentSeason === 'all' ? '全部赛季' : state.currentSeason;
        resultCount.textContent = `${total} 项 (${seasonLabel} · 第 ${state.page}/${totalPages} 页)`;
    }

    // 空状态
    if (total === 0) {
        contentArea.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        renderPagination(totalPages);
        return;
    }

    // 按赛季分组（全部模式下按赛季分组）
    const groups = {};
    pageData.forEach(e => {
        const season = e._season || '未分类';
        if (!groups[season]) groups[season] = [];
        groups[season].push(e);
    });

    let html = '';
    for (const [season, seasonEvents] of Object.entries(groups)) {
        html += `<div class="season-group">`;
        html += `<div class="season-title"><i class="fas fa-trophy"></i> ${season} <span class="count">${seasonEvents.length} 项</span></div>`;

        if (state.currentView === 'list') {
            html += `<div class="event-list">`;
            seasonEvents.forEach(e => {
                html += `
                    <div class="event-item">
                        <span class="event-date">${e.date || '日期待定'}</span>
                        <span class="event-type ${e.type || '其他'}">${e.type || '其他'}</span>
                        <span class="event-title">${e.title || '无标题'}</span>
                        ${e.result ? `<span class="event-result">${e.result}</span>` : ''}
                        <span class="event-media">
                            ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i></a>` : ''}
                            ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i></a>` : ''}
                        </span>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<div class="event-grid">`;
            seasonEvents.forEach(e => {
                html += `
                    <div class="event-card">
                        <div class="date">${e.date || '日期待定'}</div>
                        <div class="title">${e.title || '无标题'}</div>
                        <span class="type ${e.type || '其他'}">${e.type || '其他'}</span>
                        ${e.result ? `<div class="result">${e.result}</div>` : ''}
                        <div class="media-links">
                            ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i> 照片</a>` : ''}
                            ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i> 视频</a>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        html += `</div>`;
    }

    contentArea.innerHTML = html;
    renderPagination(totalPages);
}

// ---------- 7. 渲染分页控件 ----------
function renderPagination(totalPages) {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    const { page } = state;
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" data-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;

    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

    if (startPage > 1) {
        html += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">…</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">…</span>`;
        html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    html += `<button class="page-btn" data-page="next" ${page >= totalPages ? 'disabled' : ''}>下一页</button>`;
    html += `</div>`;

    paginationContainer.innerHTML = html;

    paginationContainer.querySelectorAll('.page-btn').forEach(el => {
        el.addEventListener('click', function () {
            const target = this.dataset.page;
            if (target === 'prev' && state.page > 1) {
                state.page--;
            } else if (target === 'next' && state.page < totalPages) {
                state.page++;
            } else if (!isNaN(target)) {
                state.page = parseInt(target);
            }
            renderEvents();
        });
    });
}

// ---------- 8. 绑定筛选事件 ----------
document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
    el.addEventListener('click', function () {
        document.querySelectorAll('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentType = this.dataset.filter;
        state.page = 1;
        renderEvents();
    });
});

document.querySelectorAll('.view-btn').forEach(el => {
    el.addEventListener('click', function () {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.currentView = this.dataset.view;
        renderEvents();
    });
});

// ---------- 9. 启动 ----------
document.addEventListener('DOMContentLoaded', function () {
    console.log('📄 启动（分页版 + 修复全部）...');
    loadSeasonList();
});
