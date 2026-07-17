// ============================================================
// Simen Hegstad Krüger · 资料库
// 根目录JSON + 标签筛选（修复版）+ 分页
// ============================================================

// ---------- 状态 ----------
const state = {
    season: 'all',
    type: 'all',
    view: 'list',
    page: 1,
    pageSize: 15,
    allData: {},
    seasons: [],
    selectedTags: []  // 新增：存储选中的标签
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

// ---------- 1. 加载赛季列表 ----------
async function loadSeasonList() {
    try {
        const res = await fetch('index.json');
        if (!res.ok) throw new Error('index.json 不存在');
        const data = await res.json();
        state.seasons = data.seasons || [];
        renderSeasonTags();
        await loadAllSeasons();
    } catch (err) {
        dom.content.innerHTML = `<div class="empty">❌ 加载失败: ${err.message}</div>`;
    }
}

// ---------- 2. 渲染赛季按钮 ----------
function renderSeasonTags() {
    if (!dom.seasonContainer) return;
    const seasons = state.seasons;
    let html = `<span class="filter-tag active" data-season="all">全部</span>`;
    seasons.forEach(s => {
        html += `<span class="filter-tag" data-season="${s}">${s}</span>`;
    });
    dom.seasonContainer.innerHTML = html;

    dom.seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', async function() {
            dom.seasonContainer.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            state.season = this.dataset.season;
            state.page = 1;
            if (state.season === 'all') {
                await loadAllSeasons();
            } else {
                await loadSeason(state.season);
            }
        });
    });
}

// ---------- 3. 加载单个赛季 ----------
async function loadSeason(season) {
    dom.content.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载 ${season}...</div>`;
    try {
        const res = await fetch(`${season}.json`);
        const text = await res.text();
        if (text.trim().startsWith('<')) throw new Error('文件不存在');
        const data = JSON.parse(text);
        state.allData[season] = data.events || [];
        render();
    } catch (err) {
        state.allData[season] = [];
        render();
        showError(`⚠️ 加载 ${season} 失败: ${err.message}`);
    }
}

// ---------- 4. 加载所有赛季 ----------
async function loadAllSeasons() {
    dom.content.innerHTML = `<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载全部数据...</div>`;
    state.allData = {};
    let errors = [];
    for (const season of state.seasons) {
        try {
            const res = await fetch(`${season}.json`);
            const text = await res.text();
            if (text.trim().startsWith('<')) { errors.push(season); continue; }
            state.allData[season] = JSON.parse(text).events || [];
        } catch { errors.push(season); }
    }
    if (errors.length) showError(`⚠️ 以下文件不存在: ${errors.join('、')}`);
    render();
}

// ---------- 5. 获取所有事件 ----------
function getAllEvents() {
    let events = [];
    if (state.season === 'all') {
        state.seasons.forEach(s => {
            (state.allData[s] || []).forEach(e => events.push({ ...e, _season: s }));
        });
    } else {
        (state.allData[state.season] || []).forEach(e => events.push({ ...e, _season: state.season }));
    }
    
    // 类型筛选
    if (state.type !== 'all') {
        events = events.filter(e => e.type === state.type);
    }
    
    // ✅ 标签筛选（修复版）
    if (state.selectedTags.length > 0) {
        events = events.filter(e => {
            if (!e.tags || !Array.isArray(e.tags)) return false;
            // 必须包含所有选中的标签（AND 逻辑）
            return state.selectedTags.every(tag => e.tags.includes(tag));
        });
    }
    
    events.sort((a, b) => (a.date > b.date ? -1 : 1));
    return events;
}

// ---------- 6. 渲染标签 ----------
function renderTags(events) {
    if (!dom.tagContainer) return;
    
    // 统计标签
    const counts = {};
    events.forEach(e => {
        if (e.tags) {
            e.tags.forEach(t => {
                counts[t] = (counts[t] || 0) + 1;
            });
        }
    });
    
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    
    if (!sorted.length) {
        dom.tagContainer.innerHTML = '<span style="color:#6b839b;font-size:0.8rem;">暂无标签</span>';
        return;
    }
    
    // ✅ 渲染标签，高亮选中的
    dom.tagContainer.innerHTML = sorted.map(t => {
        const active = state.selectedTags.includes(t) ? 'active' : '';
        return `<span class="filter-tag tag-btn ${active}" data-tag="${t}">${t} (${counts[t]})</span>`;
    }).join('');
    
    // ✅ 重新绑定标签点击事件
    dom.tagContainer.querySelectorAll('.tag-btn').forEach(el => {
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            const tag = this.dataset.tag;
            const index = state.selectedTags.indexOf(tag);
            
            // 切换选中状态
            if (index > -1) {
                state.selectedTags.splice(index, 1);
                this.classList.remove('active');
            } else {
                state.selectedTags.push(tag);
                this.classList.add('active');
            }
            
            state.page = 1;
            render();  // 重新渲染
        });
    });
}

// ---------- 7. 主渲染 ----------
function render() {
    const events = getAllEvents();
    const total = events.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const pageData = events.slice(start, start + state.pageSize);

    // 更新计数
    const tagLabel = state.selectedTags.length ? ` [标签: ${state.selectedTags.join('+')}]` : '';
    dom.count.textContent = `${total} 项 (${state.season === 'all' ? '全部赛季' : state.season}${tagLabel} · ${state.page}/${totalPages} 页)`;

    // 先渲染标签（基于当前数据）
    renderTags(events);

    if (!total) {
        dom.content.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        renderPagination(totalPages);
        return;
    }

    // 分组
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
}

// ---------- 8. 列表/卡片渲染 ----------
function renderList(items) {
    let html = `<div class="event-list">`;
    items.forEach(e => {
        // 显示标签
        const tagsHtml = (e.tags || []).map(t => `<span class="mini-tag">${t}</span>`).join('');
        html += `
            <div class="event-item">
                <span class="event-date">${e.date || '日期待定'}</span>
                <span class="event-type ${e.type || '其他'}">${e.type || '其他'}</span>
                <span class="event-title">${e.title || '无标题'}</span>
                ${e.result ? `<span class="event-result">${e.result}</span>` : ''}
                <span class="event-tags">${tagsHtml}</span>
                <span class="event-media">
                    ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i></a>` : ''}
                    ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i></a>` : ''}
                </span>
            </div>
        `;
    });
    return html + `</div>`;
}

function renderGrid(items) {
    let html = `<div class="event-grid">`;
    items.forEach(e => {
        const tagsHtml = (e.tags || []).map(t => `<span class="mini-tag">${t}</span>`).join('');
        html += `
            <div class="event-card">
                <div class="date">${e.date || '日期待定'}</div>
                <div class="title">${e.title || '无标题'}</div>
                <span class="type ${e.type || '其他'}">${e.type || '其他'}</span>
                ${e.result ? `<div class="result">${e.result}</div>` : ''}
                <div class="event-tags">${tagsHtml}</div>
                <div class="media-links">
                    ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i> 照片</a>` : ''}
                    ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i> 视频</a>` : ''}
                </div>
            </div>
        `;
    });
    return html + `</div>`;
}

// ---------- 9. 分页 ----------
function renderPagination(totalPages) {
    if (!dom.pagination || totalPages <= 1) {
        dom.pagination.innerHTML = '';
        return;
    }
    const { page } = state;
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" data-page="prev" ${page <= 1 ? 'disabled' : ''}>上一页</button>`;
    let start = Math.max(1, page - 2), end = Math.min(totalPages, start + 4);
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

// ---------- 10. 错误提示 ----------
function showError(msg) {
    const old = dom.content.querySelector('.error-banner');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'error-banner';
    el.style.cssText = 'background:#fce9e6;color:#b3412a;padding:0.8rem 1.2rem;border-radius:12px;margin-bottom:1rem;border-left:4px solid #b3412a;';
    el.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
    dom.content.prepend(el);
}

// ---------- 11. 绑定事件 ----------
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

// ---------- 12. 启动 ----------
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 启动（标签筛选修复版）...');
    loadSeasonList();
});
