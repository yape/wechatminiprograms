// 云函数入口文件
const cloud = require('wx-server-sdk')

const https = require('https')

const querystring = require('querystring')

cloud.init()

const CPS_API_URL = 'https://xany.qzz.io/api/public/promotions';
const CLIENT_SECRET = process.env.CPS_API_SECRET;

// 全局缓存
const cache = {
  recommend: { data: null, time: 0 },
  other: { data: null, time: 0 }
};
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 获取指定类型的推荐活动（带缓存）
function getPromotionsByType(type = 'recommend') {
  const now = Date.now();
  const cacheKey = type;
  
  if (cache[cacheKey].data && (now - cache[cacheKey].time < CACHE_TTL)) {
    return Promise.resolve(cache[cacheKey].data);
  }

  const params = {
    type: type
    // 不传 keyword 获取所有
  };
  const qs = querystring.stringify(params);
  const url = `${CPS_API_URL}?${qs}`;

  return new Promise((resolve) => {
    const options = {
      headers: {
        'x-client-secret': CLIENT_SECRET
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.data) {
            cache[cacheKey].data = json.data;
            cache[cacheKey].time = Date.now();
            resolve(cache[cacheKey].data);
          } else {
            resolve([]);
          }
        } catch (e) {
          console.error(`CPS API Parse Error (${type}):`, e);
          resolve(cache[cacheKey].data || []); // 解析失败返回旧缓存或空
        }
      });
    }).on('error', (err) => {
      console.error(`CPS API Request Error (${type}):`, err);
      resolve(cache[cacheKey].data || []); // 请求失败返回旧缓存或空
    });
  });
}

function requestAMap(params) {

  const qs = querystring.stringify(params)

  const url = `https://restapi.amap.com/v3/place/around?${qs}`

  return new Promise((resolve, reject) => {

    https

      .get(url, (res) => {

        let data = ''

        res.on('data', (chunk) => (data += chunk))

        res.on('end', () => {

          try {

            const json = JSON.parse(data)

            resolve(json)

          } catch (e) {

            reject(new Error('AMap 响应解析失败'))

          }

        })
      })
      .on('error', (err) => reject(err))
  })
}

exports.main = async (event) => {
  const { action } = event || {};

  // Action: 获取所有优惠活动列表 (recommend + other)
  if (action === 'getPromotions') {
    try {
      const [recommend, other] = await Promise.all([
        getPromotionsByType('recommend'),
        getPromotionsByType('other')
      ]);
      return {
        code: 0,
        data: {
          recommend,
          other
        }
      };
    } catch (e) {
      return { code: 500, message: e.message || '获取优惠活动失败' };
    }
  }

  // Default Action: POI Search
  const { latitude, longitude, radius = 1500, types = '050000' } = event || {}

  if (!latitude || !longitude) {
    return { code: 400, message: '缺少定位信息' }
  }

  const key = process.env.GAODE_KEY
  const params = {
    key,
    location: `${longitude},${latitude}`,
    radius: String(radius),
    types,
    offset: '25',
    page: '1',
    extensions: 'all',
    sortrule: 'distance'
  }

  try {
    // 并行获取高德数据和CPS推荐数据(用于匹配)
    const [json, promotions] = await Promise.all([
      requestAMap(params),
      getPromotionsByType('recommend')
    ]);

    if (json.status !== '1') {
      return { code: 502, message: json.info || '高德接口调用失败', raw: json }
    }

    const pois = Array.isArray(json.pois) ? json.pois : []

    // 在内存中匹配
    const mapped = pois.map((p) => {
      // 匹配逻辑：poiName 包含 keyword
      const hit = promotions.find(promo => promo.keyword && p.name.includes(promo.keyword));
      
      let coupon = null;
      if (hit) {
        // 解析原始数据尝试获取更多价格信息
        let originalData = {};
        try {
          originalData = hit.original_data ? JSON.parse(hit.original_data) : {};
        } catch(e) {}

        const price = parseFloat(hit.price) || 0;
        // 尝试从original_data获取原价，如果没有则假设原价更高一点或相等
        const originalPrice = parseFloat(originalData.goods_price || originalData.original_price || price); 
        
        coupon = {
          type: 'discount', // 默认为折扣券
          title: hit.title,
          originalPrice: originalPrice,
          discountPrice: price,
          discountAmount: Number((originalPrice - price).toFixed(2)),
          discountPercent: originalPrice > 0 ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
          
          // 使用CPS链接
          cpsLink: hit.click_url,
          
          // 附加字段
          dpShopId: p.id, 
          expireDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
      }
      
      return {
        id: p.id,
        name: p.name,
        location: p.location, // lng,lat
        distance: Number(p.distance || 0),
        address: p.address,
        adname: p.adname,
        business: p.type,
        rating: p.biz_ext ? p.biz_ext.rating : null,
        cost: p.biz_ext ? p.biz_ext.cost : null,
        tag: p.tag,
        typeName: p.typecode ? p.type : '',
        // CPS优惠券信息
        coupon: coupon,
        // 优惠力度分数
        discountScore: coupon ? coupon.discountPercent : 0
      };
    });

    return { code: 0, pois: mapped }

  } catch (e) {
    return { code: 500, message: e.message || '请求异常' }
  }
}