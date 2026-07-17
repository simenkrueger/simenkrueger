// ============================================================
// Simen Hegstad Krüger · 资料库
// 纵向标签筛选（类似 AO3）
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
    selectedTags: [],        // 选中的标签（完整名称，如"技术:经典式"）
    tagGroups: {}            // 标签分组 { "技术": ["经典式", "自由式"], ... }
};

// ---------- 需要排除的大类 ----------
const EXCLUDED_TYPES = ['世界杯', '奥运会', '世锦赛', '全国锦标赛', '其他', '夏季比赛'];

// ---------- DOM 缓存 ----------
const dom = {
    content: document.getElementById('content-area'),
    count: document.getElementById('result-count'),
    seasonContainer: document.getElementById('season-tags-container'),
    tagSidebar: document.getElementById('tag-sidebar-content'),
    pagination: document.getElementById('pagination-container'),
    clearTagsBtn: document.getElementById('clear-tags-btn')
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
    let html = `<span class="filter-tag active" data-season="all">全部</span>`;
    state.seasons.forEach(s => {
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
    
    if (state.type !== 'all') {
        events = events.filter(e => e.type === state.type);
    }
    
    // 标签筛选（完整标签名匹配）
    if (state.selectedTags.length > 0) {
        events = events.filter(e => {
            if (!e.tags || !Array.isArray(e.tags)) return false;
            return state.selectedTags.every(tag => e.tags.includes(tag));
        });
    }
    
    events.sort((a, b) => (a.date > b.date ? -1 : 1));
    return events;
}

// ---------- 6. 提取标签分组 ----------
function extractTagGroups(events) {
    const groups = {};
    const allTags = new Set();
    
    events.forEach(e => {
        if (e.tags) {
            e.tags.forEach(tag => {
                // 跳过排除的大类
                if (EXCLUDED_TYPES.includes(tag)) return;
                
                allTags.add(tag);
                
                // 按 ":" 分割标签，格式: "分类:标签名"
                if (tag.includes(':')) {
                    const [category, name] = tag.split(':');
                    if (!groups[category]) groups[category] = {};
                    if (!groups[category][name]) groups[category][name] = 0;
                    groups[category][name]++;
                } else {
                    // 没有分类的标签归入"通用"
                    if (!groups['通用']) groups['通用'] = {};
                    if (!groups['通用'][tag]) groups['通用'][tag] = 0;
                    groups['通用'][tag]++;
                }
            });
        }
    });
    
    return groups;
}

// ---------- 7. 渲染纵向标签 ----------
function renderTagSidebar(events) {
    if (!dom.tagSidebar) return;
    
    const groups = extractTagGroups(events);
    const groupKeys = Object.keys(groups);
    
    if (!groupKeys.length) {
        dom.tagSidebar.innerHTML = '<div class="loading-tags">暂无标签</div>';
        return;
    }
    
    let html = '';
    groupKeys.forEach(category => {
        const items = groups[category];
        const sortedItems = Object.keys(items).sort((a, b) => items[b] - items[a]);
        
        html += `<div class="tag-group">`;
        html += `<div class="tag-group-title" data-group="${category}">`;
        html += `<span>${category}</span>`;
        html += `<span class="arrow">▼</span>`;
        html += `</div>`;
        html += `<div class="tag-group-items">`;
        
        sortedItems.forEach(name => {
            const fullTag = `${category}:${name}`;
            const count = items[name];
            const checked = state.selectedTags.includes(fullTag) ? 'checked' : '';
            html += `
                <label class="tag-item ${checked ? 'active' : ''}">
                    <input type="checkbox" data-tag="${fullTag}" ${checked} />
                    <span class="tag-label">${name}</span>
                    <span class="tag-count">${count}</span>
                </label>
            `;
        });
        
        html += `</div></div>`;
    });
    
    dom.tagSidebar.innerHTML = html;
    
    // ---------- 绑定事件 ----------
    // 复选框点击
    dom.tagSidebar.querySelectorAll('.tag-item input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', function() {
            const tag = this.dataset.tag;
            const label = this.closest('.tag-item');
            
            if (this.checked) {
                if (!state.selectedTags.includes(tag)) {
                    state.selectedTags.push(tag);
                }
                label.classList.add('active');
            } else {
                state.selectedTags = state.selectedTags.filter(t => t !== tag);
                label.classList.remove('active');
            }
            
            state.page = 1;
            render();
        });
    });
    
    // 分类折叠/展开
    dom.tagSidebar.querySelectorAll('.tag-group-title').forEach(el => {
        el.addEventListener('click', function() {
            const items = this.nextElementSibling;
            const arrow = this.querySelector('.arrow');
            if (items) {
                items.classList.toggle('collapsed');
                if (arrow) arrow.classList.toggle('collapsed');
            }
        });
    });
}

// ---------- 8. 主渲染 ----------
function render() {
    const events = getAllEvents();
    const total = events.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;

    const start = (state.page - 1) * state.pageSize;
    const pageData = events.slice(start, start + state.pageSize);

    // 更新计数
    const tagLabel = state.selectedTags.length ? ` [标签: ${state.selectedTags.length}个]` : '';
    dom.count.textContent = `${total} 项 (${state.season === 'all' ? '全部赛季' : state.season}${tagLabel} · ${state.page}/${totalPages} 页)`;

    // 渲染标签侧边栏
    renderTagSidebar(events);

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

// ---------- 9. 列表/卡片渲染 ----------
function renderList(items) {
    let html = `<div class="event-list">`;
    items.forEach(e => {
        const displayTags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        const tagsHtml = displayTags.map(t => `<span class="mini-tag">${t}</span>`).join('');
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
        const displayTags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        const tagsHtml = displayTags.map(t => `<span class="mini-tag">${t}</span>`).join('');
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

// ---------- 10. 分页 ----------
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

// ---------- 11. 清除所有标签 ----------
if (dom.clearTagsBtn) {
    dom.clearTagsBtn.addEventListener('click', function() {
        state.selectedTags = [];
        // 取消所有复选框的选中状态
        dom.tagSidebar.querySelectorAll('.tag-item input[type="checkbox"]').forEach(el => {
            el.checked = false;
            el.closest('.tag-item').classList.remove('active');
        });
        state.page = 1;
        render();
    });
}

// ---------- 12. 错误提示 ----------
function showError(msg) {
    const old = dom.content.querySelector('.error-banner');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'error-banner';
    el.style.cssText = 'background:#fce9e6;color:#b3412a;padding:0.8rem 1.2rem;border-radius:12px;margin-bottom:1rem;border-left:4px solid #b3412a;';
    el.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
    dom.content.prepend(el);
}

// ---------- 13. 绑定事件 ----------
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

// ---------- 14. 启动 ----------
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 启动（纵向标签版）...');
    loadSeasonList();
});
