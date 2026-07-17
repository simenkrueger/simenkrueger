// ============================================================
// Simen Hegstad Krüger · 资料库
// 固定分类纵向标签筛选
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
    selectedTags: []  // 存储选中的标签（完整名称）
};

// ---------- 需要排除的大类 ----------
const EXCLUDED_TYPES = ['世界杯', '奥运会', '世锦赛', '全国锦标赛', '其他', '夏季比赛'];

// ---------- 固定标签分类（顺序从上到下） ----------
const TAG_CATEGORIES = [
    {
        id: 'technique',
        label: '技术类型',
        icon: '⛷️',
        tags: [
            { key: '自由式', label: '自由式' },
            { key: '传统式', label: '传统式' },
            { key: '混合式', label: '混合式' }
        ]
    },
    {
        id: 'result',
        label: '成绩',
        icon: '🏅',
        tags: [
            { key: '金牌', label: '金牌' },
            { key: '银牌', label: '银牌' },
            { key: '铜牌', label: '铜牌' },
            { key: '前五', label: '前五' },
            { key: '前十', label: '前十' }
        ]
    },
    {
        id: 'location',
        label: '比赛地点',
        icon: '📍',
        tags: [
            { key: '挪威站', label: '🇳🇴 挪威站' },
            { key: '瑞典站', label: '🇸🇪 瑞典站' },
            { key: '芬兰站', label: '🇫🇮 芬兰站' },
            { key: '德国站', label: '🇩🇪 德国站' },
            { key: '瑞士站', label: '🇨🇭 瑞士站' },
            { key: '意大利站', label: '🇮🇹 意大利站' },
            { key: '法国站', label: '🇫🇷 法国站' },
            { key: '美国站', label: '🇺🇸 美国站' },
            { key: '加拿大站', label: '🇨🇦 加拿大站' }
        ]
    },
    {
        id: 'distance',
        label: '距离',
        icon: '📏',
        tags: [
            { key: '短距离', label: '短距离' },
            { key: '中短距离 5-10km', label: '中短距离 5-10km' },
            { key: '中长距离 10-30km', label: '中长距离 10-30km' },
            { key: '长距离 30km+', label: '长距离 30km+' }
        ]
    }
];

// ---------- 标签到分类的映射 ----------
const TAG_CATEGORY_MAP = {};
TAG_CATEGORIES.forEach(cat => {
    cat.tags.forEach(t => {
        TAG_CATEGORY_MAP[t.key] = cat.id;
    });
});

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
    
    if (state.selectedTags.length > 0) {
        events = events.filter(e => {
            if (!e.tags || !Array.isArray(e.tags)) return false;
            return state.selectedTags.every(tag => e.tags.includes(tag));
        });
    }
    
    events.sort((a, b) => (a.date > b.date ? -1 : 1));
    return events;
}

// ---------- 6. 计算标签计数 ----------
function getTagCounts(events) {
    const counts = {};
    events.forEach(e => {
        if (e.tags) {
            e.tags.forEach(tag => {
                counts[tag] = (counts[tag] || 0) + 1;
            });
        }
    });
    return counts;
}

// ---------- 7. 渲染纵向标签 ----------
function renderTagSidebar(events) {
    if (!dom.tagSidebar) return;
    
    const counts = getTagCounts(events);
    
    let html = '';
    TAG_CATEGORIES.forEach(category => {
        // 检查该分类下是否有标签有数据
        const hasData = category.tags.some(t => counts[t.key] > 0);
        if (!hasData) return;
        
        html += `<div class="tag-group">`;
        html += `<div class="tag-group-title" data-group="${category.id}">`;
        html += `<span>${category.icon} ${category.label}</span>`;
        html += `<span class="arrow">▼</span>`;
        html += `</div>`;
        html += `<div class="tag-group-items">`;
        
        category.tags.forEach(t => {
            const count = counts[t.key] || 0;
            if (count === 0) return; // 不显示计数为0的标签
            
            const checked = state.selectedTags.includes(t.key);
            html += `
                <label class="tag-item ${checked ? 'active' : ''}">
                    <input type="checkbox" data-tag="${t.key}" ${checked ? 'checked' : ''} />
                    <span class="tag-label">${t.label}</span>
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
        el.addEventListener('change', function(e) {
            e.stopPropagation();
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
    
    // 点击整个 label 触发 checkbox
    dom.tagSidebar.querySelectorAll('.tag-item').forEach(el => {
        el.addEventListener('click', function(e) {
            if (e.target.tagName === 'INPUT') return;
            const checkbox = this.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
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

    const tagLabel = state.selectedTags.length ? ` [标签: ${state.selectedTags.join(', ')}]` : '';
    dom.count.textContent = `${total} 项 (${state.season === 'all' ? '全部赛季' : state.season}${tagLabel} · ${state.page}/${totalPages} 页)`;

    // 渲染标签侧边栏
    renderTagSidebar(events);

    if (!total) {
        dom.content.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据</div>`;
        renderPagination(totalPages);
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
    console.log('📄 启动（固定分类标签版）...');
    loadSeasonList();
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
