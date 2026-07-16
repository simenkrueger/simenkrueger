// ============================================
// 羽生结弦资料库 - JavaScript
// 修复：添加 DOM 加载检查 + 错误处理
// ============================================

let allEvents = [];
let currentFilter = 'all';
let currentSeason = 'all';
let currentView = 'list';

// ============================================
// 加载 JSON 数据
// ============================================

async function fetchEvents() {
  console.log('🔄 开始加载数据...');
  
  try {
    // 尝试从 data/ 文件夹读取
    let response = await fetch('data/events.json');
    
    // 如果 data/events.json 不存在，尝试从根目录读取
    if (!response.ok) {
      console.log('⚠️ data/events.json 不存在，尝试从根目录读取...');
      response = await fetch('events.json');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: 文件不存在`);
    }
    
    const data = await response.json();
    console.log('✅ 数据加载成功:', data);
    
    // 检查数据结构
    if (!data.events || !Array.isArray(data.events)) {
      throw new Error('数据格式错误: 缺少 events 数组');
    }
    
    allEvents = data.events;
    renderEvents();
    
  } catch (error) {
    console.error('❌ 加载失败:', error);
    document.getElementById('content-area').innerHTML = `
      <div class="empty">
        <i class="fas fa-exclamation-triangle"></i> 
        加载失败: ${error.message}<br>
        <small>请确保 data/events.json 文件存在且格式正确</small>
        <br><br>
        <div style="font-size:0.8rem; color:#999; text-align:left; max-width:500px; margin:0 auto;">
          <b>检查步骤：</b><br>
          1. 访问 <a href="data/events.json" target="_blank">data/events.json</a> 是否能打开？<br>
          2. 如果 404，请把 events.json 放在 data 文件夹里<br>
          3. 或者把 events.json 放在根目录，并修改代码路径
        </div>
      </div>
    `;
  }
}

// ============================================
// 渲染数据
// ============================================

function renderEvents() {
  console.log('🔄 开始渲染, 数据条数:', allEvents.length);
  
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
  
  if (!container) {
    console.error('❌ 找不到 content-area 元素');
    return;
  }
  
  if (countEl) {
    countEl.textContent = `${filtered.length} 项`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <i class="fas fa-inbox"></i> 
        暂无数据
        <br><small>请在 data/events.json 中添加内容</small>
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
  console.log('✅ 渲染完成');
}

// ============================================
// DOM 加载完成后执行
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  console.log('📄 DOM 加载完成，开始初始化...');
  
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
  fetchEvents();
});

console.log('📄 script.js 已加载');