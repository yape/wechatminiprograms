const DIST_SCALE = 800; // 距离加权退火尺度，越小越偏向近处

Page({

  onShareAppMessage() {
    return {
      title: '决食-吃点啥?', // 分享标题
      path: '/pages/index/index.html', // 分享路径，默认当前页面路径
      imageUrl: '/images/share3.jpg' // 分享图片，支持本地和网络图片
    }
  },
  // 分享到朋友圈（需单独配置）
onShareTimeline() {
  return {
    title: '决食-吃点啥?',
    query: 'id=123',
    imageUrl: '/images/share2.jpg'
  }
},

  data: {

    radius: 1500,

    types: '050000',

    loading: false,

    error: '',

    result: null,

    lastResults: [], // 最近一次检索得到的列表

    recentIds: [], // 用于限制连续3次不重复（记录最近2个已推荐ID）

    // 新增：导航栏相关数据
    statusBarHeight: 20,
    navBarHeight: 64
  },



  onLoad() {

    // 获取系统信息，计算导航栏高度
    this.getSystemInfo();

    // 从本地恢复用户上次配置（可选）

    try {

      const radius = wx.getStorageSync('radius');

      const types = wx.getStorageSync('types');

      if (radius) this.setData({ radius });

      if (types) this.setData({ types });

    } catch (e) {}
  },

// 新增：获取系统信息
getSystemInfo() {
  // 方法1：使用 wx.getSystemInfo 异步获取
  wx.getSystemInfo({
    success: (res) => {
      const { statusBarHeight, platform } = res;
      let navBarHeight = 44; // 导航栏内容区域高度
      
      // 根据不同平台设置高度
      if (platform === 'android') {
        navBarHeight = 48;
      }
      
      // 计算总高度
      const totalNavHeight = statusBarHeight + navBarHeight;
      
      this.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: totalNavHeight
      });
      
      console.log('系统信息:', {
        statusBarHeight,
        platform,
        navBarHeight: totalNavHeight
      });
    },
    fail: (err) => {
      console.error('获取系统信息失败:', err);
      // 设置默认值
      this.setData({
        statusBarHeight: 20,
        navBarHeight: 64
      });
    }
  });
  
  // 方法2：或者使用 wx.getWindowInfo（新API）
  if (wx.getWindowInfo) {
    try {
      const windowInfo = wx.getWindowInfo();
      const statusBarHeight = windowInfo.statusBarHeight || 20;
      const navBarHeight = statusBarHeight + 44; // 44是导航栏内容区默认高度
      
      this.setData({
        statusBarHeight: statusBarHeight,
        navBarHeight: navBarHeight
      });
    } catch (e) {
      console.error('使用getWindowInfo失败:', e);
    }
  }
},

  onRadiusInput(e) {

    const v = Number(e.detail.value) || 1500;

    this.setData({ radius: v });

    try { wx.setStorageSync('radius', v); } catch (e) {}

  },



  onTypesInput(e) {

    const v = (e.detail.value || '050000').trim();

    this.setData({ types: v });

    try { wx.setStorageSync('types', v); } catch (e) {}

  },



  onRecommend() {

    this.fetchAndRecommend();

  },



  onReshuffle() {

    const { lastResults } = this.data;

    if (!lastResults || lastResults.length === 0) {

      this.fetchAndRecommend();

      return;

    }

    const pick = this.pickOne(lastResults);

    if (pick) {

      this.setData({ result: this.decorateResult(pick) });

      this.pushRecent(pick.id);

    } else {

      this.setData({ error: '没有可推荐的店铺，请重试' });

    }

  },



  onNavigate() {

    const { result } = this.data;

    if (!result || !result.location) return;

    const [lng, lat] = (result.location || '').split(',').map(Number);

    if (!lng || !lat) return;

    wx.openLocation({

      latitude: lat,

      longitude: lng,

      name: result.name || '目的地',

      address: result.address || ''

    });

  },



  async fetchAndRecommend() {

    this.setData({ loading: true, error: '', result: null });

    try {

      const loc = await this.ensureLocation();

      const resp = await wx.cloud.callFunction({

        name: 'poiSearch',

        data: {

          latitude: loc.latitude,

          longitude: loc.longitude,

          radius: this.data.radius,

          types: this.data.types

        }

      });

      const data = (resp && resp.result) || {};

      const list = Array.isArray(data.pois) ? data.pois : [];

      this.setData({ lastResults: list });

      const pick = this.pickOne(list);

      if (pick) {

        this.setData({ result: this.decorateResult(pick) });

        this.pushRecent(pick.id);

      } else {

        this.setData({ error: '附近没有符合条件的店铺' });

      }

    } catch (err) {

      const msg = (err && err.message) || '请求失败';

      this.setData({ error: msg });

    } finally {

      this.setData({ loading: false });

    }

  },



  ensureLocation() {

    return new Promise((resolve, reject) => {

      wx.getLocation({

        type: 'gcj02',

        isHighAccuracy: true,

        highAccuracyExpireTime: 5000,

        success: resolve,

        fail: (e) => {

          reject(new Error('获取定位失败，请在设置中授权定位权限'));

        }

      });

    });

  },



  // 距离加权随机抽样，且避免与recentIds冲突（连续3次不重复）

  pickOne(list) {

    if (!list || list.length === 0) return null;



    // 如果结果少于3个，不启用去重规则

    const enforceUnique = list.length >= 3;

    const recent = this.data.recentIds || [];



    // 生成候选与权重

    const candidates = [];

    for (const item of list) {

      const id = item.id || item.uid || `${item.location || ''}-${item.name || ''}`;

      if (enforceUnique && recent.includes(id)) {

        continue;

      }

      const d = Number(item.distance || 0);

      const w = Math.exp(-(d / DIST_SCALE));

      candidates.push({ item: { ...item, id }, w });

    }



    // 如果因为去重导致候选为空，则放宽去重

    const pool = candidates.length > 0 ? candidates : list.map(it => {

      const id = it.id || it.uid || `${it.location || ''}-${it.name || ''}`;

      const d = Number(it.distance || 0);

      const w = Math.exp(-(d / DIST_SCALE));

      return { item: { ...it, id }, w };

    });



    // 归一化加权随机

    const total = pool.reduce((s, x) => s + (x.w || 0), 0) || 1;

    let r = Math.random() * total;

    for (const x of pool) {

      r -= x.w;

      if (r <= 0) return x.item;

    }

    return pool[pool.length - 1].item;

  },



  pushRecent(id) {

    const recent = (this.data.recentIds || []).slice();

    recent.push(id);

    while (recent.length > 2) recent.shift(); // 只保留最近2个

    this.setData({ recentIds: recent });

  },



  decorateResult(p) {

    const d = Number(p.distance || 0);

    return {

      ...p,

      _distanceText: d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m'

    }

  }

});

