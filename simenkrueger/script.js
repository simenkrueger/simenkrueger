// ========================================
// 配置：直接读取 data/events.json
// ========================================

let allEvents = [];
let currentFilter = 'all';
let currentSeason = 'all';
let currentView = 'list';

// ========================================
// 加载 JSON 数据
// ========================================

async function fetchEvents() {
  try {
    const response = await fetch('data/events.json');
    if (!response.ok) throw new Error('无法加载 events.json');
    const data = await response.json();
    allEvents = data.events || [];
    renderEvents();
  } catch (error) {
    document.getElementById('content-area').innerHTML = `
      <div class="empty">
        <i class="fas fa-exclamation-triangle"></i> 加载失败: ${error.message}<br>
        <small>请确保 data/events.json 文件存在且格式正确</small>
      </div>
    `;
    console.error('加载数据失败:', error);
  }
}

// ========================================
// 渲染数据
// ========================================

function renderEvents() {
  // 1. 过滤
  let filtered = allEvents;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(e => e.type === currentFilter);
  }
  if (currentSeason !== 'all') {
    filtered = filtered.filter(e => e.season === currentSeason);
  }

  const container = document.getElementById('content-area');
  document.getElementById('result-count').textContent = `${filtered.length} 项`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty"><i class="fas fa-inbox"></i> 暂无数据，请编辑 data/events.json 添加内容</div>`;
    return;
  }

  // 2. 按赛季分组
  const seasons = {};
  filtered.forEach(e => {
    if (!seasons[e.season]) seasons[e.season] = [];
    seasons[e.season].push(e);
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
            <span class="event-date">${e.date}</span>
            <span class="event-type ${e.type}">${e.type}</span>
            <span class="event-title">${e.title}</span>
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
            <div class="date">${e.date}</div>
            <div class="title">${e.title}</div>
            <span class="type ${e.type}">${e.type}</span>
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

// ========================================
// 事件绑定
// ========================================

// 分类筛选
document.querySelectorAll('.filter-tag[data-filter]').forEach(el => {
  el.addEventListener('click', function () {
    document.querySelectorAll('.filter-tag[data-filter]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.filter;
    renderEvents();
  });
});

// 赛季筛选
document.querySelectorAll('.filter-tag[data-season]').forEach(el => {
  el.addEventListener('click', function () {
    document.querySelectorAll('.filter-tag[data-season]').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentSeason = this.dataset.season;
    renderEvents();
  });
});

// 视图切换
document.querySelectorAll('.view-btn').forEach(el => {
  el.addEventListener('click', function () {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentView = this.dataset.view;
    renderEvents();
  });
});

// ========================================
// 启动
// ========================================

fetchEvents();