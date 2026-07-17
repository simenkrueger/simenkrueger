// ============================================================
// Simen Hegstad Krüger · 资料库
// 修复版：标签筛选 + 反向索引 + 底部统计
// ============================================================

// ---------- 全局状态 ----------
const state = {
    season: 'all',
    type: 'all',
    view: 'list',
    page: 1,
    pageSize: 15,
    seasons: [],
    selectedTags: [],
    tagIndex: {},
    eventMap: {},
    allIds: [],
    seasonIds: {},
    typeIds: {},
    totalPages: 1
};

// ---------- DOM 缓存 ----------
const dom = {
    content: document.getElementById('content-area'),
    count: document.getElementById('result-count'),
    seasonContainer: document.getElementById('season-tags-container'),
    tagContainer: document.getElementById('tag-container'),
    pagination: document.getElementById('pagination-container'),
    renderTime: document.getElementById('render-time')
};

// ---------- 常量 ----------
const EXCLUDED_TYPES = ['世界杯', '奥运会', '世锦赛', '全国锦标赛', '其他', '夏季比赛'];

// ---------- 工具函数 ----------
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

// ============================================================
// 1. 加载所有数据
// ============================================================
async function loadAllData() {
    dom.content.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载数据中...</div>`;
    const startTime = performance.now();

    try {
        const indexRes = await fetch('index.json');
        if (!indexRes.ok) throw new Error('index.json 不存在');
        const indexData = await indexRes.json();
        state.seasons = indexData.seasons || [];

        const results = await Promise.all(state.seasons.map(async (season) => {
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
        }));

        // ---------- 建立反向索引 ----------
        const tagIndex = {};
        const eventMap = {};
        const allIds = [];
        const seasonIds = {};
        const typeIds = {};
        let idCounter = 0;

        results.forEach(({ season, events }) => {
            const seasonIdList = [];
            events.forEach(e => {
                idCounter++;
                const id = idCounter;
                const eventWithSeason = { ...e, id, _season: season };

                eventMap[id] = eventWithSeason;
                allIds.push(id);
                seasonIdList.push(id);

                const type = e.type || '其他';
                if (!typeIds[type]) typeIds[type] = [];
                typeIds[type].push(id);

                if (e.tags) {
                    e.tags.forEach(tag => {
                        if (EXCLUDED_TYPES.includes(tag)) return;
                        if (!tagIndex[tag]) tagIndex[tag] = [];
                        tagIndex[tag].push(id);
                    });
                }
            });
            seasonIds[season] = seasonIdList;
        });

        state.tagIndex = tagIndex;
        state.eventMap = eventMap;
        state.allIds = allIds;
        state.seasonIds = seasonIds;
        state.typeIds = typeIds;

        console.log('📊 标签索引:', Object.keys(tagIndex));
        console.log('📊 标签数量:', Object.keys(tagIndex).length);

        // ---------- 渲染 ----------
        renderSeasonTags();
        renderTagFilters();
        render();

        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`✅ 加载完成: ${allIds.length} 条数据, ${elapsed}ms`);

    } catch (err) {
        dom.content.innerHTML = `<div class="empty">❌ 加载失败: ${err.message}</div>`;
        console.error(err);
    }
}

// ============================================================
// 2. 渲染标签筛选器
// ============================================================
function renderTagFilters() {
    console.log('🔄 渲染标签筛选器...');

    if (!dom.tagContainer) {
        console.error('❌ dom.tagContainer 不存在！');
        return;
    }

    const tagIndex = state.tagIndex || {};
    const tagKeys = Object.keys(tagIndex);

    console.log(`📊 找到 ${tagKeys.length} 个标签`);

    if (tagKeys.length === 0) {
        dom.tagContainer.innerHTML = '<span style="color:#6b839b;font-size:0.8rem;">暂无标签</span>';
        return;
    }

    const sortedTags = tagKeys.sort((a, b) => tagIndex[b].length - tagIndex[a].length);

    let html = '';
    sortedTags.forEach(tag => {
        const count = tagIndex[tag].length;
        const active = state.selectedTags.includes(tag) ? 'active' : '';
        html += `<span class="filter-tag tag-btn ${active}" data-tag="${tag}">${tag} (${count})</span>`;
    });

    dom.tagContainer.innerHTML = html;

    dom.tagContainer.querySelectorAll('.tag-btn').forEach(el => {
        el.addEventListener('click', function() {
            const tag = this.dataset.tag;
            const index = state.selectedTags.indexOf(tag);

            if (index > -1) {
                state.selectedTags.splice(index, 1);
                this.classList.remove('active');
            } else {
                state.selectedTags.push(tag);
                this.classList.add('active');
            }

            state.page = 1;
            render();
        });
    });

    console.log('✅ 标签渲染完成');
}

// ============================================================
// 3. 获取筛选后的 ID 列表
// ============================================================
function getFilteredIds() {
    let ids = [];

    if (state.season === 'all') {
        ids = [...state.allIds];
    } else {
        ids = state.seasonIds[state.season] || [];
    }

    if (state.type !== 'all') {
        const typeIdSet = new Set(state.typeIds[state.type] || []);
        ids = ids.filter(id => typeIdSet.has(id));
    }

    if (state.selectedTags.length > 0) {
        let tagIds = state.tagIndex[state.selectedTags[0]] || [];
        for (let i = 1; i < state.selectedTags.length; i++) {
            const tag = state.selectedTags[i];
            const tagIdSet = new Set(state.tagIndex[tag] || []);
            tagIds = tagIds.filter(id => tagIdSet.has(id));
            if (tagIds.length === 0) break;
        }
        const tagIdSet = new Set(tagIds);
        ids = ids.filter(id => tagIdSet.has(id));
    }

    return ids;
}

// ============================================================
// 4. 渲染主内容
// ============================================================
function render() {
    const renderStart = performance.now();

    const ids = getFilteredIds();
    const total = ids.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    state.totalPages = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const pageIds = ids.slice(start, start + state.pageSize);
    const pageData = pageIds.map(id => state.eventMap[id]).filter(Boolean);

    const seasonLabel = state.season === 'all' ? '全部赛季' : state.season;
    const tagLabel = state.selectedTags.length ? ` [${state.selectedTags.join('+')}]` : '';
    dom.count.textContent = `${total} 项 (${seasonLabel}${tagLabel} · ${state.page}/${totalPages} 页)`;

    if (total === 0) {
        dom.content.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        renderPagination();
        updateRenderTime(renderStart);
        return;
    }

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

    requestAnimationFrame(() => {
        dom.content.innerHTML = html;
        renderPagination();
        updateRenderTime(renderStart);
    });
}

// ============================================================
// 5. 列表渲染
// ============================================================
function renderList(items) {
    let html = `<div class="event-list">`;
    for (const e of items) {
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
    }
    return html + `</div>`;
}

// ============================================================
// 6. 卡片渲染
// ============================================================
function renderGrid(items) {
    let html = `<div class="event-grid">`;
    for (const e of items) {
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
    }
    return html + `</div>`;
}

// ============================================================
// 7. 赛季按钮
// ============================================================
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
            render();
        });
    });
}

// ============================================================
// 8. 分页
// ============================================================
function renderPagination() {
    if (!dom.pagination || state.totalPages <= 1) {
        dom.pagination.innerHTML = '';
        return;
    }

    const { page, totalPages } = state;
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

// ============================================================
// 9. 更新渲染时间
// ============================================================
function updateRenderTime(startTime) {
    const elapsed = (performance.now() - startTime).toFixed(0);
    if (dom.renderTime) {
        dom.renderTime.textContent = `⏱️ 渲染 ${elapsed}ms`;
    }
}

// ============================================================
// 10. 底部生涯统计
// ============================================================
function calculateCareerDays() {
    function parseLocalDate(dateStr) {
        const parts = dateStr.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    const fisStart = parseLocalDate('2010-02-12');
    const wcStart = parseLocalDate('2013-03-16');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const fisDays = Math.floor((today - fisStart) / 86400000);
    const wcDays = Math.floor((today - wcStart) / 86400000);

    const fisEl = document.getElementById('fis-days');
    const wcEl = document.getElementById('wc-days');
    if (fisEl) fisEl.innerHTML = `${fisDays.toLocaleString()} <span class="days-suffix">天</span>`;
    if (wcEl) wcEl.innerHTML = `${wcDays.toLocaleString()} <span class="days-suffix">天</span>`;

    const statsEl = document.getElementById('header-stats');
    if (statsEl) statsEl.textContent = `🏁 ${fisDays}天 · 🌍 ${wcDays}天`;

    const footerEl = document.getElementById('footer-stats');
    if (footerEl) footerEl.textContent = `FIS ${fisDays}天 · 世界杯 ${wcDays}天`;
}

// ============================================================
// 11. 绑定事件
// ============================================================
document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
    el.addEventListener('click', function() {
        $$('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.type = this.dataset.filter;
        state.page = 1;
        render();
    });
});

document.querySelectorAll('.view-btn').forEach(el => {
    el.addEventListener('click', function() {
        $$('.view-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.view = this.dataset.view;
        render();
    });
});

// ============================================================
// 12. 启动
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 启动（反向索引修复版）...');
    loadAllData();
    calculateCareerDays();
    setInterval(calculateCareerDays, 60000);
});
