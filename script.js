// ============================================================
// Simen Hegstad Krüger · 资料库
// 反向索引 + 固定分类标签 + 折叠详情 + 底部时间统计
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
    // 反向索引
    tagIndex: {},
    eventMap: {},
    allIds: [],
    seasonIds: {},
    typeIds: {},
    totalPages: 1
};

// ---------- 固定标签分类 ----------
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
        { key: '前十', label: '前十' },
        { key: '前30', label: '前30' }
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

// ---------- 常量 ----------
const EXCLUDED_TYPES = ['世界杯', '奥运会', '世锦赛', '全国锦标赛', '其他', '夏季比赛'];

// ---------- DOM 缓存 ----------
const dom = {
    content: document.getElementById('content-area'),
    count: document.getElementById('result-count'),
    seasonContainer: document.getElementById('season-tags-container'),
    tagSidebar: document.getElementById('tag-sidebar-content'),
    pagination: document.getElementById('pagination-container'),
    clearTagsBtn: document.getElementById('clear-tags-btn'),
    renderTime: document.getElementById('render-time')
};

// ---------- 工具函数 ----------
const $$ = (sel, parent = document) => [...parent.querySelectorAll(sel)];

// ============================================================
// 1. 加载数据（反向索引）
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

        // 渲染
        renderSeasonTags();
        renderTagSidebar();
        render();

        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(`✅ 加载完成: ${allIds.length} 条数据, ${elapsed}ms`);

    } catch (err) {
        dom.content.innerHTML = `<div class="empty">❌ 加载失败: ${err.message}</div>`;
        console.error(err);
    }
}

// ============================================================
// 2. 获取筛选后的 ID 列表（反向索引，极快）
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
// 3. 渲染固定分类标签侧边栏
// ============================================================
function renderTagSidebar() {
    if (!dom.tagSidebar) return;

    // 计算每个标签的数量
    const counts = {};
    Object.keys(state.tagIndex).forEach(tag => {
        counts[tag] = state.tagIndex[tag].length;
    });

    let html = '';
    TAG_CATEGORIES.forEach(category => {
        // 检查该分类下是否有标签有数据
        const hasData = category.tags.some(t => (counts[t.key] || 0) > 0);
        if (!hasData) return;

        html += `<div class="tag-group">`;
        html += `<div class="tag-group-title" data-group="${category.id}">`;
        html += `<span>${category.icon} ${category.label}</span>`;
        html += `<span class="arrow">▼</span>`;
        html += `</div>`;
        html += `<div class="tag-group-items">`;

        category.tags.forEach(t => {
            const count = counts[t.key] || 0;
            if (count === 0) return;

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

// ============================================================
// 4. 清除所有标签
// ============================================================
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

// ============================================================
// 5. 折叠详情切换
// ============================================================
function toggleDetail(id) {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'block';
        const parent = el.closest('.event-item') || el.closest('.event-card');
        if (parent) {
            const icon = parent.querySelector('.detail-toggle i, .detail-toggle-card i');
            if (icon) {
                icon.style.transform = 'rotate(180deg)';
                icon.style.transition = 'transform 0.3s ease';
            }
            const cardBtn = parent.querySelector('.detail-toggle-card');
            if (cardBtn) {
                cardBtn.innerHTML = '<i class="fas fa-chevron-up"></i> 收起';
            }
        }
    } else {
        el.style.display = 'none';
        const parent = el.closest('.event-item') || el.closest('.event-card');
        if (parent) {
            const icon = parent.querySelector('.detail-toggle i, .detail-toggle-card i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
            const cardBtn = parent.querySelector('.detail-toggle-card');
            if (cardBtn) {
                cardBtn.innerHTML = '<i class="fas fa-chevron-down"></i> 详情';
            }
        }
    }
}

// ============================================================
// 6. 渲染主内容
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

    // ❌ 删除这行！renderTagSidebar();
    // 只在数据加载和标签变化时更新侧边栏

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

    dom.content.innerHTML = html;
    renderPagination();
    updateRenderTime(renderStart);
}

// ============================================================
// 7. 更新渲染时间
// ============================================================
function updateRenderTime(startTime) {
    const elapsed = (performance.now() - startTime).toFixed(0);
    if (dom.renderTime) {
        dom.renderTime.textContent = `⏱️ 渲染 ${elapsed}ms`;
    }
}

// ============================================================
// 8. 列表渲染（折叠详情）
// ============================================================
// ============================================================
// 列表渲染（支持多视频来源）
// ============================================================
function renderList(items) {
    let html = `<div class="event-list">`;
    for (const e of items) {
        const tags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        const detailId = `detail-${e.id || Math.random().toString(36).substr(2, 9)}`;

        // ---------- 生成视频按钮（支持多来源） ----------
        let videoButtons = '';
        const videos = e.videos || [];
        
        // 兼容旧格式：如果有 video 字段但没有 videos 数组
        if (videos.length === 0 && e.video) {
            // 自动识别来源
            let source = '视频';
            if (e.video.includes('youtube.com') || e.video.includes('youtu.be')) source = 'YouTube';
            else if (e.video.includes('bilibili.com')) source = 'Bilibili';
            else if (e.video.includes('weibo.com')) source = '微博';
            else if (e.video.includes('youku.com')) source = '优酷';
            else if (e.video.includes('v.qq.com')) source = '腾讯';
            
            videos.push({ url: e.video, source: source, label: '' });
        }

        if (videos.length > 0) {
            const sourceIcons = {
                'YouTube': 'fab fa-youtube',
                'Bilibili': 'fab fa-bilibili',
                '微博': 'fab fa-weibo',
                '优酷': 'fab fa-youku',
                '腾讯': 'fab fa-tencent',
                '默认': 'fas fa-video'
            };
            const sourceColors = {
                'YouTube': '#FF0000',
                'Bilibili': '#00A1D6',
                '微博': '#FF8200',
                '优酷': '#FF6600',
                '腾讯': '#00B4E3',
                '默认': '#b3412a'
            };

            videos.forEach((v, index) => {
                const icon = sourceIcons[v.source] || sourceIcons['默认'];
                const color = sourceColors[v.source] || sourceColors['默认'];
                const tooltip = v.label ? `${v.source} · ${v.label}` : v.source;
                videoButtons += `
                    <a href="${v.url}" target="_blank" class="link-btn video-btn" 
                       style="background:${color}; color:white;"
                       title="${tooltip}">
                        <i class="${icon}"></i>
                        ${videos.length > 1 ? `<span class="video-index">${index + 1}</span>` : ''}
                        <span class="video-source-label">${v.source}</span>
                    </a>
                `;
            });
        }

        html += `
            <div class="event-item">
                <div class="event-main">
                    <span class="event-date">${e.date || '日期待定'}</span>
                    <span class="event-type ${e.type || '其他'}">${e.type || '其他'}</span>
                    <span class="event-title">${e.title || '无标题'}</span>
                    ${e.result ? `<span class="event-result">${e.result}</span>` : ''}
                    <button class="detail-toggle" onclick="toggleDetail('${detailId}')">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>

                <div class="event-detail-collapsible" id="${detailId}" style="display:none;">
                    ${e.location ? `<div class="event-location"><i class="fas fa-map-pin"></i> ${e.location}</div>` : ''}
                    ${e.description ? `<div class="event-desc">${e.description}</div>` : ''}
                    ${e.detail ? `<div class="event-detail-text">📋 ${e.detail}</div>` : ''}
                </div>

                <div class="event-footer">
                    <span class="event-tags">${tags.map(t => `<span class="mini-tag">${t}</span>`).join('')}</span>
                    <div class="event-links">
                        ${e.photo ? `<a href="${e.photo}" target="_blank" class="link-btn photo" title="照片"><i class="fas fa-image"></i></a>` : ''}
                        ${videoButtons}
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
// 卡片渲染（支持多视频来源）
// ============================================================
function renderGrid(items) {
    let html = `<div class="event-grid">`;
    for (const e of items) {
        const tags = (e.tags || []).filter(t => !EXCLUDED_TYPES.includes(t));
        const detailId = `detail-${e.id || Math.random().toString(36).substr(2, 9)}`;

        // ---------- 生成视频按钮（支持多来源） ----------
        let videoButtons = '';
        const videos = e.videos || [];
        
        // 兼容旧格式
        if (videos.length === 0 && e.video) {
            let source = '视频';
            if (e.video.includes('youtube.com') || e.video.includes('youtu.be')) source = 'YouTube';
            else if (e.video.includes('bilibili.com')) source = 'Bilibili';
            else if (e.video.includes('weibo.com')) source = '微博';
            else if (e.video.includes('youku.com')) source = '优酷';
            else if (e.video.includes('v.qq.com')) source = '腾讯';
            
            videos.push({ url: e.video, source: source, label: '' });
        }

        if (videos.length > 0) {
            const sourceIcons = {
                'YouTube': 'fab fa-youtube',
                'Bilibili': 'fab fa-bilibili',
                '微博': 'fab fa-weibo',
                '优酷': 'fab fa-youku',
                '腾讯': 'fab fa-tencent',
                '默认': 'fas fa-video'
            };
            const sourceColors = {
                'YouTube': '#FF0000',
                'Bilibili': '#00A1D6',
                '微博': '#FF8200',
                '优酷': '#FF6600',
                '腾讯': '#00B4E3',
                '默认': '#b3412a'
            };

            videos.forEach((v, index) => {
                const icon = sourceIcons[v.source] || sourceIcons['默认'];
                const color = sourceColors[v.source] || sourceColors['默认'];
                const tooltip = v.label ? `${v.source} · ${v.label}` : v.source;
                videoButtons += `
                    <a href="${v.url}" target="_blank" class="link-btn video-btn" 
                       style="background:${color}; color:white;"
                       title="${tooltip}">
                        <i class="${icon}"></i>
                        ${videos.length > 1 ? `<span class="video-index">${index + 1}</span>` : ''}
                    </a>
                `;
            });
        }

        html += `
            <div class="event-card">
                <div class="card-header">
                    <span class="card-type ${e.type || '其他'}">${e.type || '其他'}</span>
                    <span class="card-date">${e.date || '日期待定'}</span>
                </div>
                <div class="card-title">${e.title || '无标题'}</div>
                ${e.result ? `<div class="card-result">🏅 ${e.result}</div>` : ''}

                <button class="detail-toggle-card" onclick="toggleDetail('${detailId}')">
                    <i class="fas fa-chevron-down"></i> 详情
                </button>

                <div class="event-detail-collapsible" id="${detailId}" style="display:none;">
                    ${e.location ? `<div class="card-location"><i class="fas fa-map-pin"></i> ${e.location}</div>` : ''}
                    ${e.description ? `<div class="card-desc">${e.description}</div>` : ''}
                    ${e.detail ? `<div class="card-detail-text">📋 ${e.detail}</div>` : ''}
                </div>

                <div class="card-footer">
                    <span class="event-tags">${tags.map(t => `<span class="mini-tag">${t}</span>`).join('')}</span>
                    <div class="event-links">
                        ${e.photo ? `<a href="${e.photo}" target="_blank" class="link-btn photo" title="照片"><i class="fas fa-image"></i></a>` : ''}
                        ${videoButtons}
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
// 10. 赛季按钮
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
// 11. 分页
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
// 12. 底部生涯统计
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
// 13. 绑定事件
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
// 14. 启动
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 启动（反向索引 + 固定分类 + 折叠详情）...');
    loadAllData();
    calculateCareerDays();
    setInterval(calculateCareerDays, 60000);
});
