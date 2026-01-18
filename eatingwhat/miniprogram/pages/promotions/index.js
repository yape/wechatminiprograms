Page({
  data: {
    currentTab: 'recommend', // 'recommend' | 'other'
    recommendList: [],
    otherList: [],
    currentList: [],
    loading: true
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

  onLoad() {
    // 获取系统信息，计算导航栏高度
    this.getSystemInfo();
    this.fetchPromotions();
  },

  // 切换 Tab
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;

    this.setData({
      currentTab: tab,
      currentList: tab === 'recommend' ? this.data.recommendList : this.data.otherList
    });
  },

  // 拉取数据
  async fetchPromotions() {
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'poiSearch',
        data: {
          action: 'getPromotions'
        }
      });

      const result = res.result;
      if (result && result.code === 0 && result.data) {
        const recommendList = this.processData(result.data.recommend || []);
        const otherList = this.processData(result.data.other || []);

        this.setData({
          recommendList,
          otherList,
          currentList: this.data.currentTab === 'recommend' ? recommendList : otherList
        });
      } else {
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('Fetch promotions error:', err);
      wx.showToast({
        title: '网络请求失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 数据预处理（计算折扣等）
  processData(list) {
    return list.map(item => {
      let originalData = {};
      try {
        originalData = item.original_data ? JSON.parse(item.original_data) : {};
      } catch (e) {}

      const price = parseFloat(item.price) || 0;
      // 尝试从original_data获取原价，如果没有则假设原价更高一点或相等
      // 常见的原价字段：goods_price, original_price, market_price
      let originalPrice = parseFloat(originalData.goods_price || originalData.original_price || originalData.market_price || 0);
      
      // 如果解析不出原价，且没有折扣信息，就默认原价=现价
      if (originalPrice <= price) {
        originalPrice = price;
      }

      const discountPercent = originalPrice > price 
        ? Math.round(((originalPrice - price) / originalPrice) * 100) 
        : 0;

      return {
        ...item,
        price: price.toFixed(2), // 格式化价格
        originalPrice: originalPrice > price ? originalPrice.toFixed(2) : null,
        discountPercent: discountPercent > 0 ? discountPercent : null,
        originalDataObj: originalData
      };
    });
  },

  // 点击卡片
  onItemClick(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;

    // 1. 优先尝试小程序跳转
    // 检查 click_url 是否是 miniprogram:// 协议 (我们在保存时生成的)
    if (item.click_url && item.click_url.startsWith('miniprogram://')) {
        // miniprogram://appid/path
        const withoutPrefix = item.click_url.replace('miniprogram://', '');
        // 找到第一个 / 的位置，前面是 appid，后面是 path
        const firstSlash = withoutPrefix.indexOf('/');
        if (firstSlash !== -1) {
            const appId = withoutPrefix.substring(0, firstSlash);
            const path = withoutPrefix.substring(firstSlash); // path includes /
            
            this.navigateToMiniProgram(appId, path, item);
            return;
        }
    }

    // 检查 original_data 中的 we_app_info
    const od = item.originalDataObj || {};
    if (od.we_app_info && od.we_app_info.app_id && od.we_app_info.page_path) {
        this.navigateToMiniProgram(od.we_app_info.app_id, od.we_app_info.page_path, item);
        return;
    }

    // 2. 其次尝试 H5 链接 (click_url)
    // 小程序无法直接打开外链，通常只能复制或通过 web-view (如果域名配置了)
    // 这里采用复制链接策略
    if (item.click_url) {
        this.copyLink(item.click_url);
        return;
    }

    wx.showToast({
        title: '暂无跳转链接',
        icon: 'none'
    });
  },

  navigateToMiniProgram(appId, path, item) {
    wx.navigateToMiniProgram({
        appId: appId,
        path: path,
        extraData: {
            // 传递一些通用参数，虽然目标小程序不一定用
            foo: 'bar' 
        },
        success(res) {
            // 打开成功
        },
        fail(err) {
            console.error('跳转小程序失败', err);
            // 降级：复制链接
            if (item.click_url && !item.click_url.startsWith('miniprogram://')) {
                this.copyLink(item.click_url);
            } else {
                wx.showToast({
                    title: '跳转失败，请稍后重试',
                    icon: 'none'
                });
            }
        }
    });
  },

  copyLink(content) {
      wx.setClipboardData({
          data: content,
          success: () => {
              wx.showModal({
                  title: '链接已复制',
                  content: '由于小程序限制，请粘贴链接到浏览器或对应APP中打开',
                  showCancel: false,
                  confirmText: '知道了'
              });
          }
      });
  },

  onPullDownRefresh() {
    this.fetchPromotions().then(() => {
        wx.stopPullDownRefresh();
    });
  }
});
