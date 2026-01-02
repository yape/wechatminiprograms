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

    // 价格范围过滤
    priceMin: 0,
    priceMax: 0,

    loading: false,

    error: '',

    result: null,

    lastResults: [], // 最近一次检索得到的列表

    recentIds: [], // 用于限制连续3次不重复（记录最近2个已推荐ID）

    // 新增：导航栏相关数据
    statusBarHeight: 20,
    navBarHeight: 64,

    // 侧边栏设置
    showSettings: false,

    // 价格范围选项
    priceRanges: [
      { label: '不限', min: 0, max: 0 },
      { label: '20元以下', min: 0, max: 20 },
      { label: '20-50元', min: 20, max: 50 },
      { label: '50-100元', min: 50, max: 100 },
      { label: '100-200元', min: 100, max: 200 },
      { label: '200元以上', min: 200, max: 9999 }
    ],
    selectedPriceIndex: 0,

    // 餐饮类型选项
    foodTypes: [
      { label: '餐饮相关', value: '050000' },
      { label: '中餐厅', value: '050100' },
      { label: '综合酒楼', value: '050101' },
      { label: '四川菜(川菜)', value: '050102' },
      { label: '广东菜(粤菜)', value: '050103' },
      { label: '山东菜(鲁菜)', value: '050104' },
      { label: '江苏菜', value: '050105' },
      { label: '浙江菜', value: '050106' },
      { label: '上海菜', value: '050107' },
      { label: '湖南菜(湘菜)', value: '050108' },
      { label: '安徽菜(徽菜)', value: '050109' },
      { label: '福建菜', value: '050110' },
      { label: '北京菜', value: '050111' },
      { label: '湖北菜(鄂菜)', value: '050112' },
      { label: '东北菜', value: '050113' },
      { label: '云贵菜', value: '050114' },
      { label: '西北菜', value: '050115' },
      { label: '老字号', value: '050116' },
      { label: '火锅店', value: '050117' },
      { label: '特色/地方风味餐厅', value: '050118' },
      { label: '海鲜酒楼', value: '050119' },
      { label: '中式素菜馆', value: '050120' },
      { label: '清真菜馆', value: '050121' },
      { label: '台湾菜', value: '050122' },
      { label: '潮州菜', value: '050123' },
      { label: '外国餐厅', value: '050200' },
      { label: '西餐厅(综合风味)', value: '050201' },
      { label: '日本料理', value: '050202' },
      { label: '韩国料理', value: '050203' },
      { label: '法式菜品餐厅', value: '050204' },
      { label: '意式菜品餐厅', value: '050205' },
      { label: '泰国/越南菜品餐厅', value: '050206' },
      { label: '地中海风格菜品', value: '050207' },
      { label: '美式风味', value: '050208' },
      { label: '印度风味', value: '050209' },
      { label: '英国式菜品餐厅', value: '050210' },
      { label: '牛扒店(扒房)', value: '050211' },
      { label: '俄国菜', value: '050212' },
      { label: '葡国菜', value: '050213' },
      { label: '德国菜', value: '050214' },
      { label: '巴西菜', value: '050215' },
      { label: '墨西哥菜', value: '050216' },
      { label: '其它亚洲菜', value: '050217' },
      { label: '快餐厅', value: '050300' },
      { label: '肯德基', value: '050301' },
      { label: '麦当劳', value: '050302' },
      { label: '必胜客', value: '050303' },
      { label: '永和豆浆', value: '050304' },
      { label: '茶餐厅', value: '050305' },
      { label: '大家乐', value: '050306' },
      { label: '大快活', value: '050307' },
      { label: '美心', value: '050308' },
      { label: '吉野家', value: '050309' },
      { label: '仙跡岩', value: '050310' },
      { label: '呷哺呷哺', value: '050311' },
      { label: '休闲餐饮场所', value: '050400' },
      { label: '咖啡厅', value: '050500' },
      { label: '星巴克咖啡', value: '050501' },
      { label: '上岛咖啡', value: '050502' },
      { label: 'Pacific Coffee Company', value: '050503' },
      { label: '巴黎咖啡店', value: '050504' },
      { label: '茶艺馆', value: '050600' },
      { label: '冷饮店', value: '050700' },
      { label: '糕饼店', value: '050800' },
      { label: '甜品店', value: '050900' }
    ],
    selectedTypeIndex: 0
  },



  onLoad() {

    // 获取系统信息，计算导航栏高度
    this.getSystemInfo();

    // 从本地恢复用户上次配置（可选）

    this.loadSettings();
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

      // 根据价格范围过滤
      const filteredList = this.filterByPrice(list);

      this.setData({ lastResults: filteredList });

      const pick = this.pickOne(filteredList);

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

  },

  // 加载设置
  loadSettings() {
    try {
      const radius = wx.getStorageSync('radius');
      const types = wx.getStorageSync('types');
      const priceMin = wx.getStorageSync('priceMin');
      const priceMax = wx.getStorageSync('priceMax');
      const selectedPriceIndex = wx.getStorageSync('selectedPriceIndex');
      const selectedTypeIndex = wx.getStorageSync('selectedTypeIndex');

      if (radius) this.setData({ radius });
      if (types) this.setData({ types });
      if (priceMin !== '' && priceMin !== undefined) this.setData({ priceMin });
      if (priceMax !== '' && priceMax !== undefined) this.setData({ priceMax });
      if (selectedPriceIndex !== '' && selectedPriceIndex !== undefined) this.setData({ selectedPriceIndex });
      if (selectedTypeIndex !== '' && selectedTypeIndex !== undefined) this.setData({ selectedTypeIndex });
    } catch (e) {
      console.error('加载设置失败:', e);
    }
  },

  // 页面显示时重新加载设置（从设置页返回时）
  onShow() {
    this.loadSettings();
  },

  // 打开侧边栏设置
  onOpenSettings() {
    this.setData({ showSettings: true });
  },

  // 关闭侧边栏设置
  onCloseSettings() {
    this.setData({ showSettings: false });
  },

  // 价格范围变更
  onPriceChange(e) {
    const index = Number(e.detail.value);
    const range = this.data.priceRanges[index];
    this.setData({ 
      selectedPriceIndex: index,
      priceMin: range.min,
      priceMax: range.max
    });
    try {
      wx.setStorageSync('priceMin', range.min);
      wx.setStorageSync('priceMax', range.max);
      wx.setStorageSync('selectedPriceIndex', index);
    } catch (e) {}
    wx.showToast({ title: '已保存', icon: 'success', duration: 1000 });
  },

  // 搜索半径变更
  onRadiusChange(e) {
    const value = Number(e.detail.value) || 1500;
    this.setData({ radius: value });
    try {
      wx.setStorageSync('radius', value);
    } catch (e) {}
    wx.showToast({ title: '已保存', icon: 'success', duration: 1000 });
  },

  // 餐饮类型变更
  onTypeChange(e) {
    const index = Number(e.detail.value);
    const type = this.data.foodTypes[index];
    this.setData({ 
      selectedTypeIndex: index,
      types: type.value
    });
    try {
      wx.setStorageSync('types', type.value);
      wx.setStorageSync('selectedTypeIndex', index);
    } catch (e) {}
    wx.showToast({ title: '已保存', icon: 'success', duration: 1000 });
  },

  // 根据价格范围过滤列表
  filterByPrice(list) {
    const { priceMin, priceMax } = this.data;
    
    // 如果没有设置价格范围（都为0），返回原列表
    if (!priceMin && !priceMax) {
      return list;
    }

    return list.filter(item => {
      const cost = Number(item.cost) || 0;
      // 如果店铺没有人均消费数据，保留它
      if (!cost) return true;
      // 检查是否在价格范围内
      if (priceMin && cost < priceMin) return false;
      if (priceMax && priceMax < 9999 && cost > priceMax) return false;
      return true;
    });
  }

});