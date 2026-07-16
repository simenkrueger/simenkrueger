// ============================================
// 羽生结弦资料库 - 按赛季拆分数据
// ============================================

let allData = {};
let currentSeason = 'all';
let currentFilter = 'all';
let currentView = 'list';

// ============================================
// 加载数据：先加载索引，再按需加载赛季
// ============================================

async function loadData() {
    console.log('🔄 开始加载数据...');
    
    try {
        // 1. 加载索引文件
        const indexRes = await fetch('index.json');
        if (!indexRes.ok) throw new Error('无法加载索引文件');
        const index = await indexRes.json();
        console.log('📋 索引加载成功:', index);
        
        // 2. 加载所有赛季数据（可优化为按需加载）
        const seasonKeys = index.seasons;
        const loadPromises = seasonKeys.map(async (season) => {
            const res = await fetch(`${season}.json`);
            if (res.ok) {
                const data = await res.json();
                return { season, data };
            }
            return null;
        });
        
        const results = await Promise.all(loadPromises);
        
        // 3. 合并数据
        allData = {};
        results.forEach(result => {
            if (result) {
                allData[result.season] = result.data.events || [];
            }
        });
        
        console.log('✅ 所有赛季数据加载完成:', allData);
        renderEvents();
        
    } catch (error) {
        console.error('❌ 加载失败:', error);
        document.getElementById('content-area').innerHTML = `
            <div class="empty">
                <i class="fas fa-exclamation-triangle"></i> 
                加载失败: ${error.message}<br>
                <small>请确保 data/ 目录下有 index.json 和赛季文件</small>
            </div>
        `;
    }
}

// ============================================
// 获取所有事件（展平）
// ============================================

function getAllEvents() {
    const all = [];
    for (const [season, events] of Object.entries(allData)) {
        events.forEach(e => {
            all.push({
                ...e,
                season: season
            });
        });
    }
    return all;
}

// ============================================
// 渲染数据
// ============================================

function renderEvents() {
    let allEvents = getAllEvents();
    
    // 1. 过滤
    let filtered = allEvents;
    if (currentFilter !== 'all') {
        filtered = filtered.filter(e => e.type === currentFilter);
    }
    if (currentSeason !== 'all') {
        filtered = filtered.filter(e => e.season === currentSeason);
    }

    const container = document.getElementById('content-area');
    const countEl = document.getElementById('result-count');
    
    if (!container) return;
    
    if (countEl) {
        countEl.textContent = `${filtered.length} 项`;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty">
                <i class="fas fa-inbox"></i> 
                暂无数据
                <br><small>请在 data/ 目录中添加赛季数据</small>
            </div>
        `;
        return;
    }

    // 2. 按赛季分组
    const seasons = {};
    filtered.forEach(e => {
        const season = e.season || '未分类';
        if (!seasons[season]) seasons[season] = [];
        seasons[season].push(e);
    });

    // 3. 生成 HTML
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
                            ${e.photo ? `<a href="${e.photo}" target="_blank"><i class="fas fa-camera"></i> 照片</a>` : ''}
                            ${e.video ? `<a href="${e.video}" target="_blank"><i class="fas fa-video"></i> 视频</a>` : ''}
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
                        ${e.result ? `<div style="font-size:0.8rem; color:#6b839b; margin-top:0.3rem;">${e.result}</div>` : ''}
                        ${e.location ? `<div style="font-size:0.75rem; color:#8a9db0; margin-top:0.2rem;">📍 ${e.location}</div>` : ''}
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

    container.innerHTML = html;
}

// ============================================
// DOM 加载完成后执行
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM 加载完成');
    
    // 绑定筛选事件
    document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
        el.addEventListener('click', function () {
            document.querySelectorAll('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderEvents();
        });
    });

    document.querySelectorAll('.filter-tag[data-season]').forEach(el => {
        el.addEventListener('click', function () {
            document.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentSeason = this.dataset.season;
            renderEvents();
        });
    });

    document.querySelectorAll('.view-btn').forEach(el => {
        el.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.dataset.view;
            renderEvents();
        });
    });

    // 加载数据
    loadData();
});

console.log('📄 script.js 已加载（按赛季拆分版本）');
